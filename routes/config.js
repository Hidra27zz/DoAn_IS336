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

// GET /api/config/storage - Get storage configuration
router.get('/storage', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get storage configuration data
    const storageConfig = {
      zones: await db.all(`
        SELECT 
          zone,
          COUNT(*) as total_locations,
          SUM(capacity) as total_capacity,
          SUM(current_occupancy) as total_occupancy,
          ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_utilization
        FROM storage_locations
        GROUP BY zone
        ORDER BY zone
      `),
      strategies: await db.all(`
        SELECT 
          strategy_type,
          COUNT(*) as location_count,
          SUM(product_count) as total_products,
          SUM(total_quantity) as total_quantity
        FROM storage_strategies
        GROUP BY strategy_type
      `),
      summary: {
        total_locations: (await db.get('SELECT COUNT(*) as count FROM storage_locations'))?.count || 0,
        total_capacity: (await db.get('SELECT SUM(capacity) as total FROM storage_locations'))?.total || 0,
        total_occupancy: (await db.get('SELECT SUM(current_occupancy) as total FROM storage_locations'))?.total || 0,
        utilization_percentage: 0
      }
    };

    // Calculate overall utilization
    if (storageConfig.summary.total_capacity > 0) {
      storageConfig.summary.utilization_percentage = Math.round(
        (storageConfig.summary.total_occupancy / storageConfig.summary.total_capacity) * 100
      );
    }

    res.json({
      success: true,
      storage_config: storageConfig,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get storage config error:', error);
    res.status(500).json({ error: 'Failed to get storage configuration' });
  }
});

module.exports = router;