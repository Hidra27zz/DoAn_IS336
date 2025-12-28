// Import all data to SQL database - Much faster than Firebase
const InventoryDataLoader = require('../services/inventory-data-loader');
const { getDatabase } = require('../config/database');

class SQLImporter {
  constructor() {
    this.loader = new InventoryDataLoader();
    this.db = null;
  }

  async importAllData() {
    console.log('🚀 Starting data import to SQL database...\n');
    console.log('📊 This should be much faster than Firebase!\n');
    
    try {
      // Initialize database
      console.log('1. Initializing SQL database...');
      this.db = await getDatabase();
      
      // Load real data from CSV
      console.log('\n2. Loading real data from CSV files...');
      await this.loader.loadRealInventoryData();
      
      // Clear existing data
      console.log('\n3. Clearing existing data...');
      await this.clearExistingData();
      
      // Import products
      console.log('\n4. Importing products...');
      await this.importProducts();
      
      // Import storage locations
      console.log('\n5. Importing storage locations...');
      await this.importStorageLocations();
      
      // Import inventory
      console.log('\n6. Importing inventory...');
      await this.importInventory();
      
      // Import orders
      console.log('\n7. Importing orders...');
      await this.importOrders();
      
      // Import picking waves
      console.log('\n8. Importing picking waves...');
      await this.importPickingWaves();
      
      // Create sample users
      console.log('\n9. Creating sample users...');
      await this.createSampleUsers();
      
      console.log('\n✅ SQL database import completed successfully!');
      
    } catch (error) {
      console.error('❌ SQL import failed:', error);
      throw error;
    }
  }

  async clearExistingData() {
    try {
      const tables = ['inventory', 'order_items', 'orders', 'products', 'storage_locations', 'users', 'system_logs'];
      
      for (const table of tables) {
        await this.db.run(`DELETE FROM ${table}`);
        console.log(`   Cleared ${table} table`);
      }
      
      console.log('   ✅ All existing data cleared');
    } catch (error) {
      console.error('   Error clearing data:', error);
    }
  }

  async importProducts() {
    try {
      const products = this.loader.getProducts();
      console.log(`   Importing ${products.length} products...`);
      
      const productData = products.map(product => ({
        reference: product.reference,
        abc_code: product.abc_code,
        sector: product.sector,
        description: product.description,
        unit_price: product.unit_price
      }));
      
      await this.db.bulkInsert('products', productData);
      console.log(`   ✅ Successfully imported ${products.length} products`);
      
    } catch (error) {
      console.error('   ❌ Product import failed:', error);
      throw error;
    }
  }

  async importStorageLocations() {
    try {
      const locations = this.loader.getLocations();
      console.log(`   Importing ${locations.length} storage locations...`);
      
      const locationData = locations.map(location => ({
        location_code: location.location_code,
        x: location.x,
        y: location.y,
        z: location.z,
        zone: location.zone,
        capacity: location.capacity,
        current_occupancy: location.current_occupancy,
        status: 'active'
      }));
      
      await this.db.bulkInsert('storage_locations', locationData);
      console.log(`   ✅ Successfully imported ${locations.length} storage locations`);
      
    } catch (error) {
      console.error('   ❌ Storage location import failed:', error);
      throw error;
    }
  }

  async importInventory() {
    try {
      const inventory = this.loader.getInventory();
      console.log(`   Importing ${inventory.length} inventory records...`);
      
      // Prepare inventory data using direct references instead of IDs
      const inventoryData = inventory.map(inv => ({
        product_reference: inv.product_reference,
        location_code: inv.location_code,
        quantity: inv.quantity,
        reserved_quantity: inv.reserved_quantity,
        slot_position: inv.slot_position
      }));
      
      // Bulk insert inventory - this should be very fast with SQL
      await this.db.bulkInsert('inventory', inventoryData, 5000); // Larger batch size for SQL
      
      console.log(`   ✅ Successfully imported ${inventoryData.length} inventory records`);
      
    } catch (error) {
      console.error('   ❌ Inventory import failed:', error);
      throw error;
    }
  }

