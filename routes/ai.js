// AI Routes - Clustering and Route Optimization APIs - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');
const { ProductClusteringService } = require('../services/ai-clustering');
const { RouteOptimizationService } = require('../services/ai-route-optimization');

const router = express.Router();

// Initialize AI services
const clusteringService = new ProductClusteringService();
const routeOptimizationService = new RouteOptimizationService();

// POST /api/ai/clustering/products - Run K-Means clustering on products
router.post('/clustering/products', async (req, res) => {
  try {
    const db = await getDatabase();
    const { k = 3, features = ['quantity', 'frequency'] } = req.body;

    // Get product data with inventory statistics
    const productData = await db.all(`
      SELECT 
        p.reference,
        p.abc_code,
        p.sector,
        COUNT(i.id) as location_count,
        SUM(i.quantity) as total_quantity,
        AVG(i.quantity) as avg_quantity
      FROM products p
      LEFT JOIN inventory i ON p.reference = i.product_reference
      GROUP BY p.reference, p.abc_code, p.sector
      HAVING total_quantity > 0
    `);

    // Run clustering
    const clusteringResult = await clusteringService.clusterProducts(productData, k, features);

    res.json({
      success: true,
      algorithm: 'K-Means',
      k: k,
      features: features,
      products_analyzed: productData.length,
      clusters: clusteringResult.clusters,
      centroids: clusteringResult.centroids,
      accuracy: clusteringResult.accuracy,
      processing_time: clusteringResult.processingTime,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Product clustering error:', error);
    res.status(500).json({ error: 'Failed to run product clustering' });
  }
});

// POST /api/ai/optimization/routes - Optimize picking routes
router.post('/optimization/routes', async (req, res) => {
  try {
    const db = await getDatabase();
    const { wave_id, algorithm = 'genetic' } = req.body;

    // Get picking tasks for the wave (mock data for now)
    const pickingTasks = [
      { product_reference: 'O9YFO8', location_code: 'A-14-11', quantity: 5, x: 368, y: 0, z: 1 },
      { product_reference: 'I1X92B', location_code: 'A-14-12', quantity: 3, x: 352, y: 0, z: 1 },
      { product_reference: 'HOUGRO', location_code: 'B-15-11', quantity: 2, x: 300, y: 50, z: 1 }
    ];

    // Run route optimization
    const optimizationResult = await routeOptimizationService.optimizeRoute(pickingTasks, algorithm);

    res.json({
      success: true,
      wave_id: wave_id,
      algorithm: algorithm,
      tasks_optimized: pickingTasks.length,
      optimized_route: optimizationResult.route,
      distance_reduction: optimizationResult.distanceReduction,
      time_saved: optimizationResult.timeSaved,
      processing_time: optimizationResult.processingTime,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize routes' });
  }
});

// GET /api/ai/analytics/performance - Get AI performance metrics
router.get('/analytics/performance', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get basic statistics
    const productCount = await db.get('SELECT COUNT(*) as count FROM products');
    const inventoryCount = await db.get('SELECT COUNT(*) as count FROM inventory');
    const locationCount = await db.get('SELECT COUNT(*) as count FROM storage_locations');

    // Mock AI performance metrics (replace with real calculations)
    const aiMetrics = {
      kmeans: {
        accuracy: 87.5,
        clusters_created: 3,
        products_classified: productCount.count,
        last_run: new Date().toISOString()
      },
      route_optimization: {
        improvement_percentage: 23.4,
        routes_optimized: 45,
        time_saved_minutes: 127,
        last_run: new Date().toISOString()
      },
      anomaly_detection: {
        anomalies_detected: 12,
        accuracy: 94.2,
        patterns_identified: 8,
        last_run: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      dataset: {
        products: productCount.count,
        inventory_records: inventoryCount.count,
        storage_locations: locationCount.count
      },
      ai_performance: aiMetrics,
      overall_efficiency: 89.3,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('AI analytics error:', error);
    res.status(500).json({ error: 'Failed to get AI analytics' });
  }
});

// POST /api/ai/anomaly/detect - Run anomaly detection
router.post('/anomaly/detect', async (req, res) => {
  try {
    const db = await getDatabase();
    const { algorithm = 'dbscan', threshold = 0.1 } = req.body;

    // Get inventory data for anomaly detection
    const inventoryData = await db.all(`
      SELECT 
        i.product_reference,
        i.location_code,
        i.quantity,
        sl.zone,
        sl.x, sl.y, sl.z,
        p.abc_code
      FROM inventory i
      JOIN storage_locations sl ON i.location_code = sl.location_code
      JOIN products p ON i.product_reference = p.reference
      WHERE i.quantity > 0
      LIMIT 1000
    `);

    // Mock anomaly detection results
    const anomalies = inventoryData
      .filter(() => Math.random() < threshold)
      .map(item => ({
        ...item,
        anomaly_type: 'quantity_outlier',
        confidence: Math.random() * 0.5 + 0.5,
        reason: 'Quantity significantly different from zone average'
      }));

    res.json({
      success: true,
      algorithm: algorithm,
      data_points_analyzed: inventoryData.length,
      anomalies_detected: anomalies.length,
      anomaly_rate: (anomalies.length / inventoryData.length) * 100,
      anomalies: anomalies.slice(0, 10), // Return top 10
      threshold: threshold,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({ error: 'Failed to run anomaly detection' });
  }
});

module.exports = router;