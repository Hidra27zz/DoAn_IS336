const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');

class DataSeeder {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'Order Picking Dataset from a Warehouse of a Footwear Manufacturing Company');
    this.products = new Map();
    this.locations = new Map();
    this.operators = new Map();
  }

  async seedAll() {
    try {
      console.log('🌱 Starting data seeding process...');
      
      await db.initialize();
      
      // Seed in order of dependencies
      await this.seedUsers();
      await this.seedProducts();
      await this.seedStorageLocations();
      await this.seedInventory();
      await this.seedCustomerOrders();
      await this.seedPickingWaves();
      
      console.log('✅ Data seeding completed successfully!');
      
      // Print summary
      await this.printSummary();
      
    } catch (error) {
      console.error('❌ Data seeding failed:', error);
      throw error;
    }
  }

  async seedUsers() {
    console.log('👥 Seeding users...');
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    await db.run(`
      INSERT OR IGNORE INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, ['admin', 'admin@warehouse.com', adminPassword, 'admin']);

    // Create manager user
    const managerPassword = await bcrypt.hash('manager123', 12);
    await db.run(`
      INSERT OR IGNORE INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, ['manager', 'manager@warehouse.com', managerPassword, 'manager']);

    // Create operators from Customer_Order.csv
    const operators = new Set();
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(path.join(this.dataPath, 'Customer_Order.csv'))
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.operator && row.operator !== 'operator') {
            operators.add(row.operator);
          }
        })
        .on('end', async () => {
          try {
            let operatorId = 3; // Start after admin and manager
            
            for (const operatorName of operators) {
              const password = await bcrypt.hash('operator123', 12);
              const email = `${operatorName.toLowerCase()}@warehouse.com`;
              
              const result = await db.run(`
                INSERT OR IGNORE INTO users (username, email, password_hash, role)
                VALUES (?, ?, ?, ?)
              `, [operatorName, email, password, 'operator']);

              if (result.changes > 0) {
                this.operators.set(operatorName, operatorId++);
              } else {
                // Get existing ID
                const existing = await db.get('SELECT id FROM users WHERE username = ?', [operatorName]);
                this.operators.set(operatorName, existing.id);
              }
            }
            
            console.log(`   ✅ Created ${operators.size} operators`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async seedProducts() {
    console.log('Seeding products...');
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(path.join(this.dataPath, 'Product.csv'))
        .pipe(csv({ separator: ';' }))
        .on('data', async (row) => {
          if (row.Reference && row.Reference !== 'Reference') {
            try {
              const result = await db.run(`
                INSERT OR IGNORE INTO products (reference, abc_code, sector, description, unit_price)
                VALUES (?, ?, ?, ?, ?)
              `, [
                row.Reference,
                row.ABCCOD || 'C',
                row.Sector || 'PF',
                `Footwear Product ${row.Reference}`,
                Math.floor(Math.random() * 200) + 50 // Random price between 50-250
              ]);

              if (result.changes > 0) {
                this.products.set(row.Reference, result.id);
              } else {
                // Get existing ID
                const existing = await db.get('SELECT id FROM products WHERE reference = ?', [row.Reference]);
                this.products.set(row.Reference, existing.id);
              }
            } catch (error) {
              console.error('Error inserting product:', error);
            }
          }
        })
        .on('end', () => {
          console.log(`   ✅ Created ${this.products.size} products`);
          resolve();
        })
        .on('error', reject);
    });
  }

  async seedStorageLocations() {
    console.log('Seeding storage locations...');
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(path.join(this.dataPath, 'Storage_Location.csv'))
        .pipe(csv())
        .on('data', async (row) => {
          if (row.originalLocation && row.originalLocation !== 'originalLocation') {
            try {
              // Extract zone from location code (e.g., A-14-11 -> A)
              const zone = row.originalLocation.split('-')[0] || 'A';
              
              const result = await db.run(`
                INSERT OR IGNORE INTO storage_locations 
                (location_code, x_coordinate, y_coordinate, z_coordinate, zone, capacity, current_occupancy)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `, [
                row.originalLocation,
                parseInt(row.x) || 0,
                parseInt(row.y) || 0,
                parseInt(row.z) || 0,
                zone,
                100, // Default capacity
                Math.floor(Math.random() * 80) // Random occupancy 0-80
              ]);

              if (result.changes > 0) {
                this.locations.set(row.originalLocation, result.id);
              } else {
                // Get existing ID
                const existing = await db.get('SELECT id FROM storage_locations WHERE location_code = ?', [row.originalLocation]);
                this.locations.set(row.originalLocation, existing.id);
              }
            } catch (error) {
              console.error('Error inserting location:', error);
            }
          }
        })
        .on('end', () => {
          console.log(`   ✅ Created ${this.locations.size} storage locations`);
          resolve();
        })
        .on('error', reject);
    });
  }

  async seedInventory() {
    console.log('Seeding inventory from storage strategies...');
    
    // Use Class_Based_Storage.csv as primary inventory source
    return new Promise((resolve, reject) => {
      let inventoryCount = 0;
      
      fs.createReadStream(path.join(this.dataPath, 'Class_Based_Storage.csv'))
        .pipe(csv())
        .on('data', async (row) => {
          if (row.Location && this.locations.has(row.Location)) {
            const locationId = this.locations.get(row.Location);
            
            // Process columns col_1 to col_18
            for (let i = 1; i <= 18; i++) {
              const colName = `col_${i}`;
              const cellValue = row[colName];
              
              if (cellValue && cellValue.includes(';')) {
                const [productCode, quantityStr] = cellValue.split(';');
                const quantity = parseInt(quantityStr) || 0;
                
                if (quantity > 0 && this.products.has(productCode)) {
                  const productId = this.products.get(productCode);
                  
                  try {
                    await db.run(`
                      INSERT OR IGNORE INTO inventory (product_id, location_id, quantity, reserved_quantity)
                      VALUES (?, ?, ?, ?)
                    `, [productId, locationId, quantity, 0]);
                    
                    inventoryCount++;
                  } catch (error) {
                    console.error('Error inserting inventory:', error);
                  }
                }
              }
            }
          }
        })
        .on('end', () => {
          console.log(`   ✅ Created ${inventoryCount} inventory records`);
          resolve();
        })
        .on('error', reject);
    });
  }

  async seedCustomerOrders() {
    console.log('🛒 Seeding customer orders...');
    
    const orders = new Map();
    let orderCount = 0;
    let itemCount = 0;
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(path.join(this.dataPath, 'Customer_Order.csv'))
        .pipe(csv({ separator: ';' }))
        .on('data', async (row) => {
          if (row.orderNumber && row.orderNumber !== 'orderNumber') {
            const orderNumber = parseInt(row.orderNumber);
            const operatorId = this.operators.get(row.operator) || null;
            
            try {
              // Create order if not exists
              if (!orders.has(orderNumber)) {
                const result = await db.run(`
                  INSERT OR IGNORE INTO customer_orders 
                  (customer_code, order_number, order_to_collect, status, priority, creation_date, wave_number, assigned_operator_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  row.codCustomer || 'CUSTOMER_001',
                  orderNumber,
                  parseInt(row.orderToCollect) || 1,
                  'pending',
                  'normal',
                  row.creationDate || new Date().toISOString(),
                  parseInt(row.waveNumber) || null,
                  operatorId
                ]);

                if (result.changes > 0) {
                  orders.set(orderNumber, result.id);
                  orderCount++;
                } else {
                  // Get existing ID
                  const existing = await db.get('SELECT id FROM customer_orders WHERE order_number = ?', [orderNumber]);
                  orders.set(orderNumber, existing.id);
                }
              }

              // Add order item
              const orderId = orders.get(orderNumber);
              const productId = this.products.get(row.Reference);
              
              if (orderId && productId) {
                await db.run(`
                  INSERT OR IGNORE INTO order_items (order_id, product_id, size_us, quantity, status)
                  VALUES (?, ?, ?, ?, ?)
                `, [
                  orderId,
                  productId,
                  parseFloat(row['Size (US)']) || null,
                  parseInt(row['quantity (units)']) || 1,
                  'pending'
                ]);
                
                itemCount++;
              }
            } catch (error) {
              console.error('Error inserting order:', error);
            }
          }
        })
        .on('end', () => {
          console.log(`   ✅ Created ${orderCount} orders with ${itemCount} items`);
          resolve();
        })
        .on('error', reject);
    });
  }

  async seedPickingWaves() {
    console.log('🌊 Seeding picking waves...');
    
    const waves = new Map();
    let waveCount = 0;
    let taskCount = 0;
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(path.join(this.dataPath, 'Picking_Wave.csv'))
        .pipe(csv({ separator: ';' }))
        .on('data', async (row) => {
          if (row.waveNumber && row.waveNumber !== 'waveNumber') {
            const waveNumber = parseInt(row.waveNumber);
            const operatorId = this.operators.get(row.operator) || null;
            
            try {
              // Create wave if not exists
              if (!waves.has(waveNumber)) {
                const result = await db.run(`
                  INSERT OR IGNORE INTO picking_waves 
                  (wave_number, status, assigned_operator_id, total_items)
                  VALUES (?, ?, ?, ?)
                `, [
                  waveNumber,
                  'completed', // Mark as completed since this is historical data
                  operatorId,
                  0 // Will be updated later
                ]);

                if (result.changes > 0) {
                  waves.set(waveNumber, result.id);
                  waveCount++;
                } else {
                  // Get existing ID
                  const existing = await db.get('SELECT id FROM picking_waves WHERE wave_number = ?', [waveNumber]);
                  waves.set(waveNumber, existing.id);
                }
              }

              // Create picking task
              const waveId = waves.get(waveNumber);
              const productId = this.products.get(row.reference);
              const locationId = this.locations.get(row.locations?.trim());
              
              if (waveId && productId && locationId) {
                // Find corresponding order item
                const orderItem = await db.get(`
                  SELECT oi.id 
                  FROM order_items oi
                  JOIN customer_orders co ON oi.order_id = co.id
                  WHERE co.wave_number = ? AND oi.product_id = ?
                  LIMIT 1
                `, [waveNumber, productId]);

                if (orderItem) {
                  await db.run(`
                    INSERT OR IGNORE INTO picking_tasks 
                    (wave_id, order_item_id, location_id, quantity_to_pick, quantity_picked, status, picking_time_seconds, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  `, [
                    waveId,
                    orderItem.id,
                    locationId,
                    parseInt(row['quantityToPick (units)']) || 1,
                    parseInt(row['quantityToPick (units)']) || 1,
                    'completed',
                    Math.floor(Math.random() * 120) + 30, // Random picking time 30-150 seconds
                    new Date().toISOString()
                  ]);
                  
                  taskCount++;
                }
              }
            } catch (error) {
              console.error('Error inserting picking wave:', error);
            }
          }
        })
        .on('end', async () => {
          // Update wave total_items
          for (const [waveNumber, waveId] of waves) {
            const taskCount = await db.get(
              'SELECT COUNT(*) as count FROM picking_tasks WHERE wave_id = ?',
              [waveId]
            );
            
            await db.run(
              'UPDATE picking_waves SET total_items = ?, picked_items = ? WHERE id = ?',
              [taskCount.count, taskCount.count, waveId]
            );
          }
          
          console.log(`   ✅ Created ${waveCount} picking waves with ${taskCount} tasks`);
          resolve();
        })
        .on('error', reject);
    });
  }

  async printSummary() {
    console.log('\nDatabase Summary:');
    
    const tables = [
      'users',
      'products', 
      'storage_locations',
      'inventory',
      'customer_orders',
      'order_items',
      'picking_waves',
      'picking_tasks'
    ];

    for (const table of tables) {
      const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${count.count} records`);
    }

    // Print some sample data
    console.log('\n🔍 Sample Data:');
    
    const sampleOrder = await db.get(`
      SELECT co.order_number, co.customer_code, co.status, u.username as operator
      FROM customer_orders co
      LEFT JOIN users u ON co.assigned_operator_id = u.id
      LIMIT 1
    `);
    
    if (sampleOrder) {
      console.log(`   Sample Order: #${sampleOrder.order_number} for ${sampleOrder.customer_code} (${sampleOrder.status}) - Operator: ${sampleOrder.operator || 'Unassigned'}`);
    }

    const sampleProduct = await db.get(`
      SELECT p.reference, p.abc_code, COUNT(i.id) as locations
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY p.id
      LIMIT 1
    `);
    
    if (sampleProduct) {
      console.log(`   Sample Product: ${sampleProduct.reference} (Class ${sampleProduct.abc_code}) in ${sampleProduct.locations} locations`);
    }

    console.log('\n🔐 Default Login Credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   Manager: manager / manager123');
    console.log('   Operators: [operator_name] / operator123');
  }
}

// Run seeding if called directly
if (require.main === module) {
  const seeder = new DataSeeder();
  seeder.seedAll()
    .then(() => {
      console.log('\n🎉 Seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = DataSeeder;