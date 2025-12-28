// Picking Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/picking/waves - Get all picking waves
router.get('/waves', async (req, res) => {
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

    // Get total count
    const countResult = await db.get(`SELECT COUNT(DISTINCT wave_number) as total FROM picking_tasks ${whereClause}`, params);
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
      started_at: w.created_at,
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
    console.error('Get picking waves error:', error);
    res.status(500).json({ error: 'Failed to get picking waves' });
  }
});

// GET /api/picking/waves/:id - Get single wave with tasks
router.get('/waves/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Get wave info (first task with this wave_number or id)
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

// POST /api/picking/waves/:id/start - Start a wave
router.post('/waves/:id/start', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { operator_id } = req.body;

    // Find wave by id or wave_number
    const wave = await db.get(`
      SELECT wave_number, status FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Update all tasks in this wave to in_progress
    await db.run(`
      UPDATE picking_tasks 
      SET status = 'in_progress', 
          operator = COALESCE(?, operator),
          updated_at = CURRENT_TIMESTAMP 
      WHERE wave_number = ?
    `, [operator_id, wave.wave_number]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      status: 'in_progress',
      message: 'Wave started successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Start wave error:', error);
    res.status(500).json({ error: 'Failed to start wave' });
  }
});

// POST /api/picking/waves/:id/complete - Complete a wave
router.post('/waves/:id/complete', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Find wave
    const wave = await db.get(`
      SELECT wave_number FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Update all tasks in this wave to completed
    await db.run(`
      UPDATE picking_tasks 
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
      WHERE wave_number = ?
    `, [wave.wave_number]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      status: 'completed',
      message: 'Wave completed successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Complete wave error:', error);
    res.status(500).json({ error: 'Failed to complete wave' });
  }
});

// POST /api/picking/tasks/:id/complete - Complete a single task
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { quantity_picked, picking_time_seconds } = req.body;

    // Get task
    const task = await db.get('SELECT * FROM picking_tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const pickedQty = quantity_picked !== undefined ? quantity_picked : task.quantity_to_pick;

    // Update task
    await db.run(`
      UPDATE picking_tasks 
      SET quantity_picked = ?, 
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [pickedQty, id]);

    // Update inventory (reduce quantity)
    if (task.product_reference && task.location_code) {
      await db.run(`
        UPDATE inventory 
        SET quantity = quantity - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE product_reference = ? AND location_code = ?
      `, [pickedQty, task.product_reference, task.location_code]);
    }

    // Check if all tasks in wave are completed
    const remainingTasks = await db.get(`
      SELECT COUNT(*) as count FROM picking_tasks 
      WHERE wave_number = ? AND status != 'completed'
    `, [task.wave_number]);

    const waveCompleted = remainingTasks.count === 0;

    res.json({
      success: true,
      task_id: id,
      quantity_picked: pickedQty,
      status: 'completed',
      wave_completed: waveCompleted,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// GET /api/picking/performance - Get picking performance metrics
router.get('/performance', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get total picks and quantities
    const totals = await db.get(`
      SELECT 
        COUNT(*) as total_picks,
        SUM(quantity_picked) as total_quantity,
        AVG(quantity_picked) as avg_quantity
      FROM picking_tasks
      WHERE status = 'completed'
    `);

    // Calculate average pick time (mock for now - would need actual timing data)
    const avgPickTimeSeconds = 45; // Default average
    const avgPickTimeMinutes = avgPickTimeSeconds / 60;

    res.json({
      success: true,
      total_picks: totals?.total_picks || 0,
      total_quantity: totals?.total_quantity || 0,
      average_quantity_per_pick: Math.round((totals?.avg_quantity || 0) * 100) / 100,
      average_pick_time_seconds: avgPickTimeSeconds,
      average_pick_time_minutes: Math.round(avgPickTimeMinutes * 100) / 100,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get picking performance error:', error);
    res.status(500).json({ error: 'Failed to get picking performance' });
  }
});

// POST /api/picking/waves - Create new wave
router.post('/waves', async (req, res) => {
  try {
    const db = await getDatabase();
    const { order_ids, operator_id } = req.body;

    if (!order_ids || order_ids.length === 0) {
      return res.status(400).json({ error: 'At least one order is required' });
    }

    // Generate wave number
    const waveNumber = `W${Date.now().toString().slice(-8)}`;

    // Get order items for selected orders
    const placeholders = order_ids.map(() => '?').join(',');
    const orderItems = await db.all(`
      SELECT 
        oi.product_reference,
        oi.quantity,
        oi.size,
        o.order_number
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.id IN (${placeholders})
    `, order_ids);

    if (orderItems.length === 0) {
      return res.status(400).json({ error: 'No items found in selected orders' });
    }

    // Get inventory locations for products
    let tasksCreated = 0;
    for (const item of orderItems) {
      // Find inventory location for this product
      const inventory = await db.get(`
        SELECT location_code FROM inventory 
        WHERE product_reference = ? AND quantity > 0
        LIMIT 1
      `, [item.product_reference]);

      const locationCode = inventory?.location_code || 'UNKNOWN';

      // Create picking task
      await db.run(`
        INSERT INTO picking_tasks (wave_number, product_reference, location_code, quantity_to_pick, quantity_picked, operator, size, status)
        VALUES (?, ?, ?, ?, 0, ?, ?, 'created')
      `, [waveNumber, item.product_reference, locationCode, item.quantity, operator_id, item.size]);

      tasksCreated++;
    }

    // Update orders status to assigned
    await db.run(`
      UPDATE orders SET status = 'assigned', wave_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `, [waveNumber, ...order_ids]);

    res.status(201).json({
      success: true,
      wave_number: waveNumber,
      tasks_created: tasksCreated,
      orders_assigned: order_ids.length,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Create wave error:', error);
    res.status(500).json({ error: 'Failed to create wave' });
  }
});

// GET /api/picking - Get all picking tasks
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { status, wave_number, limit = 50 } = req.query;

    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push('pt.status = ?');
      params.push(status);
    }

    if (wave_number) {
      whereConditions.push('pt.wave_number = ?');
      params.push(wave_number);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const tasks = await db.all(`
      SELECT 
        pt.*,
        p.description as product_description,
        p.abc_code,
        sl.zone
      FROM picking_tasks pt
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      ${whereClause}
      ORDER BY pt.created_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    res.json({
      success: true,
      tasks: tasks,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get picking tasks error:', error);
    res.status(500).json({ error: 'Failed to get picking tasks' });
  }
});

module.exports = router;
