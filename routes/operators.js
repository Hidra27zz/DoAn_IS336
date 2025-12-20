// Operators Routes
const express = require('express');
const db = require('../database/firebase-connection');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all operators
router.get('/', async (req, res) => {
  try {
    const users = await db.db.getAll(db.collections.USERS, [
      { field: 'role', op: '==', value: 'operator' }
    ]);
    
    const waves = await db.getAllPickingWaves();
    const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
    
    const operators = users.map(user => {
      const userWaves = waves.filter(w => w.assigned_operator_id === user.id);
      const completedWaves = userWaves.filter(w => w.status === 'completed');
      
      const userWaveIds = userWaves.map(w => w.id);
      const userTasks = tasks.filter(t => userWaveIds.includes(t.wave_id) && t.status === 'completed');
      
      const totalPicks = userTasks.length;
      const avgPickTime = totalPicks > 0
        ? userTasks.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0) / totalPicks
        : 0;
      const accuracyRate = totalPicks > 0
        ? userTasks.filter(t => t.quantity_picked === t.quantity_to_pick).length / totalPicks
        : 0;
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        total_waves: userWaves.length,
        completed_waves: completedWaves.length,
        total_picks: totalPicks,
        avg_pick_time: Math.round(avgPickTime),
        accuracy_rate: Math.round(accuracyRate * 100)
      };
    });
    
    operators.sort((a, b) => b.total_picks - a.total_picks);
    
    res.json({ operators });
  } catch (error) {
    console.error('Get operators error:', error);
    res.status(500).json({ error: 'Failed to get operators' });
  }
});

// Get operator performance
router.get('/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await db.getUserById(id);
    if (!user || user.role !== 'operator') {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    const waves = await db.getAllPickingWaves();
    const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
    const locations = await db.getAllStorageLocations();
    
    const userWaves = waves.filter(w => w.assigned_operator_id === id);
    const userWaveIds = userWaves.map(w => w.id);
    const userTasks = tasks.filter(t => userWaveIds.includes(t.wave_id) && t.status === 'completed');
    
    const totalPicks = userTasks.length;
    const totalQuantity = userTasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0);
    const totalTime = userTasks.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0);
    const avgPickTime = totalPicks > 0 ? totalTime / totalPicks : 0;
    const accuracyRate = totalPicks > 0
      ? userTasks.filter(t => t.quantity_picked === t.quantity_to_pick).length / totalPicks
      : 0;
    
    const locationMap = new Map(locations.map(l => [l.id, l]));
    const zonePerformance = {};
    
    userTasks.forEach(task => {
      const location = locationMap.get(task.location_id);
      const zone = location?.zone || 'Unknown';
      
      if (!zonePerformance[zone]) {
        zonePerformance[zone] = { picks: 0, total_time: 0 };
      }
      zonePerformance[zone].picks++;
      zonePerformance[zone].total_time += task.picking_time_seconds || 0;
    });
    
    const zoneStats = Object.entries(zonePerformance).map(([zone, data]) => ({
      zone,
      picks: data.picks,
      avg_time: data.picks > 0 ? Math.round(data.total_time / data.picks) : 0
    }));
    
    res.json({
      operator: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      performance: {
        total_picks: totalPicks,
        total_quantity: totalQuantity,
        total_time_seconds: totalTime,
        avg_pick_time: Math.round(avgPickTime),
        accuracy_percentage: Math.round(accuracyRate * 100),
        waves_completed: userWaves.filter(w => w.status === 'completed').length,
        efficiency_score: totalTime > 0 ? Math.round((totalPicks / (totalTime / 3600)) * 100) / 100 : 0
      },
      zone_performance: zoneStats
    });
  } catch (error) {
    console.error('Get operator performance error:', error);
    res.status(500).json({ error: 'Failed to get operator performance' });
  }
});

