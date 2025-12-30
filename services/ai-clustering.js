// AI Clustering Service - K-Means and DBSCAN Implementation
// For product grouping based on sales frequency and picking patterns

class KMeansClustering {
  constructor(k = 3, maxIterations = 100) {
    this.k = k;
    this.maxIterations = maxIterations;
    this.centroids = [];
    this.clusters = [];
  }

  // Calculate Euclidean distance between two points
  euclideanDistance(point1, point2) {
    let sum = 0;
    for (let i = 0; i < point1.length; i++) {
      sum += Math.pow(point1[i] - point2[i], 2);
    }
    return Math.sqrt(sum);
  }

  // Initialize centroids randomly from data points
  initializeCentroids(data) {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    this.centroids = shuffled.slice(0, this.k).map(point => [...point.features]);
  }

  // Assign each point to nearest centroid
  assignClusters(data) {
    this.clusters = Array.from({ length: this.k }, () => []);
    
    data.forEach((point, index) => {
      let minDistance = Infinity;
      let clusterIndex = 0;
      
      this.centroids.forEach((centroid, i) => {
        const distance = this.euclideanDistance(point.features, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          clusterIndex = i;
        }
      });
      
      this.clusters[clusterIndex].push({ ...point, clusterIndex, distance: minDistance });
    });
  }

  // Update centroids based on cluster means
  updateCentroids() {
    const newCentroids = this.clusters.map(cluster => {
      if (cluster.length === 0) return this.centroids[0];
      
      const dimensions = cluster[0].features.length;
      const centroid = new Array(dimensions).fill(0);
      
      cluster.forEach(point => {
        point.features.forEach((val, i) => {
          centroid[i] += val;
        });
      });
      
      return centroid.map(val => val / cluster.length);
    });
    
    return newCentroids;
  }

  // Check if centroids have converged
  hasConverged(oldCentroids, newCentroids, threshold = 0.001) {
    for (let i = 0; i < oldCentroids.length; i++) {
      if (this.euclideanDistance(oldCentroids[i], newCentroids[i]) > threshold) {
        return false;
      }
    }
    return true;
  }

  // Main clustering method
  fit(data) {
    if (data.length < this.k) {
      this.k = data.length;
    }
    
    this.initializeCentroids(data);
    
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      this.assignClusters(data);
      const newCentroids = this.updateCentroids();
      
      if (this.hasConverged(this.centroids, newCentroids)) {
        break;
      }
      
      this.centroids = newCentroids;
    }
    
    return {
      clusters: this.clusters,
      centroids: this.centroids,
      labels: this.getLabels(data)
    };
  }

  getLabels(data) {
    const labels = new Array(data.length);
    this.clusters.forEach((cluster, clusterIndex) => {
      cluster.forEach(point => {
        const originalIndex = data.findIndex(d => d.id === point.id);
        if (originalIndex !== -1) {
          labels[originalIndex] = clusterIndex;
        }
      });
    });
    return labels;
  }
}

class DBSCANClustering {
  constructor(epsilon = 0.5, minPoints = 5) {
    this.epsilon = epsilon;
    this.minPoints = minPoints;
    this.labels = [];
    this.clusters = [];
  }

  euclideanDistance(point1, point2) {
    let sum = 0;
    for (let i = 0; i < point1.length; i++) {
      sum += Math.pow(point1[i] - point2[i], 2);
    }
    return Math.sqrt(sum);
  }

  // Find all neighbors within epsilon distance
  getNeighbors(data, pointIndex) {
    const neighbors = [];
    const point = data[pointIndex].features;
    
    data.forEach((other, index) => {
      if (index !== pointIndex) {
        const distance = this.euclideanDistance(point, other.features);
        if (distance <= this.epsilon) {
          neighbors.push(index);
        }
      }
    });
    
    return neighbors;
  }

  // Expand cluster from a core point
  expandCluster(data, pointIndex, neighbors, clusterId, visited) {
    this.labels[pointIndex] = clusterId;
    
    let i = 0;
    while (i < neighbors.length) {
      const neighborIndex = neighbors[i];
      
      if (!visited[neighborIndex]) {
        visited[neighborIndex] = true;
        const neighborNeighbors = this.getNeighbors(data, neighborIndex);
        
        if (neighborNeighbors.length >= this.minPoints) {
          neighbors = neighbors.concat(neighborNeighbors.filter(n => !neighbors.includes(n)));
        }
      }
      
      if (this.labels[neighborIndex] === -1) {
        this.labels[neighborIndex] = clusterId;
      }
      
      i++;
    }
  }

