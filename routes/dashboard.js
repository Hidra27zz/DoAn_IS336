// Dashboard Routes - Analytics & Reporting with Real Data
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// GET /api/dashboard/kpis - Get real KPI metrics
router.get('/kpis', authMiddleware, async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Total Orders
    const totalOrders = await db.get(`
      SELECT COUNT(*) as total FROM orders
    `);
    
    // Total Waves Created
    const totalWaves = await db.get(`
      SELECT COUNT(*) as total FROM picking_waves
    `);
    
    // Picking Completion Rate
    const pickingStats = await db.get(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        ROUND(CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS FLOAT) / COUNT(*) * 100, 2) as completion_rate
      FROM picking_tasks
    `);
    
    // Stock Alerts (low stock items)
    const stockAlerts = await db.get(`
      SELECT COUNT(DISTINCT i.product_reference) as alert_count
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      WHERE (i.quantity - i.reserved_quantity) < 10
    `);
    
    // Today's Orders
    const todayOrders = await db.get(`
      SELECT COUNT(*) as today_count
      FROM orders
      WHERE DATE(created_at) = DATE('now')
    `);
    
    // Active Waves
    const activeWaves = await db.get(`
      SELECT COUNT(*) as active_count
      FROM picking_waves
      WHERE status IN ('created', 'released', 'in_progress')
    `);
    
    // Storage Utilization
    const storageUtil = await db.get(`
      SELECT 
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(CAST(SUM(current_occupancy) AS FLOAT) / SUM(capacity) * 100, 2) as utilization_rate
      FROM storage_locations
      WHERE status = 'active'
    `);
    
    // Pending Orders
    const pendingOrders = await db.get(`
      SELECT COUNT(*) as pending_count
      FROM orders
      WHERE status = 'pending'
    `);

    res.json({
      success: true,
      data: {
        total_orders: totalOrders.total,
        total_waves: totalWaves.total,
        picking_completion_rate: pickingStats.completion_rate || 0,
        stock_alerts: stockAlerts.alert_count,
        today_orders: todayOrders.today_count,
        active_waves: activeWaves.active_count,
        storage_utilization: storageUtil.utilization_rate || 0,
        pending_orders: pendingOrders.pending_count,
        completed_tasks: pickingStats.completed_tasks,
        total_tasks: pickingStats.total_tasks
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch KPIs',
      details: error.message
    });
  }
});

// GET /api/dashboard/charts - Get chart data
router.get('/charts', authMiddleware, async (req, res) => {
  try {
    const db = await getDatabase();
    const { type = 'orders_by_day', days = 7 } = req.query;

    let chartData = {};

    switch (type) {
      case 'orders_by_day':
        chartData = await getOrdersByDay(db, parseInt(days));
        break;
      
      case 'pick_rate_by_day':
        chartData = await getPickRateByDay(db, parseInt(days));
        break;
      
      case 'top_products':
        chartData = await getTopProducts(db, parseInt(days));
        break;
      
      case 'zone_utilization':
        chartData = await getZoneUtilization(db);
        break;
      
      case 'operator_performance':
        chartData = await getOperatorPerformance(db, parseInt(days));
        break;
      
      case 'wave_status':
        chartData = await getWaveStatus(db);
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid chart type'
        });
    }

    res.json({
      success: true,
      type: type,
      data: chartData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chart data',
      details: error.message
    });
  }
});

// GET /api/dashboard/activities - Get recent activities
router.get('/activities', authMiddleware, async (req, res) => {
  try {
    const db = await getDatabase();
    const { limit = 20 } = req.query;

    const activities = await db.all(`
      SELECT 
        id,
        level,
        module,
        message,
        details,
        user_id,
        created_at
      FROM system_logs
      ORDER BY created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    // Get user info for activities
    const activitiesWithUsers = await Promise.all(
      activities.map(async (activity) => {
        if (activity.user_id) {
          const user = await db.get('SELECT username FROM users WHERE id = ?', [activity.user_id]);
          return {
            ...activity,
            username: user?.username || 'Unknown'
          };
        }
        return {
          ...activity,
          username: 'System'
        };
      })
    );

    res.json({
      success: true,
      data: activitiesWithUsers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities',
      details: error.message
    });
  }
});

