// Reports Routes
const express = require('express');
const db = require('../database/firebase-connection');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Warehouse summary report
router.get('/warehouse-summary', async (req, res) => {
  try {
    const inventory = await db.getAllInventory();
    const products = await db.getAllProducts();
    const locations = await db.getAllStorageLocations();
    const orders = await db.getAllOrders();
    const waves = await db.getAllPickingWaves();
    const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
    const movements = await db.getAllMovements();
    
    const inventorySummary = {
      total_products: products.length,
      total_locations: locations.length,
      total_inventory: inventory.reduce((sum, i) => sum + (i.quantity || 0), 0),
      total_reserved: inventory.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0),
      avg_utilization: locations.length > 0
        ? locations.reduce((sum, l) => sum + ((l.current_occupancy || 0) / (l.capacity || 1)), 0) / locations.length * 100
        : 0
    };
    
    const ordersSummary = {
      total_orders: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      assigned: orders.filter(o => o.status === 'assigned').length,
      picking: orders.filter(o => o.status === 'picking').length,
      picked: orders.filter(o => o.status === 'picked').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    };
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const pickingPerformance = {
      total_picks: completedTasks.length,
      total_quantity: completedTasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0),
      avg_pick_time: completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0) / completedTasks.length
        : 0,
      total_waves: waves.length,
      completed_waves: waves.filter(w => w.status === 'completed').length
    };
    
    const movementsByType = {};
    movements.forEach(m => {
      const type = m.movement_type || 'unknown';
      if (!movementsByType[type]) {
        movementsByType[type] = { count: 0, quantity: 0 };
      }
      movementsByType[type].count++;
      movementsByType[type].quantity += Math.abs(m.quantity || 0);
    });
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const abcAnalysis = { A: 0, B: 0, C: 0 };
    inventory.forEach(inv => {
      const product = productMap.get(inv.product_id);
      const abc = product?.abc_code || 'C';
      abcAnalysis[abc] = (abcAnalysis[abc] || 0) + (inv.quantity || 0);
    });
    
    res.json({
      inventory_summary: {
        ...inventorySummary,
        available_inventory: inventorySummary.total_inventory - inventorySummary.total_reserved,
        utilization_percentage: Math.round(inventorySummary.avg_utilization * 100) / 100
      },
      orders_summary: {
        ...ordersSummary,
        completion_rate: ordersSummary.total_orders > 0
          ? Math.round((ordersSummary.shipped / ordersSummary.total_orders) * 100)
          : 0
      },
      picking_performance: {
        ...pickingPerformance,
        avg_pick_time_seconds: Math.round(pickingPerformance.avg_pick_time)
      },
      movement_activity: movementsByType,
      abc_analysis: abcAnalysis
    });
  } catch (error) {
    console.error('Warehouse summary error:', error);
    res.status(500).json({ error: 'Failed to generate warehouse summary' });
  }
});

// Operator performance report
router.get('/operator-performance', async (req, res) => {
  try {
    const { operator_id } = req.query;
    
    const users = await db.db.getAll(db.collections.USERS, [
      { field: 'role', op: '==', value: 'operator' }
    ]);
    
    const waves = await db.getAllPickingWaves();
    const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
    const locations = await db.getAllStorageLocations();
    
    let operators = users;
    if (operator_id) {
      operators = users.filter(u => u.id === operator_id);
    }
    
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    const operatorPerformance = operators.map(user => {
      const userWaves = waves.filter(w => w.assigned_operator_id === user.id);
      const userWaveIds = userWaves.map(w => w.id);
      const userTasks = tasks.filter(t => userWaveIds.includes(t.wave_id) && t.status === 'completed');
      
      const totalPicks = userTasks.length;
      const totalQuantity = userTasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0);
      const totalTime = userTasks.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0);
      const avgPickTime = totalPicks > 0 ? totalTime / totalPicks : 0;
      const accuracyRate = totalPicks > 0
        ? userTasks.filter(t => t.quantity_picked === t.quantity_to_pick).length / totalPicks
        : 0;
      
      return {
        id: user.id,
        username: user.username,
        total_picks: totalPicks,
        total_quantity: totalQuantity,
        avg_pick_time: Math.round(avgPickTime),
        best_pick_time: totalPicks > 0 ? Math.min(...userTasks.map(t => t.picking_time_seconds || 0)) : 0,
        worst_pick_time: totalPicks > 0 ? Math.max(...userTasks.map(t => t.picking_time_seconds || 0)) : 0,
        waves_completed: userWaves.filter(w => w.status === 'completed').length,
        accuracy_percentage: Math.round(accuracyRate * 100),
        picks_per_hour: totalTime > 0 ? Math.round((totalPicks / (totalTime / 3600)) * 100) / 100 : 0
      };
    });
    
    operatorPerformance.sort((a, b) => b.total_picks - a.total_picks);
    
    const topPerformers = operatorPerformance
      .sort((a, b) => b.picks_per_hour - a.picks_per_hour)
      .slice(0, 5)
      .map((op, index) => ({
        rank: index + 1,
        username: op.username,
        picks_per_hour: op.picks_per_hour,
        accuracy_percentage: op.accuracy_percentage,
        total_picks: op.total_picks
      }));
    
    res.json({
      operator_performance: operatorPerformance,
      top_performers: topPerformers,
      summary: {
        total_operators: operatorPerformance.length,
        total_picks: operatorPerformance.reduce((sum, op) => sum + op.total_picks, 0),
        avg_accuracy: operatorPerformance.length > 0
          ? Math.round(operatorPerformance.reduce((sum, op) => sum + op.accuracy_percentage, 0) / operatorPerformance.length)
          : 0
      }
    });
  } catch (error) {
    console.error('Operator performance report error:', error);
    res.status(500).json({ error: 'Failed to generate operator performance report' });
  }
});

