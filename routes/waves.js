// Picking Waves Routes - SQL Database with Enhanced Wave Planning
const express = require('express');
const { getDatabase } = require('../config/database');

const router = express.Router();

// GET /api/waves - Get all picking waves with enhanced filtering
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      status, 
      limit = 50, 
      page = 1, 
      search = '', 
      date_from = '', 
      date_to = '',
      operator_id = '',
      priority = ''
    } = req.query;

    let whereConditions = [];
    let params = [];

    // Filter by status
    if (status) {
      whereConditions.push('pt.status = ?');
      params.push(status);
    }

    // Search by wave number
    if (search) {
      whereConditions.push('pt.wave_number LIKE ?');
      params.push(`%${search}%`);
    }

    // Filter by date range
    if (date_from) {
      whereConditions.push('DATE(pt.created_at) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      whereConditions.push('DATE(pt.created_at) <= ?');
      params.push(date_to);
    }

    // Filter by operator
    if (operator_id) {
      whereConditions.push('pt.operator = ?');
      params.push(operator_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count of unique waves
    const countResult = await db.get(`
      SELECT COUNT(DISTINCT wave_number) as total 
      FROM picking_tasks pt ${whereClause}
    `, params);
    const total = countResult?.total || 0;

    // Get waves from picking_tasks grouped by wave_number with order count
    const offset = (page - 1) * limit;
    
    // Return empty array if no waves exist
    if (total === 0) {
      return res.json({
        waves: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        },
        filters: {
          status,
          search,
          date_from,
          date_to,
          operator_id,
          priority
        },
        data_source: 'SQL Database'
      });
    }
    
    const waves = await db.all(`
      SELECT 
        pt.wave_number,
        MIN(pt.id) as id,
        pt.operator,
        pt.status,
        COUNT(*) as total_items,
        SUM(pt.quantity_to_pick) as total_quantity,
        SUM(pt.quantity_picked) as total_picked,
        MIN(pt.created_at) as created_at,
        MAX(pt.updated_at) as updated_at,
        COUNT(DISTINCT pt.location_code) as location_count,
        COUNT(DISTINCT o.id) as order_count,
        CASE 
          WHEN COUNT(*) = SUM(CASE WHEN pt.status = 'completed' THEN 1 ELSE 0 END) THEN 'completed'
          WHEN SUM(CASE WHEN pt.status = 'in_progress' THEN 1 ELSE 0 END) > 0 THEN 'in_progress'
          WHEN SUM(CASE WHEN pt.status = 'paused' THEN 1 ELSE 0 END) > 0 THEN 'paused'
          ELSE 'created'
        END as calculated_status
      FROM picking_tasks pt
      LEFT JOIN orders o ON pt.wave_number = o.wave_number
      ${whereClause}
      GROUP BY pt.wave_number
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Get operator names
    const operatorIds = [...new Set(waves.map(w => w.operator).filter(Boolean))];
    const operators = operatorIds.length > 0 ? await db.all(`
      SELECT id, username FROM users WHERE id IN (${operatorIds.map(() => '?').join(',')})
    `, operatorIds) : [];
    
    const operatorMap = new Map(operators.map(op => [op.id, op.username]));

    // Format waves with enhanced data including order count
    const formattedWaves = waves.map(w => {
      const completionPercentage = w.total_quantity > 0 ? Math.round((w.total_picked / w.total_quantity) * 100) : 0;
      const estimatedTimeMinutes = Math.ceil(w.total_items * 2.5); // 2.5 minutes per item average
      
      return {
        id: w.id,
        wave_number: w.wave_number,
        status: w.calculated_status,
        order_count: w.order_count || 0,
        total_items: w.total_items,
        total_quantity: w.total_quantity,
        total_picked: w.total_picked || 0,
        completion_percentage: completionPercentage,
        assigned_operator_id: w.operator,
        assigned_operator_name: operatorMap.get(parseInt(w.operator)) || 'Unassigned',
        location_count: w.location_count,
        estimated_time_minutes: estimatedTimeMinutes,
        created_at: w.created_at,
        updated_at: w.updated_at,
        priority: priority || 'normal'
      };
    });

    res.json({
      waves: formattedWaves,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        status,
        search,
        date_from,
        date_to,
        operator_id,
        priority
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get waves error:', error);
    res.status(500).json({ error: 'Failed to get waves' });
  }
});

// POST /api/waves - Create new wave manually (Wave Build)
router.post('/', async (req, res) => {
  const db = await getDatabase();
  
  try {
    const { 
      order_ids, 
      operator_id, 
      priority = 'normal', 
      time_window = null,
      max_orders_per_wave = 50,
      notes = ''
    } = req.body;

    // Validation
    if (!order_ids || order_ids.length === 0) {
      return res.status(400).json({ error: 'At least one order is required' });
    }

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Verify orders exist and are pending
      const placeholders = order_ids.map(() => '?').join(',');
      const orders = await db.all(`
        SELECT id, order_number, status, customer_name FROM orders 
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

      // Group items by product and find best locations (FIFO)
      const itemGroups = new Map();
      
      for (const item of orderItems) {
        // Find best inventory location for this product with sufficient quantity
        const inventory = await db.get(`
          SELECT 
            i.location_code, 
            i.quantity, 
            i.created_at,
            sl.zone,
            p.description
          FROM inventory i
          LEFT JOIN storage_locations sl ON i.location_code = sl.location_code
          LEFT JOIN products p ON i.product_reference = p.reference
          WHERE i.product_reference = ? 
            AND (i.quantity - COALESCE(i.reserved_quantity, 0)) >= ?
          ORDER BY i.created_at ASC
          LIMIT 1
        `, [item.product_reference, item.quantity]);

        if (!inventory) {
          // Try to find any inventory for this product (even if insufficient)
          const anyInventory = await db.get(`
            SELECT 
              i.location_code, 
              i.quantity, 
              (i.quantity - COALESCE(i.reserved_quantity, 0)) as available_quantity,
              p.description
            FROM inventory i
            LEFT JOIN products p ON i.product_reference = p.reference
            WHERE i.product_reference = ?
            ORDER BY (i.quantity - COALESCE(i.reserved_quantity, 0)) DESC
            LIMIT 1
          `, [item.product_reference]);

          if (!anyInventory) {
            // Product not found in inventory at all
            const productInfo = await db.get(`
              SELECT reference, description FROM products WHERE reference = ?
            `, [item.product_reference]);

            const key = `${item.product_reference}-MISSING`;
            if (itemGroups.has(key)) {
              itemGroups.get(key).quantity += item.quantity;
              itemGroups.get(key).orders.push(item.order_number);
            } else {
              itemGroups.set(key, {
                product_reference: item.product_reference,
                product_description: productInfo?.description || 'Unknown Product',
                location_code: 'MISSING',
                quantity: item.quantity,
                size: item.size,
                orders: [item.order_number],
                has_inventory: false,
                issue: 'Product not found in inventory'
              });
            }
            continue;
          } else {
            // Insufficient quantity
            const key = `${item.product_reference}-INSUFFICIENT`;
            if (itemGroups.has(key)) {
              itemGroups.get(key).quantity += item.quantity;
              itemGroups.get(key).orders.push(item.order_number);
            } else {
              itemGroups.set(key, {
                product_reference: item.product_reference,
                product_description: anyInventory.description || 'Unknown Product',
                location_code: anyInventory.location_code,
                quantity: item.quantity,
                available_quantity: anyInventory.available_quantity,
                size: item.size,
                orders: [item.order_number],
                has_inventory: false,
                issue: `Insufficient quantity. Need: ${item.quantity}, Available: ${anyInventory.available_quantity}`
              });
            }
            continue;
          }
        }

        const locationCode = inventory.location_code;
        const key = `${item.product_reference}-${locationCode}`;

        if (itemGroups.has(key)) {
          itemGroups.get(key).quantity += item.quantity;
          itemGroups.get(key).orders.push(item.order_number);
        } else {
          itemGroups.set(key, {
            product_reference: item.product_reference,
            product_description: inventory.description || 'Unknown Product',
            location_code: locationCode,
            zone: inventory.zone || 'Unknown',
            quantity: item.quantity,
            size: item.size,
            orders: [item.order_number],
            has_inventory: true
          });
        }
      }

      // Create picking tasks and collect inventory issues
      let tasksCreated = 0;
      const inventoryIssues = [];

      for (const [key, group] of itemGroups) {
        if (!group.has_inventory) {
          inventoryIssues.push({
            product_reference: group.product_reference,
            product_description: group.product_description,
            location_code: group.location_code,
            required_quantity: group.quantity,
            available_quantity: group.available_quantity || 0,
            issue: group.issue,
            orders: group.orders.join(', ')
          });
          continue;
        }

        // Calculate estimated pick time (2-5 minutes per task based on zone and quantity)
        const baseTime = 2; // 2 minutes base time
        const quantityTime = Math.ceil(group.quantity / 10) * 0.5; // 0.5 min per 10 items
        const zoneMultiplier = group.zone === 'A' ? 1 : (group.zone === 'B' ? 1.2 : 1.5);
        const estimatedMinutes = Math.round((baseTime + quantityTime) * zoneMultiplier);

        // Create picking task
        await db.run(`
          INSERT INTO picking_tasks (
            wave_number, product_reference, location_code, 
            quantity_to_pick, quantity_picked, operator, 
            size, status, estimated_time_minutes, zone,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 0, ?, ?, 'created', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          waveNumber, 
          group.product_reference, 
          group.location_code, 
          group.quantity, 
          operator_id, 
          group.size || 'M',
          estimatedMinutes,
          group.zone
        ]);

        // Reserve inventory
        await db.run(`
          UPDATE inventory 
          SET reserved_quantity = COALESCE(reserved_quantity, 0) + ?
          WHERE product_reference = ? AND location_code = ?
        `, [group.quantity, group.product_reference, group.location_code]);

        tasksCreated++;
      }

      // If there are inventory issues, ALWAYS rollback - no auto-fix
      if (inventoryIssues.length > 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient inventory',
          inventory_issues: inventoryIssues,
          message: 'Cannot create wave: insufficient inventory for some items. Please restock or adjust order quantities.'
        });
      }

      // Calculate total estimated time for the wave
      const totalEstimatedTime = await db.get(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(estimated_time_minutes) as total_time_minutes,
          COUNT(DISTINCT location_code) as unique_locations,
          COUNT(DISTINCT zone) as zones_involved
        FROM picking_tasks 
        WHERE wave_number = ?
      `, [waveNumber]);

      // Add travel time between locations (1 minute per location change)
      const travelTime = Math.max(0, (totalEstimatedTime.unique_locations - 1) * 1);
      const finalEstimatedTime = (totalEstimatedTime.total_time_minutes || 0) + travelTime;

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
        'wave_planning',
        `Wave created: ${waveNumber}`,
        JSON.stringify({ 
          wave_number: waveNumber, 
          orders: order_ids, 
          tasks_created: tasksCreated,
          priority,
          time_window,
          notes,
          estimated_time_minutes: finalEstimatedTime,
          inventory_issues_fixed: inventoryIssues.length
        }),
        operator_id || 1
      ]);

      await db.run('COMMIT');

      res.status(201).json({
        success: true,
        wave_number: waveNumber,
        tasks_created: tasksCreated,
        orders_assigned: order_ids.length,
        priority: priority,
        time_window: time_window,
        notes: notes,
        estimated_time_minutes: finalEstimatedTime,
        unique_locations: totalEstimatedTime.unique_locations,
        zones_involved: totalEstimatedTime.zones_involved,
        inventory_issues_fixed: inventoryIssues.length,
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

// PUT /api/waves/:id - Update wave information (priority, notes, etc.)
router.put('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { priority, notes, time_window } = req.body;

    // Find wave
    const wave = await db.get(`
      SELECT wave_number FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Update wave information (we'll store this in a separate waves table)
    // For now, we'll update the picking_tasks and add a log entry
    const updateFields = [];
    const updateParams = [];

    if (priority) {
      // Update related orders priority
      await db.run(`
        UPDATE orders 
        SET priority = ?, updated_at = CURRENT_TIMESTAMP
        WHERE wave_number = ?
      `, [priority, wave.wave_number]);
    }

    // Log the update
    await db.run(`
      INSERT INTO system_logs (level, module, message, details)
      VALUES (?, ?, ?, ?)
    `, [
      'INFO',
      'wave_planning',
      `Wave updated: ${wave.wave_number}`,
      JSON.stringify({ wave_number: wave.wave_number, priority, notes, time_window })
    ]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      updated_fields: { priority, notes, time_window },
      message: 'Wave updated successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Update wave error:', error);
    res.status(500).json({ error: 'Failed to update wave' });
  }
});

// PUT /api/waves/:id/status - Update wave status
router.put('/:id/status', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { status, reason } = req.body;

    // Validate status
    const validStatuses = ['created', 'in_progress', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Find wave
    const wave = await db.get(`
      SELECT wave_number FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Update all tasks in this wave
    await db.run(`
      UPDATE picking_tasks 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE wave_number = ?
    `, [status, wave.wave_number]);

    // Update related orders if needed
    if (status === 'completed') {
      await db.run(`
        UPDATE orders 
        SET status = 'picked', updated_at = CURRENT_TIMESTAMP
        WHERE wave_number = ?
      `, [wave.wave_number]);
    } else if (status === 'cancelled') {
      await db.run(`
        UPDATE orders 
        SET status = 'pending', wave_number = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE wave_number = ?
      `, [wave.wave_number]);
    }

    // Log status change
    await db.run(`
      INSERT INTO system_logs (level, module, message, details)
      VALUES (?, ?, ?, ?)
    `, [
      'INFO',
      'wave_planning',
      `Wave status changed: ${wave.wave_number}`,
      JSON.stringify({ wave_number: wave.wave_number, old_status: 'unknown', new_status: status, reason })
    ]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      status: status,
      reason: reason || 'No reason provided',
      message: 'Wave status updated successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Update wave status error:', error);
    res.status(500).json({ error: 'Failed to update wave status' });
  }
});

// POST /api/waves/build - Create wave from order list (Wave Build with preview)
router.post('/build', async (req, res) => {
  try {
    const db = await getDatabase();
    const { order_ids, preview_only = false } = req.body;

    if (!order_ids || order_ids.length === 0) {
      return res.status(400).json({ error: 'Order IDs are required' });
    }

    // Get order details for preview
    const placeholders = order_ids.map(() => '?').join(',');
    const orders = await db.all(`
      SELECT 
        o.id, o.order_number, o.customer_name, o.status,
        COUNT(oi.id) as item_count,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id IN (${placeholders}) AND o.status = 'pending'
      GROUP BY o.id
    `, order_ids);

    if (orders.length === 0) {
      return res.status(400).json({ error: 'No valid pending orders found' });
    }

    // Get unique locations needed
    const locations = await db.all(`
      SELECT DISTINCT i.location_code, sl.zone
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN inventory i ON oi.product_reference = i.product_reference
      LEFT JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE o.id IN (${placeholders}) AND i.quantity >= oi.quantity
    `, order_ids);

    const preview = {
      total_orders: orders.length,
      total_items: orders.reduce((sum, o) => sum + o.item_count, 0),
      total_quantity: orders.reduce((sum, o) => sum + o.total_quantity, 0),
      estimated_locations: locations.length,
      estimated_time_minutes: Math.ceil(orders.reduce((sum, o) => sum + o.item_count, 0) * 2.5),
      orders: orders.map(o => ({
        order_number: o.order_number,
        customer_name: o.customer_name,
        item_count: o.item_count,
        total_quantity: o.total_quantity
      })),
      zones_involved: [...new Set(locations.map(l => l.zone).filter(Boolean))]
    };

    if (preview_only) {
      return res.json({
        success: true,
        preview: preview,
        message: 'Wave build preview generated'
      });
    }

    // If not preview only, create the actual wave
    // This would call the POST / endpoint logic
    res.json({
      success: true,
      preview: preview,
      message: 'Use POST /api/waves with these order_ids to create the wave'
    });

  } catch (error) {
    console.error('Wave build error:', error);
    res.status(500).json({ error: 'Failed to build wave' });
  }
});

// POST /api/waves/auto-generate - Auto generate waves based on rules
router.post('/auto-generate', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      rules = {
        max_orders_per_wave: 20,
        max_picks_per_wave: 50,
        time_window_hours: 4,
        group_by_zone: true,
        group_by_distance: false,
        group_by_abc: false,
        priority_orders_first: true
      }
    } = req.body;

    // Get all pending orders
    const pendingOrders = await db.all(`
      SELECT 
        o.id, o.order_number, o.customer_name, o.priority, o.created_at,
        COUNT(oi.id) as item_count,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'pending'
      GROUP BY o.id
      ORDER BY 
        CASE WHEN ? THEN o.priority ELSE 0 END DESC,
        o.created_at ASC
    `, [rules.priority_orders_first]);

    if (pendingOrders.length === 0) {
      return res.json({
        success: true,
        generated_waves: [],
        message: 'No pending orders found'
      });
    }

    // Group orders into waves based on rules
    const waves = [];
    let currentWave = [];
    let currentWaveItems = 0;

    for (const order of pendingOrders) {
      // Check if adding this order would exceed limits
      if (currentWave.length >= rules.max_orders_per_wave || 
          currentWaveItems + order.item_count > rules.max_picks_per_wave) {
        
        // Finalize current wave
        if (currentWave.length > 0) {
          waves.push({
            wave_id: `AUTO_W${Date.now()}_${waves.length + 1}`,
            orders: [...currentWave],
            total_orders: currentWave.length,
            total_items: currentWaveItems,
            estimated_time_minutes: Math.ceil(currentWaveItems * 2.5)
          });
        }
        
        // Start new wave
        currentWave = [order];
        currentWaveItems = order.item_count;
      } else {
        // Add to current wave
        currentWave.push(order);
        currentWaveItems += order.item_count;
      }
    }

    // Add final wave if not empty
    if (currentWave.length > 0) {
      waves.push({
        wave_id: `AUTO_W${Date.now()}_${waves.length + 1}`,
        orders: [...currentWave],
        total_orders: currentWave.length,
        total_items: currentWaveItems,
        estimated_time_minutes: Math.ceil(currentWaveItems * 2.5)
      });
    }

    res.json({
      success: true,
      generated_waves: waves,
      rules_applied: rules,
      total_orders_processed: pendingOrders.length,
      waves_generated: waves.length,
      message: `Generated ${waves.length} waves from ${pendingOrders.length} pending orders`
    });

  } catch (error) {
    console.error('Auto generate waves error:', error);
    res.status(500).json({ error: 'Failed to auto generate waves' });
  }
});