  // Main clustering method
  fit(data) {
    this.labels = new Array(data.length).fill(-1);
    const visited = new Array(data.length).fill(false);
    let clusterId = 0;
    
    data.forEach((point, index) => {
      if (visited[index]) return;
      
      visited[index] = true;
      const neighbors = this.getNeighbors(data, index);
      
      if (neighbors.length >= this.minPoints) {
        this.expandCluster(data, index, neighbors, clusterId, visited);
        clusterId++;
      }
    });
    
    // Group points by cluster
    this.clusters = [];
    for (let i = 0; i < clusterId; i++) {
      this.clusters.push([]);
    }
    
    data.forEach((point, index) => {
      if (this.labels[index] !== -1) {
        this.clusters[this.labels[index]].push({ ...point, clusterIndex: this.labels[index] });
      }
    });
    
    // Noise points (label = -1)
    const noisePoints = data.filter((_, index) => this.labels[index] === -1);
    
    return {
      clusters: this.clusters,
      labels: this.labels,
      noisePoints: noisePoints,
      numClusters: clusterId
    };
  }
}

// Product Clustering Service
class ProductClusteringService {
  constructor() {
    this.kmeans = null;
    this.dbscan = null;
  }

  // Prepare product data for clustering
  prepareProductData(products, pickingHistory) {
    return products.map(product => {
      const productPicks = pickingHistory.filter(p => p.product_id === product.id);
      const totalPicks = productPicks.length;
      const totalQuantity = productPicks.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const avgPickTime = productPicks.length > 0 
        ? productPicks.reduce((sum, p) => sum + (p.picking_time || 0), 0) / productPicks.length 
        : 0;
      
      return {
        id: product.id,
        reference: product.reference,
        features: [
          totalPicks,           // Picking frequency
          totalQuantity,        // Total quantity picked
          avgPickTime,          // Average picking time
          product.unit_price || 0  // Product value
        ],
        originalData: product
      };
    });
  }

  // Normalize features to 0-1 range
  normalizeFeatures(data) {
    if (data.length === 0) return data;
    
    const numFeatures = data[0].features.length;
    const mins = new Array(numFeatures).fill(Infinity);
    const maxs = new Array(numFeatures).fill(-Infinity);
    
    // Find min and max for each feature
    data.forEach(point => {
      point.features.forEach((val, i) => {
        mins[i] = Math.min(mins[i], val);
        maxs[i] = Math.max(maxs[i], val);
      });
    });
    
    // Normalize
    return data.map(point => ({
      ...point,
      features: point.features.map((val, i) => {
        const range = maxs[i] - mins[i];
        return range > 0 ? (val - mins[i]) / range : 0;
      })
    }));
  }

  // Run K-Means clustering for ABC classification
  runKMeansClustering(products, pickingHistory, k = 3) {
    const preparedData = this.prepareProductData(products, pickingHistory);
    const normalizedData = this.normalizeFeatures(preparedData);
    
    this.kmeans = new KMeansClustering(k);
    const result = this.kmeans.fit(normalizedData);
    
    // Classify clusters as A, B, C based on centroid values
    const clusterStats = result.clusters.map((cluster, index) => {
      const avgFrequency = cluster.reduce((sum, p) => sum + p.features[0], 0) / (cluster.length || 1);
      return { index, avgFrequency, size: cluster.length };
    });
    
    clusterStats.sort((a, b) => b.avgFrequency - a.avgFrequency);
    
    const classLabels = ['A', 'B', 'C'];
    const clusterToClass = {};
    clusterStats.forEach((stat, i) => {
      clusterToClass[stat.index] = classLabels[Math.min(i, classLabels.length - 1)];
    });
    
    // Calculate accuracy by comparing AI classification with existing ABC codes
    let correctClassifications = 0;
    let totalClassified = 0;
    
    result.clusters.forEach((cluster, clusterIndex) => {
      const aiClass = clusterToClass[clusterIndex];
      cluster.forEach(point => {
        const product = point.originalData;
        if (product.abc_code) {
          totalClassified++;
          if (product.abc_code.toUpperCase() === aiClass) {
            correctClassifications++;
          }
        }
      });
    });
    
    const accuracy = totalClassified > 0 ? Math.round((correctClassifications / totalClassified) * 100) : 0;
    
    return {
      algorithm: 'K-Means',
      clusters: result.clusters.map((cluster, index) => ({
        id: index,
        class: clusterToClass[index],
        products: cluster.map(p => ({
          id: p.id,
          reference: p.reference,
          class: clusterToClass[index]
        })),
        centroid: result.centroids[index],
        size: cluster.length
      })),
      summary: {
        totalProducts: products.length,
        classA: result.clusters.filter((_, i) => clusterToClass[i] === 'A').reduce((sum, c) => sum + c.length, 0),
        classB: result.clusters.filter((_, i) => clusterToClass[i] === 'B').reduce((sum, c) => sum + c.length, 0),
        classC: result.clusters.filter((_, i) => clusterToClass[i] === 'C').reduce((sum, c) => sum + c.length, 0),
        accuracy: accuracy,
        correctClassifications: correctClassifications,
        totalClassified: totalClassified
      }
    };
  }

