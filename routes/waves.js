// Picking Waves Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');

const router = express.Router();

// GET /api/waves - Get all picking waves
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { status, limit = 50, page = 1 } = req.query;

    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count of unique waves
    const countResult = await db.get(`
      SELECT COUNT(DISTINCT wave_number) as total 
      FROM picking_tasks ${whereClause}
    `, params);
    const total = countResult?.total || 0;

    // Get waves from picking_tasks grouped by wave_number
    const offset = (page - 1) * limit;
    const waves = await db.all(`
      SELECT 
        wave_number,
        MIN(id) as id,
        operator,
        status,
        COUNT(*) as total_items,
        SUM(quantity_to_pick) as total_quantity,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM picking_tasks
      ${whereClause}
      GROUP BY wave_number
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Format waves
    const formattedWaves = waves.map(w => ({
      id: w.id,
      wave_number: w.wave_number,
      status: w.status || 'created',
      total_items: w.total_items,
      total_quantity: w.total_quantity,
      assigned_operator_id: w.operator,
      created_at: w.created_at,
      updated_at: w.updated_at
    }));

    res.json({
      waves: formattedWaves,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get waves error:', error);
    res.status(500).json({ error: 'Failed to get waves' });
  }
});

// GET /api/waves/:id - Get single wave with tasks
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Get wave info
    const wave = await db.get(`
      SELECT 
        wave_number,
        MIN(id) as id,
        operator,
        status,
        COUNT(*) as total_items,
        SUM(quantity_to_pick) as total_quantity,
        SUM(quantity_picked) as total_picked,
        MIN(created_at) as created_at
      FROM picking_tasks
      WHERE id = ? OR wave_number = ?
      GROUP BY wave_number
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Get all tasks for this wave
    const tasks = await db.all(`
      SELECT 
        pt.*,
        p.description as product_description,
        p.abc_code,
        sl.zone
      FROM picking_tasks pt
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      WHERE pt.wave_number = ?
      ORDER BY sl.zone, pt.location_code
    `, [wave.wave_number]);

    res.json({
      wave: {
        id: wave.id,
        wave_number: wave.wave_number,
        status: wave.status || 'created',
        total_items: wave.total_items,
        total_quantity: wave.total_quantity,
        total_picked: wave.total_picked || 0,
        assigned_operator_id: wave.operator,
        created_at: wave.created_at
      },
      tasks: tasks,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get wave error:', error);
    res.status(500).json({ error: 'Failed to get wave' });
  }
});

module.exports = router;