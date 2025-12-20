// Order Management Routes
const express = require('express');
const router = express.Router();
const db = require('../database/firebase-connection');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// GET /api/orders - Get all orders with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      status_filter = '', 
      customer_filter = '',
      date_from = '',
      date_to = ''
    } = req.query;

    let orders = await db.getAllOrders();

    // Apply filters
    if (search) {
      orders = orders.filter(o => 
        o.order_id.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_id.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status_filter) {
      orders = orders.filter(o => o.status === status_filter);
    }

    if (customer_filter) {
      orders = orders.filter(o => o.customer_id === customer_filter);
    }

    if (date_from) {
      orders = orders.filter(o => new Date(o.order_date) >= new Date(date_from));
    }

    if (date_to) {
      orders = orders.filter(o => new Date(o.order_date) <= new Date(date_to));
    }

    // Sort by date (newest first)
    orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = orders.slice(startIndex, endIndex);

    res.json({
      orders: paginatedOrders,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(orders.length / limit),
        total_items: orders.length,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// GET /api/orders/summary - Get order statistics
router.get('/summary', async (req, res) => {
  try {
    const orders = await db.getAllOrders();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const stats = {
      total_orders: orders.length,
      today_orders: orders.filter(o => o.order_date.startsWith(todayStr)).length,
      this_month_orders: orders.filter(o => {
        const orderDate = new Date(o.order_date);
        return orderDate.getMonth() === thisMonth && orderDate.getFullYear() === thisYear;
      }).length,
      pending_orders: orders.filter(o => o.status === 'pending').length,
      processing_orders: orders.filter(o => o.status === 'processing').length,
      completed_orders: orders.filter(o => o.status === 'completed').length,
      total_quantity: orders.reduce((sum, o) => sum + (o.quantity || 0), 0)
    };

    // Customer statistics
    const customerStats = {};
    orders.forEach(order => {
      if (!customerStats[order.customer_id]) {
        customerStats[order.customer_id] = {
          total_orders: 0,
          total_quantity: 0
        };
      }
      customerStats[order.customer_id].total_orders++;
      customerStats[order.customer_id].total_quantity += order.quantity || 0;
    });

    // Top customers
    const topCustomers = Object.entries(customerStats)
      .map(([customer, stats]) => ({ customer, ...stats }))
      .sort((a, b) => b.total_orders - a.total_orders)
      .slice(0, 10);

    res.json({
      ...stats,
      top_customers: topCustomers
    });
  } catch (error) {
    console.error('Get order summary error:', error);
    res.status(500).json({ error: 'Failed to get order summary' });
  }
});

// GET /api/orders/:id - Get order details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await db.getOrderById(id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get product details
    const product = await db.getProductByReference(order.product_reference);
    
    res.json({
      ...order,
      product: product
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: 'Failed to get order details' });
  }
});

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
  try {
    const {
      customer_id,
      product_reference,
      quantity,
      order_date,
      notes
    } = req.body;

    // Validate required fields
    if (!customer_id || !product_reference || !quantity) {
      return res.status(400).json({ 
        error: 'Customer ID, Product Reference, and Quantity are required' 
      });
    }

    // Check if product exists
    const product = await db.getProductByReference(product_reference);
    if (!product) {
      return res.status(400).json({ error: 'Product not found' });
    }

    // Generate order ID
    const orderCount = (await db.getAllOrders()).length;
    const order_id = `ORD-${Date.now()}-${String(orderCount + 1).padStart(4, '0')}`;

    const orderData = {
      order_id,
      customer_id,
      product_reference,
      quantity: parseInt(quantity),
      order_date: order_date || new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newOrder = await db.createOrder(orderData);
    
    res.status(201).json({
      message: 'Order created successfully',
      order: newOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PUT /api/orders/:id - Update order
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Add updated timestamp
    updateData.updated_at = new Date().toISOString();

    const updatedOrder = await db.updateOrder(id, updateData);
    
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      message: 'Order updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// DELETE /api/orders/:id - Delete order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await db.deleteOrder(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// POST /api/orders/import - Import orders from CSV
router.post('/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const orders = [];
    const errors = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Validate required fields
            if (!row.customer_id || !row.product_reference || !row.quantity) {
              errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
              return;
            }

            const orderData = {
              order_id: row.order_id || `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              customer_id: row.customer_id.trim(),
              product_reference: row.product_reference.trim(),
              quantity: parseInt(row.quantity),
              order_date: row.order_date || new Date().toISOString().split('T')[0],
              status: row.status || 'pending',
              notes: row.notes || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            orders.push(orderData);
          } catch (error) {
            errors.push(`Error processing row: ${error.message}`);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (orders.length === 0) {
      return res.status(400).json({ 
        error: 'No valid orders found in CSV',
        errors: errors
      });
    }

    // Import orders to database
    const imported = [];
    for (const orderData of orders) {
      try {
        const newOrder = await db.createOrder(orderData);
        imported.push(newOrder);
      } catch (error) {
        errors.push(`Failed to import order ${orderData.order_id}: ${error.message}`);
      }
    }

    res.json({
      message: `Successfully imported ${imported.length} orders`,
      imported_count: imported.length,
      total_processed: orders.length,
      errors: errors
    });
  } catch (error) {
    console.error('Import orders error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to import orders' });
  }
});

// GET /api/orders/export - Export orders to CSV
router.get('/export', async (req, res) => {
  try {
    const { status_filter, customer_filter, date_from, date_to } = req.query;
    
    let orders = await db.getAllOrders();
    
    // Apply filters
    if (status_filter) {
      orders = orders.filter(o => o.status === status_filter);
    }
    if (customer_filter) {
      orders = orders.filter(o => o.customer_id === customer_filter);
    }
    if (date_from) {
      orders = orders.filter(o => new Date(o.order_date) >= new Date(date_from));
    }
    if (date_to) {
      orders = orders.filter(o => new Date(o.order_date) <= new Date(date_to));
    }
    
    // Generate CSV
    const csvHeader = 'Order ID,Customer ID,Product Reference,Quantity,Order Date,Status,Notes\n';
    const csvRows = orders.map(order => [
      order.order_id,
      order.customer_id,
      order.product_reference,
      order.quantity,
      order.order_date,
      order.status,
      (order.notes || '').replace(/,/g, ';')
    ].join(',')).join('\n');
    
    const csv = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders_export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

// GET /api/orders/customers/list - Get unique customers
router.get('/customers/list', async (req, res) => {
  try {
    const orders = await db.getAllOrders();
    const customers = [...new Set(orders.map(o => o.customer_id))].sort();
    
    res.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

module.exports = router;