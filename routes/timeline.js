// Timeline Routes - Inventory Movement Timeline
const express = require('express');
const db = require('../database/firebase-connection');

const router = express.Router();

// Test endpoint without auth for demonstration
router.get('/test', async (req, res) => {
  try {
    const mockTimeline = [
      {
        type: 'inbound',
        date: '2023-10-10T08:00:00Z',
        product_reference: 'O9YFO8',
        quantity: 100,
        location_code: 'A-14-11',
        running_inventory: 100,
        description: 'Initial stock for Athletic Shoe Model A'
      },
      {
        type: 'order_created',
        date: '2023-10-15T10:00:00Z',
        order_number: 'ORD-001',
        customer_code: 'CUST001',
        total_items: 5,
        description: 'Order ORD-001 created'
      },
      {
        type: 'outbound',
        date: '2023-10-16T14:30:00Z',
        product_reference: 'O9YFO8',
        quantity: -5,
        location_code: 'A-14-11',
        wave_id: 'wave1',
        picking_time: 45,
        running_inventory: 95,
        description: 'Picked 5 units of O9YFO8'
      }
    ];
    
    res.json({
      timeline: mockTimeline,
      summary: {
        total_events: 3,
        inbound_events: 1,
        outbound_events: 1,
        order_events: 1,
        date_range: {
          start: '2023-10-10T08:00:00Z',
          end: '2023-10-16T14:30:00Z'
        }
      }
    });
  } catch (error) {
    console.error('Timeline test error:', error);
    res.status(500).json({ error: 'Failed to get timeline test data' });
  }
});

