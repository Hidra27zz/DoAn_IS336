// AI Demand Forecasting Service
// Advanced predictive analytics for inventory management and demand planning

const { getDatabase } = require('../config/database');

class AIDemandForecasting {
  constructor() {
    this.forecastHorizon = 30; // days
    this.seasonalityPeriod = 7; // weekly seasonality
    this.trendSmoothingFactor = 0.3;
    this.seasonalSmoothingFactor = 0.1;
  }

  // Main demand forecasting function
  async generateDemandForecast(options = {}) {
    try {
      const db = await getDatabase();
      const {
        product_references = [],
        forecast_days = this.forecastHorizon,
        include_seasonality = true,
        confidence_level = 0.95
      } = options;

      // Get historical demand data
      const historicalData = await this.getHistoricalDemand(db, product_references);
      
      // Generate forecasts for each product
      const forecasts = {};
      
      for (const productRef of Object.keys(historicalData)) {
        const productData = historicalData[productRef];
        
        if (productData.length < 7) {
          // Not enough data for forecasting
          forecasts[productRef] = {
            error: 'Insufficient historical data (minimum 7 days required)',
            forecast: null
          };
          continue;
        }

        // Apply forecasting algorithm
        const forecast = await this.forecastProduct(productData, forecast_days, include_seasonality);
        
        // Calculate confidence intervals
        const confidenceIntervals = this.calculateConfidenceIntervals(
          productData, 
          forecast, 
          confidence_level
        );

        // Detect anomalies in historical data
        const anomalies = this.detectDemandAnomalies(productData);

        // Calculate forecast accuracy metrics
        const accuracy = this.calculateForecastAccuracy(productData);

        forecasts[productRef] = {
          product_reference: productRef,
          forecast_horizon_days: forecast_days,
          historical_data_points: productData.length,
          forecast: forecast,
          confidence_intervals: confidenceIntervals,
          anomalies: anomalies,
          accuracy_metrics: accuracy,
          recommendations: this.generateRecommendations(productRef, forecast, productData)
        };
      }

      // Generate aggregate insights
      const aggregateInsights = this.generateAggregateInsights(forecasts);

      return {
        success: true,
        data: {
          forecasts: forecasts,
          aggregate_insights: aggregateInsights,
          parameters: {
            forecast_days,
            include_seasonality,
            confidence_level,
            products_analyzed: Object.keys(forecasts).length
          },
          generated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error generating demand forecast:', error);
      throw error;
    }
  }

  // Get historical demand data from picking tasks
  async getHistoricalDemand(db, productReferences = []) {
    let whereClause = 'pt.status = "completed"';
    let params = [];

    if (productReferences.length > 0) {
      const placeholders = productReferences.map(() => '?').join(',');
      whereClause += ` AND pt.product_reference IN (${placeholders})`;
      params = [...productReferences];
    }

    const demandData = await db.all(`
      SELECT 
        pt.product_reference,
        DATE(pt.created_at) as demand_date,
        SUM(pt.quantity_picked) as daily_demand,
        COUNT(*) as pick_frequency,
        AVG(pt.quantity_picked) as avg_pick_size,
        p.abc_code,
        p.sector
      FROM picking_tasks pt
      JOIN products p ON pt.product_reference = p.reference
      WHERE ${whereClause}
      AND pt.created_at >= DATE('now', '-90 days')
      GROUP BY pt.product_reference, DATE(pt.created_at)
      ORDER BY pt.product_reference, demand_date
    `, params);

    // Group by product
    const groupedData = {};
    demandData.forEach(row => {
      if (!groupedData[row.product_reference]) {
        groupedData[row.product_reference] = [];
      }
      groupedData[row.product_reference].push({
        date: row.demand_date,
        demand: row.daily_demand,
        frequency: row.pick_frequency,
        avg_size: row.avg_pick_size,
        abc_code: row.abc_code,
        sector: row.sector
      });
    });

    return groupedData;
  }

  // Forecast individual product using Holt-Winters method
  async forecastProduct(historicalData, forecastDays, includeSeasonality) {
    if (historicalData.length === 0) {
      return [];
    }

    // Prepare time series data
    const timeSeries = historicalData.map(d => d.demand);
    
    // Apply Holt-Winters exponential smoothing
    const forecast = includeSeasonality ? 
      this.holtWintersSeasonalForecast(timeSeries, forecastDays) :
      this.holtLinearForecast(timeSeries, forecastDays);

    // Generate forecast dates
    const lastDate = new Date(historicalData[historicalData.length - 1].date);
    const forecastData = [];

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(lastDate.getDate() + i);
      
      forecastData.push({
        date: forecastDate.toISOString().split('T')[0],
        forecasted_demand: Math.max(0, Math.round(forecast[i - 1] * 100) / 100),
        day_of_week: forecastDate.getDay(),
        is_weekend: forecastDate.getDay() === 0 || forecastDate.getDay() === 6
      });
    }

    return forecastData;
  }

  // Holt-Winters seasonal forecasting
  holtWintersSeasonalForecast(data, forecastPeriods) {
    const alpha = this.trendSmoothingFactor; // Level smoothing
    const beta = 0.1; // Trend smoothing
    const gamma = this.seasonalSmoothingFactor; // Seasonal smoothing
    const seasonLength = this.seasonalityPeriod;

    if (data.length < seasonLength * 2) {
      // Fall back to linear trend if not enough data for seasonality
      return this.holtLinearForecast(data, forecastPeriods);
    }

    // Initialize components
    let level = data.slice(0, seasonLength).reduce((a, b) => a + b, 0) / seasonLength;
    let trend = 0;
    
    // Initialize seasonal components
    const seasonal = new Array(seasonLength);
    for (let i = 0; i < seasonLength; i++) {
      seasonal[i] = data[i] / level;
    }

    // Apply Holt-Winters algorithm
    const smoothed = [];
    
    for (let i = 0; i < data.length; i++) {
      const seasonalIndex = i % seasonLength;
      
      if (i === 0) {
        smoothed.push(level);
        continue;
      }

      const prevLevel = level;
      const prevTrend = trend;

      // Update level
      level = alpha * (data[i] / seasonal[seasonalIndex]) + (1 - alpha) * (prevLevel + prevTrend);
      
      // Update trend
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      
      // Update seasonal component
      seasonal[seasonalIndex] = gamma * (data[i] / level) + (1 - gamma) * seasonal[seasonalIndex];
      
      smoothed.push(level + trend);
    }

    // Generate forecasts
    const forecasts = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      const seasonalIndex = (data.length + i - 1) % seasonLength;
      const forecast = (level + trend * i) * seasonal[seasonalIndex];
      forecasts.push(Math.max(0, forecast));
    }

    return forecasts;
  }

