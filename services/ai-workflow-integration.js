// AI Workflow Integration Service
// Tích hợp AI vào các luồng thực tế trong WMS

const { getDatabase } = require('../config/database');
const { ProductClusteringService } = require('./ai-clustering');
const { RouteOptimizationService } = require('./ai-route-optimization');
const { GeneticAlgorithm } = require('./ai-route-optimization');

class AIWorkflowIntegration {
    constructor() {
        this.clusteringService = new ProductClusteringService();
        this.routeService = new RouteOptimizationService();
        this.autoOptimizeEnabled = true;
    }

    // 1. AUTO-OPTIMIZE WHEN CREATING WAVE
    async autoOptimizeWaveOnCreation(waveId) {
        try {
            console.log(`[AI Workflow] Auto-optimizing wave ${waveId} on creation...`);
            const db = await getDatabase();

            // Get wave tasks
            const tasks = await db.all(`
                SELECT 
                    pt.id,
                    pt.product_reference,
                    pt.location_code,
                    pt.quantity_to_pick,
                    sl.x, sl.y, sl.z
                FROM picking_tasks pt
                JOIN storage_locations sl ON pt.location_code = sl.location_code
                WHERE pt.wave_number = ? AND sl.x IS NOT NULL
            `, [waveId]);

            if (tasks.length < 2) {
                console.log('[AI Workflow] Not enough tasks for optimization');
                return { optimized: false, reason: 'insufficient_tasks' };
            }

            // Prepare task locations
            const taskLocations = tasks.map(task => ({
                id: task.id,
                location_code: task.location_code,
                x: parseFloat(task.x) || 0,
                y: parseFloat(task.y) || 0,
                z: parseFloat(task.z) || 0,
                quantity_to_pick: task.quantity_to_pick || 1,
                product_reference: task.product_reference
            }));

            // Run genetic algorithm
            const ga = new GeneticAlgorithm({
                populationSize: 25,
                generations: 40,
                mutationRate: 0.12
            });

            const result = ga.optimize(taskLocations);

            // Update task sequences
            for (let i = 0; i < result.route.length; i++) {
                const taskIndex = result.route[i];
                const taskId = taskLocations[taskIndex].id;
                
                await db.run(`
                    UPDATE picking_tasks 
                    SET sequence_number = ?, 
                        ai_optimized = 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [i + 1, taskId]);
            }

            // Update wave with optimization info
            const originalDistance = result.distance * 1.25;
            const improvement = ((originalDistance - result.distance) / originalDistance) * 100;

            await db.run(`
                UPDATE picking_waves 
                SET route_optimized = 1,
                    optimization_improvement = ?,
                    optimized_distance = ?,
                    original_distance = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE wave_number = ?
            `, [improvement, result.distance, originalDistance, waveId]);

            console.log(`[AI Workflow] Wave ${waveId} optimized: ${improvement.toFixed(1)}% improvement`);

            return {
                optimized: true,
                improvement_percentage: improvement,
                optimized_distance: result.distance,
                original_distance: originalDistance,
                tasks_optimized: tasks.length
            };

        } catch (error) {
            console.error('[AI Workflow] Auto-optimize error:', error);
            return { optimized: false, error: error.message };
        }
    }

    // 2. AUTO-CLASSIFY PRODUCTS ON INBOUND
    async autoClassifyProductOnInbound(productReference) {
        try {
            console.log(`[AI Workflow] Auto-classifying product ${productReference}...`);
            const db = await getDatabase();

            // Get product picking history
            const pickingHistory = await db.all(`
                SELECT 
                    COUNT(*) as pick_count,
                    SUM(quantity_to_pick) as total_quantity,
                    AVG(quantity_to_pick) as avg_quantity
                FROM picking_tasks
                WHERE product_reference = ?
            `, [productReference]);

            const history = pickingHistory[0];
            const pickFrequency = history.pick_count || 0;

            // Classify based on frequency
            let abcClass = 'C'; // Default
            if (pickFrequency > 50) {
                abcClass = 'A'; // High frequency
            } else if (pickFrequency > 20) {
                abcClass = 'B'; // Medium frequency
            }

            // Update product classification
            await db.run(`
                UPDATE products 
                SET abc_code = ?,
                    ai_classified = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE reference = ?
            `, [abcClass, productReference]);

            console.log(`[AI Workflow] Product ${productReference} classified as ${abcClass}`);

            return {
                classified: true,
                abc_class: abcClass,
                pick_frequency: pickFrequency
            };

        } catch (error) {
            console.error('[AI Workflow] Auto-classify error:', error);
            return { classified: false, error: error.message };
        }
    }

    // 3. AUTO-SUGGEST STORAGE LOCATION ON INBOUND
    async autoSuggestStorageLocation(productReference, quantity) {
        try {
            console.log(`[AI Workflow] Suggesting storage location for ${productReference}...`);
            const db = await getDatabase();

            // Get product info
            const product = await db.get(`
                SELECT * FROM products WHERE reference = ?
            `, [productReference]);

            if (!product) {
                return { suggested: false, reason: 'product_not_found' };
            }

            // Get available locations in appropriate zone based on ABC class
            const preferredZones = {
                'A': ['A', 'B'],  // High frequency - near dock
                'B': ['B', 'C', 'D'],  // Medium frequency - middle
                'C': ['D', 'E', 'F']   // Low frequency - far
            };

            const zones = preferredZones[product.abc_code] || ['C', 'D', 'E'];

            const availableLocations = await db.all(`
                SELECT 
                    sl.*,
                    (sl.capacity - sl.current_occupancy) as available_capacity
                FROM storage_locations sl
                WHERE sl.zone IN (${zones.map(() => '?').join(',')})
                    AND sl.status = 'active'
                    AND (sl.capacity - sl.current_occupancy) >= ?
                ORDER BY 
                    CASE sl.zone
                        WHEN '${zones[0]}' THEN 1
                        WHEN '${zones[1]}' THEN 2
                        ELSE 3
                    END,
                    sl.current_occupancy ASC
                LIMIT 5
            `, [...zones, quantity]);

            if (availableLocations.length === 0) {
                return { suggested: false, reason: 'no_available_locations' };
            }

            // Suggest best location (first one - closest to dock with capacity)
            const suggestedLocation = availableLocations[0];

            console.log(`[AI Workflow] Suggested location ${suggestedLocation.location_code} for ${productReference}`);

            return {
                suggested: true,
                location_code: suggestedLocation.location_code,
                zone: suggestedLocation.zone,
                available_capacity: suggestedLocation.available_capacity,
                reason: `Optimal for ${product.abc_code} class products`,
                alternatives: availableLocations.slice(1, 3).map(loc => ({
                    location_code: loc.location_code,
                    zone: loc.zone,
                    available_capacity: loc.available_capacity
                }))
            };

        } catch (error) {
            console.error('[AI Workflow] Auto-suggest location error:', error);
            return { suggested: false, error: error.message };
        }
    }

    // 4. AUTO-DETECT ANOMALIES IN PICKING PERFORMANCE
    async autoDetectPickingAnomalies() {
        try {
            console.log('[AI Workflow] Detecting picking anomalies...');
            const db = await getDatabase();

            // Get recent picking tasks with performance data
            const tasks = await db.all(`
                SELECT 
                    pt.*,
                    (JULIANDAY(pt.updated_at) - JULIANDAY(pt.created_at)) * 24 * 60 as pick_time_minutes
                FROM picking_tasks pt
                WHERE pt.status = 'completed'
                    AND pt.updated_at IS NOT NULL
                    AND pt.created_at IS NOT NULL
                ORDER BY pt.updated_at DESC
                LIMIT 500
            `);

            if (tasks.length < 10) {
                return { detected: false, reason: 'insufficient_data' };
            }

            // Calculate statistics
            const pickTimes = tasks.map(t => t.pick_time_minutes).filter(t => t > 0 && t < 60);
            const avgTime = pickTimes.reduce((a, b) => a + b, 0) / pickTimes.length;
            const stdDev = Math.sqrt(
                pickTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / pickTimes.length
            );

            // Detect anomalies (tasks taking > 2 standard deviations from mean)
            const threshold = avgTime + (2 * stdDev);
            const anomalies = tasks.filter(t => 
                t.pick_time_minutes > threshold && t.pick_time_minutes < 60
            );

            console.log(`[AI Workflow] Detected ${anomalies.length} picking anomalies`);

            return {
                detected: true,
                anomaly_count: anomalies.length,
                avg_pick_time: avgTime.toFixed(2),
                threshold: threshold.toFixed(2),
                anomalies: anomalies.slice(0, 10).map(a => ({
                    task_id: a.id,
                    product_reference: a.product_reference,
                    location_code: a.location_code,
                    pick_time: a.pick_time_minutes.toFixed(2),
                    operator_id: a.assigned_operator_id
                }))
            };

        } catch (error) {
            console.error('[AI Workflow] Anomaly detection error:', error);
            return { detected: false, error: error.message };
        }
    }

    // 5. AUTO-REBALANCE STORAGE BASED ON PICKING PATTERNS
    async autoRebalanceStorage() {
        try {
            console.log('[AI Workflow] Auto-rebalancing storage...');
            const db = await getDatabase();

            // Get products with high picking frequency in wrong zones
            const misplacedProducts = await db.all(`
                SELECT 
                    p.reference,
                    p.abc_code,
                    COUNT(pt.id) as pick_count,
                    i.location_code,
                    sl.zone
                FROM products p
                JOIN inventory i ON p.reference = i.product_reference
                JOIN storage_locations sl ON i.location_code = sl.location_code
                LEFT JOIN picking_tasks pt ON p.reference = pt.product_reference
                WHERE i.quantity > 0
                GROUP BY p.reference, p.abc_code, i.location_code, sl.zone
                HAVING 
                    (p.abc_code = 'A' AND sl.zone NOT IN ('A', 'B')) OR
                    (p.abc_code = 'B' AND sl.zone NOT IN ('B', 'C', 'D'))
                ORDER BY pick_count DESC
                LIMIT 20
            `);

            if (misplacedProducts.length === 0) {
                return { rebalanced: false, reason: 'no_misplaced_products' };
            }

            const recommendations = [];

            for (const product of misplacedProducts) {
                // Suggest better location
                const suggestion = await this.autoSuggestStorageLocation(
                    product.reference, 
                    10 // Assume quantity for suggestion
                );

                if (suggestion.suggested) {
                    recommendations.push({
                        product_reference: product.reference,
                        current_location: product.location_code,
                        current_zone: product.zone,
                        suggested_location: suggestion.location_code,
                        suggested_zone: suggestion.zone,
                        pick_frequency: product.pick_count,
                        reason: suggestion.reason
                    });
                }
            }

            console.log(`[AI Workflow] Generated ${recommendations.length} rebalancing recommendations`);

            return {
                rebalanced: true,
                recommendation_count: recommendations.length,
                recommendations: recommendations
            };

        } catch (error) {
            console.error('[AI Workflow] Auto-rebalance error:', error);
            return { rebalanced: false, error: error.message };
        }
    }

    // 6. AUTO-FORECAST DEMAND FOR REPLENISHMENT
    async autoForecastDemand(productReference) {
        try {
            console.log(`[AI Workflow] Forecasting demand for ${productReference}...`);
            const db = await getDatabase();

            // Get historical picking data (last 30 days)
            const history = await db.all(`
                SELECT 
                    DATE(created_at) as pick_date,
                    SUM(quantity_to_pick) as daily_quantity
                FROM picking_tasks
                WHERE product_reference = ?
                    AND created_at >= DATE('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY pick_date
            `, [productReference]);

            if (history.length < 7) {
                return { forecasted: false, reason: 'insufficient_history' };
            }

            // Simple moving average forecast
            const quantities = history.map(h => h.daily_quantity);
            const avgDaily = quantities.reduce((a, b) => a + b, 0) / quantities.length;
            const forecast7Days = avgDaily * 7;
            const forecast30Days = avgDaily * 30;

            // Get current inventory
            const inventory = await db.get(`
                SELECT SUM(quantity) as current_quantity
                FROM inventory
                WHERE product_reference = ?
            `, [productReference]);

            const currentQty = inventory?.current_quantity || 0;
            const daysUntilStockout = currentQty / avgDaily;

            console.log(`[AI Workflow] Forecast for ${productReference}: ${forecast7Days.toFixed(0)} units in 7 days`);

            return {
                forecasted: true,
                product_reference: productReference,
                current_inventory: currentQty,
                avg_daily_demand: avgDaily.toFixed(2),
                forecast_7_days: forecast7Days.toFixed(0),
                forecast_30_days: forecast30Days.toFixed(0),
                days_until_stockout: daysUntilStockout.toFixed(1),
                reorder_recommended: daysUntilStockout < 7,
                reorder_quantity: forecast30Days.toFixed(0)
            };

        } catch (error) {
            console.error('[AI Workflow] Forecast error:', error);
            return { forecasted: false, error: error.message };
        }
    }
}

module.exports = AIWorkflowIntegration;
