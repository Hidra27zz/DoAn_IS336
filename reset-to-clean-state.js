// Reset to Clean State - Keep only inventory and orders
const { getDatabase } = require('./config/database');

async function resetToCleanState() {
  console.log('\n=== RESET TO CLEAN STATE ===\n');
  console.log('This will:');
  console.log('- Delete ALL picking waves and tasks');
  console.log('- Reset ALL inventory reserved_quantity to 0');
  console.log('- Reset ALL orders to pending status');
  console.log('- Keep inventory quantities intact\n');
  
  try {
    const db = await getDatabase();
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Count before
      const before = await db.get(`
        SELECT 
          (SELECT COUNT(*) FROM picking_waves) as waves,
          (SELECT COUNT(*) FROM picking_tasks) as tasks,
          (SELECT COUNT(*) FROM orders WHERE status != 'pending') as non_pending_orders
      `);
      
      console.log('Before:');
      console.log(`  Picking Waves: ${before.waves}`);
      console.log(`  Picking Tasks: ${before.tasks}`);
      console.log(`  Non-Pending Orders: ${before.non_pending_orders}\n`);
      
      // Delete all picking data
      console.log('Deleting picking waves and tasks...');
      await db.run('DELETE FROM picking_tasks');
      await db.run('DELETE FROM picking_waves');
      
      // Reset inventory reserved
      console.log('Resetting inventory reserved quantities...');
      await db.run('UPDATE inventory SET reserved_quantity = 0');
      
      // Reset orders
      console.log('Resetting orders to pending...');
      await db.run(`
        UPDATE orders 
        SET status = 'pending', wave_number = NULL
        WHERE status != 'pending'
      `);
      
      // Reset order items
      await db.run('UPDATE order_items SET picked_quantity = 0');
      
      await db.run('COMMIT');
      
      console.log('\nSystem reset to clean state successfully!\n');
      
      // Verify
      const after = await db.get(`
        SELECT 
          (SELECT COUNT(*) FROM picking_waves) as waves,
          (SELECT COUNT(*) FROM picking_tasks) as tasks,
          (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
          (SELECT SUM(reserved_quantity) FROM inventory) as total_reserved
      `);
      
      console.log('After:');
      console.log(`  Picking Waves: ${after.waves}`);
      console.log(`  Picking Tasks: ${after.tasks}`);
      console.log(`  Pending Orders: ${after.pending_orders}`);
      console.log(`  Total Reserved: ${after.total_reserved}\n`);
      
      console.log('System is now ready for proper WMS workflow:');
      console.log('1. Create orders (already have ' + after.pending_orders + ' pending)');
      console.log('2. Create waves from pending orders');
      console.log('3. System will auto-reserve inventory');
      console.log('4. Pick items');
      console.log('5. System will auto-update inventory\n');
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
  
  console.log('=== RESET COMPLETE ===\n');
}

if (require.main === module) {
  resetToCleanState()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { resetToCleanState };
