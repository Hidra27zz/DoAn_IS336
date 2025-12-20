// Wave Planning Routes
const express = require('express');
const router = express.Router();
const db = require('../database/firebase-connection');

// GET /api/waves - Get all waves with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      status_filter = '', 
      operator_filter = '',
      date_from = '',
      date_to = ''
    } = req.query;

    let waves = await db.getAllWaves();

    // Apply filters
    if (search) {
      waves = waves.filter(w => 
        w.wave_id.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status_filter) {
      waves = waves.filter(w => w.status === status_filter);
    }

    if (operator_filter) {
      waves = waves.filter(w => w.operator_id === operator_filter);
    }

    if (date_from) {
      waves = waves.filter(w => new Date(w.created_date) >= new Date(date_from));
    }

    if (date_to) {
      waves = waves.filter(w => new Date(w.created_date) <= new Date(date_to));
    }

    // Sort by date (newest first)
    waves.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedWaves = waves.slice(startIndex, endIndex);

    res.json({
      waves: paginatedWaves,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(waves.length / limit),
        total_items: waves.length,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get waves error:', error);
    res.status(500).json({ error: 'Failed to get waves' });
  }
});

// GET /api/waves/summary - Get wave statistics
router.get('/summary', async (req, res) => {
  try {
    const waves = await db.getAllWaves();
    const pickingTasks = await db.getAllPickingTasks();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const stats = {
      total_waves: waves.length,
      today_waves: waves.filter(w => w.created_date && w.created_date.startsWith(todayStr)).length,
      pending_waves: waves.filter(w => w.status === 'pending').length,
      in_progress_waves: waves.filter(w => w.status === 'in_progress').length,
      completed_waves: waves.filter(w => w.status === 'completed').length,
      total_tasks: pickingTasks.length,
      completed_tasks: pickingTasks.filter(t => t.status === 'completed').length
    };

    // Operator statistics
    const operatorStats = {};
    waves.forEach(wave => {
      if (wave.operator_id) {
        if (!operatorStats[wave.operator_id]) {
          operatorStats[wave.operator_id] = {
            total_waves: 0,
            completed_waves: 0
          };
        }
        operatorStats[wave.operator_id].total_waves++;
        if (wave.status === 'completed') {
          operatorStats[wave.operator_id].completed_waves++;
        }
      }
    });

    // Top operators
    const topOperators = Object.entries(operatorStats)
      .map(([operator, stats]) => ({ 
        operator, 
        ...stats,
        completion_rate: stats.total_waves > 0 ? (stats.completed_waves / stats.total_waves * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.completed_waves - a.completed_waves)
      .slice(0, 10);

    res.json({
      ...stats,
      top_operators: topOperators
    });
  } catch (error) {
    console.error('Get wave summary error:', error);
    res.status(500).json({ error: 'Failed to get wave summary' });
  }
});

// GET /api/waves/:id - Get wave details with tasks
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const wave = await db.getWaveById(id);
    
    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Get picking tasks for this wave
    const tasks = await db.getPickingTasksByWave(wave.wave_id);
    
    res.json({
      ...wave,
      tasks: tasks
    });
  } catch (error) {
    console.error('Get wave details error:', error);
    res.status(500).json({ error: 'Failed to get wave details' });
  }
});

// POST /api/waves - Create new wave
router.post('/', async (req, res) => {
  try {
    const {
      operator_id,
      priority,
      notes,
      order_ids
    } = req.body;

    // Validate required fields
    if (!operator_id) {
      return res.status(400).json({ 
        error: 'Operator ID is required' 
      });
    }

    // Generate wave ID
    const waveCount = (await db.getAllWaves()).length;
    const wave_id = `WAVE-${Date.now()}-${String(waveCount + 1).padStart(4, '0')}`;

    const waveData = {
      wave_id,
      operator_id,
      priority: priority || 'medium',
      status: 'pending',
      notes: notes || '',
      created_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newWave = await db.createWave(waveData);

    // If order IDs provided, create picking tasks
    if (order_ids && order_ids.length > 0) {
      const orders = await db.getAllOrders();
      const selectedOrders = orders.filter(o => order_ids.includes(o.id));
      
      for (const order of selectedOrders) {
        const taskData = {
          wave_id: wave_id,
          product_reference: order.product_reference,
          quantity: order.quantity,
          location_id: null, // Will be assigned based on inventory
          operator_id: operator_id,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        
        await db.createPickingTask(taskData);
      }
    }
    
    res.status(201).json({
      message: 'Wave created successfully',
      wave: newWave
    });
  } catch (error) {
    console.error('Create wave error:', error);
    res.status(500).json({ error: 'Failed to create wave' });
  }
});

// PUT /api/waves/:id - Update wave
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Add updated timestamp
    updateData.updated_at = new Date().toISOString();

    const updatedWave = await db.updateWave(id, updateData);
    
    if (!updatedWave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    res.json({
      message: 'Wave updated successfully',
      wave: updatedWave
    });
  } catch (error) {
    console.error('Update wave error:', error);
    res.status(500).json({ error: 'Failed to update wave' });
  }
});

