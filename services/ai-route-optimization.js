// AI Route Optimization Service - Genetic Algorithm Implementation
// For optimizing warehouse picking routes

class GeneticAlgorithm {
  constructor(options = {}) {
    this.populationSize = options.populationSize || 50;
    this.generations = options.generations || 100;
    this.mutationRate = options.mutationRate || 0.1;
    this.crossoverRate = options.crossoverRate || 0.8;
    this.eliteSize = options.eliteSize || 5;
    this.tournamentSize = options.tournamentSize || 5;
  }

  // Calculate distance between two 3D points
  calculateDistance(point1, point2) {
    const dx = (point1.x || 0) - (point2.x || 0);
    const dy = (point1.y || 0) - (point2.y || 0);
    const dz = (point1.z || 0) - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Calculate total route distance
  calculateRouteDistance(route, distanceMatrix) {
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += distanceMatrix[route[i]][route[i + 1]];
    }
    // Return to start
    if (route.length > 0) {
      totalDistance += distanceMatrix[route[route.length - 1]][route[0]];
    }
    return totalDistance;
  }

  // Calculate fitness (inverse of distance)
  calculateFitness(route, distanceMatrix) {
    const distance = this.calculateRouteDistance(route, distanceMatrix);
    return distance > 0 ? 1 / distance : Infinity;
  }

