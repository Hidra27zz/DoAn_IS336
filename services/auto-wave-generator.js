// Auto Wave Generator Service
class AutoWaveGenerator {
  constructor() {
    this.defaultRules = {
      maxOrdersPerWave: 10,
      maxItemsPerWave: 50,
      priorityWeighting: true,
      dueDateWeighting: true,
      customerPriorityWeighting: true,
      abcClassGrouping: true
    };
  }

  async generateWaves(orders, rules = {}) {
    try {
      const config = { ...this.defaultRules, ...rules };
      
      // Filter pending orders
      const pendingOrders = orders.filter(order => order.status === 'pending');
      
      if (pendingOrders.length === 0) {
        return {
          success: true,
          waves: [],
          message: 'No pending orders to process'
        };
      }

      // Sort orders by priority and due date
      const sortedOrders = this.sortOrdersByPriority(pendingOrders, config);
      
      // Group orders into waves
      const waves = this.groupOrdersIntoWaves(sortedOrders, config);
      
      return {
        success: true,
        waves: waves,
        ordersProcessed: pendingOrders.length,
        wavesGenerated: waves.length,
        rules: config
      };

    } catch (error) {
      console.error('Wave generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async previewWaveGeneration(orders, rules = {}) {
    try {
      const result = await this.generateWaves(orders, rules);
      
      return {
        success: true,
        preview: {
          totalOrders: orders.length,
          pendingOrders: orders.filter(o => o.status === 'pending').length,
          estimatedWaves: result.waves?.length || 0,
          estimatedEfficiency: this.calculateEfficiency(result.waves || [])
        },
        rules: { ...this.defaultRules, ...rules }
      };

    } catch (error) {
      console.error('Wave preview error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  sortOrdersByPriority(orders, config) {
    return orders.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Priority weighting
      if (config.priorityWeighting) {
        scoreA += (a.priority === 'high' ? 100 : a.priority === 'medium' ? 50 : 0);
        scoreB += (b.priority === 'high' ? 100 : b.priority === 'medium' ? 50 : 0);
      }

      // Due date weighting
      if (config.dueDateWeighting && a.dueDate && b.dueDate) {
        const dueDateA = new Date(a.dueDate);
        const dueDateB = new Date(b.dueDate);
        const now = new Date();
        
        const urgencyA = Math.max(0, 100 - ((dueDateA - now) / (1000 * 60 * 60))); // Hours until due
        const urgencyB = Math.max(0, 100 - ((dueDateB - now) / (1000 * 60 * 60)));
        
        scoreA += urgencyA;
        scoreB += urgencyB;
      }

      // Customer priority weighting
      if (config.customerPriorityWeighting) {
        scoreA += (a.customerPriority === 'VIP' ? 50 : 0);
        scoreB += (b.customerPriority === 'VIP' ? 50 : 0);
      }

      return scoreB - scoreA; // Higher score first
    });
  }

  groupOrdersIntoWaves(orders, config) {
    const waves = [];
    let currentWave = null;

    orders.forEach(order => {
      const orderItemCount = order.items?.length || 0;

      // Check if we need a new wave
      if (!currentWave || 
          currentWave.orders.length >= config.maxOrdersPerWave ||
          currentWave.totalItems + orderItemCount > config.maxItemsPerWave) {
        
        // Start new wave
        currentWave = {
          waveId: `WAVE_${Date.now()}_${waves.length + 1}`,
          orders: [],
          totalItems: 0,
          priority: order.priority,
          estimatedTime: 0
        };
        waves.push(currentWave);
      }

      // Add order to current wave
      currentWave.orders.push(order);
      currentWave.totalItems += orderItemCount;
      
      // Update wave priority (highest priority wins)
      if (order.priority === 'high' || 
          (order.priority === 'medium' && currentWave.priority !== 'high')) {
        currentWave.priority = order.priority;
      }

      // Estimate picking time (2 minutes per item + 5 minutes setup)
      currentWave.estimatedTime = (currentWave.totalItems * 2) + 5;
    });

    return waves;
  }

  calculateEfficiency(waves) {
    if (waves.length === 0) return 0;

    const totalItems = waves.reduce((sum, wave) => sum + wave.totalItems, 0);
    const totalWaves = waves.length;
    const avgItemsPerWave = totalItems / totalWaves;
    
    // Efficiency based on wave utilization (target: 30-40 items per wave)
    const targetItems = 35;
    const efficiency = Math.min(100, (avgItemsPerWave / targetItems) * 100);
    
    return Math.round(efficiency);
  }

  getRecommendedRules(orderHistory, currentMetrics) {
    // Analyze historical data to recommend optimal rules
    const avgOrderSize = orderHistory.length > 0 
      ? orderHistory.reduce((sum, order) => sum + (order.items?.length || 0), 0) / orderHistory.length
      : 5;

    const avgPickTime = currentMetrics?.averagePickTimePerItem || 2;

    return {
      maxOrdersPerWave: Math.max(5, Math.min(15, Math.floor(50 / avgOrderSize))),
      maxItemsPerWave: Math.max(20, Math.min(60, Math.floor(120 / avgPickTime))),
      priorityWeighting: true,
      dueDateWeighting: true,
      customerPriorityWeighting: true,
      abcClassGrouping: avgOrderSize > 3 // Group by ABC class if orders are large
    };
  }
}

module.exports = AutoWaveGenerator;