// Inventory analysis report
router.get('/inventory-analysis', async (req, res) => {
  try {
    const { abc_code, zone, low_stock_threshold = 20 } = req.query;
    
    const inventory = await db.getAllInventory();
    const products = await db.getAllProducts();
    const locations = await db.getAllStorageLocations();
    const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    let filteredInventory = inventory.map(inv => ({
      ...inv,
      product: productMap.get(inv.product_id),
      location: locationMap.get(inv.location_id)
    })).filter(inv => inv.product && inv.location);
    
    if (abc_code) {
      filteredInventory = filteredInventory.filter(inv => inv.product.abc_code === abc_code);
    }
    if (zone) {
      filteredInventory = filteredInventory.filter(inv => inv.location.zone === zone);
    }
    
    const inventoryOverview = {
      total_products: new Set(filteredInventory.map(i => i.product_id)).size,
      total_locations: new Set(filteredInventory.map(i => i.location_id)).size,
      total_quantity: filteredInventory.reduce((sum, i) => sum + (i.quantity || 0), 0),
      total_reserved: filteredInventory.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0),
      low_stock_items: filteredInventory.filter(i => (i.quantity || 0) < low_stock_threshold).length,
      out_of_stock_items: filteredInventory.filter(i => (i.quantity || 0) === 0).length
    };
    
    const abcAnalysis = {};
    filteredInventory.forEach(inv => {
      const abc = inv.product.abc_code || 'C';
      if (!abcAnalysis[abc]) {
        abcAnalysis[abc] = { product_count: 0, total_quantity: 0, total_reserved: 0 };
      }
      abcAnalysis[abc].product_count++;
      abcAnalysis[abc].total_quantity += inv.quantity || 0;
      abcAnalysis[abc].total_reserved += inv.reserved_quantity || 0;
    });
    
    const zoneUtilization = {};
    filteredInventory.forEach(inv => {
      const z = inv.location.zone || 'Unknown';
      if (!zoneUtilization[z]) {
        zoneUtilization[z] = { locations: new Set(), capacity: 0, occupancy: 0 };
      }
      zoneUtilization[z].locations.add(inv.location_id);
      zoneUtilization[z].capacity += inv.location.capacity || 0;
      zoneUtilization[z].occupancy += inv.location.current_occupancy || 0;
    });
    
    const zoneStats = Object.entries(zoneUtilization).map(([z, data]) => ({
      zone: z,
      total_locations: data.locations.size,
      total_capacity: data.capacity,
      total_occupancy: data.occupancy,
      utilization_percentage: data.capacity > 0 ? Math.round((data.occupancy / data.capacity) * 100 * 100) / 100 : 0
    }));
    
    const lowStockAlerts = filteredInventory
      .filter(inv => (inv.quantity || 0) < low_stock_threshold)
      .map(inv => ({
        product_reference: inv.product.reference,
        abc_code: inv.product.abc_code,
        quantity: inv.quantity,
        location_code: inv.location.location_code,
        zone: inv.location.zone
      }))
      .sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
    
    res.json({
      filters: { abc_code: abc_code || 'All', zone: zone || 'All', low_stock_threshold },
      inventory_overview: {
        ...inventoryOverview,
        available_quantity: inventoryOverview.total_quantity - inventoryOverview.total_reserved
      },
      abc_analysis: abcAnalysis,
      zone_utilization: zoneStats,
      low_stock_alerts: lowStockAlerts.slice(0, 50)
    });
  } catch (error) {
    console.error('Inventory analysis error:', error);
    res.status(500).json({ error: 'Failed to generate inventory analysis' });
  }
});

