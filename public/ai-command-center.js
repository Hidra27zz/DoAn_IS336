// AI Command Center JavaScript
let aiMetrics = {
    kmeans: { accuracy: 0, products: 0, clusters: 3 },
    route: { improvement: 0, distance: 0, time: 0 },
    dbscan: { accuracy: 0, anomalies: 0, clusters: 0 },
    forecast: { accuracy: 0, products: 0, confidence: 0 }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAIMetrics();
    startRealtimeUpdates();
});

// Load AI metrics from server
async function loadAIMetrics() {
    try {
        const response = await fetch('/api/public/ai/stats');
        const data = await response.json();
        
        if (data.success) {
            updateMetricsDisplay(data.data);
            logActivity('AI metrics loaded successfully');
        }
    } catch (error) {
        console.error('Error loading AI metrics:', error);
        logActivity('Error loading AI metrics', 'error');
    }
}

// Update metrics display
function updateMetricsDisplay(data) {
    // K-Means
    if (data.algorithms?.kmeans) {
        document.getElementById('kmeans-accuracy').textContent = 
            `${data.algorithms.kmeans.accuracy}%`;
        document.getElementById('kmeans-products').textContent = 
            data.dataset.products || 0;
        animateProgress('kmeans-progress', data.algorithms.kmeans.accuracy);
    }

    // Route Optimization
    if (data.algorithms?.genetic_algorithm) {
        document.getElementById('route-improvement').textContent = 
            `${data.algorithms.genetic_algorithm.improvement_percentage}%`;
        document.getElementById('route-distance').textContent = 
            `${Math.round(data.algorithms.genetic_algorithm.improvement_percentage * 10)}m`;
        document.getElementById('route-time').textContent = 
            `${Math.round(data.algorithms.genetic_algorithm.improvement_percentage * 0.5)}min`;
        animateProgress('route-progress', data.algorithms.genetic_algorithm.improvement_percentage);
    }

    // DBSCAN
    if (data.algorithms?.dbscan) {
        document.getElementById('dbscan-accuracy').textContent = 
            `${Math.round(data.performance.forecast_accuracy)}%`;
        document.getElementById('dbscan-anomalies').textContent = 
            data.algorithms.dbscan.anomalies_detected || 0;
        document.getElementById('dbscan-clusters').textContent = 
            data.algorithms.dbscan.clusters_found || 0;
        animateProgress('dbscan-progress', data.performance.forecast_accuracy);
    }

    // Forecast
    document.getElementById('forecast-accuracy').textContent = 
        `${Math.round(data.performance.forecast_accuracy)}%`;
    document.getElementById('forecast-products').textContent = 
        data.dataset.products || 0;
    document.getElementById('forecast-confidence').textContent = 
        `${Math.round(data.performance.overall_efficiency)}%`;
    animateProgress('forecast-progress', data.performance.overall_efficiency);
}

// Animate progress bar
function animateProgress(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseFloat(element.style.width) || 0;
    const step = (targetValue - currentValue) / 20;
    
    let current = currentValue;
    const interval = setInterval(() => {
        current += step;
        if ((step > 0 && current >= targetValue) || (step < 0 && current <= targetValue)) {
            current = targetValue;
            clearInterval(interval);
        }
        element.style.width = `${current}%`;
    }, 50);
}

// Run K-Means clustering
async function runKMeans() {
    showThinking('Running K-Means Clustering', 'Analyzing product patterns...');
    logActivity('Starting K-Means clustering analysis');
    
    try {
        const response = await fetch('/api/ai/clustering/kmeans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ k: 3 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideThinking();
            logActivity(`K-Means completed: ${data.products_analyzed} products analyzed, ${data.accuracy}% accuracy`);
            
            // Update metrics
            document.getElementById('kmeans-accuracy').textContent = 
                `${data.accuracy}%`;
            document.getElementById('kmeans-products').textContent = 
                data.products_analyzed;
            animateProgress('kmeans-progress', data.accuracy);
            
            // Removed comparison display
        }
    } catch (error) {
        hideThinking();
        logActivity('K-Means clustering failed', 'error');
        console.error(error);
    }
}

