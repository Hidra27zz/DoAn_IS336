// AI Storage Strategy Optimization Service
// Implements AI algorithms for optimal product placement and storage strategy selection

const { getDatabase } = require('../config/database');

class AIStorageOptimizer {
  constructor() {
    this.strategies = {
      CLASS_BASED: 'class_based',
      DEDICATED: 'dedicated', 
      RANDOM: 'random',
      HYBRID: 'hybrid'
    };
    
    this.zones = {
      HIGH_FREQUENCY: ['A', 'B', 'C'], // Close to picking area
      MEDIUM_FREQUENCY: ['D', 'E', 'F', 'G', 'H'],
      LOW_FREQUENCY: ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'] // Far from picking area
    };
  }

  // Analyze current storage performance and recommend optimal strategy
  async analyzeStoragePerformance() {
    try {
      const db = await getDatabase();
      
      // Get product movement frequency data
      const productFrequency = await this.getProductMovementFrequency(db);
      
      // Get current storage utilization
      const storageUtilization = await this.getStorageUtilization(db);
      
      // Get picking distance metrics
      const distanceMetrics = await this.getPickingDistanceMetrics(db);
      
      // Analyze ABC classification effectiveness
      const abcEffectiveness = await this.analyzeABCEffectiveness(db);
      
      // Generate recommendations
      const recommendations = await this.generateStorageRecommendations({
        productFrequency,
        storageUtilization,
        distanceMetrics,
        abcEffectiveness
      });

      return {
        success: true,
        analysis: {
          product_frequency: productFrequency,
          storage_utilization: storageUtilization,
          distance_metrics: distanceMetrics,
          abc_effectiveness: abcEffectiveness
        },
        recommendations: recommendations,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error analyzing storage performance:', error);
      throw error;
    }
  }

  // Get product movement frequency from picking tasks
  async getProductMovementFrequency(db) {
    const frequency = await db.all(`
      SELECT 
        pt.product_reference,
        p.abc_code,
        COUNT(*) as pick_frequency,
        SUM(pt.quantity_picked) as total_picked,
        AVG(pt.quantity_picked) as avg_pick_quantity,
        COUNT(DISTINCT pt.location_code) as locations_used,
        MIN(pt.created_at) as first_pick,
        MAX(pt.updated_at) as last_pick
      FROM picking_tasks pt
      JOIN products p ON pt.product_reference = p.reference
      WHERE pt.status = 'completed'
      GROUP BY pt.product_reference, p.abc_code
      ORDER BY pick_frequency DESC
    `);

    // Classify products by movement frequency
    const totalProducts = frequency.length;
    const highFreqThreshold = Math.ceil(totalProducts * 0.2); // Top 20%
    const mediumFreqThreshold = Math.ceil(totalProducts * 0.5); // Next 30%

    const classified = frequency.map((product, index) => ({
      ...product,
      frequency_class: index < highFreqThreshold ? 'HIGH' : 
                      index < mediumFreqThreshold ? 'MEDIUM' : 'LOW',
      frequency_rank: index + 1
    }));

    return {
      total_products: totalProducts,
      high_frequency_count: classified.filter(p => p.frequency_class === 'HIGH').length,
      medium_frequency_count: classified.filter(p => p.frequency_class === 'MEDIUM').length,
      low_frequency_count: classified.filter(p => p.frequency_class === 'LOW').length,
      products: classified
    };
  }

  // Get current storage space utilization
  async getStorageUtilization(db) {
    const utilization = await db.all(`
      SELECT 
        sl.zone,
        COUNT(*) as total_locations,
        SUM(sl.capacity) as total_capacity,
        SUM(sl.current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(sl.current_occupancy AS FLOAT) / sl.capacity * 100), 2) as avg_utilization,
        COUNT(CASE WHEN sl.current_occupancy = 0 THEN 1 END) as empty_locations,
        COUNT(CASE WHEN sl.current_occupancy >= sl.capacity THEN 1 END) as full_locations
      FROM storage_locations sl
      WHERE sl.status = 'active'
      GROUP BY sl.zone
      ORDER BY sl.zone
    `);

    const totalStats = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as overall_utilization
      FROM storage_locations
      WHERE status = 'active'
    `);

    return {
      overall: totalStats,
      by_zone: utilization,
      efficiency_score: this.calculateUtilizationEfficiency(utilization)
    };
  }

  // Calculate picking distance metrics
  async getPickingDistanceMetrics(db) {
    // Simulate picking distances based on coordinates
    // In a real system, this would use actual warehouse layout and picking routes
    
    const distanceData = await db.all(`
      SELECT 
        pt.wave_number,
        pt.location_code,
        sl.zone,
        sl.x, sl.y, sl.z,
        COUNT(*) as picks_count,
        SUM(pt.quantity_picked) as total_quantity
      FROM picking_tasks pt
      JOIN storage_locations sl ON pt.location_code = sl.location_code
      WHERE pt.status = 'completed'
      GROUP BY pt.wave_number, pt.location_code, sl.zone, sl.x, sl.y, sl.z
    `);

    // Calculate average distances (simplified calculation)
    const waveDistances = {};
    distanceData.forEach(pick => {
      if (!waveDistances[pick.wave_number]) {
        waveDistances[pick.wave_number] = {
          locations: [],
          total_picks: 0,
          total_distance: 0
        };
      }
      
      waveDistances[pick.wave_number].locations.push({
        x: pick.x,
        y: pick.y,
        z: pick.z,
        picks: pick.picks_count
      });
      waveDistances[pick.wave_number].total_picks += pick.picks_count;
    });

    // Calculate distances for each wave
    Object.keys(waveDistances).forEach(waveNumber => {
      const wave = waveDistances[waveNumber];
      let totalDistance = 0;
      
      for (let i = 0; i < wave.locations.length - 1; i++) {
        const loc1 = wave.locations[i];
        const loc2 = wave.locations[i + 1];
        const distance = Math.sqrt(
          Math.pow(loc2.x - loc1.x, 2) + 
          Math.pow(loc2.y - loc1.y, 2) + 
          Math.pow(loc2.z - loc1.z, 2)
        );
        totalDistance += distance;
      }
      
      wave.total_distance = totalDistance;
      wave.avg_distance_per_pick = wave.total_picks > 0 ? totalDistance / wave.total_picks : 0;
    });

    const avgDistancePerPick = Object.values(waveDistances)
      .reduce((sum, wave) => sum + wave.avg_distance_per_pick, 0) / Object.keys(waveDistances).length;

    return {
      total_waves_analyzed: Object.keys(waveDistances).length,
      average_distance_per_pick: Math.round(avgDistancePerPick * 100) / 100,
      wave_distances: waveDistances,
      efficiency_score: this.calculateDistanceEfficiency(avgDistancePerPick)
    };
  }

  // Analyze ABC classification effectiveness
  async analyzeABCEffectiveness(db) {
    const abcAnalysis = await db.all(`
      SELECT 
        p.abc_code,
        COUNT(DISTINCT p.reference) as product_count,
        COUNT(pt.id) as total_picks,
        SUM(pt.quantity_picked) as total_quantity,
        AVG(pt.quantity_picked) as avg_pick_quantity,
        sl.zone,
        COUNT(DISTINCT sl.zone) as zones_used
      FROM products p
      LEFT JOIN picking_tasks pt ON p.reference = pt.product_reference AND pt.status = 'completed'
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      WHERE p.abc_code IS NOT NULL
      GROUP BY p.abc_code, sl.zone
      ORDER BY p.abc_code, sl.zone
    `);

    // Calculate ABC effectiveness metrics
    const abcSummary = await db.all(`
      SELECT 
        p.abc_code,
        COUNT(DISTINCT p.reference) as product_count,
        COUNT(pt.id) as total_picks,
        SUM(pt.quantity_picked) as total_quantity,
        ROUND(AVG(pt.quantity_picked), 2) as avg_pick_quantity
      FROM products p
      LEFT JOIN picking_tasks pt ON p.reference = pt.product_reference AND pt.status = 'completed'
      WHERE p.abc_code IS NOT NULL
      GROUP BY p.abc_code
      ORDER BY p.abc_code
    `);

    // Check if high-frequency products (Class A) are in optimal zones
    const classAInHighFreqZones = await db.get(`
      SELECT COUNT(*) as count
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE p.abc_code = 'A' AND sl.zone IN ('A', 'B', 'C')
    `);

    const totalClassAProducts = await db.get(`
      SELECT COUNT(DISTINCT i.product_reference) as count
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      WHERE p.abc_code = 'A'
    `);

    const classAOptimalPlacement = totalClassAProducts.count > 0 ? 
      (classAInHighFreqZones.count / totalClassAProducts.count) * 100 : 0;

    return {
      abc_summary: abcSummary,
      detailed_analysis: abcAnalysis,
      class_a_optimal_placement: Math.round(classAOptimalPlacement * 100) / 100,
      effectiveness_score: this.calculateABCEffectiveness(abcSummary, classAOptimalPlacement)
    };
  }

  // Generate storage optimization recommendations
  async generateStorageRecommendations(analysisData) {
    const recommendations = [];

    // Recommendation 1: ABC Classification Optimization
    if (analysisData.abcEffectiveness.class_a_optimal_placement < 80) {
      recommendations.push({
        type: 'ABC_OPTIMIZATION',
        priority: 'HIGH',
        title: 'Optimize Class A Product Placement',
        description: `Only ${analysisData.abcEffectiveness.class_a_optimal_placement}% of Class A products are in high-frequency zones. Relocate Class A products to zones A, B, C for better efficiency.`,
        impact: 'Reduce picking time by 15-25%',
        implementation: 'Move Class A products to zones A-C',
        estimated_improvement: '20%'
      });
    }

    // Recommendation 2: Storage Utilization Optimization
    const avgUtilization = analysisData.storageUtilization.overall.overall_utilization;
    if (avgUtilization < 60) {
      recommendations.push({
        type: 'UTILIZATION_OPTIMIZATION',
        priority: 'MEDIUM',
        title: 'Improve Storage Space Utilization',
        description: `Current utilization is ${avgUtilization}%. Implement better slotting strategies to increase space efficiency.`,
        impact: 'Increase storage capacity by 20-30%',
        implementation: 'Implement dynamic slotting algorithm',
        estimated_improvement: '25%'
      });
    }

    // Recommendation 3: Distance Optimization
    if (analysisData.distanceMetrics.average_distance_per_pick > 50) {
      recommendations.push({
        type: 'DISTANCE_OPTIMIZATION',
        priority: 'HIGH',
        title: 'Reduce Picking Distances',
        description: `Average picking distance is ${analysisData.distanceMetrics.average_distance_per_pick} units. Optimize product placement to reduce travel time.`,
        impact: 'Reduce picking time by 10-20%',
        implementation: 'Use genetic algorithm for route optimization',
        estimated_improvement: '15%'
      });
    }

    // Recommendation 4: Hybrid Strategy Implementation
    const highFreqProducts = analysisData.productFrequency.high_frequency_count;
    const totalProducts = analysisData.productFrequency.total_products;
    
    if (highFreqProducts / totalProducts > 0.3) {
      recommendations.push({
        type: 'STRATEGY_CHANGE',
        priority: 'MEDIUM',
        title: 'Consider Hybrid Storage Strategy',
        description: 'High number of frequently picked products suggests hybrid strategy would be more efficient than pure ABC classification.',
        impact: 'Optimize for both frequency and space utilization',
        implementation: 'Implement hybrid storage strategy combining ABC and dedicated storage',
        estimated_improvement: '18%'
      });
    }

    // Recommendation 5: Zone Rebalancing
    const zoneImbalance = this.detectZoneImbalance(analysisData.storageUtilization.by_zone);
    if (zoneImbalance.severity > 0.3) {
      recommendations.push({
        type: 'ZONE_REBALANCING',
        priority: 'MEDIUM',
        title: 'Rebalance Zone Utilization',
        description: `Detected ${Math.round(zoneImbalance.severity * 100)}% imbalance across zones. Some zones are overutilized while others are underutilized.`,
        impact: 'Improve overall warehouse efficiency',
        implementation: 'Redistribute products across zones based on capacity and frequency',
        estimated_improvement: '12%'
      });
    }

    return {
      total_recommendations: recommendations.length,
      high_priority: recommendations.filter(r => r.priority === 'HIGH').length,
      medium_priority: recommendations.filter(r => r.priority === 'MEDIUM').length,
      low_priority: recommendations.filter(r => r.priority === 'LOW').length,
      recommendations: recommendations,
      overall_improvement_potential: this.calculateOverallImprovement(recommendations)
    };
  }

  // Calculate storage strategy recommendation based on analysis
  async recommendOptimalStrategy(analysisData) {
    const scores = {
      [this.strategies.CLASS_BASED]: 0,
      [this.strategies.DEDICATED]: 0,
      [this.strategies.RANDOM]: 0,
      [this.strategies.HYBRID]: 0
    };

    // Score based on ABC effectiveness
    if (analysisData.abcEffectiveness.effectiveness_score > 70) {
      scores[this.strategies.CLASS_BASED] += 30;
      scores[this.strategies.HYBRID] += 20;
    }

    // Score based on product frequency distribution
    const freqData = analysisData.productFrequency;
    const highFreqRatio = freqData.high_frequency_count / freqData.total_products;
    
    if (highFreqRatio > 0.3) {
      scores[this.strategies.DEDICATED] += 25;
      scores[this.strategies.HYBRID] += 30;
    } else if (highFreqRatio < 0.1) {
      scores[this.strategies.RANDOM] += 20;
    }

    // Score based on storage utilization
    if (analysisData.storageUtilization.efficiency_score > 80) {
      scores[this.strategies.CLASS_BASED] += 20;
    } else {
      scores[this.strategies.HYBRID] += 25;
      scores[this.strategies.RANDOM] += 15;
    }

    // Score based on distance efficiency
    if (analysisData.distanceMetrics.efficiency_score < 60) {
      scores[this.strategies.DEDICATED] += 20;
      scores[this.strategies.HYBRID] += 25;
    }

    // Find the strategy with the highest score
    const recommendedStrategy = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );

    return {
      recommended_strategy: recommendedStrategy,
      confidence_score: scores[recommendedStrategy],
      strategy_scores: scores,
      reasoning: this.getStrategyReasoning(recommendedStrategy, analysisData)
    };
  }

  // Helper methods for calculations
  calculateUtilizationEfficiency(utilization) {
    const avgUtilization = utilization.reduce((sum, zone) => sum + zone.avg_utilization, 0) / utilization.length;
    return Math.min(100, Math.max(0, avgUtilization));
  }

  calculateDistanceEfficiency(avgDistance) {
    // Lower distance = higher efficiency (inverse relationship)
    // Assuming optimal distance is around 20 units
    const optimalDistance = 20;
    const efficiency = Math.max(0, 100 - ((avgDistance - optimalDistance) / optimalDistance) * 100);
    return Math.min(100, Math.max(0, efficiency));
  }

  calculateABCEffectiveness(abcSummary, classAPlacement) {
    // Combine ABC distribution effectiveness with placement accuracy
    const totalPicks = abcSummary.reduce((sum, abc) => sum + (abc.total_picks || 0), 0);
    
    if (totalPicks === 0) return 0;
    
    const classAPicks = abcSummary.find(abc => abc.abc_code === 'A')?.total_picks || 0;
    const classAPickRatio = classAPicks / totalPicks;
    
    // Class A should have high pick frequency and good placement
    const effectiveness = (classAPickRatio * 0.6 + classAPlacement / 100 * 0.4) * 100;
    return Math.min(100, Math.max(0, effectiveness));
  }

  detectZoneImbalance(zoneUtilization) {
    if (zoneUtilization.length === 0) return { severity: 0 };
    
    const utilizations = zoneUtilization.map(zone => zone.avg_utilization);
    const avgUtilization = utilizations.reduce((sum, util) => sum + util, 0) / utilizations.length;
    
    // Calculate standard deviation
    const variance = utilizations.reduce((sum, util) => sum + Math.pow(util - avgUtilization, 2), 0) / utilizations.length;
    const stdDev = Math.sqrt(variance);
    
    // Severity is based on coefficient of variation
    const severity = avgUtilization > 0 ? stdDev / avgUtilization : 0;
    
    return {
      severity: Math.min(1, severity),
      avg_utilization: avgUtilization,
      std_deviation: stdDev,
      most_utilized: Math.max(...utilizations),
      least_utilized: Math.min(...utilizations)
    };
  }

  calculateOverallImprovement(recommendations) {
    const improvements = recommendations.map(rec => parseFloat(rec.estimated_improvement.replace('%', '')));
    const totalImprovement = improvements.reduce((sum, imp) => sum + imp, 0);
    
    // Apply diminishing returns - improvements don't stack linearly
    const adjustedImprovement = totalImprovement * 0.7; // 70% of sum due to overlaps
    return Math.min(50, Math.round(adjustedImprovement)); // Cap at 50%
  }

  getStrategyReasoning(strategy, analysisData) {
    const reasons = [];
    
    switch (strategy) {
      case this.strategies.CLASS_BASED:
        reasons.push('Strong ABC classification effectiveness detected');
        reasons.push('Good correlation between product class and pick frequency');
        break;
        
      case this.strategies.DEDICATED:
        reasons.push('High concentration of frequently picked products');
        reasons.push('Dedicated zones would reduce picking distances significantly');
        break;
        
      case this.strategies.RANDOM:
        reasons.push('Low product movement frequency variation');
        reasons.push('Random storage provides good space utilization flexibility');
        break;
        
      case this.strategies.HYBRID:
        reasons.push('Mixed product characteristics benefit from combined approach');
        reasons.push('Balances frequency-based and space-efficient storage');
        break;
    }
    
    return reasons;
  }

  // Apply recommended storage strategy
  async applyStorageStrategy(strategy, options = {}) {
    try {
      const db = await getDatabase();
      
      switch (strategy) {
        case this.strategies.CLASS_BASED:
          return await this.applyClassBasedStrategy(db, options);
          
        case this.strategies.DEDICATED:
          return await this.applyDedicatedStrategy(db, options);
          
        case this.strategies.RANDOM:
          return await this.applyRandomStrategy(db, options);
          
        case this.strategies.HYBRID:
          return await this.applyHybridStrategy(db, options);
          
        default:
          throw new Error(`Unknown storage strategy: ${strategy}`);
      }
      
    } catch (error) {
      console.error('Error applying storage strategy:', error);
      throw error;
    }
  }

  async applyClassBasedStrategy(db, options) {
    // Implement ABC-based storage allocation
    const classAZones = ['A', 'B', 'C'];
    const classBZones = ['D', 'E', 'F', 'G'];
    const classCZones = ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
    
    // Get products by ABC class
    const products = await db.all(`
      SELECT reference, abc_code
      FROM products
      WHERE abc_code IS NOT NULL
    `);
    
    const allocations = [];
    
    for (const product of products) {
      let targetZones;
      switch (product.abc_code) {
        case 'A': targetZones = classAZones; break;
        case 'B': targetZones = classBZones; break;
        case 'C': targetZones = classCZones; break;
        default: targetZones = classCZones;
      }
      
      // Find available location in target zones
      const availableLocation = await db.get(`
        SELECT location_code, zone, capacity, current_occupancy
        FROM storage_locations
        WHERE zone IN (${targetZones.map(() => '?').join(',')}) 
        AND current_occupancy < capacity
        AND status = 'active'
        ORDER BY (capacity - current_occupancy) DESC
        LIMIT 1
      `, targetZones);
      
      if (availableLocation) {
        allocations.push({
          product_reference: product.reference,
          recommended_location: availableLocation.location_code,
          current_zone: availableLocation.zone,
          abc_class: product.abc_code
        });
      }
    }
    
    return {
      strategy: this.strategies.CLASS_BASED,
      allocations: allocations,
      summary: {
        total_products: products.length,
        allocated_products: allocations.length,
        class_a_allocated: allocations.filter(a => a.abc_class === 'A').length,
        class_b_allocated: allocations.filter(a => a.abc_class === 'B').length,
        class_c_allocated: allocations.filter(a => a.abc_class === 'C').length
      }
    };
  }

  async applyDedicatedStrategy(db, options) {
    // Implement dedicated storage for high-frequency products
    const highFreqProducts = await db.all(`
      SELECT 
        pt.product_reference,
        COUNT(*) as pick_frequency,
        SUM(pt.quantity_picked) as total_quantity
      FROM picking_tasks pt
      WHERE pt.status = 'completed'
      GROUP BY pt.product_reference
      ORDER BY pick_frequency DESC
      LIMIT 50
    `);
    
    const dedicatedZones = ['A', 'B', 'C', 'D'];
    const allocations = [];
    
    for (const product of highFreqProducts) {
      const availableLocation = await db.get(`
        SELECT location_code, zone
        FROM storage_locations
        WHERE zone IN (${dedicatedZones.map(() => '?').join(',')})
        AND current_occupancy < capacity
        AND status = 'active'
        ORDER BY zone, location_code
        LIMIT 1
      `, dedicatedZones);
      
      if (availableLocation) {
        allocations.push({
          product_reference: product.product_reference,
          recommended_location: availableLocation.location_code,
          pick_frequency: product.pick_frequency,
          strategy_type: 'dedicated'
        });
      }
    }
    
    return {
      strategy: this.strategies.DEDICATED,
      allocations: allocations,
      summary: {
        high_frequency_products: highFreqProducts.length,
        allocated_products: allocations.length
      }
    };
  }

  async applyRandomStrategy(db, options) {
    // Implement random storage allocation
    const products = await db.all(`
      SELECT reference FROM products
      ORDER BY RANDOM()
      LIMIT 100
    `);
    
    const allocations = [];
    
    for (const product of products) {
      const availableLocation = await db.get(`
        SELECT location_code, zone
        FROM storage_locations
        WHERE current_occupancy < capacity
        AND status = 'active'
        ORDER BY RANDOM()
        LIMIT 1
      `);
      
      if (availableLocation) {
        allocations.push({
          product_reference: product.reference,
          recommended_location: availableLocation.location_code,
          strategy_type: 'random'
        });
      }
    }
    
    return {
      strategy: this.strategies.RANDOM,
      allocations: allocations,
      summary: {
        total_products: products.length,
        allocated_products: allocations.length
      }
    };
  }

  async applyHybridStrategy(db, options) {
    // Implement hybrid strategy combining ABC and frequency-based allocation
    const classBasedResult = await this.applyClassBasedStrategy(db, options);
    const dedicatedResult = await this.applyDedicatedStrategy(db, options);
    
    // Merge allocations, prioritizing dedicated for high-frequency products
    const hybridAllocations = [...dedicatedResult.allocations];
    
    // Add class-based allocations for products not in dedicated
    const dedicatedProducts = new Set(dedicatedResult.allocations.map(a => a.product_reference));
    const classBasedFiltered = classBasedResult.allocations.filter(
      a => !dedicatedProducts.has(a.product_reference)
    );
    
    hybridAllocations.push(...classBasedFiltered.map(a => ({
      ...a,
      strategy_type: 'class_based'
    })));
    
    return {
      strategy: this.strategies.HYBRID,
      allocations: hybridAllocations,
      summary: {
        total_allocations: hybridAllocations.length,
        dedicated_allocations: dedicatedResult.allocations.length,
        class_based_allocations: classBasedFiltered.length
      }
    };
  }
}

module.exports = AIStorageOptimizer;