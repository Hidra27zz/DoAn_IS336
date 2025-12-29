// Timeline Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');

const router = express.Router();

// GET /api/timeline - Get timeline events
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { product_reference, location_code, limit = 50 } = req.query;

    let events = [];

    // Get inventory movements (mock for now)
    if (product_reference) {
      const inventoryEvents = await db.all(`
        SELECT 
          'inventory_update' as type,
          created_at as date,
          product_reference,
          location_code,
          quantity,
          'Inventory updated' as description
        FROM inventory
        WHERE product_reference = ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [product_reference, parseInt(limit)]);

      events = events.concat(inventoryEvents);
    }

    // Get picking events
    const pickingEvents = await db.all(`
      SELECT 
        'picking_task' as type,
        created_at as date,
        product_reference,
        location_code,
        quantity_picked as quantity,
        wave_number,
        'Picking task completed' as description
      FROM picking_tasks
      WHERE status = 'completed'
      ${product_reference ? 'AND product_reference = ?' : ''}
      ${location_code ? 'AND location_code = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `, [
      ...(product_reference ? [product_reference] : []),
      ...(location_code ? [location_code] : []),
      parseInt(limit)
    ]);

    events = events.concat(pickingEvents);

    // Sort all events by date
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limit final results
    events = events.slice(0, parseInt(limit));

    res.json({
      timeline: events,
      summary: {
        total_events: events.length,
        date_range: events.length > 0 ? {
          start: events[events.length - 1].date,
          end: events[0].date
        } : null
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

module.exports = router;