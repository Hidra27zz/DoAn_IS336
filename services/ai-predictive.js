// AI Predictive Analytics Service
// Dự đoán nhu cầu và tối ưu hóa proactive

class PredictiveAnalyticsService {
  constructor() {
    this.models = {
      demand: null,
      seasonality: null,
      capacity: null
    };
  }

  // Dự đoán nhu cầu sản phẩm
  async predictDemand(productId, timeHorizon = 30) {
    const historicalData = await this.getHistoricalData(productId);
    
    // Simple moving average với seasonal adjustment
    const trend = this.calculateTrend(historicalData);
    const seasonality = this.calculateSeasonality(historicalData);
    
    const predictions = [];
    for (let day = 1; day <= timeHorizon; day++) {
      const baseDemand = trend.slope * day + trend.intercept;
      const seasonalFactor = seasonality[day % 365] || 1;
      const predictedDemand = Math.max(0, baseDemand * seasonalFactor);
      
      predictions.push({
        date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString(),
        predicted_demand: Math.round(predictedDemand),
        confidence: this.calculateConfidence(historicalData, day)
      });
    }
    
    return {
      product_id: productId,
      predictions: predictions,
      model_accuracy: this.calculateModelAccuracy(historicalData)
    };
  }

  // Dự đoán capacity cần thiết
  async predictCapacityNeeds(zoneId, timeHorizon = 7) {
    const currentUtilization = await this.getCurrentUtilization(zoneId);
    const demandForecast = await this.getZoneDemandForecast(zoneId, timeHorizon);
    
    const capacityNeeds = demandForecast.map(forecast => {
      const requiredCapacity = forecast.predicted_volume * 1.2; // 20% buffer
      const currentCapacity = currentUtilization.total_capacity;
      
      return {
        date: forecast.date,
        required_capacity: requiredCapacity,
        current_capacity: currentCapacity,
        utilization_percentage: (requiredCapacity / currentCapacity) * 100,
        needs_expansion: requiredCapacity > currentCapacity,
        recommended_action: this.getCapacityRecommendation(requiredCapacity, currentCapacity)
      };
    });
    
    return {
      zone_id: zoneId,
      capacity_forecast: capacityNeeds,
      critical_dates: capacityNeeds.filter(c => c.needs_expansion)
    };
  }

  // Phát hiện anomalies trong picking patterns
  async detectPickingAnomalies(timeWindow = 7) {
    const recentPickingData = await this.getRecentPickingData(timeWindow);
    const historicalBaseline = await this.getHistoricalBaseline();
    
    const anomalies = [];
    
    recentPickingData.forEach(data => {
      const expectedTime = this.calculateExpectedPickingTime(data, historicalBaseline);
      const actualTime = data.actual_picking_time;
      const deviation = Math.abs(actualTime - expectedTime) / expectedTime;
      
      if (deviation > 0.3) { // 30% deviation threshold
        anomalies.push({
          task_id: data.task_id,
          product_id: data.product_id,
          location_id: data.location_id,
          expected_time: expectedTime,
          actual_time: actualTime,
          deviation_percentage: deviation * 100,
          possible_causes: this.identifyPossibleCauses(data, deviation)
        });
      }
    });
    
    return {
      anomalies: anomalies,
      total_anomalies: anomalies.length,
      anomaly_rate: (anomalies.length / recentPickingData.length) * 100,
      recommendations: this.generateAnomalyRecommendations(anomalies)
    };
  }

  // Helper methods
  calculateTrend(data) {
    // Linear regression để tính trend
    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.quantity, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.quantity, 0);
    const sumXX = data.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  calculateSeasonality(data) {
    // Tính seasonal factors theo ngày trong năm
    const seasonalFactors = {};
    const dailyAverages = {};
    
    data.forEach(d => {
      const dayOfYear = new Date(d.date).getDayOfYear();
      if (!dailyAverages[dayOfYear]) {
        dailyAverages[dayOfYear] = [];
      }
      dailyAverages[dayOfYear].push(d.quantity);
    });
    
    Object.keys(dailyAverages).forEach(day => {
      const avg = dailyAverages[day].reduce((sum, q) => sum + q, 0) / dailyAverages[day].length;
      const overallAvg = data.reduce((sum, d) => sum + d.quantity, 0) / data.length;
      seasonalFactors[day] = avg / overallAvg;
    });
    
    return seasonalFactors;
  }

  getCapacityRecommendation(required, current) {
    const ratio = required / current;
    
    if (ratio > 1.5) return 'urgent_expansion';
    if (ratio > 1.2) return 'plan_expansion';
    if (ratio > 1.0) return 'monitor_closely';
    return 'sufficient_capacity';
  }

  identifyPossibleCauses(data, deviation) {
    const causes = [];
    
    if (deviation > 0.5) causes.push('equipment_malfunction');
    if (data.distance_traveled > data.expected_distance * 1.3) causes.push('suboptimal_route');
    if (data.operator_experience < 30) causes.push('inexperienced_operator');
    if (data.product_weight > 10) causes.push('heavy_item');
    
    return causes;
  }

  generateAnomalyRecommendations(anomalies) {
    const recommendations = [];
    
    const equipmentIssues = anomalies.filter(a => a.possible_causes.includes('equipment_malfunction'));
    if (equipmentIssues.length > 0) {
      recommendations.push({
        type: 'equipment_maintenance',
        priority: 'high',
        description: 'Schedule equipment maintenance',
        affected_locations: [...new Set(equipmentIssues.map(a => a.location_id))]
      });
    }
    
    const routeIssues = anomalies.filter(a => a.possible_causes.includes('suboptimal_route'));
    if (routeIssues.length > 0) {
      recommendations.push({
        type: 'route_optimization',
        priority: 'medium',
        description: 'Re-run route optimization for affected waves',
        affected_waves: [...new Set(routeIssues.map(a => a.wave_id))]
      });
    }
    
    return recommendations;
  }

  async getHistoricalData(productId) {
    // Mock implementation - replace with actual database query
    return [
      { date: '2024-01-01', quantity: 100 },
      { date: '2024-01-02', quantity: 120 },
      // ... more historical data
    ];
  }

  async getCurrentUtilization(zoneId) {
    // Mock implementation
    return {
      zone_id: zoneId,
      total_capacity: 1000,
      used_capacity: 750,
      utilization_percentage: 75
    };
  }

  async getZoneDemandForecast(zoneId, days) {
    // Mock implementation
    const forecast = [];
    for (let i = 1; i <= days; i++) {
      forecast.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
        predicted_volume: Math.floor(Math.random() * 200) + 100
      });
    }
    return forecast;
  }
}

// Extend Date prototype for day of year calculation
Date.prototype.getDayOfYear = function() {
  const start = new Date(this.getFullYear(), 0, 0);
  const diff = this - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

module.exports = { PredictiveAnalyticsService };