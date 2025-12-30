// Alert Routes - Notifications for delayed orders and other issues
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

// GET /api/alerts/delayed-orders - Get orders that have been pending too long
router.get('/delayed-orders', async (req, res) => {
  try {
    const db = await getDatabase();
    const { threshold_hours = 24 } = req.query;

    // Get orders that have been pending for more than threshold hours
    const delayedOrders = await db.all(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.priority,
        o.created_at,
        COUNT(oi.id) as total_items,
        SUM(oi.quantity) as total_quantity,
        ROUND((julianday('now') - julianday(o.created_at)) * 24, 1) as hours_waiting
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'pending'
        AND (julianday('now') - julianday(o.created_at)) * 24 > ?
      GROUP BY o.id
      HAVING total_items > 0
      ORDER BY hours_waiting DESC
      LIMIT 100
    `, [threshold_hours]);

    // Categorize by severity
    const critical = delayedOrders.filter(o => o.hours_waiting > 72); // > 3 days
    const warning = delayedOrders.filter(o => o.hours_waiting > 48 && o.hours_waiting <= 72); // 2-3 days
    const info = delayedOrders.filter(o => o.hours_waiting > 24 && o.hours_waiting <= 48); // 1-2 days

    res.json({
      success: true,
      threshold_hours: parseFloat(threshold_hours),
      total_delayed: delayedOrders.length,
      severity: {
        critical: critical.length,
        warning: warning.length,
        info: info.length
      },
      orders: delayedOrders.map(o => ({
        ...o,
        severity: o.hours_waiting > 72 ? 'critical' : 
                 o.hours_waiting > 48 ? 'warning' : 'info',
        message: `Order ${o.order_number} has been waiting for ${o.hours_waiting} hours`
      })),
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get delayed orders error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get delayed orders' 
    });
  }
});

// GET /api/alerts/summary - Get summary of all alerts
router.get('/summary', async (req, res) => {
  try {
    const db = await getDatabase();

    // Delayed orders (pending > 24 hours)
    const delayedOrders = await db.get(`
      SELECT COUNT(*) as count
      FROM orders o
      WHERE o.status = 'pending'
        AND (julianday('now') - julianday(o.created_at)) * 24 > 24
        AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
    `);

    // Low stock items
    const lowStock = await db.get(`
      SELECT COUNT(DISTINCT product_reference) as count
      FROM inventory
      WHERE (quantity - COALESCE(reserved_quantity, 0)) < 10
        AND (quantity - COALESCE(reserved_quantity, 0)) > 0
    `);

    // Out of stock items
    const outOfStock = await db.get(`
      SELECT COUNT(DISTINCT product_reference) as count
      FROM inventory
      WHERE (quantity - COALESCE(reserved_quantity, 0)) <= 0
    `);

    // Stalled waves (in_progress > 4 hours)
    const stalledWaves = await db.get(`
      SELECT COUNT(DISTINCT wave_number) as count
      FROM picking_tasks
      WHERE status = 'in_progress'
        AND (julianday('now') - julianday(updated_at)) * 24 > 4
    `);

    // Over-reserved inventory
    const overReserved = await db.get(`
      SELECT COUNT(*) as count
      FROM inventory
      WHERE reserved_quantity > quantity
    `);

    res.json({
      success: true,
      alerts: {
        delayed_orders: delayedOrders.count || 0,
        low_stock: lowStock.count || 0,
        out_of_stock: outOfStock.count || 0,
        stalled_waves: stalledWaves.count || 0,
        over_reserved: overReserved.count || 0
      },
      total_alerts: (delayedOrders.count || 0) + 
                   (lowStock.count || 0) + 
                   (outOfStock.count || 0) + 
                   (stalledWaves.count || 0) + 
                   (overReserved.count || 0),
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get alerts summary error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get alerts summary' 
    });
  }
});

// GET /api/alerts/low-stock - Get low stock items
router.get('/low-stock', async (req, res) => {
  try {
    const db = await getDatabase();
    const { threshold = 10 } = req.query;

    const lowStockItems = await db.all(`
      SELECT 
        i.product_reference,
        p.description,
        p.abc_code,
        SUM(i.quantity) as total_quantity,
        SUM(i.reserved_quantity) as total_reserved,
        SUM(i.quantity - COALESCE(i.reserved_quantity, 0)) as available,
        COUNT(DISTINCT i.location_code) as location_count
      FROM inventory i
      LEFT JOIN products p ON i.product_reference = p.reference
      GROUP BY i.product_reference
      HAVING available < ? AND available > 0
      ORDER BY available ASC
      LIMIT 50
    `, [threshold]);

    res.json({
      success: true,
      threshold: parseInt(threshold),
      total_items: lowStockItems.length,
      items: lowStockItems,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get low stock items' 
    });
  }
});

// GET /api/alerts/stalled-waves - Get waves that are stalled
router.get('/stalled-waves', async (req, res) => {
  try {
    const db = await getDatabase();
    const { threshold_hours = 4 } = req.query;

    const stalledWaves = await db.all(`
      SELECT 
        pt.wave_number,
        pt.status,
        pt.operator,
        u.username as operator_name,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN pt.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        MIN(pt.created_at) as started_at,
        MAX(pt.updated_at) as last_updated,
        ROUND((julianday('now') - julianday(MAX(pt.updated_at))) * 24, 1) as hours_stalled
      FROM picking_tasks pt
      LEFT JOIN users u ON pt.operator = u.id
      WHERE pt.status = 'in_progress'
      GROUP BY pt.wave_number
      HAVING hours_stalled > ?
      ORDER BY hours_stalled DESC
    `, [threshold_hours]);

    res.json({
      success: true,
      threshold_hours: parseFloat(threshold_hours),
      total_stalled: stalledWaves.length,
      waves: stalledWaves,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get stalled waves error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get stalled waves' 
    });
  }
});

module.exports = router;