  async importOrders() {
    try {
      const fs = require('fs');
      const csv = require('csv-parser');
      const path = require('path');
      
      console.log('   Loading Customer_Order.csv...');
      const orderCsvPath = path.join(__dirname, '../datasets/Customer_Order.csv');
      
      const orders = [];
      const orderItems = [];
      const orderMap = new Map();
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(orderCsvPath)
          .pipe(csv({ separator: ';' }))
          .on('data', (row) => {
            const orderNumber = row.orderNumber?.trim();
            const customerCode = row.codCustomer?.trim();
            const productReference = row.Reference?.trim();
            const quantity = parseInt(row['quantity (units)']) || 0;
            const creationDate = row.creationDate?.trim();
            const waveNumber = row.waveNumber?.trim();
            const operator = row.operator?.trim();
            
            if (!orderNumber || !productReference) return;
            
            // Create order if not exists
            if (!orderMap.has(orderNumber)) {
              const order = {
                order_number: orderNumber,
                customer_name: customerCode || `Customer_${orderNumber}`,
                status: 'pending',
                priority: 1,
                wave_number: waveNumber,
                operator: operator,
                creation_date: creationDate
              };
              orders.push(order);
              orderMap.set(orderNumber, orders.length - 1);
            }
            
            // Add order item
            orderItems.push({
              order_number: orderNumber,
              product_reference: productReference,
              quantity: quantity,
              picked_quantity: 0,
              size: row['Size (US)']?.trim() || '',
              order_to_collect: row.orderToCollect?.trim() || ''
            });
          })
          .on('end', async () => {
            try {
              console.log(`   Found ${orders.length} unique orders with ${orderItems.length} items`);
              
              // Import orders
              if (orders.length > 0) {
                await this.db.bulkInsert('orders', orders);
                console.log(`   ✅ Imported ${orders.length} orders`);
              }
              
              // Get order IDs and create order items with proper foreign keys
              if (orderItems.length > 0) {
                const dbOrders = await this.db.all('SELECT id, order_number FROM orders');
                const orderIdMap = new Map();
                dbOrders.forEach(order => {
                  orderIdMap.set(order.order_number, order.id);
                });
                
                const orderItemsWithIds = orderItems
                  .filter(item => orderIdMap.has(item.order_number))
                  .map(item => ({
                    order_id: orderIdMap.get(item.order_number),
                    product_reference: item.product_reference,
                    quantity: item.quantity,
                    picked_quantity: item.picked_quantity,
                    size: item.size,
                    order_to_collect: item.order_to_collect
                  }));
                
                // Update order_items table schema to include new fields
                await this.db.run(`
                  CREATE TABLE IF NOT EXISTS order_items_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER,
                    product_reference TEXT,
                    quantity INTEGER,
                    picked_quantity INTEGER DEFAULT 0,
                    size TEXT,
                    order_to_collect TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (order_id) REFERENCES orders (id),
                    FOREIGN KEY (product_reference) REFERENCES products (reference)
                  )
                `);
                
                await this.db.run('DROP TABLE IF EXISTS order_items');
                await this.db.run('ALTER TABLE order_items_new RENAME TO order_items');
                
                await this.db.bulkInsert('order_items', orderItemsWithIds);
                console.log(`   ✅ Imported ${orderItemsWithIds.length} order items`);
              }
              
              resolve();
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });
      
    } catch (error) {
      console.error('   ❌ Order import failed:', error);
      throw error;
    }
  }

  async importPickingWaves() {
    try {
      const fs = require('fs');
      const csv = require('csv-parser');
      const path = require('path');
      
      console.log('   Loading Picking_Wave.csv...');
      const waveCsvPath = path.join(__dirname, '../datasets/Picking_Wave.csv');
      
      const pickingTasks = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(waveCsvPath)
          .pipe(csv({ separator: ';' }))
          .on('data', (row) => {
            const waveNumber = row.waveNumber?.trim();
            const productReference = row.reference?.trim();
            const locationCode = row.locations?.trim();
            const quantity = parseInt(row['quantityToPick (units)']) || 0;
            const operator = row.operator?.trim();
            const size = row['Size (US)']?.trim();
            
            if (!waveNumber || !productReference || !locationCode) return;
            
            pickingTasks.push({
              wave_number: waveNumber,
              product_reference: productReference,
              location_code: locationCode,
              quantity_to_pick: quantity,
              quantity_picked: 0,
              operator: operator,
              size: size,
              status: 'pending'
            });
          })
          .on('end', async () => {
            try {
              console.log(`   Found ${pickingTasks.length} picking tasks`);
              
              if (pickingTasks.length > 0) {
                // Create picking_tasks table
                await this.db.run(`
                  CREATE TABLE IF NOT EXISTS picking_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wave_number TEXT,
                    product_reference TEXT,
                    location_code TEXT,
                    quantity_to_pick INTEGER,
                    quantity_picked INTEGER DEFAULT 0,
                    operator TEXT,
                    size TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_reference) REFERENCES products (reference),
                    FOREIGN KEY (location_code) REFERENCES storage_locations (location_code)
                  )
                `);
                
                await this.db.bulkInsert('picking_tasks', pickingTasks);
                console.log(`   ✅ Imported ${pickingTasks.length} picking tasks`);
              }
              
              resolve();
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });
      
    } catch (error) {
      console.error('   ❌ Picking wave import failed:', error);
      throw error;
    }
  }

  async createSampleUsers() {
    try {
      const users = [
        {
          username: 'admin',
          email: 'admin@warehouse.com',
          password_hash: 'hashed_password_admin',
          role: 'admin'
        },
        {
          username: 'manager',
          email: 'manager@warehouse.com',
          password_hash: 'hashed_password_manager',
          role: 'manager'
        },
        {
          username: 'operator1',
          email: 'operator1@warehouse.com',
          password_hash: 'hashed_password_operator1',
          role: 'operator'
        },
        {
          username: 'operator2',
          email: 'operator2@warehouse.com',
          password_hash: 'hashed_password_operator2',
          role: 'operator'
        }
      ];
      
      await this.db.bulkInsert('users', users);
      console.log(`   ✅ Created ${users.length} sample users`);
      
    } catch (error) {
      console.error('   ❌ User creation failed:', error);
    }
  }

  async verifyImport() {
    try {
      console.log('\n10. Verifying import...');
      
      const productCount = await this.db.count('products');
      const locationCount = await this.db.count('storage_locations');
      const inventoryCount = await this.db.count('inventory');
      const orderCount = await this.db.count('orders');
      const orderItemCount = await this.db.count('order_items');
      const pickingTaskCount = await this.db.count('picking_tasks');
      const userCount = await this.db.count('users');
      
      console.log(`   Products in database: ${productCount}`);
      console.log(`   Locations in database: ${locationCount}`);
      console.log(`   Inventory in database: ${inventoryCount}`);
      console.log(`   Orders in database: ${orderCount}`);
      console.log(`   Order items in database: ${orderItemCount}`);
      console.log(`   Picking tasks in database: ${pickingTaskCount}`);
      console.log(`   Users in database: ${userCount}`);
      
      // Show sample data
      console.log('\n   Sample inventory records:');
      const sampleInventory = await this.db.all(`
        SELECT 
          i.product_reference,
          i.location_code,
          i.quantity,
          i.reserved_quantity
        FROM inventory i
        LIMIT 5
      `);
      
      sampleInventory.forEach(inv => {
        console.log(`     ${inv.product_reference} at ${inv.location_code}: ${inv.quantity} units (${inv.reserved_quantity} reserved)`);
      });
      
      // Show sample orders
      console.log('\n   Sample orders:');
      const sampleOrders = await this.db.all(`
        SELECT 
          order_number,
          customer_name,
          status,
          wave_number,
          operator
        FROM orders
        LIMIT 5
      `);
      
      sampleOrders.forEach(order => {
        console.log(`     Order ${order.order_number} - ${order.customer_name} (${order.status}) - Wave: ${order.wave_number}`);
      });
      
      // Show sample picking tasks
      console.log('\n   Sample picking tasks:');
      const sampleTasks = await this.db.all(`
        SELECT 
          wave_number,
          product_reference,
          location_code,
          quantity_to_pick,
          operator,
          status
        FROM picking_tasks
        LIMIT 5
      `);
      
      sampleTasks.forEach(task => {
        console.log(`     Wave ${task.wave_number}: Pick ${task.quantity_to_pick} of ${task.product_reference} from ${task.location_code} (${task.operator})`);
      });
      
      // Show inventory by zone
      console.log('\n   Inventory by zone:');
      const inventoryByZone = await this.db.all(`
        SELECT 
          sl.zone,
          COUNT(*) as item_count,
          SUM(i.quantity) as total_quantity
        FROM inventory i
        JOIN storage_locations sl ON i.location_code = sl.location_code
        GROUP BY sl.zone
        ORDER BY sl.zone
      `);
      
      inventoryByZone.forEach(zone => {
        console.log(`     Zone ${zone.zone}: ${zone.item_count} items, ${zone.total_quantity} units`);
      });
      
      // Show inventory by ABC code
      console.log('\n   Inventory by ABC code:');
      const inventoryByABC = await this.db.all(`
        SELECT 
          p.abc_code,
          COUNT(*) as item_count,
          SUM(i.quantity) as total_quantity
        FROM inventory i
        JOIN products p ON i.product_reference = p.reference
        GROUP BY p.abc_code
        ORDER BY p.abc_code
      `);
      
      inventoryByABC.forEach(abc => {
        console.log(`     ABC ${abc.abc_code}: ${abc.item_count} items, ${abc.total_quantity} units`);
      });
      
      console.log('\n   ✅ Import verification completed');
      
    } catch (error) {
      console.log(`   Verification failed: ${error.message}`);
    }
  }
}

// Run import if called directly
if (require.main === module) {
  const importer = new SQLImporter();
  
  console.log('🚀 This will import all data to SQL database.');
  console.log('🚀 Should be much faster than Firebase!');
  console.log('🚀 Press Ctrl+C within 3 seconds to cancel...\n');
  
  setTimeout(async () => {
    try {
      const startTime = Date.now();
      
      await importer.importAllData();
      await importer.verifyImport();
      
      const totalTime = (Date.now() - startTime) / 1000;
      
      console.log('\n🎉 SQL database import completed successfully!');
      console.log(`⚡ Total time: ${totalTime.toFixed(1)} seconds`);
      console.log('Database file: warehouse.db');
      process.exit(0);
      
    } catch (error) {
      console.error('\n💥 SQL import failed:', error);
      process.exit(1);
    }
  }, 3000);
}

module.exports = SQLImporter;