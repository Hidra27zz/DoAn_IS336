// Delete orders with 0 items from database
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./warehouse.db');

async function deleteEmptyOrders() {
  console.log('\n========================================');
  console.log('  Deleting Orders with 0 Items');
  console.log('========================================\n');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // First, count orders with no items
      db.get(`
        SELECT COUNT(*) as count 
        FROM orders o 
        WHERE NOT EXISTS (
          SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
        )
      `, (err, result) => {
        if (err) {
          console.error('Error counting empty orders:', err);
          reject(err);
          return;
        }
        
        const emptyOrderCount = result.count;
        console.log(`Found ${emptyOrderCount} orders with 0 items`);
        
        if (emptyOrderCount === 0) {
          console.log('\n✓ No empty orders to delete');
          db.close();
          resolve();
          return;
        }
        
        // Show some examples
        db.all(`
          SELECT o.id, o.order_number, o.status, o.created_at
          FROM orders o 
          WHERE NOT EXISTS (
            SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
          )
          LIMIT 10
        `, (err, examples) => {
          if (err) {
            console.error('Error getting examples:', err);
          } else {
            console.log('\nExamples of orders to be deleted:');
            examples.forEach(order => {
              console.log(`  - ${order.order_number} (ID: ${order.id}, Status: ${order.status})`);
            });
          }
          
          // Delete the empty orders
          console.log('\nDeleting empty orders...');
          db.run(`
            DELETE FROM orders 
            WHERE id IN (
              SELECT o.id 
              FROM orders o 
              WHERE NOT EXISTS (
                SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
              )
            )
          `, function(err) {
            if (err) {
              console.error('Error deleting orders:', err);
              reject(err);
              return;
            }
            
            console.log(`\n✓ Deleted ${this.changes} orders with 0 items`);
            
            // Verify deletion
            db.get(`
              SELECT COUNT(*) as count 
              FROM orders o 
              WHERE NOT EXISTS (
                SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
              )
            `, (err, result) => {
              if (err) {
                console.error('Error verifying:', err);
              } else {
                console.log(`\n✓ Remaining empty orders: ${result.count}`);
              }
              
              // Show final statistics
              db.get('SELECT COUNT(*) as total FROM orders', (err, result) => {
                if (err) {
                  console.error('Error getting total:', err);
                } else {
                  console.log(`✓ Total orders remaining: ${result.total}`);
                }
                
                db.get(`
                  SELECT COUNT(*) as count 
                  FROM orders o 
                  WHERE EXISTS (
                    SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
                  )
                `, (err, result) => {
                  if (err) {
                    console.error('Error getting orders with items:', err);
                  } else {
                    console.log(`✓ Orders with items: ${result.count}`);
                  }
                  
                  console.log('\n========================================');
                  console.log('  Cleanup Complete');
                  console.log('========================================\n');
                  
                  db.close();
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  });
}

deleteEmptyOrders().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
