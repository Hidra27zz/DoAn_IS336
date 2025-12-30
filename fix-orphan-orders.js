// Fix Orphan Orders (orders assigned but no wave exists)
const { getDatabase } = require('./config/database');

async function fixOrphanOrders() {
  console.log('\n=== FIX ORPHAN ORDERS ===\n');
  
  try {
    const db = await getDatabase();
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Find orders with wave_number but wave doesn't exist
      const orphans = await db.all(`
        SELECT o.id, o.order_number, o.wave_number, o.status
        FROM orders o
        LEFT JOIN picking_waves pw ON o.wave_number = pw.wave_number
        WHERE o.wave_number IS NOT NULL 
          AND pw.wave_number IS NULL
          AND o.status = 'assigned'
      `);
      
      console.log(`Found ${orphans.length} orphan orders\n`);
      
      if (orphans.length === 0) {
        console.log('No orphan orders to fix');
        await db.run('COMMIT');
        return;
      }
      
      // Get their items to unreserve inventory
      const orderIds = orphans.map(o => o.id);
      const placeholders = orderIds.map(() => '?').join(',');
      
      const items = await db.all(`
        SELECT 
          oi.product_reference,
          oi.quantity,
          i.location_code,
          i.reserved_quantity
        FROM order_items oi
        LEFT JOIN inventory i ON oi.product_reference = i.product_reference
        WHERE oi.order_id IN (${placeholders})
          AND i.id IS NOT NULL
      `, orderIds);
      
      console.log(`Found ${items.length} items to unreserve\n`);
      
      // Unreserve inventory
      for (const item of items) {
        await db.run(`
          UPDATE inventory
          SET reserved_quantity = MAX(0, reserved_quantity - ?)
          WHERE product_reference = ? AND location_code = ?
        `, [item.quantity, item.product_reference, item.location_code]);
      }
      
      // Reset orders to pending
      await db.run(`
        UPDATE orders
        SET status = 'pending', wave_number = NULL
        WHERE id IN (${placeholders})
      `, orderIds);
      
      await db.run('COMMIT');
      
      console.log(`Fixed ${orphans.length} orphan orders`);
      console.log(`Unreserved ${items.length} inventory items`);
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
  fixOrphanOrders()
    .then(() => {
      console.log('=== FIX COMPLETE ===\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { fixOrphanOrders };