  // Holt linear trend forecasting
  holtLinearForecast(data, forecastPeriods) {
    const alpha = this.trendSmoothingFactor;
    const beta = 0.1;

    if (data.length < 2) {
      return new Array(forecastPeriods).fill(data[0] || 0);
    }

    let level = data[0];
    let trend = data[1] - data[0];

    // Apply Holt linear method
    for (let i = 1; i < data.length; i++) {
      const prevLevel = level;
      level = alpha * data[i] + (1 - alpha) * (prevLevel + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    // Generate forecasts
    const forecasts = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      forecasts.push(Math.max(0, level + trend * i));
    }

    return forecasts;
  }

  // Calculate confidence intervals
  calculateConfidenceIntervals(historicalData, forecast, confidenceLevel) {
    if (historicalData.length < 3) {
      return forecast.map(f => ({ lower: f.forecasted_demand * 0.8, upper: f.forecasted_demand * 1.2 }));
    }

    // Calculate residuals from simple moving average
    const windowSize = Math.min(7, historicalData.length);
    const residuals = [];

    for (let i = windowSize; i < historicalData.length; i++) {
      const actual = historicalData[i].demand;
      const predicted = historicalData.slice(i - windowSize, i)
        .reduce((sum, d) => sum + d.demand, 0) / windowSize;
      residuals.push(Math.abs(actual - predicted));
    }

    // Calculate standard error
    const meanResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const variance = residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) / residuals.length;
    const standardError = Math.sqrt(variance);

    // Z-score for confidence level
    const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.58 : 1.64;
    const margin = zScore * standardError;

    return forecast.map(f => ({
      lower: Math.max(0, f.forecasted_demand - margin),
      upper: f.forecasted_demand + margin
    }));
  }