// Run DBSCAN anomaly detection
async function runDBSCAN() {
    showThinking('Running DBSCAN Analysis', 'Detecting anomalies...');
    logActivity('Starting DBSCAN anomaly detection');
    
    try {
        const response = await fetch('/api/ai/clustering/dbscan', {
            method: 'GET'
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideThinking();
            logActivity(`DBSCAN completed: ${data.clusters_detected} clusters, ${data.anomalies_found} anomalies detected`);
            
            // Update metrics
            document.getElementById('dbscan-clusters').textContent = data.clusters_detected;
            document.getElementById('dbscan-anomalies').textContent = data.anomalies_found;
            animateProgress('dbscan-progress', data.accuracy);
        }
    } catch (error) {
        hideThinking();
        logActivity('DBSCAN analysis failed', 'error');
        console.error(error);
    }
}

// Optimize route
async function optimizeRoute() {
    showThinking('Optimizing Routes', 'Running genetic algorithm...');
    logActivity('Starting route optimization');
    
    try {
        const response = await fetch('/api/ai/route/optimize', {
            method: 'GET'
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideThinking();
            const improvement = data.improvement;
            logActivity(`Route optimized: ${improvement}% improvement, ${data.distance_saved}m saved`);
            
            // Update metrics
            document.getElementById('route-improvement').textContent = `${improvement}%`;
            document.getElementById('route-distance').textContent = `${data.distance_saved}m`;
            document.getElementById('route-time').textContent = `${data.time_saved}min`;
            animateProgress('route-progress', improvement);
        }
    } catch (error) {
        hideThinking();
        logActivity('Route optimization failed', 'error');
        console.error(error);
    }
}

// Generate forecast
async function generateForecast() {
    showThinking('Generating Forecast', 'Analyzing demand patterns...');
    logActivity('Starting demand forecasting');
    
    try {
        const response = await fetch('/api/ai/stats');
        const data = await response.json();
        
        if (data.success && data.predictive) {
            hideThinking();
            logActivity(`Forecast generated: ${data.predictive.forecast_accuracy}% accuracy`);
            
            // Update metrics
            document.getElementById('forecast-accuracy').textContent = `${data.predictive.forecast_accuracy}%`;
            document.getElementById('forecast-products').textContent = data.predictive.products_forecasted;
            document.getElementById('forecast-confidence').textContent = `${data.predictive.confidence}%`;
            animateProgress('forecast-progress', data.predictive.forecast_accuracy);
        } else {
            hideThinking();
            logActivity('No forecast data available', 'error');
        }
    } catch (error) {
        hideThinking();
        logActivity('Forecast generation failed', 'error');
        console.error(error);
    }
}

// Run all AI algorithms
async function runAllAI() {
    logActivity('Starting full AI analysis suite');
    
    await runKMeans();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await runDBSCAN();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await optimizeRoute();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await generateForecast();
    
    logActivity('Full AI analysis completed', 'success');
}

// View comparison
function viewComparison() {
    const comparison = document.getElementById('ai-comparison');
    if (comparison.style.display === 'none') {
        comparison.style.display = 'grid';
        logActivity('Showing AI comparison results');
    } else {
        comparison.style.display = 'none';
    }
}

// Show thinking animation
function showThinking(title, detail) {
    const thinking = document.getElementById('ai-thinking');
    document.getElementById('thinking-text').textContent = title;
    document.getElementById('thinking-detail').textContent = detail;
    thinking.classList.add('active');
}

// Hide thinking animation
function hideThinking() {
    const thinking = document.getElementById('ai-thinking');
    thinking.classList.remove('active');
}

// Show comparison - REMOVED (no longer showing before/after)

// Log activity
function logActivity(message, type = 'info') {
    const log = document.getElementById('ai-log');
    const timestamp = new Date().toLocaleTimeString();
    const icon = type === 'error' ? 'ERROR' : type === 'success' ? 'SUCCESS' : 'INFO';
    
    const entry = document.createElement('div');
    entry.className = 'ai-log-entry';
    entry.textContent = `[${timestamp}] ${icon} ${message}`;
    
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    
    // Keep only last 50 entries
    while (log.children.length > 50) {
        log.removeChild(log.firstChild);
    }
}

// Start realtime updates
function startRealtimeUpdates() {
    setInterval(() => {
        loadAIMetrics();
    }, 30000); // Update every 30 seconds
}
