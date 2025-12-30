// Test Complete Inventory Flow
const { getDatabase } = require('./config/database');

async function testInventoryFlow() {
  console.log('\n=== TEST INVENTORY FLOW ===\n');
  
  try {
    const db = await getDatabase();
    
    // 1. Check initial inventory
    console.log('1. INITIAL INVENTORY STATE:');
    const initial = await db.get(`
      SELECT 
        product_reference,
        location_code,
        quantity,
        reserved_quantity,
        (quantity - reserved_quantity) as available
      FROM inventory
      WHERE product_reference = '02MRUH' AND location_code = 'A-14-40'
    `);
    
    if (initial) {
      console.log(`   Product: ${initial.product_reference}`);
      console.log(`   Location: ${initial.location_code}`);
      console.log(`   Quantity: ${initial.quantity}`);
      console.log(`   Reserved: ${initial.reserved_quantity}`);
      console.log(`   Available: ${initial.available}`);
    } else {
      console.log('   No inventory found for 02MRUH at A-14-40');
    }
    
    // 2. Check if there are any picking tasks for this product
    console.log('\n2. PICKING TASKS FOR THIS PRODUCT:');
    const tasks = await db.all(`
      SELECT 
        id,
        wave_number,
        product_reference,
        location_code,
        quantity_to_pick,
        quantity_picked,
        status,
        created_at
      FROM picking_tasks
      WHERE product_reference = '02MRUH' AND location_code = 'A-14-40'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (tasks.length > 0) {
      console.log(`   Found ${tasks.length} tasks:`);
      tasks.forEach(t => {
        console.log(`   - Task ${t.id}: Wave ${t.wave_number}`);
        console.log(`     To Pick: ${t.quantity_to_pick}, Picked: ${t.quantity_picked}, Status: ${t.status}`);
      });
    } else {
      console.log('   No picking tasks found');
    }
    
    // 3. Check orders for this product
    console.log('\n3. ORDERS CONTAINING THIS PRODUCT:');
    const orders = await db.all(`
      SELECT 
        o.order_number,
        o.status as order_status,
        oi.quantity,
        oi.picked_quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.product_reference = '02MRUH'
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    
    if (orders.length > 0) {
      console.log(`   Found ${orders.length} orders:`);
      orders.forEach(o => {
        console.log(`   - Order ${o.order_number}: ${o.order_status}`);
        console.log(`     Quantity: ${o.quantity}, Picked: ${o.picked_quantity || 0}`);
      });
    } else {
      console.log('   No orders found');
    }
    
    // 4. Summary and recommendations
    console.log('\n4. FLOW ANALYSIS:');
    
    if (initial) {
      const totalDemand = tasks.reduce((sum, t) => sum + (t.quantity_to_pick || 0), 0);
      const totalPicked = tasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0);
      
      console.log(`   Total Demand (from tasks): ${totalDemand}`);
      console.log(`   Total Picked: ${totalPicked}`);
      console.log(`   Reserved in Inventory: ${initial.reserved_quantity}`);
      console.log(`   Available: ${initial.available}`);
      
      if (initial.reserved_quantity !== totalDemand - totalPicked) {
        console.log('\n   WARNING: Reserved quantity mismatch!');
        console.log(`   Expected: ${totalDemand - totalPicked}`);
        console.log(`   Actual: ${initial.reserved_quantity}`);
      } else {
        console.log('\n   OK: Reserved quantity matches pending picks');
      }
      
      if (initial.available < 0) {
        console.log('\n   ERROR: Negative available quantity!');
      } else if (initial.available === 0) {
        console.log('\n   INFO: Product out of stock (available = 0)');
        console.log('   "Nhập thêm" button should be shown');
      }
    }
    
    console.log('\n=== TEST COMPLETE ===\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  testInventoryFlow()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { testInventoryFlow };
