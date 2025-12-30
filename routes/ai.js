// AI Routes - Simple but Real AI calculations from database
const express = require('express');
const { getDatabase } = require('../config/database');
const simpleAI = require('../services/simple-ai');

const router = express.Router();

// GET /api/ai/stats - Get AI statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await simpleAI.getStats();
    res.json(stats);
  } catch (error) {
    console.error('AI stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get AI statistics' 
    });
  }
});

// POST /api/ai/kmeans - Run K-Means clustering
router.post('/kmeans', async (req, res) => {
  try {
    const result = await simpleAI.runKMeans();
    res.json(result);
  } catch (error) {
    console.error('K-Means error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to run K-Means clustering' 
    });
  }
});

// POST /api/ai/dbscan - Run DBSCAN anomaly detection
router.post('/dbscan', async (req, res) => {
  try {
    const result = await simpleAI.runDBSCAN();
    res.json(result);
  } catch (error) {
    console.error('DBSCAN error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to run DBSCAN' 
    });
  }
});

// POST /api/ai/route-optimization - Optimize picking route
router.post('/route-optimization', async (req, res) => {
  try {
    const { wave_number } = req.body;
    
    if (!wave_number) {
      return res.status(400).json({ 
        success: false,
        error: 'wave_number is required' 
      });
    }
    
    const result = await simpleAI.optimizeRoute(wave_number);
    res.json(result);
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to optimize route' 
    });
  }
});

// POST /api/ai/demand-forecast - Forecast demand
router.post('/demand-forecast', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const result = await simpleAI.forecastDemand(days);
    res.json(result);
  } catch (error) {
    console.error('Demand forecast error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to forecast demand' 
    });
  }
});

// POST /api/ai/run-all - Run all AI analyses
router.post('/run-all', async (req, res) => {
  try {
    const [kmeans, dbscan, forecast] = await Promise.all([
      simpleAI.runKMeans(),
      simpleAI.runDBSCAN(),
      simpleAI.forecastDemand(30)
    ]);
    
    res.json({
      success: true,
      results: {
        kmeans,
        dbscan,
        forecast
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Run all AI error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to run all AI analyses' 
    });
  }
});

module.exports = router;
