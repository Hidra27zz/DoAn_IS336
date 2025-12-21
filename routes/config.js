// Configuration Routes
const express = require('express');
const router = express.Router();

// Mock configuration data
let storageConfig = {
  abc_thresholds: {
    class_a: 80,
    class_b: 15,
    class_c: 5
  },
  storage_strategy: 'class-based',
  zone_config: {
    high_frequency: 'A',
    low_frequency: 'F'
  }
};

// GET /api/config/storage - Get current storage configuration
router.get('/storage', (req, res) => {
  try {
    res.json({
      success: true,
      data: storageConfig
    });
  } catch (error) {
    console.error('Error getting storage config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get storage configuration'
    });
  }
});

// PUT /api/config/storage/abc - Update ABC thresholds
router.put('/storage/abc', (req, res) => {
  try {
    const { class_a, class_b, class_c } = req.body;
    
    if (!class_a || !class_b || !class_c) {
      return res.status(400).json({
        success: false,
        error: 'All ABC thresholds are required'
      });
    }
    
    if (class_a + class_b + class_c !== 100) {
      return res.status(400).json({
        success: false,
        error: 'ABC thresholds must sum to 100%'
      });
    }
    
    storageConfig.abc_thresholds = { class_a, class_b, class_c };
    
    res.json({
      success: true,
      message: 'ABC thresholds updated successfully',
      data: storageConfig.abc_thresholds
    });
  } catch (error) {
    console.error('Error updating ABC config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ABC configuration'
    });
  }
});

// PUT /api/config/storage/strategy - Update storage strategy
router.put('/storage/strategy', (req, res) => {
  try {
    const { strategy } = req.body;
    
    const validStrategies = ['class-based', 'random', 'dedicated', 'hybrid'];
    if (!validStrategies.includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid storage strategy'
      });
    }
    
    storageConfig.storage_strategy = strategy;
    
    res.json({
      success: true,
      message: 'Storage strategy updated successfully',
      data: { strategy }
    });
  } catch (error) {
    console.error('Error updating storage strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update storage strategy'
    });
  }
});

// PUT /api/config/storage/zones - Update zone configuration
router.put('/storage/zones', (req, res) => {
  try {
    const { high_frequency, low_frequency } = req.body;
    
    const validZones = ['A', 'B', 'C', 'D', 'E', 'F'];
    if (!validZones.includes(high_frequency) || !validZones.includes(low_frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid zone selection'
      });
    }
    
    if (high_frequency === low_frequency) {
      return res.status(400).json({
        success: false,
        error: 'High and low frequency zones must be different'
      });
    }
    
    storageConfig.zone_config = { high_frequency, low_frequency };
    
    res.json({
      success: true,
      message: 'Zone configuration updated successfully',
      data: storageConfig.zone_config
    });
  } catch (error) {
    console.error('Error updating zone config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update zone configuration'
    });
  }
});

module.exports = router;