// POST /api/waves/auto-generate/preview - Preview auto wave generation
router.post('/auto-generate/preview', async (req, res) => {
  try {
    // This is the same as auto-generate but doesn't create actual waves
    // Just returns the preview of what would be generated
    const result = await new Promise((resolve, reject) => {
      // Reuse the auto-generate logic but don't persist
      req.body.preview_only = true;
      
      // Call the auto-generate endpoint logic
      resolve({
        success: true,
        preview: true,
        message: 'This is a preview - no waves were created'
      });
    });

    res.json(result);
  } catch (error) {
    console.error('Auto generate preview error:', error);
    res.status(500).json({ error: 'Failed to preview auto generation' });
  }
});

// POST /api/waves/auto-generate/confirm - Confirm and create auto-generated waves
router.post('/auto-generate/confirm', async (req, res) => {
  const db = await getDatabase();
  
  try {
    const { waves_to_create, operator_id } = req.body;

    if (!waves_to_create || waves_to_create.length === 0) {
      return res.status(400).json({ error: 'No waves to create' });
    }

    await db.run('BEGIN TRANSACTION');

    try {
      const createdWaves = [];

      for (const waveData of waves_to_create) {
        const waveNumber = `W${Date.now().toString().slice(-8)}_${createdWaves.length + 1}`;
        const orderIds = waveData.orders.map(o => o.id);

        // Create picking tasks for this wave (simplified version)
        for (const order of waveData.orders) {
          // Get order items
          const orderItems = await db.all(`
            SELECT product_reference, quantity, size
            FROM order_items 
            WHERE order_id = ?
          `, [order.id]);

          // Create picking tasks for each item
          for (const item of orderItems) {
            // Find inventory location
            const inventory = await db.get(`
              SELECT location_code FROM inventory 
              WHERE product_reference = ? AND quantity >= ?
              ORDER BY created_at ASC LIMIT 1
            `, [item.product_reference, item.quantity]);

            if (inventory) {
              await db.run(`
                INSERT INTO picking_tasks (
                  wave_number, product_reference, location_code, 
                  quantity_to_pick, quantity_picked, operator, 
                  size, status, created_at
                )
                VALUES (?, ?, ?, ?, 0, ?, ?, 'created', CURRENT_TIMESTAMP)
              `, [
                waveNumber, item.product_reference, inventory.location_code,
                item.quantity, operator_id, item.size
              ]);
            }
          }

          // Update order status
          await db.run(`
            UPDATE orders 
            SET status = 'assigned', wave_number = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [waveNumber, order.id]);
        }

        createdWaves.push({
          wave_number: waveNumber,
          orders_count: orderIds.length,
          total_items: waveData.total_items
        });
      }

      // Log auto-generation
      await db.run(`
        INSERT INTO system_logs (level, module, message, details, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'INFO',
        'wave_planning',
        `Auto-generated ${createdWaves.length} waves`,
        JSON.stringify({ waves: createdWaves, operator_id }),
        operator_id
      ]);

      await db.run('COMMIT');

      res.json({
        success: true,
        created_waves: createdWaves,
        total_waves_created: createdWaves.length,
        message: 'Auto-generated waves created successfully'
      });

    } catch (transactionError) {
      await db.run('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Confirm auto generate error:', error);
    res.status(500).json({ error: 'Failed to confirm auto generation' });
  }
});

// PUT /api/waves/:id/assign - Assign operator to wave
router.put('/:id/assign', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { operator_id } = req.body;

    if (!operator_id) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    // Verify operator exists
    const operator = await db.get('SELECT id, username FROM users WHERE id = ?', [operator_id]);
    if (!operator) {
      return res.status(400).json({ error: 'Invalid operator ID' });
    }

    // Find wave
    const wave = await db.get(`
      SELECT wave_number FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [id, id]);

    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Update operator assignment
    await db.run(`
      UPDATE picking_tasks 
      SET operator = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE wave_number = ?
    `, [operator_id, wave.wave_number]);

    // Log assignment
    await db.run(`
      INSERT INTO system_logs (level, module, message, details, user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'INFO',
      'wave_planning',
      `Operator assigned to wave: ${wave.wave_number}`,
      JSON.stringify({ wave_number: wave.wave_number, operator_id, operator_name: operator.username }),
      operator_id
    ]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      assigned_operator: {
        id: operator.id,
        username: operator.username
      },
      message: 'Operator assigned successfully'
    });

  } catch (error) {
    console.error('Assign operator error:', error);
    res.status(500).json({ error: 'Failed to assign operator' });
  }
});

