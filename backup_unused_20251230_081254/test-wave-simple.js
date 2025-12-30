// Simple test để kiểm tra database và wave creation logic
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function testWaveCreationLogic() {
  console.log('🧪 Testing Wave Creation Logic...');
  
  const dbPath = path.join(__dirname, 'warehouse.db');
  const db = new sqlite3.Database(dbPath);
  
  try {
    // Wrap in promise for async/await
    const getQuery = (query, params = []) => {
      return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    
    const allQuery = (query, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    
    // 1. Check pending orders
    console.log('\n1. Checking pending orders...');
    const pendingOrders = await allQuery(`
      SELECT id, order_number, status, customer_name 
      FROM orders 
      WHERE status = 'pending' 
      LIMIT 5
    `);
    
    console.log(`✅ Found ${pendingOrders.length} pending orders`);
    if (pendingOrders.length > 0) {
      pendingOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ${order.order_number} - ${order.customer_name}`);
      });
    }
    
    // 2. Check order items for first order
    if (pendingOrders.length > 0) {
      console.log('\n2. Checking order items...');
      const orderItems = await allQuery(`
        SELECT 
          oi.product_reference,
          oi.quantity,
          oi.size,
          p.description
        FROM order_items oi
        LEFT JOIN products p ON oi.product_reference = p.reference
        WHERE oi.order_id = ?
        LIMIT 5
      `, [pendingOrders[0].id]);
      
      console.log(`✅ Found ${orderItems.length} items in order ${pendingOrders[0].order_number}`);
      orderItems.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.product_reference} (${item.description || 'No description'}) - Qty: ${item.quantity}`);
      });
      
      // 3. Check inventory for these items
      console.log('\n3. Checking inventory availability...');
      for (const item of orderItems.slice(0, 3)) {
        const inventory = await getQuery(`
          SELECT 
            i.location_code, 
            i.quantity, 
            (i.quantity - COALESCE(i.reserved_quantity, 0)) as available_quantity,
            sl.zone
          FROM inventory i
          LEFT JOIN storage_locations sl ON i.location_code = sl.location_code
          WHERE i.product_reference = ? 
            AND (i.quantity - COALESCE(i.reserved_quantity, 0)) >= ?
          ORDER BY i.created_at ASC
          LIMIT 1
        `, [item.product_reference, item.quantity]);
        
        if (inventory) {
          console.log(`   ✅ ${item.product_reference}: Available at ${inventory.location_code} (Zone ${inventory.zone}) - ${inventory.available_quantity} units`);
        } else {
          // Check if product exists at all
          const anyInventory = await getQuery(`
            SELECT 
              i.location_code, 
              (i.quantity - COALESCE(i.reserved_quantity, 0)) as available_quantity
            FROM inventory i
            WHERE i.product_reference = ?
            ORDER BY (i.quantity - COALESCE(i.reserved_quantity, 0)) DESC
            LIMIT 1
          `, [item.product_reference]);
          
          if (anyInventory) {
            console.log(`   ⚠️ ${item.product_reference}: Insufficient quantity at ${anyInventory.location_code} - Need: ${item.quantity}, Have: ${anyInventory.available_quantity}`);
          } else {
            console.log(`   ❌ ${item.product_reference}: Not found in inventory`);
          }
        }
      }
    }
    
    // 4. Check operators
    console.log('\n4. Checking operators...');
    const operators = await allQuery(`
      SELECT id, username, role 
      FROM users 
      WHERE role IN ('admin', 'operator') 
      LIMIT 5
    `);
    
    console.log(`✅ Found ${operators.length} operators`);
    operators.forEach((op, index) => {
      console.log(`   ${index + 1}. ${op.username} (${op.role})`);
    });
    
    // 5. Check existing waves
    console.log('\n5. Checking existing waves...');
    const existingWaves = await allQuery(`
      SELECT wave_number, status, COUNT(*) as task_count
      FROM picking_tasks 
      GROUP BY wave_number 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`✅ Found ${existingWaves.length} existing waves`);
    existingWaves.forEach((wave, index) => {
      console.log(`   ${index + 1}. ${wave.wave_number} (${wave.status}) - ${wave.task_count} tasks`);
    });
    
    // 6. Test wave number generation
    console.log('\n6. Testing wave number generation...');
    const waveNumber = `W${Date.now().toString().slice(-8)}`;
    console.log(`✅ Generated wave number: ${waveNumber}`);
    
    console.log('\n🎉 Wave creation logic test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Pending Orders: ${pendingOrders.length}`);
    console.log(`   - Available Operators: ${operators.length}`);
    console.log(`   - Existing Waves: ${existingWaves.length}`);
    console.log(`   - System Ready: ${pendingOrders.length > 0 && operators.length > 0 ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    db.close();
  }
}

// Run test
testWaveCreationLogic().catch(console.error);