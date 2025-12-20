// Picking Routes
const express = require('express');
const db = require('../database/firebase-connection');
const { requireRole } = require('../middleware/auth');
const { RouteOptimizationService } = require('../services/ai-route-optimization');

const router = express.Router();
const routeService = new RouteOptimizationService();

// Get all picking waves
router.get('/waves', async (req, res) => {
  try {
    const { status, operator_id, page = 1, limit = 20 } = req.query;
    
    let waves = await db.getAllPickingWaves();
    
    if (status) {
      waves = waves.filter(w => w.status === status);
    }
    if (operator_id) {
      waves = waves.filter(w => w.assigned_operator_id === operator_id);
    }
    
    waves.sort((a, b) => (b.wave_number || 0) - (a.wave_number || 0));
    
    const startIndex = (page - 1) * limit;
    const paginatedWaves = waves.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({ waves: paginatedWaves });
  } catch (error) {
    console.error('Get picking waves error:', error);
    res.status(500).json({ error: 'Failed to get picking waves' });
  }
});

// Get wave by ID
router.get('/waves/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const wave = await db.getPickingWaveById(id);
    if (!wave) {
      return res.status(404).json({ error: 'Picking wave not found' });
    }
    
    const tasks = await db.getPickingTasksByWave(id);
    
    res.json({ wave, tasks });
  } catch (error) {
    console.error('Get wave error:', error);
    res.status(500).json({ error: 'Failed to get picking wave' });
  }
});

// Create picking wave
router.post('/waves', requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { order_ids, operator_id } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ error: 'Order IDs array is required' });
    }
    
    const allWaves = await db.getAllPickingWaves();
    const maxWaveNumber = allWaves.reduce((max, w) => Math.max(max, w.wave_number || 0), 0);
    const waveNumber = maxWaveNumber + 1;
    
    const wave = await db.createPickingWave({
      wave_number: waveNumber,
      assigned_operator_id: operator_id || null,
      status: 'created',
      total_items: 0
    });
    
    let totalItems = 0;
    let sequenceNumber = 1;
    
    for (const orderId of order_ids) {
      const orderItems = await db.getOrderItemsByOrder(orderId);
      const inventory = await db.getAllInventory();
      const locations = await db.getAllStorageLocations();
      
      for (const item of orderItems) {
        const itemInventory = inventory.find(inv => inv.product_id === item.product_id && inv.quantity > 0);
        if (itemInventory) {
          await db.createPickingTask({
            wave_id: wave.id,
            order_item_id: item.id,
            product_id: item.product_id,
            location_id: itemInventory.location_id,
            quantity_to_pick: item.quantity || 1,
            sequence_number: sequenceNumber,
            status: 'pending'
          });
          totalItems++;
          sequenceNumber++;
        }
      }
      
      await db.updateOrder(orderId, { status: 'assigned', wave_number: waveNumber });
    }
    
    await db.updatePickingWave(wave.id, { total_items: totalItems });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('wave-created', { wave_id: wave.id, wave_number: waveNumber, total_items: totalItems });
    }
    
    res.status(201).json({
      message: 'Picking wave created successfully',
      wave_id: wave.id,
      wave_number: waveNumber,
      total_items: totalItems
    });
  } catch (error) {
    console.error('Create picking wave error:', error);
    res.status(500).json({ error: 'Failed to create picking wave' });
  }
});

// Get picking tasks for a wave
router.get('/waves/:waveId/tasks', async (req, res) => {
  try {
    const { waveId } = req.params;
    
    const tasks = await db.getPickingTasksByWave(waveId);
    const products = await db.getAllProducts();
    const locations = await db.getAllStorageLocations();
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    const tasksWithDetails = tasks.map(task => ({
      ...task,
      product: productMap.get(task.product_id),
      location: locationMap.get(task.location_id)
    }));
    
    tasksWithDetails.sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
    
    res.json({ tasks: tasksWithDetails });
  } catch (error) {
    console.error('Get picking tasks error:', error);
    res.status(500).json({ error: 'Failed to get picking tasks' });
  }
});

