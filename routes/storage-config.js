// Storage Configuration Routes - Backend for Storage Strategy Config
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

// GET /api/storage-config - Get current storage configuration
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Get ABC classification config
    const abcConfig = await db.get(`
      SELECT * FROM storage_config 
      WHERE config_type = 'abc_classification' 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    // Get storage strategy config
    const strategyConfig = await db.get(`
      SELECT * FROM storage_config 
      WHERE config_type = 'storage_strategy' 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    // Get zone configuration
    const zoneConfig = await db.all(`
      SELECT * FROM storage_config 
      WHERE config_type = 'zone_config' 
      ORDER BY updated_at DESC
    `);
    
    res.json({
      success: true,
      abc_classification: abcConfig ? JSON.parse(abcConfig.config_value) : {
        class_a_threshold: 80,
        class_b_threshold: 95
      },
      storage_strategy: strategyConfig ? JSON.parse(strategyConfig.config_value) : {
        strategy_type: 'class_based'
      },
      zone_config: zoneConfig.length > 0 ? JSON.parse(zoneConfig[0].config_value) : {
        high_frequency_zones: ['A', 'B', 'C'],
        low_frequency_zones: ['D', 'E', 'F']
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get storage config error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get storage configuration' 
    });
  }
});

// POST /api/storage-config/abc - Update ABC classification config
router.post('/abc', async (req, res) => {
  try {
    const db = await getDatabase();
    const { class_a_threshold, class_b_threshold } = req.body;
    
    // Validate thresholds
    if (!class_a_threshold || !class_b_threshold) {
      return res.status(400).json({ 
        success: false,
        error: 'Both thresholds are required' 
      });
    }
    
    if (class_a_threshold >= class_b_threshold) {
      return res.status(400).json({ 
        success: false,
        error: 'Class A threshold must be less than Class B threshold' 
      });
    }
    
    const configValue = JSON.stringify({
      class_a_threshold: parseFloat(class_a_threshold),
      class_b_threshold: parseFloat(class_b_threshold)
    });
    
    // Insert new config
    await db.run(`
      INSERT INTO storage_config (config_type, config_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, ['abc_classification', configValue]);
    
    // Apply ABC classification to products
    await applyABCClassification(db, class_a_threshold, class_b_threshold);
    
    res.json({
      success: true,
      message: 'ABC classification updated successfully',
      config: {
        class_a_threshold: parseFloat(class_a_threshold),
        class_b_threshold: parseFloat(class_b_threshold)
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Update ABC config error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update ABC configuration' 
    });
  }
});

// POST /api/storage-config/strategy - Update storage strategy
router.post('/strategy', async (req, res) => {
  try {
    const db = await getDatabase();
    const { strategy_type } = req.body;
    
    const validStrategies = ['class_based', 'random', 'dedicated', 'hybrid'];
    if (!validStrategies.includes(strategy_type)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid strategy type' 
      });
    }
    
    const configValue = JSON.stringify({
      strategy_type: strategy_type
    });
    
    await db.run(`
      INSERT INTO storage_config (config_type, config_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, ['storage_strategy', configValue]);
    
    res.json({
      success: true,
      message: 'Storage strategy updated successfully',
      config: {
        strategy_type: strategy_type
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Update storage strategy error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update storage strategy' 
    });
  }
});

// POST /api/storage-config/zones - Update zone configuration
router.post('/zones', async (req, res) => {
  try {
    const db = await getDatabase();
    const { high_frequency_zones, low_frequency_zones } = req.body;
    
    if (!high_frequency_zones || !low_frequency_zones) {
      return res.status(400).json({ 
        success: false,
        error: 'Both zone configurations are required' 
      });
    }
    
    const configValue = JSON.stringify({
      high_frequency_zones: high_frequency_zones,
      low_frequency_zones: low_frequency_zones
    });
    
    await db.run(`
      INSERT INTO storage_config (config_type, config_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, ['zone_config', configValue]);
    
    res.json({
      success: true,
      message: 'Zone configuration updated successfully',
      config: {
        high_frequency_zones: high_frequency_zones,
        low_frequency_zones: low_frequency_zones
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Update zone config error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update zone configuration' 
    });
  }
});

// POST /api/storage-config/apply - Apply current configuration to warehouse
router.post('/apply', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Get current configs
    const abcConfig = await db.get(`
      SELECT * FROM storage_config 
      WHERE config_type = 'abc_classification' 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    const strategyConfig = await db.get(`
      SELECT * FROM storage_config 
      WHERE config_type = 'storage_strategy' 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    if (!abcConfig || !strategyConfig) {
      return res.status(400).json({ 
        success: false,
        error: 'Configuration not found. Please set ABC and strategy first.' 
      });
    }
    
    const abc = JSON.parse(abcConfig.config_value);
    const strategy = JSON.parse(strategyConfig.config_value);
    
    // Apply ABC classification
    const productsUpdated = await applyABCClassification(
      db, 
      abc.class_a_threshold, 
      abc.class_b_threshold
    );
    
    // Apply storage strategy (this would reorganize inventory)
    const result = await applyStorageStrategy(db, strategy.strategy_type);
    
    res.json({
      success: true,
      message: 'Configuration applied successfully',
      results: {
        products_classified: productsUpdated,
        strategy_applied: strategy.strategy_type,
        ...result
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Apply config error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to apply configuration' 
    });
  }
});

// Helper function: Apply ABC classification to products
async function applyABCClassification(db, classAThreshold, classBThreshold) {
  // Calculate total value for each product
  const products = await db.all(`
    SELECT 
      p.reference,
      SUM(i.quantity * p.unit_price) as total_value
    FROM products p
    LEFT JOIN inventory i ON p.reference = i.product_reference
    GROUP BY p.reference
    ORDER BY total_value DESC
  `);
  
  // Calculate cumulative percentage
  const totalValue = products.reduce((sum, p) => sum + (p.total_value || 0), 0);
  let cumulativeValue = 0;
  let updatedCount = 0;
  
  for (const product of products) {
    cumulativeValue += (product.total_value || 0);
    const cumulativePercentage = (cumulativeValue / totalValue) * 100;
    
    let abcCode = 'C';
    if (cumulativePercentage <= classAThreshold) {
      abcCode = 'A';
    } else if (cumulativePercentage <= classBThreshold) {
      abcCode = 'B';
    }
    
    await db.run(`
      UPDATE products 
      SET abc_code = ? 
      WHERE reference = ?
    `, [abcCode, product.reference]);
    
    updatedCount++;
  }
  
  return updatedCount;
}

// Helper function: Apply storage strategy
async function applyStorageStrategy(db, strategyType) {
  switch (strategyType) {
    case 'class_based':
      return await applyClassBasedStrategy(db);
    case 'random':
      return { message: 'Random storage strategy - no reorganization needed' };
    case 'dedicated':
      return { message: 'Dedicated storage strategy - manual assignment required' };
    case 'hybrid':
      return await applyHybridStrategy(db);
    default:
      return { message: 'Unknown strategy' };
  }
}

// Apply class-based storage strategy
async function applyClassBasedStrategy(db) {
  // Get zone configuration
  const zoneConfig = await db.get(`
    SELECT * FROM storage_config 
    WHERE config_type = 'zone_config' 
    ORDER BY updated_at DESC 
    LIMIT 1
  `);
  
  const zones = zoneConfig ? JSON.parse(zoneConfig.config_value) : {
    high_frequency_zones: ['A', 'B', 'C'],
    low_frequency_zones: ['D', 'E', 'F']
  };
  
  // This is a simulation - in real system, you would:
  // 1. Identify products that need to move
  // 2. Find available locations in target zones
  // 3. Create movement tasks
  // 4. Update inventory locations
  
  const classAProducts = await db.get(`
    SELECT COUNT(*) as count FROM products WHERE abc_code = 'A'
  `);
  
  const classBProducts = await db.get(`
    SELECT COUNT(*) as count FROM products WHERE abc_code = 'B'
  `);
  
  const classCProducts = await db.get(`
    SELECT COUNT(*) as count FROM products WHERE abc_code = 'C'
  `);
  
  return {
    message: 'Class-based strategy applied',
    class_a_products: classAProducts.count,
    class_b_products: classBProducts.count,
    class_c_products: classCProducts.count,
    high_frequency_zones: zones.high_frequency_zones,
    low_frequency_zones: zones.low_frequency_zones,
    note: 'Products classified. Manual relocation recommended for optimal placement.'
  };
}

// Apply hybrid storage strategy
async function applyHybridStrategy(db) {
  // Hybrid combines class-based for fast movers and random for slow movers
  const result = await applyClassBasedStrategy(db);
  result.message = 'Hybrid strategy applied (Class-based + Random)';
  return result;
}

module.exports = router;
