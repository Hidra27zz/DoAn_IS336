// Warehouse Layout Processor
// Xử lý và tích hợp dữ liệu layout kho từ Order_Picking_dataset.ipynb

const fs = require('fs');
const path = require('path');

class WarehouseLayoutProcessor {
  constructor() {
    this.datasets = {};
    this.layoutData = {};
    this.supportPoints = [];
    this.floorLevels = new Map();
    
    this.loadLayoutDatasets();
  }

  // Load datasets for warehouse layout processing
  loadLayoutDatasets() {
    try {
      // Load storage locations with coordinates
      this.datasets.storageLocations = this.parseStorageLocationsCSV('Storage_Location.csv');
      
      // Load support points for navigation
      this.datasets.supportPoints = this.parseSupportPointsCSV('Support_Points_Navigation.csv');
      
      // Process layout data by floor levels
      this.processFloorLevels();
      
      console.log('Warehouse layout datasets loaded successfully');
      console.log(`Processed ${this.datasets.storageLocations.length} storage locations`);
      console.log(`Found ${this.floorLevels.size} floor levels`);
      
    } catch (error) {
      console.error('Error loading layout datasets:', error);
    }
  }

  parseStorageLocationsCSV(filename) {
    const csvPath = path.join(__dirname, `../datasets/${filename}`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').slice(1);
    
    const locations = [];
    lines.forEach(line => {
      if (line.trim()) {
        const [originalLocation, position, x, y, z] = line.split(',');
        const locationCode = originalLocation?.replace(/"/g, '');
        
        if (locationCode && x && y && z) {
          locations.push({
            location: locationCode,
            position: position?.replace(/"/g, ''),
            x: parseInt(x) || 0,
            y: parseInt(y) || 0,
            z: parseInt(z) || 0,
            zone: locationCode?.split('-')[0] || 'UNKNOWN',
            aisle: locationCode?.split('-')[1] || '1',
            level: locationCode?.split('-')[2] || '1'
          });
        }
      }
    });
    
    return locations;
  }

  parseSupportPointsCSV(filename) {
    try {
      const csvPath = path.join(__dirname, `../datasets/${filename}`);
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n').slice(1);
      
      const supportPoints = [];
      lines.forEach(line => {
        if (line.trim()) {
          const parts = line.split(',');
          if (parts.length >= 2) {
            // Parse coordinates from string format like "(x, y, z)"
            const coordString = parts[0]?.replace(/[()]/g, '');
            const coords = coordString?.split(',').map(c => parseFloat(c.trim()) || 0);
            
            if (coords && coords.length >= 2) {
              supportPoints.push({
                x: coords[0],
                y: coords[1],
                z: coords[2] || 0,
                label: parts[1]?.trim() || 'Support Point',
                type: 'navigation'
              });
            }
          }
        }
      });
      
      return supportPoints;
    } catch (error) {
      console.log('Support points file not found, generating default points');
      return this.generateDefaultSupportPoints();
    }
  }

  generateDefaultSupportPoints() {
    const supportPoints = [
      { x: 0, y: 0, z: 0, label: 'Shipping Dock', type: 'dock' },
      { x: 100, y: 0, z: 0, label: 'Receiving Dock', type: 'dock' },
      { x: 200, y: 100, z: 0, label: 'Central Hub', type: 'hub' }
    ];
    
    // Generate zone centers as support points
    const zones = {};
    this.datasets.storageLocations.forEach(loc => {
      if (!zones[loc.zone]) {
        zones[loc.zone] = { x: [], y: [], z: [] };
      }
      zones[loc.zone].x.push(loc.x);
      zones[loc.zone].y.push(loc.y);
      zones[loc.zone].z.push(loc.z);
    });
    
    Object.keys(zones).forEach(zone => {
      const zoneData = zones[zone];
      const centerX = zoneData.x.reduce((sum, x) => sum + x, 0) / zoneData.x.length;
      const centerY = zoneData.y.reduce((sum, y) => sum + y, 0) / zoneData.y.length;
      const centerZ = zoneData.z.reduce((sum, z) => sum + z, 0) / zoneData.z.length;
      
      supportPoints.push({
        x: Math.round(centerX),
        y: Math.round(centerY),
        z: Math.round(centerZ),
        label: `Zone ${zone} Center`,
        type: 'zone_center',
        zone: zone
      });
    });
    
    return supportPoints;
  }

  // Process data by floor levels (Z values)
  processFloorLevels() {
    // Group locations by Z coordinate (floor level)
    this.datasets.storageLocations.forEach(location => {
      const floor = location.z;
      
      if (!this.floorLevels.has(floor)) {
        this.floorLevels.set(floor, {
          floor: floor,
          locations: [],
          zones: new Set(),
          bounds: {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
          },
          blockSize: this.calculateBlockSize(floor)
        });
      }
      
      const floorData = this.floorLevels.get(floor);
      floorData.locations.push(location);
      floorData.zones.add(location.zone);
      
      // Update bounds
      floorData.bounds.minX = Math.min(floorData.bounds.minX, location.x);
      floorData.bounds.maxX = Math.max(floorData.bounds.maxX, location.x);
      floorData.bounds.minY = Math.min(floorData.bounds.minY, location.y);
      floorData.bounds.maxY = Math.max(floorData.bounds.maxY, location.y);
    });
    
    // Convert zones Set to Array for each floor
    this.floorLevels.forEach(floorData => {
      floorData.zones = Array.from(floorData.zones);
    });
  }

  // Calculate block size based on floor level (from notebook insights)
  calculateBlockSize(floor) {
    // Dynamic block sizing based on floor level (from notebook)
    if (floor === 3 || floor === 4) {
      return { width: 45, height: 30 };
    }
    return { width: 15, height: 30 };
  }

  // Generate layout data for specific floor
  generateFloorLayout(floor) {
    const floorData = this.floorLevels.get(floor);
    if (!floorData) {
      return { error: `Floor ${floor} not found` };
    }
    
    // Generate blocks for this floor
    const blocks = floorData.locations.map(location => ({
      location: location.location,
      zone: location.zone,
      aisle: location.aisle,
      level: location.level,
      coordinates: {
        x: location.x,
        y: location.y,
        z: location.z
      },
      blockSize: floorData.blockSize,
      bounds: {
        xmin: location.x - floorData.blockSize.width / 2,
        xmax: location.x + floorData.blockSize.width / 2,
        ymin: location.y - floorData.blockSize.height / 2,
        ymax: location.y + floorData.blockSize.height / 2
      }
    }));
    
    // Get support points for this floor
    const floorSupportPoints = this.datasets.supportPoints.filter(
      point => point.z === floor
    );
    
    // Generate navigation connections
    const navigationConnections = this.generateNavigationConnections(floorSupportPoints);
    
    return {
      floor: floor,
      totalLocations: blocks.length,
      zones: floorData.zones,
      bounds: floorData.bounds,
      blockSize: floorData.blockSize,
      blocks: blocks,
      supportPoints: floorSupportPoints,
      navigationConnections: navigationConnections,
      layoutMetrics: this.calculateLayoutMetrics(floorData)
    };
  }

  // Generate navigation connections between support points
  generateNavigationConnections(supportPoints) {
    const connections = {
      horizontal: [],
      vertical: []
    };
    
    // Group points by Y coordinate for horizontal connections
    const pointsByY = {};
    supportPoints.forEach(point => {
      if (!pointsByY[point.y]) {
        pointsByY[point.y] = [];
      }
      pointsByY[point.y].push(point);
    });
    
    // Create horizontal connections
    Object.values(pointsByY).forEach(points => {
      if (points.length > 1) {
        points.sort((a, b) => a.x - b.x);
        for (let i = 0; i < points.length - 1; i++) {
          connections.horizontal.push({
            from: points[i],
            to: points[i + 1],
            distance: Math.abs(points[i + 1].x - points[i].x)
          });
        }
      }
    });
    
    // Group points by X coordinate for vertical connections
    const pointsByX = {};
    supportPoints.forEach(point => {
      if (!pointsByX[point.x]) {
        pointsByX[point.x] = [];
      }
      pointsByX[point.x].push(point);
    });
    
    // Create vertical connections
    Object.values(pointsByX).forEach(points => {
      if (points.length > 1) {
        points.sort((a, b) => a.y - b.y);
        for (let i = 0; i < points.length - 1; i++) {
          connections.vertical.push({
            from: points[i],
            to: points[i + 1],
            distance: Math.abs(points[i + 1].y - points[i].y)
          });
        }
      }
    });
    
    return connections;
  }

  // Calculate layout metrics for optimization
  calculateLayoutMetrics(floorData) {
    const metrics = {
      density: floorData.locations.length / this.calculateFloorArea(floorData.bounds),
      zoneDistribution: {},
      averageDistanceFromCenter: 0,
      accessibilityScore: 0
    };
    
    // Calculate zone distribution
    floorData.zones.forEach(zone => {
      const zoneLocations = floorData.locations.filter(loc => loc.zone === zone);
      metrics.zoneDistribution[zone] = {
        count: zoneLocations.length,
        percentage: (zoneLocations.length / floorData.locations.length * 100).toFixed(2)
      };
    });
    
    // Calculate center point
    const centerX = (floorData.bounds.minX + floorData.bounds.maxX) / 2;
    const centerY = (floorData.bounds.minY + floorData.bounds.maxY) / 2;
    
    // Calculate average distance from center
    const totalDistance = floorData.locations.reduce((sum, loc) => {
      return sum + Math.sqrt(
        Math.pow(loc.x - centerX, 2) + Math.pow(loc.y - centerY, 2)
      );
    }, 0);
    
    metrics.averageDistanceFromCenter = (totalDistance / floorData.locations.length).toFixed(2);
    
    // Calculate accessibility score (lower distance from origin = higher score)
    const accessibilityScores = floorData.locations.map(loc => {
      const distanceFromOrigin = Math.sqrt(Math.pow(loc.x, 2) + Math.pow(loc.y, 2));
      return 1000 / (distanceFromOrigin + 1);
    });
    
    metrics.accessibilityScore = (
      accessibilityScores.reduce((sum, score) => sum + score, 0) / accessibilityScores.length
    ).toFixed(2);
    
    return metrics;
  }

  calculateFloorArea(bounds) {
    return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  }

  // Generate complete warehouse layout data
  generateCompleteWarehouseLayout() {
    const layout = {
      totalFloors: this.floorLevels.size,
      totalLocations: this.datasets.storageLocations.length,
      totalSupportPoints: this.datasets.supportPoints.length,
      floors: {},
      overallMetrics: {},
      navigationNetwork: this.generateOverallNavigationNetwork()
    };
    
    // Generate layout for each floor
    Array.from(this.floorLevels.keys()).sort().forEach(floor => {
      layout.floors[floor] = this.generateFloorLayout(floor);
    });
    
    // Calculate overall metrics
    layout.overallMetrics = this.calculateOverallMetrics();
    
    return layout;
  }

  generateOverallNavigationNetwork() {
    // Create a comprehensive navigation network across all floors
    const network = {
      nodes: [],
      edges: [],
      zones: {},
      shortcuts: []
    };
    
    // Add all support points as nodes
    this.datasets.supportPoints.forEach((point, index) => {
      network.nodes.push({
        id: index,
        ...point,
        connections: []
      });
    });
    
    // Add storage locations as nodes
    this.datasets.storageLocations.forEach((location, index) => {
      network.nodes.push({
        id: this.datasets.supportPoints.length + index,
        x: location.x,
        y: location.y,
        z: location.z,
        label: location.location,
        type: 'storage',
        zone: location.zone,
        connections: []
      });
    });
    
    // Generate edges between nearby nodes
    network.nodes.forEach((node1, i) => {
      network.nodes.forEach((node2, j) => {
        if (i !== j && node1.z === node2.z) { // Same floor
          const distance = Math.sqrt(
            Math.pow(node2.x - node1.x, 2) + Math.pow(node2.y - node1.y, 2)
          );
          
          // Connect nodes within reasonable distance
          if (distance <= 100) {
            network.edges.push({
              from: node1.id,
              to: node2.id,
              distance: distance,
              floor: node1.z
            });
            
            node1.connections.push(node2.id);
          }
        }
      });
    });
    
    return network;
  }

  calculateOverallMetrics() {
    const metrics = {
      floorDistribution: {},
      zoneDistribution: {},
      densityByFloor: {},
      accessibilityDistribution: {
        high: 0,
        medium: 0,
        low: 0
      }
    };
    
    // Floor distribution
    this.floorLevels.forEach((floorData, floor) => {
      metrics.floorDistribution[floor] = {
        locations: floorData.locations.length,
        zones: floorData.zones.length,
        area: this.calculateFloorArea(floorData.bounds)
      };
      
      metrics.densityByFloor[floor] = (
        floorData.locations.length / this.calculateFloorArea(floorData.bounds)
      ).toFixed(4);
    });
    
    // Zone distribution across all floors
    const allZones = {};
    this.datasets.storageLocations.forEach(location => {
      if (!allZones[location.zone]) {
        allZones[location.zone] = 0;
      }
      allZones[location.zone]++;
    });
    
    Object.keys(allZones).forEach(zone => {
      metrics.zoneDistribution[zone] = {
        count: allZones[zone],
        percentage: (allZones[zone] / this.datasets.storageLocations.length * 100).toFixed(2)
      };
    });
    
    // Accessibility distribution
    this.datasets.storageLocations.forEach(location => {
      const distanceFromOrigin = Math.sqrt(Math.pow(location.x, 2) + Math.pow(location.y, 2));
      
      if (distanceFromOrigin <= 100) {
        metrics.accessibilityDistribution.high++;
      } else if (distanceFromOrigin <= 300) {
        metrics.accessibilityDistribution.medium++;
      } else {
        metrics.accessibilityDistribution.low++;
      }
    });
    
    return metrics;
  }

  // Get layout data for visualization
  getLayoutForVisualization(floor = null) {
    if (floor !== null) {
      return this.generateFloorLayout(floor);
    }
    
    return this.generateCompleteWarehouseLayout();
  }

  // Get available floors
  getAvailableFloors() {
    return Array.from(this.floorLevels.keys()).sort().map(floor => {
      const floorData = this.floorLevels.get(floor);
      return {
        floor: floor,
        locationCount: floorData.locations.length,
        zoneCount: floorData.zones.length,
        blockSize: floorData.blockSize,
        bounds: floorData.bounds
      };
    });
  }

  // Generate layout optimization recommendations
  generateLayoutOptimizationRecommendations() {
    const recommendations = [];
    
    this.floorLevels.forEach((floorData, floor) => {
      const metrics = this.calculateLayoutMetrics(floorData);
      
      // Check density issues
      if (metrics.density > 0.8) {
        recommendations.push({
          type: 'density',
          floor: floor,
          severity: 'high',
          message: `Floor ${floor} has high density (${metrics.density.toFixed(2)}). Consider expanding or reorganizing.`,
          suggestion: 'Redistribute products to less dense areas or expand storage capacity'
        });
      }
      
      // Check accessibility issues
      if (parseFloat(metrics.accessibilityScore) < 100) {
        recommendations.push({
          type: 'accessibility',
          floor: floor,
          severity: 'medium',
          message: `Floor ${floor} has low accessibility score (${metrics.accessibilityScore}). Consider relocating high-velocity items.`,
          suggestion: 'Move frequently accessed items closer to shipping/receiving areas'
        });
      }
      
      // Check zone balance
      const zoneImbalance = Object.values(metrics.zoneDistribution).some(
        zone => parseFloat(zone.percentage) > 50
      );
      
      if (zoneImbalance) {
        recommendations.push({
          type: 'zone_balance',
          floor: floor,
          severity: 'low',
          message: `Floor ${floor} has unbalanced zone distribution.`,
          suggestion: 'Consider redistributing products across zones for better balance'
        });
      }
    });
    
    return recommendations;
  }
}

module.exports = WarehouseLayoutProcessor;