// Configuration Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');

const router = express.Router();

// GET /api/config - Get system configuration
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get basic system stats
    const stats = {
      database: {
        type: 'SQLite',
        status: 'connected',
        file: 'warehouse.db'
      },
      system: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        node_version: process.version
      },
      warehouse: {
        total_products: (await db.get('SELECT COUNT(*) as count FROM products'))?.count || 0,
        total_locations: (await db.get('SELECT COUNT(*) as count FROM storage_locations'))?.count || 0,
        total_orders: (await db.get('SELECT COUNT(*) as count FROM orders'))?.count || 0,
        total_users: (await db.get('SELECT COUNT(*) as count FROM users'))?.count || 0
      }
    };

    res.json({
      success: true,
      config: stats,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

module.exports = router;