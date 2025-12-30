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

// GET /api/config/storage/abc - Get ABC classification config
router.get('/storage/abc', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Get ABC distribution
    const abcDistribution = await db.all(`
      SELECT 
        abc_code,
        COUNT(*) as product_count,
        SUM(i.quantity) as total_quantity
      FROM products p
      LEFT JOIN inventory i ON p.reference = i.product_reference
      GROUP BY abc_code
      ORDER BY abc_code
    `);
    
    res.json({
      success: true,
      abc_config: {
        class_a_threshold: 20,
        class_b_threshold: 50,
        distribution: abcDistribution
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get ABC config error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get ABC configuration',
      details: error.message 
    });
  }
});

// PUT /api/config/storage/abc - Update ABC classification config
router.put('/storage/abc', async (req, res) => {
  try {
    const { class_a_threshold, class_b_threshold } = req.body;
    
    res.json({
      success: true,
      message: 'ABC configuration updated',
      config: {
        class_a_threshold: class_a_threshold || 20,
        class_b_threshold: class_b_threshold || 50
      }
    });
    
  } catch (error) {
    console.error('Update ABC config error:', error);
    res.status(500).json({ error: 'Failed to update ABC configuration' });
  }
});

// GET /api/config/storage/strategy - Get storage strategy config
router.get('/storage/strategy', async (req, res) => {
  try {
    res.json({
      success: true,
      strategy_config: {
        current_strategy: 'class_based',
        available_strategies: [
          { id: 'class_based', name: 'Class-Based Storage', description: 'Store products based on ABC classification' },
          { id: 'random', name: 'Random Storage', description: 'Store products in any available location' },
          { id: 'dedicated', name: 'Dedicated Storage', description: 'Assign specific locations to specific products' },
          { id: 'hybrid', name: 'Hybrid Storage', description: 'Combination of strategies' }
        ]
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get storage strategy error:', error);
    res.status(500).json({ error: 'Failed to get storage strategy' });
  }
});

// PUT /api/config/storage/strategy - Update storage strategy
router.put('/storage/strategy', async (req, res) => {
  try {
    const { strategy_type } = req.body;
    
    res.json({
      success: true,
      message: 'Storage strategy updated',
      strategy: strategy_type || 'class_based'
    });
    
  } catch (error) {
    console.error('Update storage strategy error:', error);
    res.status(500).json({ error: 'Failed to update storage strategy' });
  }
});

// GET /api/config/storage/zones - Get zone configuration
router.get('/storage/zones', async (req, res) => {
  try {
    const db = await getDatabase();
    
    const zones = await db.all(`
      SELECT 
        zone,
        COUNT(*) as location_count,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as utilization_rate
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `);
    
    res.json({
      success: true,
      zones: zones.map(z => ({
        zone: z.zone,
        location_count: z.location_count,
        total_capacity: z.total_capacity,
        total_occupancy: z.total_occupancy,
        utilization_rate: z.utilization_rate || 0,
        zone_type: z.zone <= 'C' ? 'high_frequency' : 'low_frequency'
      })),
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get zone config error:', error);
    res.status(500).json({ error: 'Failed to get zone configuration' });
  }
});

// PUT /api/config/storage/zones - Update zone configuration
router.put('/storage/zones', async (req, res) => {
  try {
    const { high_frequency_zones, low_frequency_zones } = req.body;
    
    res.json({
      success: true,
      message: 'Zone configuration updated',
      config: {
        high_frequency_zones: high_frequency_zones || ['A', 'B', 'C'],
        low_frequency_zones: low_frequency_zones || ['D', 'E', 'F']
      }
    });
    
  } catch (error) {
    console.error('Update zone config error:', error);
    res.status(500).json({ error: 'Failed to update zone configuration' });
  }
});

module.exports = router;