  // Create distance matrix from locations
  createDistanceMatrix(locations) {
    const n = locations.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const distance = this.calculateDistance(locations[i], locations[j]);
        matrix[i][j] = distance;
        matrix[j][i] = distance;
      }
    }
    
    return matrix;
  }

  // Generate random route
  generateRandomRoute(numLocations) {
    const route = Array.from({ length: numLocations }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = route.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [route[i], route[j]] = [route[j], route[i]];
    }
    return route;
  }

  // Initialize population
  initializePopulation(numLocations) {
    return Array.from({ length: this.populationSize }, () => 
      this.generateRandomRoute(numLocations)
    );
  }

  // Tournament selection
  tournamentSelection(population, fitnesses) {
    const tournamentIndices = [];
    for (let i = 0; i < this.tournamentSize; i++) {
      tournamentIndices.push(Math.floor(Math.random() * population.length));
    }
    
    let bestIndex = tournamentIndices[0];
    let bestFitness = fitnesses[bestIndex];
    
    for (let i = 1; i < tournamentIndices.length; i++) {
      if (fitnesses[tournamentIndices[i]] > bestFitness) {
        bestIndex = tournamentIndices[i];
        bestFitness = fitnesses[tournamentIndices[i]];
      }
    }
    
    return [...population[bestIndex]];
  }

  // Order crossover (OX)
  crossover(parent1, parent2) {
    if (Math.random() > this.crossoverRate) {
      return [[...parent1], [...parent2]];
    }
    
    const length = parent1.length;
    const start = Math.floor(Math.random() * length);
    const end = Math.floor(Math.random() * (length - start)) + start;
    
    const child1 = new Array(length).fill(-1);
    const child2 = new Array(length).fill(-1);
    
    // Copy segment from parents
    for (let i = start; i <= end; i++) {
      child1[i] = parent1[i];
      child2[i] = parent2[i];
    }
    
    // Fill remaining positions
    let pos1 = (end + 1) % length;
    let pos2 = (end + 1) % length;
    
    for (let i = 0; i < length; i++) {
      const idx = (end + 1 + i) % length;
      
      if (!child1.includes(parent2[idx])) {
        child1[pos1] = parent2[idx];
        pos1 = (pos1 + 1) % length;
      }
      
      if (!child2.includes(parent1[idx])) {
        child2[pos2] = parent1[idx];
        pos2 = (pos2 + 1) % length;
      }
    }
    
    return [child1, child2];
  }

  // Swap mutation
  mutate(route) {
    if (Math.random() < this.mutationRate) {
      const i = Math.floor(Math.random() * route.length);
      const j = Math.floor(Math.random() * route.length);
      [route[i], route[j]] = [route[j], route[i]];
    }
    return route;
  }

  // 2-opt local optimization
  twoOpt(route, distanceMatrix) {
    let improved = true;
    let bestRoute = [...route];
    let bestDistance = this.calculateRouteDistance(bestRoute, distanceMatrix);
    
    while (improved) {
      improved = false;
      for (let i = 0; i < route.length - 1; i++) {
        for (let j = i + 2; j < route.length; j++) {
          const newRoute = [...bestRoute];
          // Reverse segment between i and j
          const segment = newRoute.slice(i + 1, j + 1).reverse();
          newRoute.splice(i + 1, segment.length, ...segment);
          
          const newDistance = this.calculateRouteDistance(newRoute, distanceMatrix);
          if (newDistance < bestDistance) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }
    
    return bestRoute;
  }

  // Main optimization method
  optimize(locations) {
    if (locations.length <= 2) {
      return {
        route: locations.map((_, i) => i),
        distance: locations.length === 2 ? this.calculateDistance(locations[0], locations[1]) : 0,
        generations: 0
      };
    }
    
    const distanceMatrix = this.createDistanceMatrix(locations);
    let population = this.initializePopulation(locations.length);
    
    let bestRoute = null;
    let bestDistance = Infinity;
    let generationStats = [];
    
    for (let gen = 0; gen < this.generations; gen++) {
      // Calculate fitness for all routes
      const fitnesses = population.map(route => 
        this.calculateFitness(route, distanceMatrix)
      );
      
      // Find best route in current generation
      const maxFitnessIndex = fitnesses.indexOf(Math.max(...fitnesses));
      const currentBestDistance = this.calculateRouteDistance(population[maxFitnessIndex], distanceMatrix);
      
      if (currentBestDistance < bestDistance) {
        bestDistance = currentBestDistance;
        bestRoute = [...population[maxFitnessIndex]];
      }
      
      generationStats.push({
        generation: gen,
        bestDistance: currentBestDistance,
        avgDistance: population.reduce((sum, route) => 
          sum + this.calculateRouteDistance(route, distanceMatrix), 0) / population.length
      });
      
      // Create new population
      const newPopulation = [];
      
      // Elitism - keep best routes
      const sortedIndices = fitnesses
        .map((f, i) => ({ fitness: f, index: i }))
        .sort((a, b) => b.fitness - a.fitness)
        .slice(0, this.eliteSize)
        .map(item => item.index);
      
      sortedIndices.forEach(i => {
        newPopulation.push([...population[i]]);
      });
      
      // Generate rest of population through selection, crossover, mutation
      while (newPopulation.length < this.populationSize) {
        const parent1 = this.tournamentSelection(population, fitnesses);
        const parent2 = this.tournamentSelection(population, fitnesses);
        
        const [child1, child2] = this.crossover(parent1, parent2);
        
        newPopulation.push(this.mutate(child1));
        if (newPopulation.length < this.populationSize) {
          newPopulation.push(this.mutate(child2));
        }
      }
      
      population = newPopulation;
    }
    
    // Apply 2-opt local optimization to best route
    bestRoute = this.twoOpt(bestRoute, distanceMatrix);
    bestDistance = this.calculateRouteDistance(bestRoute, distanceMatrix);
    
    return {
      route: bestRoute,
      distance: bestDistance,
      generations: this.generations,
      stats: generationStats
    };
  }
}

// Route Optimization Service
class RouteOptimizationService {
  constructor() {
    this.ga = null;
  }

  // Optimize picking route for a wave
  optimizePickingRoute(pickingTasks, storageLocations, options = {}) {
    // Map tasks to locations with coordinates
    const taskLocations = pickingTasks.map(task => {
      const location = storageLocations.find(loc => loc.id === task.location_id);
      return {
        task_id: task.id,
        location_id: task.location_id,
        location_code: location ? location.location_code : 'Unknown',
        x: location ? (location.x_coordinate || location.x || 0) : 0,
        y: location ? (location.y_coordinate || location.y || 0) : 0,
        z: location ? (location.z_coordinate || location.z || 0) : 0,
        quantity: task.quantity_to_pick || task.quantity || 0,
        product_id: task.product_id
      };
    });
    
    if (taskLocations.length === 0) {
      return {
        optimized_route: [],
        original_distance: 0,
        optimized_distance: 0,
        improvement_percentage: 0,
        estimated_time_minutes: 0
      };
    }
    
    // Calculate original route distance (sequential order)
    this.ga = new GeneticAlgorithm({
      populationSize: options.populationSize || 50,
      generations: options.generations || 100,
      mutationRate: options.mutationRate || 0.1
    });
    
    const originalRoute = taskLocations.map((_, i) => i);
    const distanceMatrix = this.ga.createDistanceMatrix(taskLocations);
    const originalDistance = this.ga.calculateRouteDistance(originalRoute, distanceMatrix);
    
    // Run genetic algorithm optimization
    const result = this.ga.optimize(taskLocations);
    
    // Map optimized route back to tasks
    const optimizedRoute = result.route.map((index, sequence) => ({
      sequence: sequence + 1,
      task_id: taskLocations[index].task_id,
      location_id: taskLocations[index].location_id,
      location_code: taskLocations[index].location_code,
      coordinates: {
        x: taskLocations[index].x,
        y: taskLocations[index].y,
        z: taskLocations[index].z
      },
      quantity: taskLocations[index].quantity,
      product_id: taskLocations[index].product_id
    }));
    
    const improvementPercentage = originalDistance > 0 
      ? ((originalDistance - result.distance) / originalDistance) * 100 
      : 0;
    
    // Estimate time (assuming 30 seconds per pick + travel time)
    const avgSpeed = 1.5; // meters per second
    const pickTime = 30; // seconds per pick
    const travelTime = result.distance / avgSpeed;
    const totalTime = (pickingTasks.length * pickTime) + travelTime;
    
    return {
      optimized_route: optimizedRoute,
      original_distance: Math.round(originalDistance * 100) / 100,
      optimized_distance: Math.round(result.distance * 100) / 100,
      improvement_percentage: Math.round(improvementPercentage * 100) / 100,
      estimated_time_seconds: Math.round(totalTime),
      estimated_time_minutes: Math.round(totalTime / 60 * 10) / 10,
      algorithm: 'Genetic Algorithm with 2-opt',
      parameters: {
        population_size: this.ga.populationSize,
        generations: this.ga.generations,
        mutation_rate: this.ga.mutationRate
      }
    };
  }

  // Optimize multiple waves
  optimizeMultipleWaves(waves, pickingTasks, storageLocations) {
    const results = [];
    
    waves.forEach(wave => {
      const waveTasks = pickingTasks.filter(task => task.wave_id === wave.id);
      const optimization = this.optimizePickingRoute(waveTasks, storageLocations);
      
      results.push({
        wave_id: wave.id,
        wave_number: wave.wave_number,
        ...optimization
      });
    });
    
    const totalOriginalDistance = results.reduce((sum, r) => sum + r.original_distance, 0);
    const totalOptimizedDistance = results.reduce((sum, r) => sum + r.optimized_distance, 0);
    const totalImprovement = totalOriginalDistance > 0 
      ? ((totalOriginalDistance - totalOptimizedDistance) / totalOriginalDistance) * 100 
      : 0;
    
    return {
      waves: results,
      summary: {
        total_waves: waves.length,
        total_original_distance: Math.round(totalOriginalDistance * 100) / 100,
        total_optimized_distance: Math.round(totalOptimizedDistance * 100) / 100,
        total_improvement_percentage: Math.round(totalImprovement * 100) / 100,
        total_estimated_time_minutes: results.reduce((sum, r) => sum + r.estimated_time_minutes, 0)
      }
    };
  }

  // Get route visualization data
  getRouteVisualization(optimizedRoute) {
    const pathPoints = optimizedRoute.map(point => ({
      x: point.coordinates.x,
      y: point.coordinates.y,
      z: point.coordinates.z,
      label: point.location_code,
      sequence: point.sequence
    }));
    
    // Add start point (entrance at 0,0,0)
    pathPoints.unshift({
      x: 0,
      y: 0,
      z: 0,
      label: 'Entrance',
      sequence: 0
    });
    
    // Add return to entrance
    pathPoints.push({
      x: 0,
      y: 0,
      z: 0,
      label: 'Exit',
      sequence: pathPoints.length
    });
    
    return {
      path: pathPoints,
      segments: pathPoints.slice(0, -1).map((point, i) => ({
        from: point,
        to: pathPoints[i + 1],
        distance: Math.sqrt(
          Math.pow(pathPoints[i + 1].x - point.x, 2) +
          Math.pow(pathPoints[i + 1].y - point.y, 2) +
          Math.pow(pathPoints[i + 1].z - point.z, 2)
        )
      }))
    };
  }
}

module.exports = {
  GeneticAlgorithm,
  RouteOptimizationService
};
