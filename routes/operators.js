// Operators Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');

const router = express.Router();

// GET /api/operators - Get all operators
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get operators from users table with role 'operator'
    const operators = await db.all(`
      SELECT 
        id,
        username,
        email,
        role,
        created_at
      FROM users
      WHERE role IN ('operator', 'manager', 'admin')
      ORDER BY username
    `);

    // Get performance stats for each operator
    const operatorStats = await Promise.all(operators.map(async (operator) => {
      const stats = await db.get(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(quantity_picked) as total_quantity,
          AVG(quantity_picked) as avg_quantity
        FROM picking_tasks
        WHERE operator = ?
      `, [operator.username]);

      return {
        ...operator,
        performance: {
          total_tasks: stats?.total_tasks || 0,
          total_quantity: stats?.total_quantity || 0,
          avg_quantity: Math.round((stats?.avg_quantity || 0) * 100) / 100
        }
      };
    }));

    res.json({
      operators: operatorStats,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get operators error:', error);
    res.status(500).json({ error: 'Failed to get operators' });
  }
});

// GET /api/operators/:id/performance - Get operator performance
router.get('/:id/performance', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Get operator info
    const operator = await db.get(`
      SELECT 
        id,
        username,
        email,
        role
      FROM users
      WHERE id = ? OR username = ?
    `, [id, id]);

    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }

    // Get performance metrics
    const performance = await db.get(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(quantity_to_pick) as total_quantity_assigned,
        SUM(quantity_picked) as total_quantity_picked,
        AVG(quantity_picked) as avg_quantity_per_task
      FROM picking_tasks
      WHERE operator = ?
    `, [operator.username]);

    // Get recent tasks
    const recentTasks = await db.all(`
      SELECT 
        pt.*,
        p.description as product_description,
        sl.zone
      FROM picking_tasks pt
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      WHERE pt.operator = ?
      ORDER BY pt.created_at DESC
      LIMIT 10
    `, [operator.username]);

    res.json({
      operator: operator,
      performance: {
        total_tasks: performance?.total_tasks || 0,
        total_quantity_assigned: performance?.total_quantity_assigned || 0,
        total_quantity_picked: performance?.total_quantity_picked || 0,
        avg_quantity_per_task: Math.round((performance?.avg_quantity_per_task || 0) * 100) / 100,
        completion_rate: performance?.total_quantity_assigned > 0 
          ? Math.round((performance.total_quantity_picked / performance.total_quantity_assigned) * 100)
          : 0
      },
      recent_tasks: recentTasks,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get operator performance error:', error);
    res.status(500).json({ error: 'Failed to get operator performance' });
  }
});

module.exports = router;