// Populate Local JSON Database with sample data
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');

class LocalDBPopulator {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.datasetsDir = path.join(__dirname, '..', 'datasets');
  }

  generateId() {
    return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  async writeCollection(collectionName, data) {
    const filePath = path.join(this.dataDir, `${collectionName}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ Created ${collectionName}.json with ${data.length} records`);
  }

  async populateAll() {
    console.log('🌱 Populating local JSON database...');
    
    await this.ensureDataDir();
    
    // Users already exist, so skip
    console.log('👥 Users already exist, skipping...');
    
    await this.populateProducts();
    await this.populateStorageLocations();
    await this.populateInventory();
    await this.populateOrders();
    await this.populatePickingWaves();
    
    console.log('✅ Local database population completed!');
  }

  async populateProducts() {
    console.log('📦 Populating products...');
    
    const products = [];
    const productFile = path.join(this.datasetsDir, 'Product.csv');
    
    return new Promise((resolve, reject) => {
      const stream = require('fs').createReadStream(productFile)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.Reference && row.Reference !== 'Reference') {
            products.push({
              id: this.generateId(),
              reference: row.Reference,
              abc_code: row.ABCCOD || 'C',
              sector: row.Sector || 'PF',
              description: `Footwear Product ${row.Reference}`,
              unit_price: Math.floor(Math.random() * 200) + 50,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        })
        .on('end', async () => {
          await this.writeCollection('products', products);
          resolve();
        })
        .on('error', reject);
    });
  }

  async populateStorageLocations() {
    console.log('📍 Populating storage locations...');
    
    const locations = [];
    const locationFile = path.join(this.datasetsDir, 'Storage_Location.csv');
    
    return new Promise((resolve, reject) => {
      const stream = require('fs').createReadStream(locationFile)
        .pipe(csv())
        .on('data', (row) => {
          if (row.originalLocation && row.originalLocation !== 'originalLocation') {
            const zone = row.originalLocation.split('-')[0] || 'A';
            
            locations.push({
              id: this.generateId(),
              location_code: row.originalLocation,
              x: parseInt(row.x) || 0,
              y: parseInt(row.y) || 0,
              z: parseInt(row.z) || 0,
              zone: zone,
              capacity: 100,
              current_occupancy: Math.floor(Math.random() * 80),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        })
        .on('end', async () => {
          await this.writeCollection('storage_locations', locations);
          resolve();
        })
        .on('error', reject);
    });
  }

  async populateInventory() {
    console.log('📊 Populating inventory...');
    
    // Read products and locations first
    const productsData = await fs.readFile(path.join(this.dataDir, 'products.json'), 'utf8');
    const products = JSON.parse(productsData);
    const productMap = new Map(products.map(p => [p.reference, p.id]));
    
    const locationsData = await fs.readFile(path.join(this.dataDir, 'storage_locations.json'), 'utf8');
    const locations = JSON.parse(locationsData);
    const locationMap = new Map(locations.map(l => [l.location_code, l.id]));
    
    const inventory = [];
    const inventoryFile = path.join(this.datasetsDir, 'Class_Based_Storage.csv');
    
    return new Promise((resolve, reject) => {
      const stream = require('fs').createReadStream(inventoryFile)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.Location && locationMap.has(row.Location)) {
            const locationId = locationMap.get(row.Location);
            
            // Process columns 1 to 18
            for (let i = 1; i <= 18; i++) {
              const colName = i.toString();
              const cellValue = row[colName];
              
              if (cellValue && cellValue.includes(';')) {
                const [productCode, quantityStr] = cellValue.split(';');
                const quantity = parseInt(quantityStr) || 0;
                
                if (quantity > 0 && productMap.has(productCode)) {
                  const productId = productMap.get(productCode);
                  
                  inventory.push({
                    id: this.generateId(),
                    product_id: productId,
                    location_id: locationId,
                    quantity: quantity,
                    reserved_quantity: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                }
              }
            }
          }
        })
        .on('end', async () => {
          await this.writeCollection('inventory', inventory);
          resolve();
        })
        .on('error', reject);
    });
  }

  async populateOrders() {
    console.log('🛒 Populating orders...');
    
    // Read products first
    const productsData = await fs.readFile(path.join(this.dataDir, 'products.json'), 'utf8');
    const products = JSON.parse(productsData);
    const productMap = new Map(products.map(p => [p.reference, p.id]));
    
    const orders = [];
    const orderItems = [];
    const orderMap = new Map();
    
    const orderFile = path.join(this.datasetsDir, 'Customer_Order.csv');
    
    return new Promise((resolve, reject) => {
      const stream = require('fs').createReadStream(orderFile)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.orderNumber && row.orderNumber !== 'orderNumber') {
            const orderNumber = parseInt(row.orderNumber);
            
            // Create order if not exists
            if (!orderMap.has(orderNumber)) {
              const orderId = this.generateId();
              
              orders.push({
                id: orderId,
                customer_code: row.codCustomer || 'CUSTOMER_001',
                order_number: orderNumber.toString(),
                status: 'pending',
                priority: 'normal',
                total_items: 0, // Will be calculated later
                created_at: row.creationDate || new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
              orderMap.set(orderNumber, orderId);
            }
            
            // Add order item
            const orderId = orderMap.get(orderNumber);
            const productId = productMap.get(row.Reference);
            
            if (orderId && productId) {
              orderItems.push({
                id: this.generateId(),
                order_id: orderId,
                product_id: productId,
                quantity: parseInt(row['quantity (units)']) || 1,
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        })
        .on('end', async () => {
          // Update order total_items
          const itemCounts = new Map();
          orderItems.forEach(item => {
            const count = itemCounts.get(item.order_id) || 0;
            itemCounts.set(item.order_id, count + item.quantity);
          });
          
          orders.forEach(order => {
            order.total_items = itemCounts.get(order.id) || 0;
          });
          
          await this.writeCollection('orders', orders);
          await this.writeCollection('order_items', orderItems);
          resolve();
        })
        .on('error', reject);
    });
  }

  async populatePickingWaves() {
    console.log('🌊 Populating picking waves...');
    
    const waves = [];
    const tasks = [];
    const waveMap = new Map();
    
    // Read orders and locations
    const ordersData = await fs.readFile(path.join(this.dataDir, 'orders.json'), 'utf8');
    const orders = JSON.parse(ordersData);
    const orderMap = new Map(orders.map(o => [parseInt(o.order_number), o.id]));
    
    const locationsData = await fs.readFile(path.join(this.dataDir, 'storage_locations.json'), 'utf8');
    const locations = JSON.parse(locationsData);
    const locationMap = new Map(locations.map(l => [l.location_code, l.id]));
    
    const productsData = await fs.readFile(path.join(this.dataDir, 'products.json'), 'utf8');
    const products = JSON.parse(productsData);
    const productMap = new Map(products.map(p => [p.reference, p.id]));
    
    const waveFile = path.join(this.datasetsDir, 'Picking_Wave.csv');
    
    return new Promise((resolve, reject) => {
      const stream = require('fs').createReadStream(waveFile)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.waveNumber && row.waveNumber !== 'waveNumber') {
            const waveNumber = parseInt(row.waveNumber);
            
            // Create wave if not exists
            if (!waveMap.has(waveNumber)) {
              const waveId = this.generateId();
              
              waves.push({
                id: waveId,
                wave_number: waveNumber.toString(),
                status: 'completed',
                total_items: 0, // Will be calculated later
                assigned_operator_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
              waveMap.set(waveNumber, waveId);
            }
            
            // Create picking task
            const waveId = waveMap.get(waveNumber);
            const productId = productMap.get(row.reference);
            const locationId = locationMap.get(row.locations?.trim());
            
            if (waveId && productId && locationId) {
              tasks.push({
                id: this.generateId(),
                wave_id: waveId,
                product_id: productId,
                location_id: locationId,
                quantity_to_pick: parseInt(row['quantityToPick (units)']) || 1,
                quantity_picked: parseInt(row['quantityToPick (units)']) || 1,
                status: 'completed',
                picking_time_seconds: Math.floor(Math.random() * 120) + 30,
                completed_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        })
        .on('end', async () => {
          // Update wave total_items
          const taskCounts = new Map();
          tasks.forEach(task => {
            const count = taskCounts.get(task.wave_id) || 0;
            taskCounts.set(task.wave_id, count + task.quantity_to_pick);
          });
          
          waves.forEach(wave => {
            wave.total_items = taskCounts.get(wave.id) || 0;
          });
          
          await this.writeCollection('picking_waves', waves);
          await this.writeCollection('picking_tasks', tasks);
          resolve();
        })
        .on('error', reject);
    });
  }
}

// Run if called directly
if (require.main === module) {
  const populator = new LocalDBPopulator();
  populator.populateAll()
    .then(() => {
      console.log('\n🎉 Local database population completed successfully!');
      console.log('\n📊 Summary:');
      console.log('   - Products: Loaded from Product.csv');
      console.log('   - Storage Locations: Loaded from Storage_Location.csv');
      console.log('   - Inventory: Loaded from Class_Based_Storage.csv');
      console.log('   - Orders: Loaded from Customer_Order.csv');
      console.log('   - Picking Waves: Loaded from Picking_Wave.csv');
      console.log('\n🔐 Login with: admin / admin123');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Population failed:', error);
      process.exit(1);
    });
}

module.exports = LocalDBPopulator;