  // Detect demand anomalies using statistical methods
  detectDemandAnomalies(historicalData) {
    if (historicalData.length < 7) {
      return [];
    }

    const demands = historicalData.map(d => d.demand);
    const mean = demands.reduce((a, b) => a + b, 0) / demands.length;
    const stdDev = Math.sqrt(demands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / demands.length);
    
    const threshold = 2.5; // Standard deviations
    const anomalies = [];

    historicalData.forEach((dataPoint, index) => {
      const zScore = Math.abs(dataPoint.demand - mean) / stdDev;
      if (zScore > threshold) {
        anomalies.push({
          date: dataPoint.date,
          demand: dataPoint.demand,
          expected_range: [mean - threshold * stdDev, mean + threshold * stdDev],
          z_score: zScore,
          severity: zScore > 3 ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  // Calculate forecast accuracy metrics
  calculateForecastAccuracy(historicalData) {
    if (historicalData.length < 14) {
      return { error: 'Insufficient data for accuracy calculation' };
    }

    // Use last 7 days as test set
    const testSize = 7;
    const trainData = historicalData.slice(0, -testSize);
    const testData = historicalData.slice(-testSize);

    // Generate forecast for test period
    const testForecast = this.holtLinearForecast(trainData.map(d => d.demand), testSize);

    // Calculate accuracy metrics
    let mae = 0; // Mean Absolute Error
    let mse = 0; // Mean Squared Error
    let mape = 0; // Mean Absolute Percentage Error

    for (let i = 0; i < testSize; i++) {
      const actual = testData[i].demand;
      const predicted = testForecast[i];
      
      const error = Math.abs(actual - predicted);
      mae += error;
      mse += Math.pow(error, 2);
      
      if (actual > 0) {
        mape += Math.abs((actual - predicted) / actual);
      }
    }

    mae /= testSize;
    mse /= testSize;
    mape = (mape / testSize) * 100;

    const rmse = Math.sqrt(mse);

    return {
      mae: Math.round(mae * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      mape: Math.round(mape * 100) / 100,
      accuracy_score: Math.max(0, 100 - mape)
    };
  }

  // Generate recommendations based on forecast
  generateRecommendations(productRef, forecast, historicalData) {
    const recommendations = [];
    
    if (forecast.length === 0) {
      return recommendations;
    }

    // Calculate average historical demand
    const avgHistoricalDemand = historicalData.reduce((sum, d) => sum + d.demand, 0) / historicalData.length;
    const avgForecastedDemand = forecast.reduce((sum, f) => sum + f.forecasted_demand, 0) / forecast.length;

    // Trend analysis
    const demandTrend = (avgForecastedDemand - avgHistoricalDemand) / avgHistoricalDemand;

    if (demandTrend > 0.2) {
      recommendations.push({
        type: 'STOCK_INCREASE',
        priority: 'HIGH',
        message: `Demand is forecasted to increase by ${Math.round(demandTrend * 100)}%. Consider increasing stock levels.`,
        suggested_action: 'Increase safety stock by 25-30%'
      });
    } else if (demandTrend < -0.2) {
      recommendations.push({
        type: 'STOCK_REDUCTION',
        priority: 'MEDIUM',
        message: `Demand is forecasted to decrease by ${Math.round(Math.abs(demandTrend) * 100)}%. Consider reducing stock levels.`,
        suggested_action: 'Reduce reorder quantities by 15-20%'
      });
    }

    // Seasonality analysis
    const weekendDemand = forecast.filter(f => f.is_weekend).reduce((sum, f) => sum + f.forecasted_demand, 0);
    const weekdayDemand = forecast.filter(f => !f.is_weekend).reduce((sum, f) => sum + f.forecasted_demand, 0);
    
    if (weekendDemand > weekdayDemand * 1.5) {
      recommendations.push({
        type: 'WEEKEND_PATTERN',
        priority: 'MEDIUM',
        message: 'Higher demand expected on weekends. Ensure adequate weekend staffing.',
        suggested_action: 'Schedule additional picking resources for weekends'
      });
    }

    // Stock-out risk analysis
    const maxDailyDemand = Math.max(...forecast.map(f => f.forecasted_demand));
    const totalForecastedDemand = forecast.reduce((sum, f) => sum + f.forecasted_demand, 0);

    recommendations.push({
      type: 'SAFETY_STOCK',
      priority: 'MEDIUM',
      message: `Recommended safety stock: ${Math.ceil(maxDailyDemand * 1.5)} units`,
      suggested_action: `Maintain minimum ${Math.ceil(maxDailyDemand * 1.5)} units to avoid stock-outs`
    });

    recommendations.push({
      type: 'REORDER_PLANNING',
      priority: 'LOW',
      message: `Total forecasted demand for next ${forecast.length} days: ${Math.ceil(totalForecastedDemand)} units`,
      suggested_action: `Plan reorder when stock falls below ${Math.ceil(totalForecastedDemand * 0.3)} units`
    });

    return recommendations;
  }

  // Generate aggregate insights across all products
  generateAggregateInsights(forecasts) {
    const validForecasts = Object.values(forecasts).filter(f => f.forecast && f.forecast.length > 0);
    
    if (validForecasts.length === 0) {
      return { message: 'No valid forecasts generated' };
    }

    // Calculate total forecasted demand
    const totalForecastedDemand = validForecasts.reduce((sum, f) => {
      return sum + f.forecast.reduce((fSum, day) => fSum + day.forecasted_demand, 0);
    }, 0);

    // Identify high-growth products
    const highGrowthProducts = validForecasts.filter(f => {
      const avgForecast = f.forecast.reduce((sum, day) => sum + day.forecasted_demand, 0) / f.forecast.length;
      const avgHistorical = f.historical_data_points > 0 ? avgForecast * 0.8 : 0; // Approximation
      return avgForecast > avgHistorical * 1.2;
    });

    // Identify products with high variability
    const highVariabilityProducts = validForecasts.filter(f => {
      if (f.forecast.length < 7) return false;
      const demands = f.forecast.map(day => day.forecasted_demand);
      const mean = demands.reduce((a, b) => a + b, 0) / demands.length;
      const variance = demands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / demands.length;
      const coefficientOfVariation = Math.sqrt(variance) / mean;
      return coefficientOfVariation > 0.5;
    });

    // Calculate overall forecast accuracy
    const accuracyScores = validForecasts
      .map(f => f.accuracy_metrics?.accuracy_score)
      .filter(score => score !== undefined);
    
    const avgAccuracy = accuracyScores.length > 0 ? 
      accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length : null;

    return {
      total_products_analyzed: Object.keys(forecasts).length,
      valid_forecasts: validForecasts.length,
      total_forecasted_demand: Math.round(totalForecastedDemand),
      high_growth_products: highGrowthProducts.length,
      high_variability_products: highVariabilityProducts.length,
      average_forecast_accuracy: avgAccuracy ? Math.round(avgAccuracy * 100) / 100 : null,
      top_growth_products: highGrowthProducts.slice(0, 5).map(f => f.product_reference),
      recommendations: this.generateAggregateRecommendations(validForecasts)
    };
  }

  // Generate aggregate recommendations
  generateAggregateRecommendations(forecasts) {
    const recommendations = [];

    // Overall demand trend
    const totalCurrentDemand = forecasts.reduce((sum, f) => sum + f.historical_data_points, 0);
    const totalForecastedDemand = forecasts.reduce((sum, f) => {
      return sum + f.forecast.reduce((fSum, day) => fSum + day.forecasted_demand, 0);
    }, 0);

    const overallTrend = (totalForecastedDemand - totalCurrentDemand * 10) / (totalCurrentDemand * 10); // Rough approximation

    if (overallTrend > 0.15) {
      recommendations.push({
        type: 'CAPACITY_PLANNING',
        priority: 'HIGH',
        message: 'Overall demand is forecasted to increase significantly. Consider capacity expansion.',
        impact: 'Warehouse capacity and staffing may need to be increased'
      });
    }

    // Forecast accuracy assessment
    const lowAccuracyProducts = forecasts.filter(f => 
      f.accuracy_metrics?.accuracy_score && f.accuracy_metrics.accuracy_score < 70
    );

    if (lowAccuracyProducts.length > forecasts.length * 0.3) {
      recommendations.push({
        type: 'DATA_QUALITY',
        priority: 'MEDIUM',
        message: 'Forecast accuracy is low for many products. Consider improving data collection.',
        impact: 'Better demand data will improve forecast accuracy and inventory planning'
      });
    }

    return recommendations;
  }

  // Get stock-out risk analysis
  async getStockOutRisk(productReferences = []) {
    try {
      const db = await getDatabase();
      
      // Get current inventory levels
      let whereClause = '1=1';
      let params = [];

      if (productReferences.length > 0) {
        const placeholders = productReferences.map(() => '?').join(',');
        whereClause = `i.product_reference IN (${placeholders})`;
        params = productReferences;
      }

      const currentInventory = await db.all(`
        SELECT 
          i.product_reference,
          SUM(i.quantity) as total_stock,
          SUM(i.reserved_quantity) as total_reserved,
          SUM(i.quantity - i.reserved_quantity) as available_stock,
          COUNT(DISTINCT i.location_code) as locations_count,
          p.abc_code
        FROM inventory i
        JOIN products p ON i.product_reference = p.reference
        WHERE ${whereClause}
        GROUP BY i.product_reference, p.abc_code
      `, params);

      // Generate forecasts for these products
      const productRefs = currentInventory.map(inv => inv.product_reference);
      const forecastResult = await this.generateDemandForecast({
        product_references: productRefs,
        forecast_days: 14
      });

      // Calculate stock-out risk for each product
      const riskAnalysis = currentInventory.map(inv => {
        const forecast = forecastResult.data.forecasts[inv.product_reference];
        
        if (!forecast || !forecast.forecast) {
          return {
            product_reference: inv.product_reference,
            current_stock: inv.available_stock,
            risk_level: 'UNKNOWN',
            days_until_stockout: null,
            recommended_action: 'Insufficient data for analysis'
          };
        }

        // Calculate days until stock-out
        let remainingStock = inv.available_stock;
        let daysUntilStockout = null;

        for (let i = 0; i < forecast.forecast.length; i++) {
          remainingStock -= forecast.forecast[i].forecasted_demand;
          if (remainingStock <= 0) {
            daysUntilStockout = i + 1;
            break;
          }
        }

        // Determine risk level
        let riskLevel = 'LOW';
        let recommendedAction = 'Monitor stock levels';

        if (daysUntilStockout === null) {
          riskLevel = 'LOW';
        } else if (daysUntilStockout <= 3) {
          riskLevel = 'CRITICAL';
          recommendedAction = 'Immediate reorder required';
        } else if (daysUntilStockout <= 7) {
          riskLevel = 'HIGH';
          recommendedAction = 'Reorder within 1-2 days';
        } else if (daysUntilStockout <= 14) {
          riskLevel = 'MEDIUM';
          recommendedAction = 'Plan reorder within a week';
        }

        return {
          product_reference: inv.product_reference,
          abc_code: inv.abc_code,
          current_stock: inv.available_stock,
          total_stock: inv.total_stock,
          reserved_stock: inv.total_reserved,
          locations_count: inv.locations_count,
          risk_level: riskLevel,
          days_until_stockout: daysUntilStockout,
          forecasted_demand_14d: forecast.forecast.reduce((sum, f) => sum + f.forecasted_demand, 0),
          recommended_action: recommendedAction
        };
      });

      // Sort by risk level
      const riskOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNKNOWN': 0 };
      riskAnalysis.sort((a, b) => riskOrder[b.risk_level] - riskOrder[a.risk_level]);

      return {
        success: true,
        data: {
          risk_analysis: riskAnalysis,
          summary: {
            total_products: riskAnalysis.length,
            critical_risk: riskAnalysis.filter(r => r.risk_level === 'CRITICAL').length,
            high_risk: riskAnalysis.filter(r => r.risk_level === 'HIGH').length,
            medium_risk: riskAnalysis.filter(r => r.risk_level === 'MEDIUM').length,
            low_risk: riskAnalysis.filter(r => r.risk_level === 'LOW').length
          },
          generated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error calculating stock-out risk:', error);
      throw error;
    }
  }
}

module.exports = AIDemandForecasting;