// Start picking wave
router.post('/waves/:waveId/start', async (req, res) => {
  try {
    const { waveId } = req.params;
    
    const wave = await db.getPickingWaveById(waveId);
    if (!wave) {
      return res.status(404).json({ error: 'Picking wave not found' });
    }
    
    if (wave.status !== 'created') {
      return res.status(400).json({ error: 'Wave cannot be started in current status' });
    }
    
    await db.updatePickingWave(waveId, {
      status: 'in_progress',
      started_at: new Date().toISOString()
    });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('wave-started', { wave_id: waveId, wave_number: wave.wave_number });
    }
    
    res.json({ message: 'Picking wave started successfully' });
  } catch (error) {
    console.error('Start picking wave error:', error);
    res.status(500).json({ error: 'Failed to start picking wave' });
  }
});

// Complete picking task
router.post('/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { quantity_picked, picking_time_seconds } = req.body;
    
    if (typeof quantity_picked !== 'number' || quantity_picked < 0) {
      return res.status(400).json({ error: 'Valid quantity_picked is required' });
    }
    
    const tasks = await db.getAllPickingTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Picking task not found' });
    }
    
    if (task.status === 'completed') {
      return res.status(400).json({ error: 'Task already completed' });
    }
    
    await db.updatePickingTask(taskId, {
      status: 'completed',
      quantity_picked,
      picking_time_seconds: picking_time_seconds || null,
      completed_at: new Date().toISOString()
    });
    
    // Update inventory
    const inventory = await db.getInventoryByLocation(task.location_id);
    const productInventory = inventory.find(inv => inv.product_id === task.product_id);
    if (productInventory) {
      const newQuantity = Math.max(0, (productInventory.quantity || 0) - quantity_picked);
      const newReserved = Math.max(0, (productInventory.reserved_quantity || 0) - quantity_picked);
      await db.updateInventory(productInventory.id, {
        quantity: newQuantity,
        reserved_quantity: newReserved
      });
    }
    
    // Check if wave is complete
    const waveTasks = await db.getPickingTasksByWave(task.wave_id);
    const completedTasks = waveTasks.filter(t => t.status === 'completed' || t.id === taskId);
    
    if (completedTasks.length === waveTasks.length) {
      await db.updatePickingWave(task.wave_id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
      
      const io = req.app.get('io');
      if (io) {
        io.emit('wave-completed', { wave_id: task.wave_id });
      }
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('task-completed', { task_id: taskId, wave_id: task.wave_id, quantity_picked });
    }
    
    res.json({ message: 'Picking task completed successfully' });
  } catch (error) {
    console.error('Complete picking task error:', error);
    res.status(500).json({ error: 'Failed to complete picking task' });
  }
});

// Get optimized route for wave
router.get('/waves/:waveId/route', async (req, res) => {
  try {
    const { waveId } = req.params;
    
    const tasks = await db.getPickingTasksByWave(waveId);
    const locations = await db.getAllStorageLocations();
    
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'No tasks found for this wave' });
    }
    
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const optimization = routeService.optimizePickingRoute(pendingTasks, locations);
    
    res.json({
      route: optimization.optimized_route,
      total_picks: pendingTasks.length,
      original_distance: optimization.original_distance,
      optimized_distance: optimization.optimized_distance,
      improvement_percentage: optimization.improvement_percentage,
      estimated_time_minutes: optimization.estimated_time_minutes
    });
  } catch (error) {
    console.error('Get picking route error:', error);
    res.status(500).json({ error: 'Failed to get picking route' });
  }
});

// Get picking performance
router.get('/performance', async (req, res) => {
  try {
    const tasks = await db.getAllPickingTasks();
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    const totalPicks = completedTasks.length;
    const totalQuantity = completedTasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0);
    const avgPickTime = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0) / completedTasks.length
      : 0;
    
    res.json({
      total_picks: totalPicks,
      total_quantity: totalQuantity,
      average_pick_time_seconds: Math.round(avgPickTime),
      average_pick_time_minutes: Math.round(avgPickTime / 60 * 10) / 10
    });
  } catch (error) {
    console.error('Get picking performance error:', error);
    res.status(500).json({ error: 'Failed to get picking performance' });
  }
});

module.exports = router;
