// Firebase Database Connection Layer with Mock Fallback
const { FirebaseDB, COLLECTIONS, initialized: firebaseInitialized } = require('../config/firebase');
const { MockDatabase } = require('./mock-data');

class Database {
  constructor() {
    this.db = FirebaseDB;
    this.collections = COLLECTIONS;
    this.mockDb = null;
    this.useMockData = false;
  }

  async initialize() {
    console.log('Initializing Firebase Firestore connection...');
    
    // Check if Firebase was initialized successfully
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase not initialized, using mock data');
      this.mockDb = new MockDatabase();
      await this.mockDb.initializeMockData();
      this.useMockData = true;
      return true;
    }
    
    // Test Firebase connection with timeout
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase connection timeout')), 5000)
      );
      
      const testPromise = this.db.getAll(COLLECTIONS.USERS, [], 1);
      
      const testResult = await Promise.race([testPromise, timeoutPromise]);
      console.log('✅ Firebase connection successful');
      this.useMockData = false;
    } catch (error) {
      console.log('⚠️ Firebase quota exceeded or connection failed, switching to mock data');
      console.log('Error details:', error.message);
      this.mockDb = new MockDatabase();
      await this.mockDb.initializeMockData();
      this.useMockData = true;
    }
    
    return true;
  }

  // Helper method to get the appropriate database
  getDb() {
    return this.useMockData ? this.mockDb : this.db;
  }

  // User operations
  async createUser(data) {
    if (this.useMockData) {
      return await this.mockDb.create('users', data);
    }
    return await this.db.create(COLLECTIONS.USERS, data);
  }

  async getUserByUsername(username) {
    if (this.useMockData) {
      return await this.mockDb.getUserByUsername(username);
    }
    const users = await this.db.getAll(COLLECTIONS.USERS, [
      { field: 'username', op: '==', value: username }
    ]);
    return users[0] || null;
  }

  async getUserByEmail(email) {
    if (this.useMockData) {
      return await this.mockDb.getUserByEmail(email);
    }
    const users = await this.db.getAll(COLLECTIONS.USERS, [
      { field: 'email', op: '==', value: email }
    ]);
    return users[0] || null;
  }

  async getUserById(id) {
    if (this.useMockData) {
      return await this.mockDb.getUserById(id);
    }
    return await this.db.get(COLLECTIONS.USERS, id);
  }

  async updateUser(id, data) {
    if (this.useMockData) {
      return await this.mockDb.update('users', id, data);
    }
    return await this.db.update(COLLECTIONS.USERS, id, data);
  }

  // Product operations
  async createProduct(data) {
    if (this.useMockData) {
      return await this.mockDb.create('products', data);
    }
    return await this.db.create(COLLECTIONS.PRODUCTS, data);
  }

  async getProductById(id) {
    if (this.useMockData) {
      return await this.mockDb.getProductById(id);
    }
    return await this.db.get(COLLECTIONS.PRODUCTS, id);
  }

  async getAllProducts() {
    if (this.useMockData) {
      return await this.mockDb.getAllProducts();
    }
    return await this.db.getAll(COLLECTIONS.PRODUCTS);
  }

  // Inventory operations
  async getAllInventory() {
    if (this.useMockData) {
      return await this.mockDb.getAllInventory();
    }
    return await this.db.getAll(COLLECTIONS.INVENTORY);
  }

  async getInventorySummary() {
    if (this.useMockData) {
      return await this.mockDb.getInventorySummary();
    }
    
    const inventory = await this.db.getAll(COLLECTIONS.INVENTORY);
    const products = await this.db.getAll(COLLECTIONS.PRODUCTS);
    
    const totalProducts = products.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const lowStockItems = inventory.filter(item => (item.quantity || 0) < 50).length;
    
    return {
      total_products: totalProducts,
      total_quantity: totalQuantity,
      low_stock_items: lowStockItems,
      total_value: 0,
      abc_distribution: {
        A: products.filter(p => p.abc_code === 'A').length,
        B: products.filter(p => p.abc_code === 'B').length,
        C: products.filter(p => p.abc_code === 'C').length
      }
    };
  }

  // Order operations
  async getAllOrders() {
    if (this.useMockData) {
      return await this.mockDb.getAllOrders();
    }
    return await this.db.getAll(COLLECTIONS.ORDERS);
  }

  async createOrder(data) {
    if (this.useMockData) {
      return await this.mockDb.createOrder(data);
    }
    return await this.db.create(COLLECTIONS.ORDERS, data);
  }

  async updateOrder(id, data) {
    if (this.useMockData) {
      return await this.mockDb.update('orders', id, data);
    }
    return await this.db.update(COLLECTIONS.ORDERS, id, data);
  }

  async getOrderById(id) {
    if (this.useMockData) {
      return await this.mockDb.getOrderById(id);
    }
    return await this.db.get(COLLECTIONS.ORDERS, id);
  }

  // Storage location operations
  async getAllStorageLocations() {
    if (this.useMockData) {
      return await this.mockDb.getAllStorageLocations();
    }
    return await this.db.getAll(COLLECTIONS.STORAGE_LOCATIONS);
  }

  async getWarehouseLayout() {
    if (this.useMockData) {
      return await this.mockDb.getWarehouseLayout();
    }
    
    const locations = await this.db.getAll(COLLECTIONS.STORAGE_LOCATIONS);
    return {
      locations: locations,
      zone_summary: [],
      total_locations: locations.length
    };
  }

  // Picking operations
  async getAllPickingWaves() {
    if (this.useMockData) {
      return await this.mockDb.getAllPickingWaves();
    }
    return await this.db.getAll(COLLECTIONS.PICKING_WAVES);
  }

  async getPickingTasksByWave(waveId) {
    if (this.useMockData) {
      return await this.mockDb.getPickingTasksByWave(waveId);
    }
    return await this.db.getAll(COLLECTIONS.PICKING_TASKS, [
      { field: 'wave_id', op: '==', value: waveId }
    ]);
  }

  // AI operations
  async saveCluster(data) {
    if (this.useMockData) {
      return await this.mockDb.saveCluster(data);
    }
    return await this.db.create('ai_clusters', data);
  }

  async saveOptimization(data) {
    if (this.useMockData) {
      return await this.mockDb.saveOptimization(data);
    }
    return await this.db.create('ai_optimizations', data);
  }

  async getLatestClusters() {
    if (this.useMockData) {
      return await this.mockDb.getLatestClusters();
    }
    return await this.db.getAll('ai_clusters');
  }

  async getOptimizations() {
    if (this.useMockData) {
      return await this.mockDb.getOptimizations();
    }
    return await this.db.getAll('ai_optimizations');
  }

  // Additional Firebase-specific methods
  async getProductByReference(reference) {
    if (this.useMockData) {
      return this.mockDb.products.find(p => p.reference === reference) || null;
    }
    const products = await this.db.getAll(COLLECTIONS.PRODUCTS, [
      { field: 'reference', op: '==', value: reference }
    ]);
    return products[0] || null;
  }

  async getStorageLocationByCode(code) {
    if (this.useMockData) {
      return this.mockDb.storageLocations.find(l => l.location_code === code) || null;
    }
    const locations = await this.db.getAll(COLLECTIONS.STORAGE_LOCATIONS, [
      { field: 'location_code', op: '==', value: code }
    ]);
    return locations[0] || null;
  }

  async getStorageLocationById(id) {
    if (this.useMockData) {
      return this.mockDb.storageLocations.find(l => l.id === id) || null;
    }
    return await this.db.get(COLLECTIONS.STORAGE_LOCATIONS, id);
  }

  async getInventoryById(id) {
    if (this.useMockData) {
      return this.mockDb.inventory.find(i => i.id === id) || null;
    }
    return await this.db.get(COLLECTIONS.INVENTORY, id);
  }

  async getInventoryByProduct(productId) {
    if (this.useMockData) {
      return this.mockDb.inventory.filter(i => i.product_id === productId);
    }
    return await this.db.getAll(COLLECTIONS.INVENTORY, [
      { field: 'product_id', op: '==', value: productId }
    ]);
  }

  async getOrderItemsByOrder(orderId) {
    if (this.useMockData) {
      // Mock implementation - return empty array for now
      return [];
    }
    return await this.db.getAll(COLLECTIONS.ORDER_ITEMS, [
      { field: 'order_id', op: '==', value: orderId }
    ]);
  }

  async createOrderItem(data) {
    if (this.useMockData) {
      return await this.mockDb.create('order_items', data);
    }
    return await this.db.create(COLLECTIONS.ORDER_ITEMS, data);
  }

  async updateInventory(id, data) {
    if (this.useMockData) {
      return await this.mockDb.update('inventory', id, data);
    }
    return await this.db.update(COLLECTIONS.INVENTORY, id, data);
  }

  async createStorageLocation(data) {
    if (this.useMockData) {
      return await this.mockDb.create('storage_locations', data);
    }
    return await this.db.create(COLLECTIONS.STORAGE_LOCATIONS, data);
  }

  async updateStorageLocation(id, data) {
    if (this.useMockData) {
      return await this.mockDb.update('storage_locations', id, data);
    }
    return await this.db.update(COLLECTIONS.STORAGE_LOCATIONS, id, data);
  }

  async deleteStorageLocation(id) {
    if (this.useMockData) {
      return await this.mockDb.delete('storage_locations', id);
    }
    return await this.db.delete(COLLECTIONS.STORAGE_LOCATIONS, id);
  }

  async createMovement(data) {
    if (this.useMockData) {
      return await this.mockDb.create('movements', data);
    }
    return await this.db.create(COLLECTIONS.WAREHOUSE_MOVEMENTS, data);
  }

  async getAllMovements() {
    if (this.useMockData) {
      return await this.mockDb.getAll('movements');
    }
    return await this.db.getAll(COLLECTIONS.WAREHOUSE_MOVEMENTS);
  }

  async createLog(data) {
    if (this.useMockData) {
      console.log('Mock log:', data);
      return { id: 'log_' + Date.now(), ...data };
    }
    return await this.db.create(COLLECTIONS.SYSTEM_LOGS, data);
  }

  async getAllPickingTasks() {
    if (this.useMockData) {
      return this.mockDb.pickingTasks;
    }
    return await this.db.getAll(COLLECTIONS.PICKING_TASKS);
  }

  async updatePickingTask(id, data) {
    if (this.useMockData) {
      return await this.mockDb.update('picking_tasks', id, data);
    }
    return await this.db.update(COLLECTIONS.PICKING_TASKS, id, data);
  }

  async updatePickingWave(id, data) {
    if (this.useMockData) {
      return await this.mockDb.update('picking_waves', id, data);
    }
    return await this.db.update(COLLECTIONS.PICKING_WAVES, id, data);
  }

  async getProductById(id) {
    if (this.useMockData) {
      return this.mockDb.products.find(p => p.id === id) || null;
    }
    return await this.db.get(COLLECTIONS.PRODUCTS, id);
  }

  async updateProduct(id, data) {
    if (this.useMockData) {
      return await this.mockDb.update('products', id, data);
    }
    return await this.db.update(COLLECTIONS.PRODUCTS, id, data);
  }

  async getPickingWaveById(id) {
    if (this.useMockData) {
      return this.mockDb.pickingWaves.find(w => w.id === id) || null;
    }
    return await this.db.get(COLLECTIONS.PICKING_WAVES, id);
  }

  // Batch operations
  async batchCreate(collectionName, items) {
    if (this.useMockData) {
      console.log(`Mock batch create: ${items.length} items to ${collectionName}`);
      return;
    }
    const operations = items.map(item => ({
      type: 'set',
      collection: collectionName,
      data: item
    }));
    await this.db.batch(operations);
  }

  close() {
    console.log('Firebase connection closed');
  }
}

module.exports = new Database();
