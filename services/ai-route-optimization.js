// AI Route Optimization Service - Genetic Algorithm Implementation
class GeneticAlgorithm {
  constructor(options = {}) {
    this.populationSize = options.populationSize || 50;
    this.generations = options.generations || 100;
    this.mutationRate = options.mutationRate || 0.1;
    this.elitismRate = options.elitismRate || 0.2;
    this.crossoverRate = options.crossoverRate || 0.8;
  }

  // Calculate Euclidean distance between two 3D points
  calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z || 0) - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Calculate total distance for a route
  calculateRouteDistance(route, locations) {
    if (route.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const current = locations[route[i]];
      const next = locations[route[i + 1]];
      totalDistance += this.calculateDistance(current, next);
    }
    return totalDistance;
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

  // Create initial population
  createInitialPopulation(numLocations) {
    const population = [];
    
    for (let i = 0; i < this.populationSize; i++) {
      population.push(this.generateRandomRoute(numLocations));
    }
    
    return population;
  }

  // Calculate fitness (inverse of distance - shorter routes have higher fitness)
  calculateFitness(route, locations) {
    const distance = this.calculateRouteDistance(route, locations);
    return distance > 0 ? 1 / distance : 0;
  }

  // Tournament selection
  tournamentSelection(population, fitnesses, tournamentSize = 3) {
    let best = null;
    let bestFitness = -1;
    
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      const fitness = fitnesses[randomIndex];
      
      if (fitness > bestFitness) {
        bestFitness = fitness;
        best = population[randomIndex];
      }
    }
    
    return [...best]; // Return copy
  }

  // Order crossover (OX)
  orderCrossover(parent1, parent2) {
    const length = parent1.length;
    const start = Math.floor(Math.random() * length);
    const end = Math.floor(Math.random() * (length - start)) + start;
    
    const child = new Array(length).fill(-1);
    
    // Copy segment from parent1
    for (let i = start; i <= end; i++) {
      child[i] = parent1[i];
    }
    
    // Fill remaining positions with parent2's order
    let parent2Index = 0;
    for (let i = 0; i < length; i++) {
      if (child[i] === -1) {
        while (child.includes(parent2[parent2Index])) {
          parent2Index++;
        }
        child[i] = parent2[parent2Index];
        parent2Index++;
      }
    }
    
    return child;
  }

  // Swap mutation
  swapMutation(route) {
    const mutated = [...route];
    
    if (Math.random() < this.mutationRate) {
      const i = Math.floor(Math.random() * mutated.length);
      const j = Math.floor(Math.random() * mutated.length);
      [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
    }
    
    return mutated;
  }

  // 2-opt local optimization
  twoOptImprovement(route, locations) {
    let improved = [...route];
    let bestDistance = this.calculateRouteDistance(improved, locations);
    let foundImprovement = true;
    
    while (foundImprovement) {
      foundImprovement = false;
      
      for (let i = 1; i < route.length - 2; i++) {
        for (let j = i + 1; j < route.length; j++) {
          if (j - i === 1) continue; // Skip adjacent edges
          
          // Create new route by reversing segment between i and j
          const newRoute = [...improved];
          this.reverseSegment(newRoute, i, j);
          
          const newDistance = this.calculateRouteDistance(newRoute, locations);
          
          if (newDistance < bestDistance) {
            improved = newRoute;
            bestDistance = newDistance;
            foundImprovement = true;
          }
        }
      }
    }
    
    return improved;
  }

  // Reverse segment of route
  reverseSegment(route, start, end) {
    while (start < end) {
      [route[start], route[end]] = [route[end], route[start]];
      start++;
      end--;
    }
  }

  // Main optimization method
  optimize(locations) {
    if (locations.length < 2) {
      return {
        route: locations.length === 1 ? [0] : [],
        distance: 0,
        generations: 0
      };
    }

    const numLocations = locations.length;
    let population = this.createInitialPopulation(numLocations);
    let bestRoute = null;
    let bestDistance = Infinity;
    let generationsWithoutImprovement = 0;
    const maxGenerationsWithoutImprovement = 20;

    for (let generation = 0; generation < this.generations; generation++) {
      // Calculate fitness for all individuals
      const fitnesses = population.map(route => 
        this.calculateFitness(route, locations)
      );

      // Find best route in current generation
      const maxFitnessIndex = fitnesses.indexOf(Math.max(...fitnesses));
      const currentBestRoute = population[maxFitnessIndex];
      const currentBestDistance = this.calculateRouteDistance(currentBestRoute, locations);

      // Update global best
      if (currentBestDistance < bestDistance) {
        bestDistance = currentBestDistance;
        bestRoute = [...currentBestRoute];
        generationsWithoutImprovement = 0;
      } else {
        generationsWithoutImprovement++;
      }

      // Early termination if no improvement
      if (generationsWithoutImprovement >= maxGenerationsWithoutImprovement) {
        break;
      }

      // Create new population
      const newPopulation = [];
      const eliteCount = Math.floor(this.populationSize * this.elitismRate);

      // Elitism - keep best individuals
      const sortedIndices = fitnesses
        .map((fitness, index) => ({ fitness, index }))
        .sort((a, b) => b.fitness - a.fitness)
        .slice(0, eliteCount)
        .map(item => item.index);

      sortedIndices.forEach(index => {
        newPopulation.push([...population[index]]);
      });

      // Generate offspring
      while (newPopulation.length < this.populationSize) {
        const parent1 = this.tournamentSelection(population, fitnesses);
        const parent2 = this.tournamentSelection(population, fitnesses);

        let child;
        if (Math.random() < this.crossoverRate) {
          child = this.orderCrossover(parent1, parent2);
        } else {
          child = Math.random() < 0.5 ? [...parent1] : [...parent2];
        }

        child = this.swapMutation(child);
        newPopulation.push(child);
      }

      population = newPopulation;
    }

    // Apply 2-opt improvement to best route
    if (bestRoute && bestRoute.length > 3) {
      bestRoute = this.twoOptImprovement(bestRoute, locations);
      bestDistance = this.calculateRouteDistance(bestRoute, locations);
    }

    return {
      route: bestRoute || [],
      distance: bestDistance,
      generations: Math.min(this.generations, generationsWithoutImprovement + 1)
    };
  }
}