// AI optimization report
router.get('/ai-optimization', requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const clusters = await db.getLatestClusters();
    const optimizations = await db.getOptimizations();
    
    const routeOptimizations = optimizations.filter(o => o.type === 'route');
    const avgImprovement = routeOptimizations.length > 0
      ? routeOptimizations.reduce((sum, o) => sum + (o.result?.improvement_percentage || 0), 0) / routeOptimizations.length
      : 0;
    
    const clusteringRuns = clusters.map(c => ({
      algorithm: c.algorithm,
      created_at: c.created_at,
      summary: c.result?.summary || {}
    }));
    
    const routeRuns = routeOptimizations.map(o => ({
      wave_id: o.wave_id,
      created_at: o.created_at,
      improvement_percentage: o.result?.improvement_percentage || 0,
      original_distance: o.result?.original_distance || 0,
      optimized_distance: o.result?.optimized_distance || 0
    }));
    
    res.json({
      clustering: {
        total_runs: clusters.length,
        recent_runs: clusteringRuns.slice(-10)
      },
      route_optimization: {
        total_runs: routeOptimizations.length,
        average_improvement_percentage: Math.round(avgImprovement * 100) / 100,
        recent_runs: routeRuns.slice(-10)
      },
      recommendations: [
        avgImprovement > 15 ? 'Route optimization is providing significant improvements' : null,
        clusters.length === 0 ? 'Run clustering analysis to optimize product placement' : null,
        routeOptimizations.length === 0 ? 'Run route optimization to reduce picking time' : null
      ].filter(Boolean)
    });
  } catch (error) {
    console.error('AI optimization report error:', error);
    res.status(500).json({ error: 'Failed to generate AI optimization report' });
  }
});

// Export report data
router.get('/export/:reportType', requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { reportType } = req.params;
    const { format = 'json' } = req.query;
    
    let data = [];
    let filename = '';
    
    if (reportType === 'inventory') {
      const inventory = await db.getAllInventory();
      const products = await db.getAllProducts();
      const locations = await db.getAllStorageLocations();
      
      const productMap = new Map(products.map(p => [p.id, p]));
      const locationMap = new Map(locations.map(l => [l.id, l]));
      
      data = inventory.map(inv => {
        const product = productMap.get(inv.product_id);
        const location = locationMap.get(inv.location_id);
        return {
          product_reference: product?.reference || '',
          abc_code: product?.abc_code || '',
          location_code: location?.location_code || '',
          zone: location?.zone || '',
          quantity: inv.quantity || 0,
          reserved_quantity: inv.reserved_quantity || 0,
          available_quantity: (inv.quantity || 0) - (inv.reserved_quantity || 0)
        };
      });
      filename = `inventory_report_${new Date().toISOString().split('T')[0]}`;
    } else if (reportType === 'performance') {
      const users = await db.db.getAll(db.collections.USERS, [
        { field: 'role', op: '==', value: 'operator' }
      ]);
      const waves = await db.getAllPickingWaves();
      const tasks = await db.db.getAll(db.collections.PICKING_TASKS);
      
      data = users.map(user => {
        const userWaves = waves.filter(w => w.assigned_operator_id === user.id);
        const userWaveIds = userWaves.map(w => w.id);
        const userTasks = tasks.filter(t => userWaveIds.includes(t.wave_id) && t.status === 'completed');
        
        const totalPicks = userTasks.length;
        const totalTime = userTasks.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0);
        
        return {
          username: user.username,
          total_picks: totalPicks,
          total_quantity: userTasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0),
          avg_pick_time: totalPicks > 0 ? Math.round(totalTime / totalPicks) : 0,
          waves_completed: userWaves.filter(w => w.status === 'completed').length,
          accuracy_rate: totalPicks > 0
            ? Math.round(userTasks.filter(t => t.quantity_picked === t.quantity_to_pick).length / totalPicks * 100)
            : 0
        };
      });
      filename = `performance_report_${new Date().toISOString().split('T')[0]}`;
    } else {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    
    if (format === 'csv') {
      if (data.length === 0) {
        return res.status(404).json({ error: 'No data found' });
      }
      
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => {
          const val = row[h];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        report_type: reportType,
        generated_at: new Date().toISOString(),
        record_count: data.length,
        data
      });
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

module.exports = router;