// Get operator assignments
router.get('/:id/assignments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const waves = await db.getAllPickingWaves();
    const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
    
    const userWaves = waves.filter(w => 
      w.assigned_operator_id === id && ['created', 'in_progress'].includes(w.status)
    );
    
    const assignments = userWaves.map(wave => {
      const waveTasks = tasks.filter(t => t.wave_id === wave.id);
      const completedTasks = waveTasks.filter(t => t.status === 'completed');
      const pendingTasks = waveTasks.filter(t => t.status === 'pending');
      
      return {
        wave_id: wave.id,
        wave_number: wave.wave_number,
        status: wave.status,
        started_at: wave.started_at,
        total_tasks: waveTasks.length,
        completed_tasks: completedTasks.length,
        pending_tasks: pendingTasks.length
      };
    });
    
    res.json({ assignments });
  } catch (error) {
    console.error('Get operator assignments error:', error);
    res.status(500).json({ error: 'Failed to get operator assignments' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    const users = await db.db.getAll(db.collections.USERS, [
      { field: 'role', op: '==', value: 'operator' }
    ]);
    
    const waves = await db.getAllPickingWaves();
    const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
    
    const now = new Date();
    let cutoffDate = new Date();
    
    if (period === 'today') {
      cutoffDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      cutoffDate.setDate(now.getDate() - 30);
    }
    
    const recentTasks = tasks.filter(t => {
      if (t.status !== 'completed' || !t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      return completedDate >= cutoffDate;
    });
    
    const leaderboard = users.map(user => {
      const userWaves = waves.filter(w => w.assigned_operator_id === user.id);
      const userWaveIds = userWaves.map(w => w.id);
      const userTasks = recentTasks.filter(t => userWaveIds.includes(t.wave_id));
      
      const totalPicks = userTasks.length;
      const totalTime = userTasks.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0);
      const avgPickTime = totalPicks > 0 ? totalTime / totalPicks : 0;
      const accuracyRate = totalPicks > 0
        ? userTasks.filter(t => t.quantity_picked === t.quantity_to_pick).length / totalPicks
        : 0;
      const efficiencyScore = avgPickTime > 0 ? totalPicks / avgPickTime : 0;
      
      return {
        id: user.id,
        username: user.username,
        total_picks: totalPicks,
        total_quantity: userTasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0),
        avg_pick_time: Math.round(avgPickTime),
        accuracy_percentage: Math.round(accuracyRate * 100),
        efficiency_score: Math.round(efficiencyScore * 100) / 100
      };
    }).filter(op => op.total_picks > 0);
    
    leaderboard.sort((a, b) => b.efficiency_score - a.efficiency_score);
    
    const rankedLeaderboard = leaderboard.map((op, index) => ({
      rank: index + 1,
      ...op
    }));
    
    res.json({
      period,
      leaderboard: rankedLeaderboard.slice(0, 20),
      total_operators: rankedLeaderboard.length
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Assign operator to wave
router.post('/:id/assign-wave', requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { wave_id } = req.body;
    
    if (!wave_id) {
      return res.status(400).json({ error: 'Wave ID is required' });
    }
    
    const user = await db.getUserById(id);
    if (!user || user.role !== 'operator') {
      return res.status(404).json({ error: 'Operator not found' });
    }
    
    const wave = await db.getPickingWaveById(wave_id);
    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }
    
    if (wave.status !== 'created') {
      return res.status(400).json({ error: 'Wave is not available for assignment' });
    }
    
    await db.updatePickingWave(wave_id, { assigned_operator_id: id });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('operator-assigned', { operator_id: id, wave_id, wave_number: wave.wave_number });
    }
    
    res.json({
      message: 'Operator assigned to wave successfully',
      operator_name: user.username,
      wave_number: wave.wave_number
    });
  } catch (error) {
    console.error('Assign operator error:', error);
    res.status(500).json({ error: 'Failed to assign operator' });
  }
});

module.exports = router;