// Route Optimization Service
class RouteOptimizationService {
  constructor() {
    this.ga = new GeneticAlgorithm();
  }

  optimizePickingRoute(pickingTasks, storageLocations) {
    // Prepare location data
    const taskLocations = pickingTasks.map(task => {
      const location = storageLocations.find(loc => loc.location_code === task.location_code);
      return {
        id: task.id,
        location_code: task.location_code,
        x: location?.x || 0,
        y: location?.y || 0,
        z: location?.z || 0,
        quantity: task.quantity_to_pick
      };
    });

    // Run genetic algorithm
    const result = this.ga.optimize(taskLocations);

    // Map result back to tasks
    const optimizedRoute = result.route.map((index, sequence) => ({
      sequence: sequence + 1,
      task_id: taskLocations[index].id,
      location_code: taskLocations[index].location_code,
      coordinates: {
        x: taskLocations[index].x,
        y: taskLocations[index].y,
        z: taskLocations[index].z
      },
      quantity: taskLocations[index].quantity
    }));

    return {
      optimized_route: optimizedRoute,
      total_distance: result.distance,
      generations_used: result.generations,
      tasks_optimized: pickingTasks.length
    };
  }

  getRouteVisualization(optimizedRoute) {
    return {
      path: optimizedRoute.map(task => task.coordinates),
      waypoints: optimizedRoute.map(task => ({
        location: task.location_code,
        coordinates: task.coordinates,
        sequence: task.sequence
      }))
    };
  }
}

module.exports = {
  GeneticAlgorithm,
  RouteOptimizationService
};