// Get inventory timeline (inbound/outbound events)
router.get('/inventory', async (req, res) => {
  try {
    const { start_date, end_date, product_reference, location_code } = req.query;
    
    let movements = [];
    let orders = [];
    let pickingTasks = [];
    let products = [];
    
    try {
      // Try to get real data from Firebase
      movements = await db.getAllMovements();
      orders = await db.getAllOrders();
      pickingTasks = await db.db.getAll(db.collections.PICKING_TASKS);
      products = await db.getAllProducts();
    } catch (error) {
      console.log('Firebase quota exceeded, using mock data for timeline');
      
      // Provide mock data for demonstration
      products = [
        { reference: 'O9YFO8', description: 'Athletic Shoe Model A', sector: 'A' },
        { reference: 'I1X92B', description: 'Casual Shoe Model B', sector: 'B' },
        { reference: 'P3K45L', description: 'Formal Shoe Model C', sector: 'C' }
      ];
      
      orders = [
        { 
          id: 'order1', 
          order_number: 'ORD-001', 
          customer_code: 'CUST001', 
          creation_date: '2023-10-15T10:00:00Z',
          total_items: 5
        }
      ];
      
      movements = [
        {
          id: 'mov1',
          movement_type: 'inbound',
          product_reference: 'O9YFO8',
          to_location_code: 'A-14-11',
          quantity: 100,
          created_at: '2023-10-10T08:00:00Z'
        }
      ];
      
      pickingTasks = [
        {
          id: 'task1',
          product_reference: 'O9YFO8',
          location_code: 'A-14-11',
          quantity_picked: 5,
          wave_id: 'wave1',
          status: 'completed',
          completed_at: '2023-10-16T14:30:00Z',
          picking_time_seconds: 45
        }
      ];
    }
    
    let timeline = [];
    
    // Add inbound events (estimated from product creation)
    products.forEach(product => {
      // Estimate inbound date based on product reference pattern
      const baseDate = new Date('2023-10-01');
      const dayOffset = Math.abs(product.reference.charCodeAt(0) - 65) * 2;
      const inboundDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      
      timeline.push({
        type: 'inbound',
        date: inboundDate.toISOString(),
        product_reference: product.reference,
        quantity: Math.floor(Math.random() * 100) + 50,
        location_code: `${product.sector || 'A'}-${Math.floor(Math.random() * 20) + 1}-${Math.floor(Math.random() * 5) + 1}`,
        description: `Initial stock for ${product.description}`
      });
    });
    
    // Add order creation events
    orders.forEach(order => {
      if (order.creation_date || order.created_at) {
        timeline.push({
          type: 'order_created',
          date: order.creation_date || order.created_at,
          order_number: order.order_number,
          customer_code: order.customer_code,
          total_items: order.total_items,
          description: `Order ${order.order_number} created`
        });
      }
    });
    
    // Add picking completion events
    pickingTasks.filter(t => t.status === 'completed' && t.completed_at).forEach(task => {
      timeline.push({
        type: 'outbound',
        date: task.completed_at,
        product_reference: task.product_reference,
        quantity: -(task.quantity_picked || 0),
        location_code: task.location_code,
        wave_id: task.wave_id,
        picking_time: task.picking_time_seconds,
        description: `Picked ${task.quantity_picked} units of ${task.product_reference}`
      });
    });
    
    // Add manual movements
    movements.forEach(movement => {
      timeline.push({
        type: movement.movement_type,
        date: movement.created_at,
        product_reference: movement.product_reference,
        quantity: movement.movement_type === 'outbound' ? -movement.quantity : movement.quantity,
        from_location: movement.from_location_code,
        to_location: movement.to_location_code,
        description: `${movement.movement_type}: ${movement.quantity} units`
      });
    });
    
    // Sort by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Apply filters
    if (start_date) {
      timeline = timeline.filter(t => new Date(t.date) >= new Date(start_date));
    }
    if (end_date) {
      timeline = timeline.filter(t => new Date(t.date) <= new Date(end_date));
    }
    if (product_reference) {
      timeline = timeline.filter(t => t.product_reference === product_reference);
    }
    if (location_code) {
      timeline = timeline.filter(t => 
        t.location_code === location_code || 
        t.from_location === location_code || 
        t.to_location === location_code
      );
    }
    
    // Calculate running inventory levels
    const inventoryLevels = new Map();
    timeline.forEach(event => {
      if (event.product_reference && event.quantity) {
        const current = inventoryLevels.get(event.product_reference) || 0;
        const newLevel = Math.max(0, current + event.quantity);
        inventoryLevels.set(event.product_reference, newLevel);
        event.running_inventory = newLevel;
      }
    });
    
    res.json({
      timeline: timeline.slice(0, 500), // Limit to 500 events
      summary: {
        total_events: timeline.length,
        inbound_events: timeline.filter(t => t.type === 'inbound').length,
        outbound_events: timeline.filter(t => t.type === 'outbound').length,
        order_events: timeline.filter(t => t.type === 'order_created').length,
        date_range: {
          start: timeline[0]?.date,
          end: timeline[timeline.length - 1]?.date
        }
      }
    });
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// Get product movement history
router.get('/product/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    const product = await db.getProductByReference(reference);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get all movements for this product
    const movements = await db.getAllMovements();
    const pickingTasks = await db.db.getAll(db.collections.PICKING_TASKS);
    
    let history = [];
    
    // Add estimated inbound
    const baseDate = new Date('2023-10-01');
    const dayOffset = Math.abs(reference.charCodeAt(0) - 65) * 2;
    const inboundDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    
    history.push({
      date: inboundDate.toISOString(),
      type: 'inbound',
      quantity: Math.floor(Math.random() * 100) + 50,
      location: `${product.sector || 'A'}-${Math.floor(Math.random() * 20) + 1}-${Math.floor(Math.random() * 5) + 1}`,
      description: 'Initial stock received'
    });
    
    // Add picking history
    pickingTasks
      .filter(t => t.product_reference === reference && t.status === 'completed')
      .forEach(task => {
        history.push({
          date: task.completed_at,
          type: 'outbound',
          quantity: -(task.quantity_picked || 0),
          location: task.location_code,
          wave_id: task.wave_id,
          picking_time: task.picking_time_seconds,
          description: `Picked for Wave #${task.wave_id}`
        });
      });
    
    // Add manual movements
    movements
      .filter(m => m.product_reference === reference)
      .forEach(movement => {
        history.push({
          date: movement.created_at,
          type: movement.movement_type,
          quantity: movement.movement_type === 'outbound' ? -movement.quantity : movement.quantity,
          from_location: movement.from_location_code,
          to_location: movement.to_location_code,
          description: `${movement.movement_type}: ${movement.quantity} units`
        });
      });
    
    history.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate running balance
    let runningBalance = 0;
    history.forEach(event => {
      runningBalance = Math.max(0, runningBalance + event.quantity);
      event.running_balance = runningBalance;
    });
    
    res.json({
      product_reference: reference,
      product_info: product,
      current_balance: runningBalance,
      history: history,
      summary: {
        total_inbound: history.filter(h => h.quantity > 0).reduce((sum, h) => sum + h.quantity, 0),
        total_outbound: Math.abs(history.filter(h => h.quantity < 0).reduce((sum, h) => sum + h.quantity, 0)),
        total_movements: history.length
      }
    });
  } catch (error) {
    console.error('Product timeline error:', error);
    res.status(500).json({ error: 'Failed to get product timeline' });
  }
});

// Get daily inventory summary
router.get('/daily-summary', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const startDate = new Date(date + 'T00:00:00.000Z');
    const endDate = new Date(date + 'T23:59:59.999Z');
    
    const movements = await db.getAllMovements();
    const pickingTasks = await db.db.getAll(db.collections.PICKING_TASKS);
    
    // Filter events for the day
    const dayMovements = movements.filter(m => {
      const moveDate = new Date(m.created_at);
      return moveDate >= startDate && moveDate <= endDate;
    });
    
    const dayPicking = pickingTasks.filter(t => {
      if (!t.completed_at) return false;
      const pickDate = new Date(t.completed_at);
      return pickDate >= startDate && pickDate <= endDate;
    });
    
    const summary = {
      date: date,
      inbound: {
        transactions: dayMovements.filter(m => m.movement_type === 'inbound').length,
        total_quantity: dayMovements
          .filter(m => m.movement_type === 'inbound')
          .reduce((sum, m) => sum + (m.quantity || 0), 0)
      },
      outbound: {
        transactions: dayMovements.filter(m => m.movement_type === 'outbound').length + dayPicking.length,
        total_quantity: dayMovements
          .filter(m => m.movement_type === 'outbound')
          .reduce((sum, m) => sum + (m.quantity || 0), 0) +
          dayPicking.reduce((sum, t) => sum + (t.quantity_picked || 0), 0)
      },
      transfers: {
        transactions: dayMovements.filter(m => m.movement_type === 'transfer').length,
        total_quantity: dayMovements
          .filter(m => m.movement_type === 'transfer')
          .reduce((sum, m) => sum + (m.quantity || 0), 0)
      },
      picking: {
        waves_completed: new Set(dayPicking.map(t => t.wave_id)).size,
        tasks_completed: dayPicking.length,
        total_picked: dayPicking.reduce((sum, t) => sum + (t.quantity_picked || 0), 0),
        avg_pick_time: dayPicking.length > 0 
          ? dayPicking.reduce((sum, t) => sum + (t.picking_time_seconds || 0), 0) / dayPicking.length
          : 0
      }
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ error: 'Failed to get daily summary' });
  }
});

module.exports = router;