// DELETE /api/waves/:id - Delete wave
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const wave = await db.getWaveById(id);
    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    // Delete associated picking tasks first
    await db.deletePickingTasksByWave(wave.wave_id);
    
    // Delete wave
    const deleted = await db.deleteWave(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    res.json({ message: 'Wave deleted successfully' });
  } catch (error) {
    console.error('Delete wave error:', error);
    res.status(500).json({ error: 'Failed to delete wave' });
  }
});

// POST /api/waves/:id/start - Start wave execution
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    const wave = await db.getWaveById(id);
    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    if (wave.status !== 'pending') {
      return res.status(400).json({ error: 'Wave is not in pending status' });
    }

    // Update wave status
    await db.updateWave(id, { 
      status: 'in_progress',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Update all tasks in this wave to in_progress
    const tasks = await db.getPickingTasksByWave(wave.wave_id);
    for (const task of tasks) {
      await db.updatePickingTask(task.id, { 
        status: 'in_progress',
        started_at: new Date().toISOString()
      });
    }

    res.json({ message: 'Wave started successfully' });
  } catch (error) {
    console.error('Start wave error:', error);
    res.status(500).json({ error: 'Failed to start wave' });
  }
});

// POST /api/waves/:id/complete - Complete wave
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    const wave = await db.getWaveById(id);
    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }

    if (wave.status !== 'in_progress') {
      return res.status(400).json({ error: 'Wave is not in progress' });
    }

    // Check if all tasks are completed
    const tasks = await db.getPickingTasksByWave(wave.wave_id);
    const incompleteTasks = tasks.filter(t => t.status !== 'completed');
    
    if (incompleteTasks.length > 0) {
      return res.status(400).json({ 
        error: `Cannot complete wave. ${incompleteTasks.length} tasks are still incomplete.`,
        incomplete_tasks: incompleteTasks.length
      });
    }

    // Update wave status
    await db.updateWave(id, { 
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    res.json({ message: 'Wave completed successfully' });
  } catch (error) {
    console.error('Complete wave error:', error);
    res.status(500).json({ error: 'Failed to complete wave' });
  }
});

// GET /api/waves/operators/list - Get unique operators
router.get('/operators/list', async (req, res) => {
  try {
    const waves = await db.getAllWaves();
    const operators = [...new Set(waves.map(w => w.operator_id).filter(Boolean))].sort();
    
    res.json({ operators });
  } catch (error) {
    console.error('Get operators error:', error);
    res.status(500).json({ error: 'Failed to get operators' });
  }
});

// POST /api/waves/auto-generate - Auto-generate waves from pending orders
router.post('/auto-generate', async (req, res) => {
  try {
    const { 
      max_orders_per_wave = 10,
      operator_assignments = {},
      priority = 'medium'
    } = req.body;

    // Get pending orders
    const orders = await db.getAllOrders();
    const pendingOrders = orders.filter(o => o.status === 'pending');

    if (pendingOrders.length === 0) {
      return res.status(400).json({ error: 'No pending orders found' });
    }

    // Group orders by customer or other criteria
    const orderGroups = [];
    for (let i = 0; i < pendingOrders.length; i += max_orders_per_wave) {
      orderGroups.push(pendingOrders.slice(i, i + max_orders_per_wave));
    }

    const createdWaves = [];

    // Create waves for each group
    for (let i = 0; i < orderGroups.length; i++) {
      const orderGroup = orderGroups[i];
      const waveCount = (await db.getAllWaves()).length;
      const wave_id = `WAVE-AUTO-${Date.now()}-${String(waveCount + 1).padStart(4, '0')}`;

      // Assign operator (round-robin if multiple provided)
      const operators = Object.keys(operator_assignments);
      const operator_id = operators.length > 0 ? operators[i % operators.length] : 'AUTO';

      const waveData = {
        wave_id,
        operator_id,
        priority,
        status: 'pending',
        notes: `Auto-generated wave with ${orderGroup.length} orders`,
        created_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const newWave = await db.createWave(waveData);

      // Create picking tasks for orders in this wave
      for (const order of orderGroup) {
        const taskData = {
          wave_id: wave_id,
          product_reference: order.product_reference,
          quantity: order.quantity,
          location_id: null, // Will be assigned based on inventory
          operator_id: operator_id,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        
        await db.createPickingTask(taskData);

        // Update order status to processing
        await db.updateOrder(order.id, { status: 'processing' });
      }

      createdWaves.push(newWave);
    }

    res.json({
      message: `Successfully created ${createdWaves.length} waves`,
      waves: createdWaves,
      total_orders_processed: pendingOrders.length
    });
  } catch (error) {
    console.error('Auto-generate waves error:', error);
    res.status(500).json({ error: 'Failed to auto-generate waves' });
  }
});

module.exports = router;