// Enhanced Picking Routes - SQL Database with Improved Logic
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const { RouteOptimizationService } = require('../services/ai-route-optimization');
const router = express.Router();

// Initialize route optimization service
const routeOptimizer = new RouteOptimizationService();

// GET /api/picking/waves - Get all picking waves with enhanced filtering
router.get('/waves', async (req, res) => {
  try {
    const db = await getDatabase();
    const { status, operator, priority, limit = 50, page = 1, sort_by = 'created_at', sort_order = 'DESC' } = req.query;

    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (operator) {
      whereConditions.push('operator = ?');
      params.push(operator);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.get(`SELECT COUNT(DISTINCT wave_number) as total FROM picking_tasks ${whereClause}`, params);
    const total = countResult?.total || 0;

    // Validate sort parameters
    const validSortColumns = ['created_at', 'updated_at', 'wave_number', 'status'];
    const validSortOrders = ['ASC', 'DESC'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortOrder = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

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
        SUM(quantity_picked) as total_picked,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at,
        CASE 
          WHEN COUNT(*) = SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) THEN 'completed'
          WHEN SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) > 0 THEN 'in_progress'
          ELSE 'created'
        END as calculated_status
      FROM picking_tasks
      ${whereClause}
      GROUP BY wave_number
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Calculate completion percentage and estimated time for each wave
    const enhancedWaves = waves.map(w => {
      const completionPercentage = w.total_items > 0 ? Math.round((w.total_picked / w.total_quantity) * 100) : 0;
      const estimatedTimeMinutes = Math.ceil(w.total_items * 2.5); // 2.5 minutes per item average
      
      return {
        id: w.id,
        wave_number: w.wave_number,
        status: w.calculated_status,
        total_items: w.total_items,
        total_quantity: w.total_quantity,
        total_picked: w.total_picked || 0,
        completion_percentage: completionPercentage,
        assigned_operator_id: w.operator,
        estimated_time_minutes: estimatedTimeMinutes,
        started_at: w.created_at,
        created_at: w.created_at,
        updated_at: w.updated_at
      };
    });

    res.json({
      waves: enhancedWaves,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      sorting: {
        sort_by: sortColumn,
        sort_order: sortOrder
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get picking waves error:', error);
    res.status(500).json({ 
      error: 'Failed to get picking waves',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/picking/waves/:id - Get single wave with optimized route
router.get('/waves/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { optimize_route = 'true' } = req.query;

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
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM picking_tasks
      WHERE id = ? OR wave_number = ?
      GROUP BY wave_number
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Get all tasks for this wave with location and product details
    const tasks = await db.all(`
      SELECT 
        pt.*,
        p.description as product_description,
        p.abc_code,
        p.unit_price,
        sl.zone,
        sl.x,
        sl.y,
        sl.z,
        i.quantity as available_quantity,
        i.reserved_quantity
      FROM picking_tasks pt
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      LEFT JOIN inventory i ON pt.product_reference = i.product_reference AND pt.location_code = i.location_code
      WHERE pt.wave_number = ?
      ORDER BY sl.zone, pt.location_code, pt.id
    `, [wave.wave_number]);

    // Check for inventory issues (considering reserved quantity)
    const inventoryIssues = tasks.filter(task => {
      const available = task.available_quantity || 0;
      const reserved = task.reserved_quantity || 0;
      const netAvailable = available - reserved;
      return netAvailable < task.quantity_to_pick;
    });

    let optimizedRoute = null;
    let routeVisualization = null;

    // Generate optimized route if requested and tasks exist
    if (optimize_route === 'true' && tasks.length > 1) {
      try {
        // Get storage locations for optimization
        const storageLocations = await db.all(`
          SELECT DISTINCT location_code, x, y, z, zone 
          FROM storage_locations 
          WHERE location_code IN (${tasks.map(() => '?').join(',')})
        `, tasks.map(t => t.location_code));

        const routeResult = routeOptimizer.optimizePickingRoute(tasks, storageLocations);
        optimizedRoute = routeResult.optimized_route;
        routeVisualization = routeOptimizer.getRouteVisualization(routeResult.optimized_route);
      } catch (routeError) {
        console.warn('Route optimization failed:', routeError.message);
        // Continue without optimization
      }
    }

    // Calculate wave statistics
    const completionPercentage = wave.total_quantity > 0 ? 
      Math.round((wave.total_picked / wave.total_quantity) * 100) : 0;
    
    const estimatedTimeMinutes = Math.ceil(tasks.length * 2.5);
    const actualStatus = tasks.every(t => t.status === 'completed') ? 'completed' :
                        tasks.some(t => t.status === 'in_progress') ? 'in_progress' : 'created';

    res.json({
      wave: {
        id: wave.id,
        wave_number: wave.wave_number,
        status: actualStatus,
        total_items: wave.total_items,
        total_quantity: wave.total_quantity,
        total_picked: wave.total_picked || 0,
        completion_percentage: completionPercentage,
        assigned_operator_id: wave.operator,
        estimated_time_minutes: estimatedTimeMinutes,
        created_at: wave.created_at,
        updated_at: wave.updated_at
      },
      tasks: tasks.map(task => {
        const available = task.available_quantity || 0;
        const reserved = task.reserved_quantity || 0;
        const netAvailable = available - reserved;
        
        return {
          ...task,
          has_inventory_issue: netAvailable < task.quantity_to_pick,
          available_quantity: available,
          reserved_quantity: reserved,
          net_available: netAvailable
        };
      }),
      optimized_route: optimizedRoute,
      route_visualization: routeVisualization,
      inventory_issues: inventoryIssues.length,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get wave error:', error);
    res.status(500).json({ 
      error: 'Failed to get wave',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/picking/waves/:id/start - Start a wave with validation
router.post('/waves/:id/start', async (req, res) => {
  const db = await getDatabase();
  
  try {
    const { id } = req.params;
    const { operator_id } = req.body;

    // Validation
    if (!operator_id) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Find wave by id or wave_number
      const wave = await db.get(`
        SELECT wave_number, status FROM picking_tasks 
        WHERE id = ? OR wave_number = ?
        LIMIT 1
      `, [id, id]);

      if (!wave) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Wave not found' });
      }

      // Check if wave is already started or completed
      if (wave.status === 'in_progress') {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Wave is already in progress' });
      }

      if (wave.status === 'completed') {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Wave is already completed' });
      }

      // Verify operator exists
      const operator = await db.get('SELECT id, username FROM users WHERE id = ?', [operator_id]);
      if (!operator) {
        await db.run('ROLLBACK');
        console.error('Invalid operator ID:', operator_id);
        console.log('Available users in database:');
        const allUsers = await db.all('SELECT id, username, role FROM users');
        console.log(allUsers);
        return res.status(400).json({ 
          error: 'Invalid operator ID',
          details: `Operator ID ${operator_id} not found in database`,
          available_operators: allUsers.map(u => ({ id: u.id, username: u.username, role: u.role }))
        });
      }

      // Check inventory availability for all tasks
      const tasks = await db.all(`
        SELECT 
          pt.id,
          pt.product_reference,
          pt.location_code,
          pt.quantity_to_pick,
          i.quantity as available_quantity,
          i.reserved_quantity
        FROM picking_tasks pt
        LEFT JOIN inventory i ON pt.product_reference = i.product_reference AND pt.location_code = i.location_code
        WHERE pt.wave_number = ?
      `, [wave.wave_number]);

      const inventoryIssues = [];
      for (const task of tasks) {
        const available = task.available_quantity || 0;
        const reserved = task.reserved_quantity || 0;
        const netAvailable = available - reserved;
        
        if (netAvailable < task.quantity_to_pick) {
          inventoryIssues.push({
            task_id: task.id,
            product_reference: task.product_reference,
            location_code: task.location_code,
            required: task.quantity_to_pick,
            available: available,
            reserved: reserved,
            net_available: netAvailable
          });
        }
      }

      if (inventoryIssues.length > 0) {
        // Option 1: Auto-fix inventory (for demo/development)
        if (process.env.AUTO_FIX_INVENTORY === 'true') {
          console.log('Auto-fixing inventory issues...');
          
          for (const issue of inventoryIssues) {
            const needed = issue.required - issue.net_available;
            const newQuantity = (issue.available || 0) + needed + 5; // Add buffer
            
            if (issue.available !== null && issue.available !== undefined) {
              // Update existing inventory
              await db.run(`
                UPDATE inventory 
                SET quantity = ?
                WHERE product_reference = ? AND location_code = ?
              `, [newQuantity, issue.product_reference, issue.location_code]);
            } else {
              // Create new inventory record
              await db.run(`
                INSERT INTO inventory (product_reference, location_code, quantity, reserved_quantity)
                VALUES (?, ?, ?, 0)
              `, [issue.product_reference, issue.location_code, issue.required + 5]);
            }
          }
          
          console.log(`Auto-fixed ${inventoryIssues.length} inventory issues`);
          // Continue with wave start after fixing
        } else {
          // Normal behavior - return error
          await db.run('ROLLBACK');
          return res.status(400).json({ 
            error: 'Insufficient inventory for some items',
            inventory_issues: inventoryIssues,
            suggestion: 'Add more inventory or enable AUTO_FIX_INVENTORY=true for development'
          });
        }
      }

      // Reserve inventory for all tasks
      for (const task of tasks) {
        await db.run(`
          UPDATE inventory 
          SET reserved_quantity = reserved_quantity + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE product_reference = ? AND location_code = ?
        `, [task.quantity_to_pick, task.product_reference, task.location_code]);
      }

      // Update all tasks in this wave to in_progress
      await db.run(`
        UPDATE picking_tasks 
        SET status = 'in_progress', 
            operator = ?,
            updated_at = CURRENT_TIMESTAMP 
        WHERE wave_number = ?
      `, [operator_id, wave.wave_number]);

      // Log wave start
      await db.run(`
        INSERT INTO system_logs (level, module, message, details, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'INFO', 
        'picking', 
        `Wave ${wave.wave_number} started by ${operator.username}`,
        JSON.stringify({ wave_number: wave.wave_number, operator_id, tasks_count: tasks.length }),
        operator_id
      ]);

      await db.run('COMMIT');

      res.json({
        success: true,
        wave_number: wave.wave_number,
        status: 'in_progress',
        operator: {
          id: operator.id,
          username: operator.username
        },
        tasks_count: tasks.length,
        inventory_reserved: true,
        message: 'Wave started successfully',
        data_source: 'SQL Database'
      });

    } catch (transactionError) {
      await db.run('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Start wave error:', error);
    res.status(500).json({ 
      error: 'Failed to start wave',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

// POST /api/picking/tasks/:id/complete - Complete a single task with validation
router.post('/tasks/:id/complete', async (req, res) => {
  const db = await getDatabase();
  
  try {
    const { id } = req.params;
    const { quantity_picked, picking_time_seconds, notes } = req.body;

    // Validation
    if (quantity_picked !== undefined && quantity_picked < 0) {
      return res.status(400).json({ error: 'Quantity picked cannot be negative' });
    }

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Get task with current inventory
      const task = await db.get(`
        SELECT 
          pt.*,
          i.quantity as available_quantity,
          i.reserved_quantity
        FROM picking_tasks pt
        LEFT JOIN inventory i ON pt.product_reference = i.product_reference AND pt.location_code = i.location_code
        WHERE pt.id = ?
      `, [id]);

      if (!task) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status === 'completed') {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Task is already completed' });
      }

      const pickedQty = quantity_picked !== undefined ? quantity_picked : task.quantity_to_pick;

      // Validate picked quantity
      if (pickedQty > task.quantity_to_pick) {
        await db.run('ROLLBACK');
        return res.status(400).json({ 
          error: `Cannot pick ${pickedQty}. Only ${task.quantity_to_pick} required.`
        });
      }

      // Check if enough inventory is available
      if (!task.available_quantity || task.available_quantity < pickedQty) {
        await db.run('ROLLBACK');
        return res.status(400).json({ 
          error: `Insufficient inventory. Available: ${task.available_quantity || 0}, Required: ${pickedQty}`
        });
      }

      // Update task
      await db.run(`
        UPDATE picking_tasks 
        SET quantity_picked = ?, 
            status = 'completed',
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [pickedQty, id]);

      // Update inventory (reduce quantity and reserved quantity)
      if (task.product_reference && task.location_code) {
        await db.run(`
          UPDATE inventory 
          SET quantity = quantity - ?,
              reserved_quantity = reserved_quantity - ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE product_reference = ? AND location_code = ?
        `, [pickedQty, task.quantity_to_pick, task.product_reference, task.location_code]);
      }

      // Log the picking action
      await db.run(`
        INSERT INTO system_logs (level, module, message, details, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'INFO',
        'picking',
        `Task completed: ${task.product_reference} at ${task.location_code}`,
        JSON.stringify({ 
          task_id: id, 
          product_reference: task.product_reference,
          location_code: task.location_code,
          quantity_picked: pickedQty,
          picking_time_seconds,
          notes
        }),
        task.operator
      ]);

      // Check if all tasks in wave are completed
      const remainingTasks = await db.get(`
        SELECT COUNT(*) as count FROM picking_tasks 
        WHERE wave_number = ? AND status != 'completed'
      `, [task.wave_number]);

      const waveCompleted = remainingTasks.count === 0;

      // If wave is completed, update related orders
      if (waveCompleted) {
        await db.run(`
          UPDATE orders 
          SET status = 'picked', updated_at = CURRENT_TIMESTAMP
          WHERE wave_number = ?
        `, [task.wave_number]);

        // Log wave completion
        await db.run(`
          INSERT INTO system_logs (level, module, message, details, user_id)
          VALUES (?, ?, ?, ?, ?)
        `, [
          'INFO',
          'picking',
          `Wave completed: ${task.wave_number}`,
          JSON.stringify({ wave_number: task.wave_number }),
          task.operator
        ]);
      }

      await db.run('COMMIT');

      res.json({
        success: true,
        task_id: id,
        quantity_picked: pickedQty,
        status: 'completed',
        wave_completed: waveCompleted,
        wave_number: task.wave_number,
        picking_time_seconds: picking_time_seconds || null,
        notes: notes || null,
        data_source: 'SQL Database'
      });

    } catch (transactionError) {
      await db.run('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ 
      error: 'Failed to complete task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/picking/performance - Get enhanced picking performance metrics
router.get('/performance', async (req, res) => {
  try {
    const db = await getDatabase();
    const { period = '7d', operator_id } = req.query;

    // Simple performance metrics to avoid complex queries
    const totals = await db.get(`
      SELECT 
        COUNT(*) as total_picks,
        COALESCE(SUM(quantity_picked), 0) as total_quantity,
        COALESCE(AVG(quantity_picked), 0) as avg_quantity,
        COUNT(DISTINCT wave_number) as total_waves
      FROM picking_tasks
      WHERE status = 'completed'
    `);

    // Simple wave statistics
    const waveStats = await db.get(`
      SELECT 
        COUNT(DISTINCT wave_number) as total_waves,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN wave_number END) as completed_waves,
        COUNT(DISTINCT CASE WHEN status = 'in_progress' THEN wave_number END) as active_waves
      FROM picking_tasks
    `);

    // Calculate basic efficiency
    const avgPickTimeSeconds = 150;
    const avgPickTimeMinutes = avgPickTimeSeconds / 60;
    
    const efficiency = {
      picks_per_hour: Math.round((totals?.total_picks || 0) / 24),
      items_per_hour: Math.round((totals?.total_quantity || 0) / 24),
      wave_completion_rate: waveStats?.total_waves ? Math.round(((waveStats.completed_waves || 0) / waveStats.total_waves) * 100) : 0
    };

    res.json({
      success: true,
      period: period,
      operator_filter: operator_id || null,
      summary: {
        total_picks: totals?.total_picks || 0,
        total_quantity: totals?.total_quantity || 0,
        average_quantity_per_pick: Math.round((totals?.avg_quantity || 0) * 100) / 100,
        total_waves: totals?.total_waves || 0,
        total_operators: 1,
        average_pick_time_seconds: avgPickTimeSeconds,
        average_pick_time_minutes: Math.round(avgPickTimeMinutes * 100) / 100
      },
      efficiency: efficiency,
      wave_statistics: {
        total_waves: waveStats?.total_waves || 0,
        completed_waves: waveStats?.completed_waves || 0,
        active_waves: waveStats?.active_waves || 0,
        paused_waves: 0,
        completion_rate_percentage: efficiency.wave_completion_rate
      },
      operator_performance: [],
      zone_performance: [],
      daily_trend: [],
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get picking performance error:', error);
    res.status(500).json({ 
      error: 'Failed to get picking performance',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/picking/waves - Create new wave with enhanced validation
router.post('/waves', async (req, res) => {
  const db = await getDatabase();
  
  try {
    const { order_ids, operator_id, priority = 'medium', auto_optimize = true } = req.body;

    // Validation
    if (!order_ids || order_ids.length === 0) {
      return res.status(400).json({ error: 'At least one order is required' });
    }

    if (!operator_id) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Verify operator exists
      const operator = await db.get('SELECT id, username FROM users WHERE id = ?', [operator_id]);
      if (!operator) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Invalid operator ID' });
      }

      // Verify orders exist and are pending
      const placeholders = order_ids.map(() => '?').join(',');
      const orders = await db.all(`
        SELECT id, order_number, status FROM orders 
        WHERE id IN (${placeholders}) AND status = 'pending'
      `, order_ids);

      if (orders.length !== order_ids.length) {
        await db.run('ROLLBACK');
        return res.status(400).json({ 
          error: 'Some orders are not found or not in pending status',
          found_orders: orders.length,
          requested_orders: order_ids.length
        });
      }

      // Generate wave number
      const waveNumber = `W${Date.now().toString().slice(-8)}`;

      // Get order items for selected orders
      const orderItems = await db.all(`
        SELECT 
          oi.product_reference,
          oi.quantity,
          oi.size,
          o.order_number,
          o.priority as order_priority
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.id IN (${placeholders})
      `, order_ids);

      if (orderItems.length === 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'No items found in selected orders' });
      }

      // Group items by product and location to optimize picking
      const itemGroups = new Map();
      
      for (const item of orderItems) {
        // Find best inventory location for this product (FIFO - oldest first)
        const inventory = await db.get(`
          SELECT location_code, quantity, created_at
          FROM inventory 
          WHERE product_reference = ? AND quantity >= ?
          ORDER BY created_at ASC
          LIMIT 1
        `, [item.product_reference, item.quantity]);

        const locationCode = inventory?.location_code || 'UNKNOWN';
        const key = `${item.product_reference}-${locationCode}`;

        if (itemGroups.has(key)) {
          itemGroups.get(key).quantity += item.quantity;
          itemGroups.get(key).orders.push(item.order_number);
        } else {
          itemGroups.set(key, {
            product_reference: item.product_reference,
            location_code: locationCode,
            quantity: item.quantity,
            size: item.size,
            orders: [item.order_number],
            has_inventory: !!inventory
          });
        }
      }

      // Create picking tasks
      let tasksCreated = 0;
      const inventoryIssues = [];

      for (const [key, group] of itemGroups) {
        if (!group.has_inventory) {
          inventoryIssues.push({
            product_reference: group.product_reference,
            required_quantity: group.quantity,
            issue: 'No inventory found'
          });
          continue;
        }

        // Create picking task
        await db.run(`
          INSERT INTO picking_tasks (
            wave_number, product_reference, location_code, 
            quantity_to_pick, quantity_picked, operator, 
            size, status, created_at
          )
          VALUES (?, ?, ?, ?, 0, ?, ?, 'created', CURRENT_TIMESTAMP)
        `, [
          waveNumber, 
          group.product_reference, 
          group.location_code, 
          group.quantity, 
          operator_id, 
          group.size
        ]);

        tasksCreated++;
      }

      if (inventoryIssues.length > 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({
          error: 'Inventory issues found',
          inventory_issues: inventoryIssues
        });
      }

      // Update orders status to assigned
      await db.run(`
        UPDATE orders 
        SET status = 'assigned', 
            wave_number = ?, 
            priority = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `, [waveNumber, priority, ...order_ids]);

      // Log wave creation
      await db.run(`
        INSERT INTO system_logs (level, module, message, details, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'INFO',
        'picking',
        `Wave created: ${waveNumber}`,
        JSON.stringify({ 
          wave_number: waveNumber, 
          orders: order_ids, 
          tasks_created: tasksCreated,
          operator: operator.username
        }),
        operator_id
      ]);

      await db.run('COMMIT');

      res.status(201).json({
        success: true,
        wave_number: waveNumber,
        tasks_created: tasksCreated,
        orders_assigned: order_ids.length,
        operator: {
          id: operator.id,
          username: operator.username
        },
        priority: priority,
        auto_optimize: auto_optimize,
        data_source: 'SQL Database'
      });

    } catch (transactionError) {
      await db.run('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Create wave error:', error);
    res.status(500).json({ 
      error: 'Failed to create wave',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/picking - Get all picking tasks
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { status, wave_number, operator, limit = 50, page = 1 } = req.query;

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

    if (operator) {
      whereConditions.push('pt.operator = ?');
      params.push(operator);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.get(`SELECT COUNT(*) as total FROM picking_tasks pt ${whereClause}`, params);
    const total = countResult.total;

    // Get paginated results
    const offset = (page - 1) * limit;
    const tasks = await db.all(`
      SELECT 
        pt.*,
        p.description as product_description,
        p.abc_code,
        p.unit_price,
        sl.zone,
        sl.x,
        sl.y,
        sl.z,
        i.quantity as available_quantity,
        i.reserved_quantity,
        u.username as operator_name
      FROM picking_tasks pt
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      LEFT JOIN inventory i ON pt.product_reference = i.product_reference AND pt.location_code = i.location_code
      LEFT JOIN users u ON pt.operator = u.id
      ${whereClause}
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      tasks: tasks.map(task => {
        const available = task.available_quantity || 0;
        const reserved = task.reserved_quantity || 0;
        const netAvailable = available - reserved;
        
        return {
          ...task,
          has_inventory_issue: netAvailable < task.quantity_to_pick,
          available_quantity: available,
          reserved_quantity: reserved,
          net_available: netAvailable,
          completion_percentage: task.quantity_to_pick > 0 ? 
            Math.round((task.quantity_picked / task.quantity_to_pick) * 100) : 0
        };
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get picking tasks error:', error);
    res.status(500).json({ 
      error: 'Failed to get picking tasks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/picking/waves/:id/pause - Pause a wave
router.post('/waves/:id/pause', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { reason } = req.body;

    // Find wave
    const wave = await db.get(`
      SELECT wave_number, status FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    if (wave.status !== 'in_progress') {
      return res.status(400).json({ error: 'Wave is not in progress' });
    }

    // Update all tasks in this wave to paused
    await db.run(`
      UPDATE picking_tasks 
      SET status = 'paused', updated_at = CURRENT_TIMESTAMP 
      WHERE wave_number = ? AND status = 'in_progress'
    `, [wave.wave_number]);

    // Log pause action
    await db.run(`
      INSERT INTO system_logs (level, module, message, details)
      VALUES (?, ?, ?, ?)
    `, [
      'INFO',
      'picking',
      `Wave paused: ${wave.wave_number}`,
      JSON.stringify({ wave_number: wave.wave_number, reason: reason || 'No reason provided' })
    ]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      status: 'paused',
      reason: reason || 'No reason provided',
      message: 'Wave paused successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Pause wave error:', error);
    res.status(500).json({ 
      error: 'Failed to pause wave',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/picking/waves/:id/resume - Resume a paused wave
router.post('/waves/:id/resume', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Find wave
    const wave = await db.get(`
      SELECT wave_number, status FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    if (wave.status !== 'paused') {
      return res.status(400).json({ error: 'Wave is not paused' });
    }

    // Update all tasks in this wave to in_progress
    await db.run(`
      UPDATE picking_tasks 
      SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP 
      WHERE wave_number = ? AND status = 'paused'
    `, [wave.wave_number]);

    // Log resume action
    await db.run(`
      INSERT INTO system_logs (level, module, message, details)
      VALUES (?, ?, ?, ?)
    `, [
      'INFO',
      'picking',
      `Wave resumed: ${wave.wave_number}`,
      JSON.stringify({ wave_number: wave.wave_number })
    ]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      status: 'in_progress',
      message: 'Wave resumed successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Resume wave error:', error);
    res.status(500).json({ 
      error: 'Failed to resume wave',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/picking/waves/:id/cancel - Cancel a wave
router.post('/waves/:id/cancel', async (req, res) => {
  const db = await getDatabase();
  
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Find wave
      const wave = await db.get(`
        SELECT wave_number, status FROM picking_tasks 
        WHERE id = ? OR wave_number = ?
        LIMIT 1
      `, [id, id]);

      if (!wave) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Wave not found' });
      }

      if (wave.status === 'completed') {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Cannot cancel completed wave' });
      }

      // Get all tasks to release reservations
      const tasks = await db.all(`
        SELECT product_reference, location_code, quantity_to_pick
        FROM picking_tasks
        WHERE wave_number = ? AND status != 'completed'
      `, [wave.wave_number]);

      // Release inventory reservations
      for (const task of tasks) {
        await db.run(`
          UPDATE inventory 
          SET reserved_quantity = reserved_quantity - ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE product_reference = ? AND location_code = ?
        `, [task.quantity_to_pick, task.product_reference, task.location_code]);
      }

      // Update all tasks in this wave to cancelled
      await db.run(`
        UPDATE picking_tasks 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
        WHERE wave_number = ?
      `, [wave.wave_number]);

      // Update related orders back to pending
      await db.run(`
        UPDATE orders 
        SET status = 'pending', wave_number = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE wave_number = ?
      `, [wave.wave_number]);

      // Log cancellation
      await db.run(`
        INSERT INTO system_logs (level, module, message, details)
        VALUES (?, ?, ?, ?)
      `, [
        'WARNING',
        'picking',
        `Wave cancelled: ${wave.wave_number}`,
        JSON.stringify({ 
          wave_number: wave.wave_number, 
          reason: reason || 'No reason provided',
          tasks_cancelled: tasks.length
        })
      ]);

      await db.run('COMMIT');

      res.json({
        success: true,
        wave_number: wave.wave_number,
        status: 'cancelled',
        reason: reason || 'No reason provided',
        tasks_cancelled: tasks.length,
        inventory_released: true,
        message: 'Wave cancelled successfully',
        data_source: 'SQL Database'
      });

    } catch (transactionError) {
      await db.run('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Cancel wave error:', error);
    res.status(500).json({ 
      error: 'Failed to cancel wave',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/picking/waves/:id/optimize-route - Get optimized route for wave
router.get('/waves/:id/optimize-route', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Get wave tasks
    const tasks = await db.all(`
      SELECT 
        pt.*,
        sl.x,
        sl.y,
        sl.z,
        sl.zone
      FROM picking_tasks pt
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      WHERE pt.wave_number = ? OR pt.id = ?
      ORDER BY pt.id
    `, [id, id]);

    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Wave not found or has no tasks' });
    }

    // Get storage locations
    const storageLocations = await db.all(`
      SELECT DISTINCT location_code, x, y, z, zone 
      FROM storage_locations 
      WHERE location_code IN (${tasks.map(() => '?').join(',')})
    `, tasks.map(t => t.location_code));

    // Optimize route
    const routeResult = routeOptimizer.optimizePickingRoute(tasks, storageLocations);
    const visualization = routeOptimizer.getRouteVisualization(routeResult.optimized_route);

    res.json({
      success: true,
      wave_number: tasks[0].wave_number,
      optimized_route: routeResult.optimized_route,
      route_visualization: visualization,
      optimization_stats: {
        total_distance: routeResult.total_distance,
        generations_used: routeResult.generations_used,
        tasks_optimized: routeResult.tasks_optimized
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Optimize route error:', error);
    res.status(500).json({ 
      error: 'Failed to optimize route',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
