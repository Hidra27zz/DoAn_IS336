// Import ALL data to SQL database - Complete version
const InventoryDataLoader = require('../services/inventory-data-loader');
const { getDatabase } = require('../config/database');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

class CompleteDataImporter {
  constructor() {
    this.loader = new InventoryDataLoader();
    this.db = null;
  }

  async importAllData() {
    console.log('🚀 Starting COMPLETE data import to SQL database...\n');
    console.log('📊 This will import ALL CSV files and data!\n');
    
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
      
      // Import basic data
      console.log('\n4. Importing products...');
      await this.importProducts();
      
      console.log('\n5. Importing storage locations...');
      await this.importStorageLocations();
      
      console.log('\n6. Importing inventory (Class-Based)...');
      await this.importInventory();
      
      console.log('\n7. Importing orders...');
      await this.importOrders();
      
      console.log('\n8. Importing picking waves...');
      await this.importPickingWaves();
      
      // Import additional storage strategies
      console.log('\n9. Importing Dedicated Storage data...');
      await this.importDedicatedStorage();
      
      console.log('\n10. Importing Hybrid Storage data...');
      await this.importHybridStorage();
      
      console.log('\n11. Importing Random Storage data...');
      await this.importRandomStorage();
      
      console.log('\n12. Importing Navigation Support Points...');
      await this.importNavigationPoints();
      
      // Create sample users
      console.log('\n13. Creating sample users...');
      await this.createSampleUsers();
      
      console.log('\n✅ COMPLETE SQL database import finished successfully!');
      
    } catch (error) {
      console.error('❌ Complete import failed:', error);
      throw error;
    }
  }

  async clearExistingData() {
    try {
      const tables = [
        'navigation_points',
        'storage_strategies', 
        'picking_tasks',
        'order_items', 
        'orders', 
        'inventory', 
        'products', 
        'storage_locations', 
        'users', 
        'system_logs'
      ];
      
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
      
      const inventoryData = inventory.map(inv => ({
        product_reference: inv.product_reference,
        location_code: inv.location_code,
        quantity: inv.quantity,
        reserved_quantity: inv.reserved_quantity,
        slot_position: inv.slot_position
      }));
      
      await this.db.bulkInsert('inventory', inventoryData, 5000);
      console.log(`   ✅ Successfully imported ${inventoryData.length} inventory records`);
      
    } catch (error) {
      console.error('   ❌ Inventory import failed:', error);
      throw error;
    }
  }

  async importOrders() {
    try {
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
              
              if (orders.length > 0) {
                await this.db.bulkInsert('orders', orders);
                console.log(`   ✅ Imported ${orders.length} orders`);
              }
              
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
            const quantity = parseFloat(row['quantityToPick (units)']) || 0;
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

  async importDedicatedStorage() {
    try {
      await this.importStorageStrategy('Dedicated_Storage.csv', 'dedicated');
    } catch (error) {
      console.error('   ❌ Dedicated storage import failed:', error);
      throw error;
    }
  }

  async importHybridStorage() {
    try {
      await this.importStorageStrategy('Hybrid_Storage.csv', 'hybrid');
    } catch (error) {
      console.error('   ❌ Hybrid storage import failed:', error);
      throw error;
    }
  }

  async importRandomStorage() {
    try {
      await this.importStorageStrategy('Random_Storage.csv', 'random');
    } catch (error) {
      console.error('   ❌ Random storage import failed:', error);
      throw error;
    }
  }

  async importStorageStrategy(filename, strategyType) {
    console.log(`   Loading ${filename}...`);
    const csvPath = path.join(__dirname, '../datasets', filename);
    
    const storageData = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv({ separator: strategyType === 'random' ? ',' : ';' }))
        .on('data', (row) => {
          const locationCode = strategyType === 'random' ? 
            row.originalLocation?.trim() : 
            row.Location?.trim();
          
          if (!locationCode) return;
          
          // Parse products in this location
          const products = [];
          const keys = Object.keys(row);
          
          for (const key of keys) {
            if (key !== 'Location' && key !== 'XYZCOD' && key !== 'originalLocation' && row[key]) {
              const value = row[key].trim();
              if (value && value.includes(';')) {
                const [productRef, quantity] = value.split(';');
                if (productRef && quantity) {
                  products.push({
                    product_reference: productRef.trim(),
                    quantity: parseFloat(quantity) || 0
                  });
                }
              }
            }
          }
          
          if (products.length > 0) {
            storageData.push({
              location_code: locationCode,
              strategy_type: strategyType,
              products: JSON.stringify(products),
              product_count: products.length,
              total_quantity: products.reduce((sum, p) => sum + p.quantity, 0)
            });
          }
        })
        .on('end', async () => {
          try {
            console.log(`   Found ${storageData.length} ${strategyType} storage records`);
            
            if (storageData.length > 0) {
              // Create storage_strategies table if not exists
              await this.db.run(`
                CREATE TABLE IF NOT EXISTS storage_strategies (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  location_code TEXT,
                  strategy_type TEXT,
                  products TEXT,
                  product_count INTEGER,
                  total_quantity REAL,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (location_code) REFERENCES storage_locations (location_code)
                )
              `);
              
              await this.db.bulkInsert('storage_strategies', storageData);
              console.log(`   ✅ Imported ${storageData.length} ${strategyType} storage records`);
            }
            
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async importNavigationPoints() {
    try {
      console.log('   Loading Support_Points_Navigation.csv...');
      const navCsvPath = path.join(__dirname, '../datasets/Support_Points_Navigation.csv');
      
      const navigationPoints = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(navCsvPath)
          .pipe(csv({ separator: ';' }))
          .on('data', (row) => {
            const pointsStr = row.points_specified?.trim();
            const label = row.labels?.trim();
            
            if (!pointsStr || !label) return;
            
            // Parse coordinates (66.0, -29.0, 1.0)
            const coordMatch = pointsStr.match(/\(([^)]+)\)/);
            if (coordMatch) {
              const coords = coordMatch[1].split(',').map(c => parseFloat(c.trim()));
              if (coords.length === 3) {
                navigationPoints.push({
                  label: label,
                  x: coords[0],
                  y: coords[1],
                  z: coords[2],
                  point_type: 'support',
                  coordinates: pointsStr
                });
              }
            }
          })
          .on('end', async () => {
            try {
              console.log(`   Found ${navigationPoints.length} navigation points`);
              
              if (navigationPoints.length > 0) {
                // Create navigation_points table
                await this.db.run(`
                  CREATE TABLE IF NOT EXISTS navigation_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    label TEXT UNIQUE,
                    x REAL,
                    y REAL,
                    z REAL,
                    point_type TEXT,
                    coordinates TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                  )
                `);
                
                await this.db.bulkInsert('navigation_points', navigationPoints);
                console.log(`   ✅ Imported ${navigationPoints.length} navigation points`);
              }
              
              resolve();
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });
      
    } catch (error) {
      console.error('   ❌ Navigation points import failed:', error);
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

  async verifyCompleteImport() {
    try {
      console.log('\n14. Verifying COMPLETE import...');
      
      const productCount = await this.db.count('products');
      const locationCount = await this.db.count('storage_locations');
      const inventoryCount = await this.db.count('inventory');
      const orderCount = await this.db.count('orders');
      const orderItemCount = await this.db.count('order_items');
      const pickingTaskCount = await this.db.count('picking_tasks');
      const storageStrategyCount = await this.db.count('storage_strategies');
      const navigationPointCount = await this.db.count('navigation_points');
      const userCount = await this.db.count('users');
      
      console.log(`   Products: ${productCount}`);
      console.log(`   Storage Locations: ${locationCount}`);
      console.log(`   Inventory Records: ${inventoryCount}`);
      console.log(`   Orders: ${orderCount}`);
      console.log(`   Order Items: ${orderItemCount}`);
      console.log(`   Picking Tasks: ${pickingTaskCount}`);
      console.log(`   Storage Strategies: ${storageStrategyCount}`);
      console.log(`   Navigation Points: ${navigationPointCount}`);
      console.log(`   Users: ${userCount}`);
      
      // Show storage strategies breakdown
      console.log('\n   Storage strategies by type:');
      const strategyBreakdown = await this.db.all(`
        SELECT 
          strategy_type,
          COUNT(*) as count,
          SUM(total_quantity) as total_qty
        FROM storage_strategies
        GROUP BY strategy_type
      `);
      
      strategyBreakdown.forEach(strategy => {
        console.log(`     ${strategy.strategy_type}: ${strategy.count} locations, ${strategy.total_qty} units`);
      });
      
      // Show sample navigation points
      console.log('\n   Sample navigation points:');
      const sampleNav = await this.db.all('SELECT label, x, y, z FROM navigation_points LIMIT 5');
      sampleNav.forEach(nav => {
        console.log(`     ${nav.label}: (${nav.x}, ${nav.y}, ${nav.z})`);
      });
      
      console.log('\n   ✅ COMPLETE import verification finished');
      
    } catch (error) {
      console.log(`   Verification failed: ${error.message}`);
    }
  }
}

// Run import if called directly
if (require.main === module) {
  const importer = new CompleteDataImporter();
  
  console.log('🚀 This will import ALL data from ALL CSV files to SQL database.');
  console.log('🚀 Including: Products, Locations, Inventory, Orders, Picking Waves,');
  console.log('🚀 Storage Strategies (Dedicated, Hybrid, Random), Navigation Points!');
  console.log('🚀 Press Ctrl+C within 3 seconds to cancel...\n');
  
  setTimeout(async () => {
    try {
      const startTime = Date.now();
      
      await importer.importAllData();
      await importer.verifyCompleteImport();
      
      const totalTime = (Date.now() - startTime) / 1000;
      
      console.log('\n🎉 COMPLETE SQL database import finished successfully!');
      console.log(`⚡ Total time: ${totalTime.toFixed(1)} seconds`);
      console.log('📊 Database now contains ALL data from ALL CSV files!');
      console.log('Database file: warehouse.db');
      process.exit(0);
      
    } catch (error) {
      console.error('\n💥 Complete import failed:', error);
      process.exit(1);
    }
  }, 3000);
}

module.exports = CompleteDataImporter;