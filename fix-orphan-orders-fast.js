// Fix Orphan Orders - Fast Version using SQL
const { getDatabase } = require('./config/database');

async function fixOrphanOrdersFast() {
  console.log('\n=== FIX ORPHAN ORDERS (FAST) ===\n');
  
  try {
    const db = await getDatabase();
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Count orphan orders
      const count = await db.get(`
        SELECT COUNT(*) as total
        FROM orders o
        LEFT JOIN picking_waves pw ON o.wave_number = pw.wave_number
        WHERE o.wave_number IS NOT NULL 
          AND pw.wave_number IS NULL
          AND o.status = 'assigned'
      `);
      
      console.log(`Found ${count.total} orphan orders\n`);
      
      if (count.total === 0) {
        console.log('No orphan orders to fix');
        await db.run('COMMIT');
        return;
      }
      
      // Unreserve inventory using bulk SQL
      console.log('Unreserving inventory...');
      await db.run(`
        UPDATE inventory
        SET reserved_quantity = 0
        WHERE id IN (
          SELECT DISTINCT i.id
          FROM inventory i
          JOIN order_items oi ON i.product_reference = oi.product_reference
          JOIN orders o ON oi.order_id = o.id
          LEFT JOIN picking_waves pw ON o.wave_number = pw.wave_number
          WHERE o.wave_number IS NOT NULL 
            AND pw.wave_number IS NULL
            AND o.status = 'assigned'
        )
      `);
      
      console.log('Resetting orders to pending...');
      // Reset orders to pending
      await db.run(`
        UPDATE orders
        SET status = 'pending', wave_number = NULL
        WHERE id IN (
          SELECT o.id
          FROM orders o
          LEFT JOIN picking_waves pw ON o.wave_number = pw.wave_number
          WHERE o.wave_number IS NOT NULL 
            AND pw.wave_number IS NULL
            AND o.status = 'assigned'
        )
      `);
      
      await db.run('COMMIT');
      
      console.log(`\nFixed ${count.total} orphan orders`);
      console.log('All inventory unreserved');
      console.log('Orders reset to pending status\n');
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

if (require.main === module) {
  fixOrphanOrdersFast()
    .then(() => {
      console.log('=== FIX COMPLETE ===\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { fixOrphanOrdersFast };
