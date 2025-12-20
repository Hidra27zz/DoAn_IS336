// Mock Data for Demo when Firebase quota exceeded
const bcrypt = require('bcryptjs');

class MockDatabase {
  constructor() {
    this.users = [];
    this.products = [];
    this.inventory = [];
    this.orders = [];
    this.storageLocations = [];
    this.pickingWaves = [];
    this.pickingTasks = [];
    this.movements = [];
    this.orderItems = [];
    
    this.initializeMockData();
  }

  async initializeMockData() {
    console.log('🔄 Initializing mock data for demo...');
    
    // Create mock users
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const managerPasswordHash = await bcrypt.hash('manager123', 12);
    const operatorPasswordHash = await bcrypt.hash('operator123', 12);
    
    this.users = [
      {
        id: 'user_admin',
        username: 'admin',
        email: 'admin@wms.local',
        password_hash: adminPasswordHash,
        role: 'admin',
        status: 'active'
      },
      {
        id: 'user_manager',
        username: 'manager',
        email: 'manager@wms.local',
        password_hash: managerPasswordHash,
        role: 'manager',
        status: 'active'
      },
      {
        id: 'user_op1',
        username: 'Operator_1',
        email: 'op1@wms.local',
        password_hash: operatorPasswordHash,
        role: 'operator',
        status: 'active'
      }
    ];

    // Create mock products
    for (let i = 1; i <= 50; i++) {
      this.products.push({
        id: `product_${i}`,
        reference: `PROD-${String(i).padStart(3, '0')}`,
        abc_code: i <= 10 ? 'A' : i <= 25 ? 'B' : 'C',
        abc_description: i <= 10 ? 'High demand - Fast moving' : i <= 25 ? 'Medium demand - Regular' : 'Low demand - Slow moving',
        sector_code: 'PF',
        sector_name: 'Footwear',
        category: 'Footwear',
        description: `Product ${i} - SKU PROD-${String(i).padStart(3, '0')}`,
        unit_price: i <= 10 ? 89.99 : i <= 25 ? 59.99 : 39.99
      });
    }

    // Create mock storage locations
    const zones = ['A', 'B', 'C', 'H'];
    for (let i = 1; i <= 100; i++) {
      const zone = zones[i % 4];
      this.storageLocations.push({
        id: `location_${i}`,
        location_code: `${zone}-${Math.floor(i/4)+1}-${(i%4)+1}`,
        position: `${i}`,
        x: (i % 10) * 10,
        y: Math.floor(i / 10) * 10,
        z: Math.floor(Math.random() * 5) + 1,
        zone: zone,
        zone_name: `Zone ${zone}`,
        aisle: String(Math.floor(i/4)+1),
        level: String((i%4)+1),
        capacity: 100,
        current_occupancy: Math.floor(Math.random() * 80),
        status: 'active'
      });
    }

    // Create mock inventory
    for (let i = 0; i < 50; i++) {
      this.inventory.push({
        id: `inventory_${i}`,
        product_id: this.products[i].id,
        product_reference: this.products[i].reference,
        location_id: this.storageLocations[i].id,
        location_code: this.storageLocations[i].location_code,
        zone: this.storageLocations[i].zone,
        abc_code: this.products[i].abc_code,
        quantity: Math.floor(Math.random() * 200) + 50,
        reserved_quantity: 0,
        product: this.products[i],
        location: this.storageLocations[i]
      });
    }

    // Create mock orders
    for (let i = 1; i <= 20; i++) {
      this.orders.push({
        id: `order_${i}`,
        order_number: `ORD-${String(i).padStart(4, '0')}`,
        customer_code: `CUST${String(i).padStart(3, '0')}`,
        wave_number: Math.floor((i-1) / 5) + 1,
        status: i <= 5 ? 'completed' : i <= 10 ? 'picking' : i <= 15 ? 'assigned' : 'pending',
        priority: i <= 5 ? 'high' : 'normal',
        total_items: Math.floor(Math.random() * 5) + 1,
        creation_date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Create mock picking waves
    for (let i = 1; i <= 5; i++) {
      this.pickingWaves.push({
        id: `wave_${i}`,
        wave_number: i,
        operator_name: `Operator_${(i % 3) + 1}`,
        status: i <= 2 ? 'completed' : i <= 3 ? 'in_progress' : 'created',
        total_items: Math.floor(Math.random() * 20) + 10,
        started_at: i <= 3 ? new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000).toISOString() : null,
        completed_at: i <= 2 ? new Date(Date.now() - Math.random() * 60 * 60 * 1000).toISOString() : null
      });
    }

    // Create mock picking tasks
    for (let i = 1; i <= 30; i++) {
      const waveId = `wave_${Math.floor((i-1) / 6) + 1}`;
      const productIndex = i % this.products.length;
      const locationIndex = i % this.storageLocations.length;
      
      this.pickingTasks.push({
        id: `task_${i}`,
        wave_id: waveId,
        product_id: this.products[productIndex].id,
        location_id: this.storageLocations[locationIndex].id,
        product_reference: this.products[productIndex].reference,
        size: 'M',
        quantity_to_pick: Math.floor(Math.random() * 5) + 1,
        location_code: this.storageLocations[locationIndex].location_code,
        sequence_number: (i % 6) + 1,
        status: i <= 12 ? 'completed' : i <= 18 ? 'in_progress' : 'pending',
        quantity_picked: i <= 12 ? Math.floor(Math.random() * 5) + 1 : 0,
        picking_time_seconds: i <= 12 ? Math.floor(Math.random() * 30) + 20 : null
      });
    }

    console.log('✅ Mock data initialized successfully');
  }

  // User operations
  async getUserByUsername(username) {
    return this.users.find(u => u.username === username) || null;
  }

  async getUserByEmail(email) {
    return this.users.find(u => u.email === email) || null;
  }

  async getUserById(id) {
    return this.users.find(u => u.id === id) || null;
  }

  // Product operations
  async getAllProducts() {
    return this.products;
  }

  async getProductById(id) {
    return this.products.find(p => p.id === id) || null;
  }

  // Inventory operations
  async getAllInventory() {
    return this.inventory.map(item => ({
      ...item,
      product: this.products.find(p => p.id === item.product_id),
      location: this.storageLocations.find(l => l.id === item.location_id)
    }));
  }

  async getInventorySummary() {
    const totalProducts = this.products.length;
    const totalQuantity = this.inventory.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockItems = this.inventory.filter(item => item.quantity < 50).length;
    const totalValue = this.inventory.reduce((sum, item) => {
      const product = this.products.find(p => p.id === item.product_id);
      return sum + (item.quantity * (product?.unit_price || 0));
    }, 0);

    return {
      total_products: totalProducts,
      total_quantity: totalQuantity,
      low_stock_items: lowStockItems,
      total_value: totalValue,
      abc_distribution: {
        A: this.products.filter(p => p.abc_code === 'A').length,
        B: this.products.filter(p => p.abc_code === 'B').length,
        C: this.products.filter(p => p.abc_code === 'C').length
      }
    };
  }

  // Order operations
  async getAllOrders() {
    return this.orders;
  }

  async getOrderById(id) {
    return this.orders.find(o => o.id === id) || null;
  }

  async createOrder(data) {
    const id = 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const order = {
      id,
      order_number: data.order_number || `ORD-${String(this.orders.length + 1).padStart(4, '0')}`,
      customer_code: data.customer_code || `CUST${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
      status: data.status || 'pending',
      priority: data.priority || 'normal',
      total_items: data.total_items || 1,
      creation_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      ...data
    };
    
    this.orders.push(order);
    console.log(`✅ Mock DB: Created order ${order.order_number}`);
    return order;
  }

  async updateOrderStatus(id, status) {
    const order = this.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      order.updated_at = new Date().toISOString();
      console.log(`✅ Mock DB: Updated order ${order.order_number} status to ${status}`);
      return order;
    }
    return null;
  }

  // Inventory operations
  async createInventoryItem(data) {
    const id = 'inventory_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const item = {
      id,
      product_id: data.product_id,
      product_reference: data.product_reference,
      location_id: data.location_id,
      location_code: data.location_code,
      zone: data.zone,
      quantity: data.quantity || 0,
      reserved_quantity: data.reserved_quantity || 0,
      created_at: new Date().toISOString(),
      ...data
    };
    
    this.inventory.push(item);
    console.log(`✅ Mock DB: Created inventory item for ${item.product_reference} at ${item.location_code}`);
    return item;
  }

  async adjustInventory(id, newQuantity, reason) {
    const item = this.inventory.find(i => i.id === id);
    if (item) {
      const oldQuantity = item.quantity;
      item.quantity = newQuantity;
      item.updated_at = new Date().toISOString();
      
      // Create movement record
      const movement = {
        id: 'movement_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        movement_type: 'adjustment',
        product_id: item.product_id,
        location_id: item.location_id,
        quantity: newQuantity - oldQuantity,
        reference_type: 'adjustment',
        notes: reason || 'Stock adjustment',
        created_at: new Date().toISOString()
      };
      this.movements.push(movement);
      
      console.log(`Mock DB: Adjusted inventory ${id} from ${oldQuantity} to ${newQuantity}`);
      return item;
    }
    return null;
  }

  // Picking Wave operations
  async createPickingWave(data) {
    const id = 'wave_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const wave = {
      id,
      wave_number: data.wave_number || (this.pickingWaves.length + 1),
      operator_name: data.operator_name || 'Operator_1',
      status: data.status || 'created',
      total_items: data.total_items || 0,
      created_at: new Date().toISOString(),
      ...data
    };
    
    this.pickingWaves.push(wave);
    console.log(`✅ Mock DB: Created picking wave ${wave.wave_number}`);
    return wave;
  }

  async updatePickingWaveStatus(id, status) {
    const wave = this.pickingWaves.find(w => w.id === id);
    if (wave) {
      wave.status = status;
      wave.updated_at = new Date().toISOString();
      
      if (status === 'in_progress') {
        wave.started_at = new Date().toISOString();
      } else if (status === 'completed') {
        wave.completed_at = new Date().toISOString();
      }
      
      console.log(`✅ Mock DB: Updated wave ${wave.wave_number} status to ${status}`);
      return wave;
    }
    return null;
  }

  // Storage location operations
  async getAllStorageLocations() {
    return this.storageLocations;
  }

  async getWarehouseLayout() {
    const locations = this.storageLocations.map(loc => ({
      ...loc,
      pick_frequency: Math.floor(Math.random() * 50),
      utilization: (loc.current_occupancy / loc.capacity) * 100
    }));

    const zoneSummary = {};
    locations.forEach(loc => {
      if (!zoneSummary[loc.zone]) {
        zoneSummary[loc.zone] = {
          zone: loc.zone,
          total_locations: 0,
          occupied_locations: 0,
          total_capacity: 0,
          used_capacity: 0
        };
      }
      zoneSummary[loc.zone].total_locations++;
      zoneSummary[loc.zone].total_capacity += loc.capacity;
      zoneSummary[loc.zone].used_capacity += loc.current_occupancy;
      if (loc.current_occupancy > 0) {
        zoneSummary[loc.zone].occupied_locations++;
      }
    });

    return {
      locations: locations,
      zone_summary: Object.values(zoneSummary),
      total_locations: locations.length
    };
  }

  // Picking operations
  async getAllPickingWaves() {
    return this.pickingWaves;
  }

  async getPickingTasksByWave(waveId) {
    return this.pickingTasks.filter(task => task.wave_id === waveId);
  }

  // AI operations - mock implementations
  async saveCluster(data) {
    console.log('Mock: Cluster saved', data.algorithm);
    return { id: 'cluster_' + Date.now(), ...data };
  }

  async saveOptimization(data) {
    console.log('Mock: Optimization saved', data.type);
    return { id: 'optimization_' + Date.now(), ...data };
  }

  async getLatestClusters() {
    return [
      {
        id: 'cluster_1',
        algorithm: 'K-Means',
        created_at: new Date().toISOString(),
        result: {
          summary: { classA: 10, classB: 15, classC: 25, totalProducts: 50 }
        }
      }
    ];
  }

  async getOptimizations() {
    return [
      {
        id: 'opt_1',
        type: 'route',
        created_at: new Date().toISOString(),
        result: { improvement_percentage: 28.5 }
      }
    ];
  }

  // Generic database operations for compatibility
  async create(collection, data) {
    const id = collection + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    const item = { id, ...data, created_at: new Date().toISOString() };
    
    switch(collection) {
      case 'users':
        this.users.push(item);
        break;
      case 'products':
        this.products.push(item);
        break;
      case 'inventory':
        this.inventory.push(item);
        break;
      case 'orders':
        this.orders.push(item);
        break;
      case 'storage_locations':
        this.storageLocations.push(item);
        break;
      case 'picking_waves':
        this.pickingWaves.push(item);
        break;
      case 'picking_tasks':
        this.pickingTasks.push(item);
        break;
      case 'movements':
        this.movements.push(item);
        break;
      case 'order_items':
        this.orderItems.push(item);
        break;
    }
    
    console.log(`✅ Mock DB: Created ${collection} with ID: ${id}`);
    return item;
  }

  async getAll(collection, filters = []) {
    let data = [];
    
    switch(collection) {
      case 'users':
        data = this.users;
        break;
      case 'products':
        data = this.products;
        break;
      case 'inventory':
        data = this.inventory;
        break;
      case 'orders':
        data = this.orders;
        break;
      case 'storage_locations':
        data = this.storageLocations;
        break;
      case 'picking_waves':
        data = this.pickingWaves;
        break;
      case 'picking_tasks':
        data = this.pickingTasks;
        break;
      case 'movements':
        data = this.movements;
        break;
      case 'order_items':
        data = this.orderItems;
        break;
    }
    
    // Apply simple filters
    filters.forEach(filter => {
      data = data.filter(item => {
        if (filter.op === '==') {
          return item[filter.field] === filter.value;
        }
        return true;
      });
    });
    
    return data;
  }

  async get(collection, id) {
    const data = await this.getAll(collection);
    return data.find(item => item.id === id) || null;
  }

  async update(collection, id, updateData) {
    let data;
    let targetArray;
    
    switch(collection) {
      case 'users':
        targetArray = this.users;
        break;
      case 'products':
        targetArray = this.products;
        break;
      case 'inventory':
        targetArray = this.inventory;
        break;
      case 'orders':
        targetArray = this.orders;
        break;
      case 'storage_locations':
        targetArray = this.storageLocations;
        break;
      case 'picking_waves':
        targetArray = this.pickingWaves;
        break;
      case 'picking_tasks':
        targetArray = this.pickingTasks;
        break;
      case 'movements':
        targetArray = this.movements;
        break;
      case 'order_items':
        targetArray = this.orderItems;
        break;
      default:
        return null;
    }
    
    const index = targetArray.findIndex(item => item.id === id);
    
    if (index !== -1) {
      targetArray[index] = { ...targetArray[index], ...updateData, updated_at: new Date().toISOString() };
      console.log(`✅ Mock DB: Updated ${collection} ID: ${id}`, updateData);
      return targetArray[index];
    }
    
    console.log(`Mock DB: Item not found in ${collection} with ID: ${id}`);
    return null;
  }

  async delete(collection, id) {
    const data = await this.getAll(collection);
    const index = data.findIndex(item => item.id === id);
    
    if (index !== -1) {
      return data.splice(index, 1)[0];
    }
    
    return null;
  }
}

module.exports = { MockDatabase };