// Helper functions for chart data

async function getOrdersByDay(db, days) {
  const data = await db.all(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as order_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
    FROM orders
    WHERE created_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [days]);

  return {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Total Orders',
        data: data.map(d => d.order_count)
      },
      {
        label: 'Completed',
        data: data.map(d => d.completed_count)
      },
      {
        label: 'Pending',
        data: data.map(d => d.pending_count)
      }
    ]
  };
}

async function getPickRateByDay(db, days) {
  const data = await db.all(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_picks,
      SUM(quantity_picked) as total_quantity,
      ROUND(AVG(quantity_picked), 2) as avg_quantity,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_picks
    FROM picking_tasks
    WHERE created_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [days]);

  return {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Total Picks',
        data: data.map(d => d.total_picks)
      },
      {
        label: 'Completed Picks',
        data: data.map(d => d.completed_picks)
      },
      {
        label: 'Total Quantity',
        data: data.map(d => d.total_quantity)
      }
    ]
  };
}

async function getTopProducts(db, days) {
  const data = await db.all(`
    SELECT 
      pt.product_reference,
      p.description,
      COUNT(*) as pick_count,
      SUM(pt.quantity_picked) as total_quantity
    FROM picking_tasks pt
    JOIN products p ON pt.product_reference = p.reference
    WHERE pt.created_at >= DATE('now', '-' || ? || ' days')
      AND pt.status = 'completed'
    GROUP BY pt.product_reference, p.description
    ORDER BY total_quantity DESC
    LIMIT 10
  `, [days]);

  return {
    labels: data.map(d => d.product_reference),
    products: data.map(d => ({
      reference: d.product_reference,
      description: d.description,
      pick_count: d.pick_count,
      total_quantity: d.total_quantity
    }))
  };
}

async function getZoneUtilization(db) {
  const data = await db.all(`
    SELECT 
      zone,
      COUNT(*) as location_count,
      SUM(capacity) as total_capacity,
      SUM(current_occupancy) as total_occupancy,
      ROUND(CAST(SUM(current_occupancy) AS FLOAT) / SUM(capacity) * 100, 2) as utilization_rate
    FROM storage_locations
    WHERE status = 'active'
    GROUP BY zone
    ORDER BY zone
  `);

  return {
    labels: data.map(d => `Zone ${d.zone}`),
    datasets: [
      {
        label: 'Utilization Rate (%)',
        data: data.map(d => d.utilization_rate)
      }
    ],
    zones: data
  };
}

async function getOperatorPerformance(db, days) {
  const data = await db.all(`
    SELECT 
      pt.operator,
      u.username,
      COUNT(*) as tasks_completed,
      SUM(pt.quantity_picked) as total_quantity,
      ROUND(AVG(pt.quantity_picked), 2) as avg_quantity_per_task
    FROM picking_tasks pt
    JOIN users u ON pt.operator = u.id
    WHERE pt.created_at >= DATE('now', '-' || ? || ' days')
      AND pt.status = 'completed'
      AND pt.operator IS NOT NULL
    GROUP BY pt.operator, u.username
    ORDER BY tasks_completed DESC
    LIMIT 10
  `, [days]);

  return {
    labels: data.map(d => d.username),
    operators: data
  };
}

async function getWaveStatus(db) {
  const data = await db.all(`
    SELECT 
      status,
      COUNT(*) as count
    FROM picking_waves
    GROUP BY status
    ORDER BY status
  `);

  return {
    labels: data.map(d => d.status),
    data: data.map(d => d.count),
    waves: data
  };
}

module.exports = router;
