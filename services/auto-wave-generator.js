// Auto Wave Generation Service
class AutoWaveGenerator {
    constructor() {
        this.defaultRules = {
            maxOrdersPerWave: 20,
            maxItemsPerWave: 50,
            maxLocationsPerWave: 30,
            timeWindow: 60, // minutes
            priorityWeighting: true,
            zoneGrouping: true,
            distanceOptimization: true,
            operatorCapacity: 8 // hours per day
        };
    }

    async generateWaves(orders, rules = {}) {
        try {
            const config = { ...this.defaultRules, ...rules };
            
            // Step 1: Filter and prepare orders
            const eligibleOrders = this.filterEligibleOrders(orders);
            
            // Step 2: Group orders by criteria
            const orderGroups = this.groupOrdersByCriteria(eligibleOrders, config);
            
            // Step 3: Create waves from groups
            const waves = this.createWavesFromGroups(orderGroups, config);
            
            // Step 4: Optimize waves
            const optimizedWaves = this.optimizeWaves(waves, config);
            
            return {
                success: true,
                waves: optimizedWaves,
                summary: this.generateWaveSummary(optimizedWaves),
                rules: config
            };
        } catch (error) {
            console.error('Error generating auto waves:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    filterEligibleOrders(orders) {
        return orders.filter(order => {
            // Only include orders that are ready for picking
            return order.status === 'pending' || order.status === 'assigned';
        }).map(order => ({
            ...order,
            priority: this.calculateOrderPriority(order),
            estimatedPickTime: this.estimatePickTime(order),
            zones: this.getOrderZones(order)
        }));
    }

    calculateOrderPriority(order) {
        let priority = 0;
        
        // Base priority from order
        if (order.priority === 'urgent') priority += 100;
        else if (order.priority === 'high') priority += 50;
        else if (order.priority === 'normal') priority += 25;
        
        // Due date priority
        if (order.dueDate) {
            const dueDate = new Date(order.dueDate);
            const now = new Date();
            const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
            
            if (hoursUntilDue < 4) priority += 75;
            else if (hoursUntilDue < 8) priority += 50;
            else if (hoursUntilDue < 24) priority += 25;
        }
        
        // Customer priority
        if (order.customerPriority === 'VIP') priority += 30;
        else if (order.customerPriority === 'Premium') priority += 15;
        
        return priority;
    }

    estimatePickTime(order) {
        // Estimate pick time based on items and locations
        const baseTimePerItem = 1.5; // minutes
        const baseTimePerLocation = 2; // minutes for travel
        
        const itemCount = order.items ? order.items.length : 1;
        const locationCount = this.estimateLocationCount(order);
        
        return (itemCount * baseTimePerItem) + (locationCount * baseTimePerLocation);
    }

    estimateLocationCount(order) {
        // Simplified estimation - in real system would check actual storage locations
        if (order.items) {
            return Math.min(order.items.length, order.items.length * 0.7); // Assume some co-location
        }
        return 1;
    }

    getOrderZones(order) {
        // Simplified - in real system would check actual product locations
        const zones = new Set();
        if (order.items) {
            order.items.forEach(item => {
                // Simulate zone assignment based on product ABC class
                if (item.abcClass === 'A') zones.add('A');
                else if (item.abcClass === 'B') zones.add('B');
                else zones.add('C');
            });
        } else {
            zones.add('B'); // Default zone
        }
        return Array.from(zones);
    }

    groupOrdersByCriteria(orders, config) {
        const groups = [];
        
        if (config.zoneGrouping) {
            // Group by primary zone
            const zoneGroups = {};
            
            orders.forEach(order => {
                const primaryZone = order.zones[0] || 'B';
                if (!zoneGroups[primaryZone]) {
                    zoneGroups[primaryZone] = [];
                }
                zoneGroups[primaryZone].push(order);
            });
            
            // Convert zone groups to wave groups
            Object.entries(zoneGroups).forEach(([zone, zoneOrders]) => {
                // Sort by priority within zone
                zoneOrders.sort((a, b) => b.priority - a.priority);
                
                // Split large zone groups into smaller groups
                while (zoneOrders.length > 0) {
                    const groupSize = Math.min(config.maxOrdersPerWave, zoneOrders.length);
                    const group = zoneOrders.splice(0, groupSize);
                    
                    groups.push({
                        id: `zone-${zone}-${groups.length}`,
                        type: 'zone',
                        zone: zone,
                        orders: group,
                        priority: Math.max(...group.map(o => o.priority))
                    });
                }
            });
        } else {
            // Group by priority only
            orders.sort((a, b) => b.priority - a.priority);
            
            while (orders.length > 0) {
                const groupSize = Math.min(config.maxOrdersPerWave, orders.length);
                const group = orders.splice(0, groupSize);
                
                groups.push({
                    id: `priority-${groups.length}`,
                    type: 'priority',
                    orders: group,
                    priority: Math.max(...group.map(o => o.priority))
                });
            }
        }
        
        return groups;
    }

    createWavesFromGroups(groups, config) {
        const waves = [];
        
        groups.forEach((group, index) => {
            // Check if group meets wave criteria
            const totalItems = group.orders.reduce((sum, order) => 
                sum + (order.items ? order.items.length : 1), 0);
            const totalPickTime = group.orders.reduce((sum, order) => 
                sum + order.estimatedPickTime, 0);
            
            // Split group if it exceeds limits
            if (totalItems > config.maxItemsPerWave || totalPickTime > config.timeWindow) {
                const subWaves = this.splitGroupIntoWaves(group, config);
                waves.push(...subWaves);
            } else {
                waves.push(this.createWaveFromGroup(group, index));
            }
        });
        
        return waves;
    }

    splitGroupIntoWaves(group, config) {
        const subWaves = [];
        const orders = [...group.orders];
        let waveIndex = 0;
        
        while (orders.length > 0) {
            const currentWave = {
                orders: [],
                totalItems: 0,
                totalPickTime: 0
            };
            
            // Add orders to current wave until limits are reached
            while (orders.length > 0) {
                const order = orders[0];
                const orderItems = order.items ? order.items.length : 1;
                const orderTime = order.estimatedPickTime;
                
                if (currentWave.totalItems + orderItems <= config.maxItemsPerWave &&
                    currentWave.totalPickTime + orderTime <= config.timeWindow &&
                    currentWave.orders.length < config.maxOrdersPerWave) {
                    
                    currentWave.orders.push(orders.shift());
                    currentWave.totalItems += orderItems;
                    currentWave.totalPickTime += orderTime;
                } else {
                    break;
                }
            }
            
            if (currentWave.orders.length > 0) {
                subWaves.push(this.createWaveFromGroup({
                    ...group,
                    id: `${group.id}-${waveIndex}`,
                    orders: currentWave.orders
                }, waveIndex));
                waveIndex++;
            }
        }
        
        return subWaves;
    }

    createWaveFromGroup(group, index) {
        const totalItems = group.orders.reduce((sum, order) => 
            sum + (order.items ? order.items.length : 1), 0);
        const totalPickTime = group.orders.reduce((sum, order) => 
            sum + order.estimatedPickTime, 0);
        const zones = [...new Set(group.orders.flatMap(order => order.zones))];
        
        return {
            id: `auto-wave-${Date.now()}-${index}`,
            waveNumber: `AW${String(Date.now()).slice(-6)}-${index + 1}`,
            type: 'auto-generated',
            status: 'draft',
            priority: group.priority,
            orders: group.orders,
            orderIds: group.orders.map(o => o.id),
            totalOrders: group.orders.length,
            totalItems: totalItems,
            estimatedPickTime: Math.round(totalPickTime),
            zones: zones,
            groupType: group.type,
            createdAt: new Date().toISOString(),
            rules: {
                maxOrdersPerWave: group.orders.length,
                maxItemsPerWave: totalItems,
                estimatedTime: totalPickTime
            }
        };
    }

    optimizeWaves(waves, config) {
        if (!config.distanceOptimization) {
            return waves;
        }
        
        // Sort waves by priority and efficiency
        return waves.sort((a, b) => {
            // Primary sort by priority
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            
            // Secondary sort by efficiency (items per minute)
            const efficiencyA = a.totalItems / a.estimatedPickTime;
            const efficiencyB = b.totalItems / b.estimatedPickTime;
            
            return efficiencyB - efficiencyA;
        }).map((wave, index) => ({
            ...wave,
            sequence: index + 1,
            recommendedStartTime: this.calculateRecommendedStartTime(wave, index, config)
        }));
    }

    calculateRecommendedStartTime(wave, sequence, config) {
        const now = new Date();
        const startTime = new Date(now);
        
        // Add buffer time between waves
        const bufferMinutes = 15;
        const totalMinutes = sequence * (wave.estimatedPickTime + bufferMinutes);
        
        startTime.setMinutes(startTime.getMinutes() + totalMinutes);
        
        return startTime.toISOString();
    }

    generateWaveSummary(waves) {
        const totalOrders = waves.reduce((sum, wave) => sum + wave.totalOrders, 0);
        const totalItems = waves.reduce((sum, wave) => sum + wave.totalItems, 0);
        const totalTime = waves.reduce((sum, wave) => sum + wave.estimatedPickTime, 0);
        const zones = [...new Set(waves.flatMap(wave => wave.zones))];
        
        return {
            totalWaves: waves.length,
            totalOrders: totalOrders,
            totalItems: totalItems,
            estimatedTotalTime: Math.round(totalTime),
            zonesInvolved: zones,
            averageOrdersPerWave: Math.round(totalOrders / waves.length),
            averageItemsPerWave: Math.round(totalItems / waves.length),
            efficiency: {
                itemsPerMinute: Math.round((totalItems / totalTime) * 100) / 100,
                ordersPerHour: Math.round((totalOrders / (totalTime / 60)) * 100) / 100
            }
        };
    }

    async previewWaveGeneration(orders, rules = {}) {
        // Generate waves without saving to database
        const result = await this.generateWaves(orders, rules);
        
        if (result.success) {
            return {
                success: true,
                preview: {
                    waves: result.waves.map(wave => ({
                        waveNumber: wave.waveNumber,
                        totalOrders: wave.totalOrders,
                        totalItems: wave.totalItems,
                        estimatedTime: wave.estimatedPickTime,
                        zones: wave.zones,
                        priority: wave.priority,
                        recommendedStartTime: wave.recommendedStartTime
                    })),
                    summary: result.summary,
                    rules: result.rules
                }
            };
        }
        
        return result;
    }

    validateWaveRules(rules) {
        const errors = [];
        
        if (rules.maxOrdersPerWave && (rules.maxOrdersPerWave < 1 || rules.maxOrdersPerWave > 100)) {
            errors.push('Max orders per wave must be between 1 and 100');
        }
        
        if (rules.maxItemsPerWave && (rules.maxItemsPerWave < 1 || rules.maxItemsPerWave > 500)) {
            errors.push('Max items per wave must be between 1 and 500');
        }
        
        if (rules.timeWindow && (rules.timeWindow < 15 || rules.timeWindow > 480)) {
            errors.push('Time window must be between 15 and 480 minutes');
        }
        
        if (rules.operatorCapacity && (rules.operatorCapacity < 1 || rules.operatorCapacity > 24)) {
            errors.push('Operator capacity must be between 1 and 24 hours');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    getRecommendedRules(orderHistory, warehouseMetrics) {
        // Analyze historical data to recommend optimal rules
        const avgOrderSize = orderHistory.reduce((sum, order) => 
            sum + (order.items ? order.items.length : 1), 0) / orderHistory.length;
        
        const avgPickTime = warehouseMetrics.averagePickTimePerItem || 1.5;
        
        return {
            maxOrdersPerWave: Math.min(25, Math.max(10, Math.round(60 / avgPickTime))),
            maxItemsPerWave: Math.round(avgOrderSize * 20),
            maxLocationsPerWave: 35,
            timeWindow: 90,
            priorityWeighting: true,
            zoneGrouping: true,
            distanceOptimization: true,
            operatorCapacity: 8,
            reasoning: {
                avgOrderSize: Math.round(avgOrderSize * 100) / 100,
                avgPickTime: avgPickTime,
                recommendation: 'Based on historical order patterns and pick performance'
            }
        };
    }
}

module.exports = AutoWaveGenerator;