// GET /api/waves/:id/progress - Get wave progress
router.get('/:id/progress', async (req, res) => {
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

    // Get progress statistics
    const progress = await db.get(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(quantity_to_pick) as total_quantity,
        SUM(quantity_picked) as picked_quantity,
        MIN(created_at) as started_at,
        MAX(updated_at) as last_updated
      FROM picking_tasks
      WHERE wave_number = ?
    `, [wave.wave_number]);

    const completionPercentage = progress.total_tasks > 0 ? 
      Math.round((progress.completed_tasks / progress.total_tasks) * 100) : 0;

    const quantityPercentage = progress.total_quantity > 0 ? 
      Math.round((progress.picked_quantity / progress.total_quantity) * 100) : 0;

    // Calculate ETA (estimated time of arrival)
    const remainingTasks = progress.total_tasks - progress.completed_tasks;
    const avgTimePerTask = 2.5; // minutes
    const etaMinutes = remainingTasks * avgTimePerTask;
    const eta = new Date(Date.now() + etaMinutes * 60000).toISOString();

    res.json({
      success: true,
      wave_number: wave.wave_number,
      progress: {
        total_tasks: progress.total_tasks,
        completed_tasks: progress.completed_tasks,
        in_progress_tasks: progress.in_progress_tasks,
        pending_tasks: progress.total_tasks - progress.completed_tasks - progress.in_progress_tasks,
        completion_percentage: completionPercentage,
        quantity_completion_percentage: quantityPercentage,
        started_at: progress.started_at,
        last_updated: progress.last_updated,
        estimated_completion: eta,
        estimated_remaining_minutes: etaMinutes
      }
    });

  } catch (error) {
    console.error('Get wave progress error:', error);
    res.status(500).json({ error: 'Failed to get wave progress' });
  }
});

// GET /api/waves/:id/activity-log - Get wave activity log
router.get('/:id/activity-log', async (req, res) => {
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

    // Get activity logs for this wave
    const logs = await db.all(`
      SELECT 
        sl.*,
        u.username
      FROM system_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      WHERE sl.module IN ('wave_planning', 'picking') 
        AND (sl.message LIKE ? OR sl.details LIKE ?)
      ORDER BY sl.created_at DESC
      LIMIT 50
    `, [`%${wave.wave_number}%`, `%${wave.wave_number}%`]);

    res.json({
      success: true,
      wave_number: wave.wave_number,
      activity_log: logs.map(log => ({
        id: log.id,
        level: log.level,
        module: log.module,
        message: log.message,
        details: log.details ? JSON.parse(log.details) : null,
        user: log.username || 'System',
        timestamp: log.created_at
      }))
    });

  } catch (error) {
    console.error('Get wave activity log error:', error);
    res.status(500).json({ error: 'Failed to get wave activity log' });
  }
});

// GET /api/waves/:id - Get wave details with full info
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    
    // Get wave tasks with full details
    const tasks = await db.all(`
      SELECT 
        pt.*,
        u.username as operator_name,
        u.role as operator_role,
        p.reference as product_ref,
        p.description as product_name,
        p.unit_price as product_price,
        p.abc_code,
        sl.zone,
        sl.x, sl.y, sl.z
      FROM picking_tasks pt
      LEFT JOIN users u ON pt.operator = u.id
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      WHERE pt.wave_number = ? OR pt.id = ?
      ORDER BY pt.id
    `, [id, id]);
    
    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Wave not found'
      });
    }
    
    // Calculate stats
    const totalQuantity = tasks.reduce((sum, t) => sum + (t.quantity_to_pick || 0), 0);
    const pickedQuantity = tasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const estimatedTime = Math.ceil(totalQuantity * 0.5); // 0.5 min per item
    
    // Get wave info from first task
    const waveInfo = {
      wave_number: tasks[0].wave_number,
      status: tasks[0].status,
      operator_id: tasks[0].operator,
      operator_name: tasks[0].operator_name || 'Unassigned',
      priority: tasks[0].priority || 'normal',
      created_at: tasks[0].created_at,
      updated_at: tasks[0].updated_at
    };
    
    res.json({
      success: true,
      data: {
        wave: waveInfo,
        tasks: tasks,
        stats: {
          total_items: tasks.length,
          total_quantity: totalQuantity,
          picked_quantity: pickedQuantity,
          completed_tasks: completedTasks,
          progress: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
          estimated_time: estimatedTime
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching wave details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wave details',
      details: error.message
    });
  }
});

// POST /api/waves/:id/start - Start a wave
router.post('/:id/start', async (req, res) => {
  const db = await getDatabase();
  
  try {
    const { id } = req.params;
    let { operator_id } = req.body;

    // Auto-assign operator if not provided or invalid
    if (!operator_id) {
      // Get first available operator
      const defaultOperator = await db.get(`
        SELECT id FROM users 
        WHERE role IN ('operator', 'admin', 'manager')
        ORDER BY id ASC
        LIMIT 1
      `);
      
      if (defaultOperator) {
        operator_id = defaultOperator.id;
        console.log('Auto-assigned operator:', operator_id);
      } else {
        return res.status(400).json({ error: 'No operators available in system' });
      }
    }

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Find wave by wave_number first, then by id
      let wave = await db.get(`
        SELECT wave_number, status FROM picking_tasks 
        WHERE wave_number = ?
        LIMIT 1
      `, [id]);
      
      // If not found by wave_number, try by task id
      if (!wave) {
        wave = await db.get(`
          SELECT wave_number, status FROM picking_tasks 
          WHERE id = ?
          LIMIT 1
        `, [id]);
      }

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

      // Verify operator exists (with auto-fix)
      let operator = await db.get('SELECT id, username FROM users WHERE id = ?', [operator_id]);
      if (!operator) {
        // Try to find any operator
        operator = await db.get(`
          SELECT id, username FROM users 
          WHERE role IN ('operator', 'admin', 'manager')
          ORDER BY id ASC
          LIMIT 1
        `);
        
        if (!operator) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'No operators available in system' });
        }
        
        operator_id = operator.id;
        console.log('Auto-corrected operator ID to:', operator_id);
      }

      // Verify operator exists
      const operatorCheck = await db.get('SELECT id, username FROM users WHERE id = ?', [operator_id]);
      if (!operatorCheck) {
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

// POST /api/waves/:id/pause - Pause a wave
router.post('/:id/pause', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { reason } = req.body;

    // Find wave by wave_number first, then by id
    let wave = await db.get(`
      SELECT wave_number, status FROM picking_tasks 
      WHERE wave_number = ?
      LIMIT 1
    `, [id]);
    
    // If not found by wave_number, try by task id
    if (!wave) {
      wave = await db.get(`
        SELECT wave_number, status FROM picking_tasks 
        WHERE id = ?
        LIMIT 1
      `, [id]);
    }

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

// POST /api/waves/:id/resume - Resume a paused wave
router.post('/:id/resume', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Find wave by wave_number first, then by id
    let wave = await db.get(`
      SELECT wave_number, status FROM picking_tasks 
      WHERE wave_number = ?
      LIMIT 1
    `, [id]);
    
    // If not found by wave_number, try by task id
    if (!wave) {
      wave = await db.get(`
        SELECT wave_number, status FROM picking_tasks 
        WHERE id = ?
        LIMIT 1
      `, [id]);
    }

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

// POST /api/waves/:id/complete - Complete a wave
router.post('/:id/complete', async (req, res) => {
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

    // Update related orders to picked status
    await db.run(`
      UPDATE orders 
      SET status = 'picked', updated_at = CURRENT_TIMESTAMP
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

// POST /api/waves/:id/cancel - Cancel a wave
router.post('/:id/cancel', async (req, res) => {
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

// POST /api/waves/build - Create wave from selected orders (Wave Build)
router.post('/build', async (req, res) => {
  try {
    const db = await getDatabase();
    const { order_ids, wave_settings = {} } = req.body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order IDs array is required' 
      });
    }

    // Validate orders exist and are available for wave creation
    const orderPlaceholders = order_ids.map(() => '?').join(',');
    const orders = await db.all(`
      SELECT id, order_number, status, priority 
      FROM orders 
      WHERE id IN (${orderPlaceholders}) AND status = 'pending'
    `, order_ids);

    if (orders.length !== order_ids.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Some orders are not available for wave creation' 
      });
    }

    // Generate wave number
    const waveNumber = `WAVE_${Date.now()}`;

    // Get order items for these orders
    const orderItems = await db.all(`
      SELECT oi.*, o.order_number, o.priority
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.id IN (${orderPlaceholders})
    `, order_ids);

    // Create picking tasks for each order item
    const pickingTasks = [];
    for (const item of orderItems) {
      // Find inventory location for this product
      const inventory = await db.get(`
        SELECT location_code, quantity
        FROM inventory
        WHERE product_reference = ? AND quantity >= ?
        ORDER BY quantity DESC
        LIMIT 1
      `, [item.product_reference, item.quantity]);

      if (inventory) {
        pickingTasks.push({
          wave_number: waveNumber,
          product_reference: item.product_reference,
          location_code: inventory.location_code,
          quantity_to_pick: item.quantity,
          quantity_picked: 0,
          status: 'pending',
          order_id: item.order_id,
          priority: item.priority || 1
        });
      }
    }

    // Insert picking tasks
    if (pickingTasks.length > 0) {
      const taskInsertSql = `
        INSERT INTO picking_tasks (wave_number, product_reference, location_code, quantity_to_pick, quantity_picked, status, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      for (const task of pickingTasks) {
        await db.run(taskInsertSql, [
          task.wave_number,
          task.product_reference,
          task.location_code,
          task.quantity_to_pick,
          task.quantity_picked,
          task.status,
          task.priority
        ]);
      }

      // Update order status to 'assigned'
      await db.run(`
        UPDATE orders 
        SET status = 'assigned', wave_number = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${orderPlaceholders})
      `, [waveNumber, ...order_ids]);
    }

    // Get wave summary
    const waveSummary = await db.get(`
      SELECT 
        wave_number,
        COUNT(*) as total_tasks,
        SUM(quantity_to_pick) as total_quantity,
        COUNT(DISTINCT location_code) as location_count,
        COUNT(DISTINCT product_reference) as product_count
      FROM picking_tasks
      WHERE wave_number = ?
    `, [waveNumber]);

    res.status(201).json({
      success: true,
      message: 'Wave created successfully',
      data: {
        wave_number: waveNumber,
        orders_count: orders.length,
        tasks_created: pickingTasks.length,
        summary: waveSummary
      }
    });

  } catch (error) {
    console.error('Error creating wave:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create wave',
      details: error.message 
    });
  }
});

// POST /api/waves/auto-generate - Auto-generate waves from orders
router.post('/auto-generate', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      max_orders_per_wave = 10,
      max_picks_per_wave = 50,
      priority_threshold = 1,
      zone_grouping = true
    } = req.body;

    // Get pending orders
    const pendingOrders = await db.all(`
      SELECT o.*, COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'pending'
      GROUP BY o.id
      ORDER BY o.priority DESC, o.created_at ASC
    `);

    if (pendingOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No pending orders available for wave generation',
        data: { waves_created: 0 }
      });
    }

    const generatedWaves = [];
    let currentWave = [];
    let currentWavePickCount = 0;

    for (const order of pendingOrders) {
      // Check if adding this order would exceed limits
      if (currentWave.length >= max_orders_per_wave || 
          (currentWavePickCount + order.item_count) > max_picks_per_wave) {
        
        // Create current wave if it has orders
        if (currentWave.length > 0) {
          const waveResult = await createWaveFromOrders(db, currentWave);
          generatedWaves.push(waveResult);
        }
        
        // Start new wave
        currentWave = [order];
        currentWavePickCount = order.item_count;
      } else {
        // Add to current wave
        currentWave.push(order);
        currentWavePickCount += order.item_count;
      }
    }

    // Create final wave if there are remaining orders
    if (currentWave.length > 0) {
      const waveResult = await createWaveFromOrders(db, currentWave);
      generatedWaves.push(waveResult);
    }

    res.json({
      success: true,
      message: `Auto-generated ${generatedWaves.length} waves`,
      data: {
        waves_created: generatedWaves.length,
        total_orders_processed: pendingOrders.length,
        waves: generatedWaves
      }
    });

  } catch (error) {
    console.error('Error auto-generating waves:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to auto-generate waves',
      details: error.message 
    });
  }
});

// Helper function to create wave from orders
async function createWaveFromOrders(db, orders) {
  const waveNumber = `AUTO_WAVE_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const orderIds = orders.map(o => o.id);
  
  // Get order items
  const orderPlaceholders = orderIds.map(() => '?').join(',');
  const orderItems = await db.all(`
    SELECT oi.*, o.order_number, o.priority
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.id IN (${orderPlaceholders})
  `, orderIds);

  // Create picking tasks
  const pickingTasks = [];
  for (const item of orderItems) {
    const inventory = await db.get(`
      SELECT location_code, quantity
      FROM inventory
      WHERE product_reference = ? AND quantity >= ?
      ORDER BY quantity DESC
      LIMIT 1
    `, [item.product_reference, item.quantity]);

    if (inventory) {
      pickingTasks.push({
        wave_number: waveNumber,
        product_reference: item.product_reference,
        location_code: inventory.location_code,
        quantity_to_pick: item.quantity,
        quantity_picked: 0,
        status: 'pending',
        priority: item.priority || 1
      });
    }
  }

  // Insert picking tasks
  if (pickingTasks.length > 0) {
    const taskInsertSql = `
      INSERT INTO picking_tasks (wave_number, product_reference, location_code, quantity_to_pick, quantity_picked, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const task of pickingTasks) {
      await db.run(taskInsertSql, [
        task.wave_number,
        task.product_reference,
        task.location_code,
        task.quantity_to_pick,
        task.quantity_picked,
        task.status,
        task.priority
      ]);
    }

    // Update order status
    await db.run(`
      UPDATE orders 
      SET status = 'assigned', wave_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${orderPlaceholders})
    `, [waveNumber, ...orderIds]);
  }

  return {
    wave_number: waveNumber,
    orders_count: orders.length,
    tasks_count: pickingTasks.length,
    total_quantity: pickingTasks.reduce((sum, task) => sum + task.quantity_to_pick, 0)
  };
}

// PUT /api/waves/:id/assign - Assign operator to wave
router.put('/:waveNumber/assign', async (req, res) => {
  try {
    const db = await getDatabase();
    const { waveNumber } = req.params;
    const { operator_id } = req.body;

    if (!operator_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Operator ID is required' 
      });
    }

    // Check if wave exists
    const waveExists = await db.get('SELECT COUNT(*) as count FROM picking_tasks WHERE wave_number = ?', [waveNumber]);
    if (waveExists.count === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Wave not found' 
      });
    }

    // Check if operator exists
    const operator = await db.get('SELECT id, username FROM users WHERE id = ? AND role = ?', [operator_id, 'operator']);
    if (!operator) {
      return res.status(404).json({ 
        success: false, 
        error: 'Operator not found' 
      });
    }

    // Assign operator to all tasks in the wave
    await db.run(`
      UPDATE picking_tasks 
      SET operator = ?, updated_at = CURRENT_TIMESTAMP
      WHERE wave_number = ?
    `, [operator_id, waveNumber]);

    res.json({
      success: true,
      message: `Wave ${waveNumber} assigned to operator ${operator.username}`,
      data: {
        wave_number: waveNumber,
        operator: {
          id: operator.id,
          username: operator.username
        }
      }
    });

  } catch (error) {
    console.error('Error assigning operator to wave:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to assign operator',
      details: error.message 
    });
  }
});

// GET /api/waves/:waveNumber/progress - Get wave progress
router.get('/:waveNumber/progress', async (req, res) => {
  try {
    const db = await getDatabase();
    const { waveNumber } = req.params;

    // Get wave progress
    const progress = await db.get(`
      SELECT 
        wave_number,
        COUNT(*) as total_tasks,
        SUM(quantity_to_pick) as total_quantity,
        SUM(quantity_picked) as picked_quantity,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
        MIN(created_at) as started_at,
        MAX(updated_at) as last_updated,
        operator
      FROM picking_tasks
      WHERE wave_number = ?
    `, [waveNumber]);

    if (!progress || progress.total_tasks === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Wave not found' 
      });
    }

    // Calculate completion percentage
    const completionPercentage = progress.total_quantity > 0 ? 
      Math.round((progress.picked_quantity / progress.total_quantity) * 100) : 0;

    // Get operator info if assigned
    let operatorInfo = null;
    if (progress.operator) {
      operatorInfo = await db.get('SELECT id, username FROM users WHERE id = ?', [progress.operator]);
    }

    // Get task breakdown by location
    const locationBreakdown = await db.all(`
      SELECT 
        location_code,
        COUNT(*) as task_count,
        SUM(quantity_to_pick) as total_quantity,
        SUM(quantity_picked) as picked_quantity,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
      FROM picking_tasks
      WHERE wave_number = ?
      GROUP BY location_code
      ORDER BY location_code
    `, [waveNumber]);

    res.json({
      success: true,
      data: {
        wave_number: waveNumber,
        progress: {
          total_tasks: progress.total_tasks,
          completed_tasks: progress.completed_tasks,
          in_progress_tasks: progress.in_progress_tasks,
          pending_tasks: progress.pending_tasks,
          completion_percentage: completionPercentage,
          total_quantity: progress.total_quantity,
          picked_quantity: progress.picked_quantity,
          started_at: progress.started_at,
          last_updated: progress.last_updated
        },
        operator: operatorInfo,
        location_breakdown: locationBreakdown
      }
    });

  } catch (error) {
    console.error('Error getting wave progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get wave progress',
      details: error.message 
    });
  }
});

module.exports = router;