  // Run DBSCAN clustering for anomaly detection
  runDBSCANClustering(products, pickingHistory, epsilon = 0.3, minPoints = 3) {
    const preparedData = this.prepareProductData(products, pickingHistory);
    const normalizedData = this.normalizeFeatures(preparedData);
    
    this.dbscan = new DBSCANClustering(epsilon, minPoints);
    const result = this.dbscan.fit(normalizedData);
    
    return {
      algorithm: 'DBSCAN',
      clusters: result.clusters.map((cluster, index) => ({
        id: index,
        products: cluster.map(p => ({
          id: p.id,
          reference: p.reference
        })),
        size: cluster.length
      })),
      noisePoints: result.noisePoints.map(p => ({
        id: p.id,
        reference: p.reference,
        reason: 'Outlier - unusual picking pattern'
      })),
      summary: {
        totalProducts: products.length,
        numClusters: result.numClusters,
        numNoisePoints: result.noisePoints.length
      }
    };
  }

  // Get storage recommendations based on clustering
  getStorageRecommendations(clusteringResult, storageLocations) {
    const recommendations = [];
    
    // Sort locations by distance from entrance (assuming entrance at 0,0,0)
    const sortedLocations = [...storageLocations].sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.x || 0, 2) + Math.pow(a.y || 0, 2) + Math.pow(a.z || 0, 2));
      const distB = Math.sqrt(Math.pow(b.x || 0, 2) + Math.pow(b.y || 0, 2) + Math.pow(b.z || 0, 2));
      return distA - distB;
    });
    
    // Assign Class A products to closest locations
    const classAProducts = clusteringResult.clusters
      .filter(c => c.class === 'A')
      .flatMap(c => c.products);
    
    const classBProducts = clusteringResult.clusters
      .filter(c => c.class === 'B')
      .flatMap(c => c.products);
    
    const classCProducts = clusteringResult.clusters
      .filter(c => c.class === 'C')
      .flatMap(c => c.products);
    
    let locationIndex = 0;
    
    classAProducts.forEach(product => {
      if (locationIndex < sortedLocations.length) {
        recommendations.push({
          product_id: product.id,
          product_reference: product.reference,
          recommended_location: sortedLocations[locationIndex].location_code,
          zone: 'A',
          reason: 'High frequency product - placed near entrance'
        });
        locationIndex++;
      }
    });
    
    classBProducts.forEach(product => {
      if (locationIndex < sortedLocations.length) {
        recommendations.push({
          product_id: product.id,
          product_reference: product.reference,
          recommended_location: sortedLocations[locationIndex].location_code,
          zone: 'B',
          reason: 'Medium frequency product - placed in middle zone'
        });
        locationIndex++;
      }
    });
    
    classCProducts.forEach(product => {
      if (locationIndex < sortedLocations.length) {
        recommendations.push({
          product_id: product.id,
          product_reference: product.reference,
          recommended_location: sortedLocations[locationIndex].location_code,
          zone: 'C',
          reason: 'Low frequency product - placed in far zone'
        });
        locationIndex++;
      }
    });
    
    return recommendations;
  }
}

module.exports = {
  KMeansClustering,
  DBSCANClustering,
  ProductClusteringService
};
