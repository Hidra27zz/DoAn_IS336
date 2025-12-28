// Order Management Routes - SQL Database
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// GET /api/orders - Get all orders with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      page = 1, 
      limit = 50, 
      status = '', 
      priority = '',
      search = ''
    } = req.query;

    let whereConditions = [];
    let params = [];

    // Build WHERE clause based on filters
    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (priority) {
      whereConditions.push('priority = ?');
      params.push(parseInt(priority));
    }

    if (search) {
      whereConditions.push('(order_number LIKE ? OR customer_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
    const countResult = await db.get(countSql, params);
    const total = countResult.total;

    // Get paginated results
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        order_number,
        customer_name,
        status,
        priority,
        created_at,
        updated_at
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = await db.all(sql, [...params, parseInt(limit), offset]);

    res.json({
      orders: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// GET /api/orders/stats/summary - Get order statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get order counts by status
    const byStatus = await db.all(`
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      GROUP BY status
    `);

    // Get total orders
    const totalOrders = await db.get('SELECT COUNT(*) as count FROM orders');

    // Format response
    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {});

    res.json({
      total_orders: totalOrders.count,
      pending: statusCounts.pending || 0,
      assigned: statusCounts.assigned || 0,
      picking: statusCounts.picking || 0,
      picked: statusCounts.picked || 0,
      shipped: statusCounts.shipped || 0,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get order statistics error:', error);
    res.status(500).json({ error: 'Failed to get order statistics' });
  }
});

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { order_number, customer_name, priority = 1, items = [] } = req.body;

    // Validate required fields
    if (!order_number || !customer_name) {
      return res.status(400).json({ error: 'Order number and customer name are required' });
    }

    // Check if order already exists
    const existing = await db.get('SELECT * FROM orders WHERE order_number = ?', [order_number]);
    if (existing) {
      return res.status(409).json({ error: 'Order with this number already exists' });
    }

    // Create order
    const orderData = {
      order_number,
      customer_name,
      status: 'pending',
      priority: parseInt(priority)
    };

    const order = await db.create('orders', orderData);

    // Create order items if provided
    if (items.length > 0) {
      for (const item of items) {
        const itemData = {
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          picked_quantity: 0
        };
        await db.create('order_items', itemData);
      }
    }

    res.status(201).json({
      success: true,
      order: order,
      items_count: items.length,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = router;