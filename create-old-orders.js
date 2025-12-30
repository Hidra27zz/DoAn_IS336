// Create some old orders for testing delayed order alerts
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./warehouse.db');

async function createOldOrders() {
  console.log('\n========================================');
  console.log('  Creating Old Orders for Testing');
  console.log('========================================\n');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Get some products
      db.all('SELECT reference FROM products LIMIT 5', (err, products) => {
        if (err) {
          reject(err);
          return;
        }
        
        const now = new Date();
        const testOrders = [
          { hours_ago: 25, priority: 1, customer: 'Test Customer 1' },  // 1 day old
          { hours_ago: 50, priority: 2, customer: 'Test Customer 2' },  // 2 days old
          { hours_ago: 75, priority: 3, customer: 'Test Customer 3' },  // 3 days old (critical)
          { hours_ago: 100, priority: 3, customer: 'Test Customer 4' }, // 4 days old (critical)
        ];
        
        let ordersCreated = 0;
        
        testOrders.forEach((orderData, index) => {
          const orderDate = new Date(now.getTime() - (orderData.hours_ago * 60 * 60 * 1000));
          const orderNumber = `TEST_OLD_${Date.now()}_${index}`;
          
          db.run(`
            INSERT INTO orders (order_number, customer_name, status, priority, created_at, updated_at)
            VALUES (?, ?, 'pending', ?, ?, ?)
          `, [orderNumber, orderData.customer, orderData.priority, orderDate.toISOString(), orderDate.toISOString()], function(err) {
            if (err) {
              console.error('Error creating order:', err);
              return;
            }
            
            const orderId = this.lastID;
            console.log(`Created order ${orderNumber} (${orderData.hours_ago}h ago)`);
            
            // Add some items to the order
            const itemsToAdd = Math.floor(Math.random() * 3) + 2; // 2-4 items
            let itemsAdded = 0;
            
            for (let i = 0; i < itemsToAdd; i++) {
              const product = products[Math.floor(Math.random() * products.length)];
              const quantity = Math.floor(Math.random() * 5) + 1;
              
              db.run(`
                INSERT INTO order_items (order_id, product_reference, quantity, size)
                VALUES (?, ?, ?, 'M')
              `, [orderId, product.reference, quantity], (err) => {
                if (err) {
                  console.error('Error adding item:', err);
                } else {
                  itemsAdded++;
                  if (itemsAdded === itemsToAdd) {
                    console.log(`  - Added ${itemsAdded} items to order`);
                  }
                }
              });
            }
            
            ordersCreated++;
            if (ordersCreated === testOrders.length) {
              console.log(`\n✓ Created ${ordersCreated} old orders for testing`);
              console.log('\n========================================');
              console.log('  Test Orders Created');
              console.log('========================================\n');
              
              db.close();
              resolve();
            }
          });
        });
      });
    });
  });
}

createOldOrders().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
