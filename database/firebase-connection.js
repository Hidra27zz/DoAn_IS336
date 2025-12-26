// Firebase Database Connection Layer - Firebase with Local Fallback
const { FirebaseDB, COLLECTIONS, initialized: firebaseInitialized, useLocalDB, setUseLocalDB } = require('../config/firebase');

class Database {
  constructor() {
    this.db = FirebaseDB;
    this.collections = COLLECTIONS;
    this.useLocalDB = useLocalDB;
  }

  async initialize() {
    console.log('Initializing database connection...');
    
    // Check if Firebase was initialized successfully
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase not available, using local database');
      setUseLocalDB(true);
      this.useLocalDB = true;
      console.log('✅ Local database connection successful');
      return true;
    }
    
    // Test Firebase connection
    try {
      await this.db.getAll(COLLECTIONS.USERS, []);
      console.log('✅ Firebase connection successful');
      return true;
    } catch (error) {
      console.log('⚠️ Firebase connection failed, switching to local database:', error.message);
      setUseLocalDB(true);
      this.useLocalDB = true;
      console.log('✅ Local database connection successful');
      return true;
    }
  }

  // User operations
  async createUser(data) {
    return await this.db.create(COLLECTIONS.USERS, data);
  }

  async getUserByUsername(username) {
    const users = await this.db.getAll(COLLECTIONS.USERS, [
      { field: 'username', op: '==', value: username }
    ]);
    return users[0] || null;
  }

  async getUserByEmail(email) {
    const users = await this.db.getAll(COLLECTIONS.USERS, [
      { field: 'email', op: '==', value: email }
    ]);
    return users[0] || null;
  }

  async getUserById(id) {
    return await this.db.get(COLLECTIONS.USERS, id);
  }

  async updateUser(id, data) {
    return await this.db.update(COLLECTIONS.USERS, id, data);
  }

  // Product operations
  async createProduct(data) {
    return await this.db.create(COLLECTIONS.PRODUCTS, data);
  }

  async getProductById(id) {
    return await this.db.get(COLLECTIONS.PRODUCTS, id);
  }

  async getAllProducts() {
    return await this.db.getAll(COLLECTIONS.PRODUCTS);
  }

  // Inventory operations
  async getAllInventory() {
    return await this.db.getAll(COLLECTIONS.INVENTORY);
  }

  async getInventorySummary() {
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
    return await this.db.getAll(COLLECTIONS.ORDERS);
  }

  async createOrder(data) {
    return await this.db.create(COLLECTIONS.ORDERS, data);
  }

  async updateOrder(id, data) {
    return await this.db.update(COLLECTIONS.ORDERS, id, data);
  }

  async getOrderById(id) {
    return await this.db.get(COLLECTIONS.ORDERS, id);
  }

  // Storage location operations
  async getAllStorageLocations() {
    return await this.db.getAll(COLLECTIONS.STORAGE_LOCATIONS);
  }

  async getWarehouseLayout() {
    const locations = await this.db.getAll(COLLECTIONS.STORAGE_LOCATIONS);
    return {
      locations: locations,
      zone_summary: [],
      total_locations: locations.length
    };
  }

  // Picking operations
  async getAllPickingWaves() {
    return await this.db.getAll(COLLECTIONS.PICKING_WAVES);
  }

  async getPickingTasksByWave(waveId) {
    return await this.db.getAll(COLLECTIONS.PICKING_TASKS, [
      { field: 'wave_id', op: '==', value: waveId }
    ]);
  }

  // AI operations
  async saveCluster(data) {
    return await this.db.create('ai_clusters', data);
  }

  async saveOptimization(data) {
    return await this.db.create('ai_optimizations', data);
  }

  async getLatestClusters() {
    return await this.db.getAll('ai_clusters');
  }

  async getOptimizations() {
    return await this.db.getAll('ai_optimizations');
  }

  // Additional Firebase-specific methods
  async getProductByReference(reference) {
    const products = await this.db.getAll(COLLECTIONS.PRODUCTS, [
      { field: 'reference', op: '==', value: reference }
    ]);
    return products[0] || null;
  }

  async getStorageLocationByCode(code) {
    const locations = await this.db.getAll(COLLECTIONS.STORAGE_LOCATIONS, [
      { field: 'location_code', op: '==', value: code }
    ]);
    return locations[0] || null;
  }

  async getStorageLocationById(id) {
    return await this.db.get(COLLECTIONS.STORAGE_LOCATIONS, id);
  }

  async getInventoryById(id) {
    return await this.db.get(COLLECTIONS.INVENTORY, id);
  }

  async getInventoryByProduct(productId) {
    return await this.db.getAll(COLLECTIONS.INVENTORY, [
      { field: 'product_id', op: '==', value: productId }
    ]);
  }

  async getOrderItemsByOrder(orderId) {
    return await this.db.getAll(COLLECTIONS.ORDER_ITEMS, [
      { field: 'order_id', op: '==', value: orderId }
    ]);
  }

  async createOrderItem(data) {
    return await this.db.create(COLLECTIONS.ORDER_ITEMS, data);
  }

  async updateInventory(id, data) {
    return await this.db.update(COLLECTIONS.INVENTORY, id, data);
  }

  async createStorageLocation(data) {
    return await this.db.create(COLLECTIONS.STORAGE_LOCATIONS, data);
  }

  async updateStorageLocation(id, data) {
    return await this.db.update(COLLECTIONS.STORAGE_LOCATIONS, id, data);
  }

  async deleteStorageLocation(id) {
    return await this.db.delete(COLLECTIONS.STORAGE_LOCATIONS, id);
  }

  async createMovement(data) {
    return await this.db.create(COLLECTIONS.WAREHOUSE_MOVEMENTS, data);
  }

  async getAllMovements() {
    return await this.db.getAll(COLLECTIONS.WAREHOUSE_MOVEMENTS);
  }

  async createLog(data) {
    return await this.db.create(COLLECTIONS.SYSTEM_LOGS, data);
  }

  async getAllPickingTasks() {
    return await this.db.getAll(COLLECTIONS.PICKING_TASKS);
  }

  async updatePickingTask(id, data) {
    return await this.db.update(COLLECTIONS.PICKING_TASKS, id, data);
  }

  async updatePickingWave(id, data) {
    return await this.db.update(COLLECTIONS.PICKING_WAVES, id, data);
  }

  async updateProduct(id, data) {
    return await this.db.update(COLLECTIONS.PRODUCTS, id, data);
  }

  async getPickingWaveById(id) {
    return await this.db.get(COLLECTIONS.PICKING_WAVES, id);
  }

  // Batch operations
  async batchCreate(collectionName, items) {
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
