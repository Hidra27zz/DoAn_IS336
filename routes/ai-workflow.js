// AI Workflow Integration Routes
// Tích hợp AI vào các luồng thực tế trong WMS

const express = require('express');
const AIWorkflowIntegration = require('../services/ai-workflow-integration');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const aiWorkflow = new AIWorkflowIntegration();

// POST /api/ai-workflow/optimize-wave/:waveId
// Auto-optimize wave after creation
router.post('/optimize-wave/:waveId', async (req, res) => {
    try {
        const { waveId } = req.params;
        const result = await aiWorkflow.autoOptimizeWaveOnCreation(waveId);
        
        res.json({
            success: result.optimized,
            wave_id: waveId,
            data: result,
            message: result.optimized 
                ? `Wave optimized with ${result.improvement_percentage.toFixed(1)}% improvement`
                : 'Wave optimization skipped',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Optimize wave error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to optimize wave',
            details: error.message 
        });
    }
});

// POST /api/ai-workflow/classify-product/:productRef
// Auto-classify product on inbound
router.post('/classify-product/:productRef', async (req, res) => {
    try {
        const { productRef } = req.params;
        const result = await aiWorkflow.autoClassifyProductOnInbound(productRef);
        
        res.json({
            success: result.classified,
            product_reference: productRef,
            data: result,
            message: result.classified 
                ? `Product classified as ${result.abc_class}`
                : 'Product classification skipped',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Classify product error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to classify product',
            details: error.message 
        });
    }
});

// POST /api/ai-workflow/suggest-location
// Suggest storage location for inbound
router.post('/suggest-location', async (req, res) => {
    try {
        const { product_reference, quantity } = req.body;
        
        if (!product_reference || !quantity) {
            return res.status(400).json({ 
                success: false, 
                error: 'Product reference and quantity are required' 
            });
        }
        
        const result = await aiWorkflow.autoSuggestStorageLocation(product_reference, quantity);
        
        res.json({
            success: result.suggested,
            product_reference: product_reference,
            data: result,
            message: result.suggested 
                ? `Suggested location: ${result.location_code} in zone ${result.zone}`
                : 'No suitable location found',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Suggest location error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to suggest location',
            details: error.message 
        });
    }
});

// GET /api/ai-workflow/detect-anomalies
// Detect picking performance anomalies
router.get('/detect-anomalies', async (req, res) => {
    try {
        const result = await aiWorkflow.autoDetectPickingAnomalies();
        
        res.json({
            success: result.detected,
            data: result,
            message: result.detected 
                ? `Detected ${result.anomaly_count} picking anomalies`
                : 'No anomalies detected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Detect anomalies error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to detect anomalies',
            details: error.message 
        });
    }
});

// GET /api/ai-workflow/rebalance-storage
// Get storage rebalancing recommendations
router.get('/rebalance-storage', requireRole(['manager', 'admin']), async (req, res) => {
    try {
        const result = await aiWorkflow.autoRebalanceStorage();
        
        res.json({
            success: result.rebalanced,
            data: result,
            message: result.rebalanced 
                ? `Generated ${result.recommendation_count} rebalancing recommendations`
                : 'No rebalancing needed',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Rebalance storage error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to rebalance storage',
            details: error.message 
        });
    }
});

// GET /api/ai-workflow/forecast-demand/:productRef
// Forecast demand for product
router.get('/forecast-demand/:productRef', async (req, res) => {
    try {
        const { productRef } = req.params;
        const result = await aiWorkflow.autoForecastDemand(productRef);
        
        res.json({
            success: result.forecasted,
            product_reference: productRef,
            data: result,
            message: result.forecasted 
                ? `Forecast: ${result.forecast_7_days} units in 7 days`
                : 'Forecast not available',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Forecast demand error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to forecast demand',
            details: error.message 
        });
    }
});

// GET /api/ai-workflow/dashboard
// Get AI workflow dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        // Run all checks in parallel
        const [anomalies, rebalance] = await Promise.all([
            aiWorkflow.autoDetectPickingAnomalies(),
            aiWorkflow.autoRebalanceStorage()
        ]);
        
        res.json({
            success: true,
            data: {
                anomalies: {
                    detected: anomalies.detected,
                    count: anomalies.anomaly_count || 0,
                    avg_pick_time: anomalies.avg_pick_time || 0
                },
                rebalancing: {
                    needed: rebalance.rebalanced,
                    recommendation_count: rebalance.recommendation_count || 0,
                    top_recommendations: rebalance.recommendations?.slice(0, 5) || []
                },
                auto_optimization: {
                    enabled: aiWorkflow.autoOptimizeEnabled,
                    features: [
                        'Wave route optimization',
                        'Product classification',
                        'Storage location suggestion',
                        'Anomaly detection',
                        'Demand forecasting',
                        'Storage rebalancing'
                    ]
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('AI workflow dashboard error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to load AI workflow dashboard',
            details: error.message 
        });
    }
});

module.exports = router;
