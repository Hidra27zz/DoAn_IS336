// Recalculate Reserved Quantity from Active Picking Tasks
const { getDatabase } = require('./config/database');

async function recalculateReserved() {
  console.log('\n=== RECALCULATE RESERVED QUANTITY ===\n');
  
  try {
    const db = await getDatabase();
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Step 1: Reset all reserved to 0
      console.log('Step 1: Resetting all reserved quantities to 0...');
      await db.run('UPDATE inventory SET reserved_quantity = 0');
      
      // Step 2: Calculate reserved from active picking tasks (not completed)
      console.log('Step 2: Calculating reserved from active picking tasks...');
      
      const reserved = await db.all(`
        SELECT 
          pt.product_reference,
          pt.location_code,
          SUM(pt.quantity_to_pick - COALESCE(pt.quantity_picked, 0)) as to_reserve
        FROM picking_tasks pt
        WHERE pt.status IN ('pending', 'in_progress', 'created')
        GROUP BY pt.product_reference, pt.location_code
        HAVING to_reserve > 0
      `);
      
      console.log(`Found ${reserved.length} inventory items to reserve\n`);
      
      // Step 3: Update inventory with calculated reserved
      for (const item of reserved) {
        await db.run(`
          UPDATE inventory
          SET reserved_quantity = ?
          WHERE product_reference = ? AND location_code = ?
        `, [item.to_reserve, item.product_reference, item.location_code]);
      }
      
      await db.run('COMMIT');
      
      console.log('Reserved quantities recalculated successfully\n');
      
      // Verify
      const summary = await db.get(`
        SELECT 
          SUM(reserved_quantity) as total_reserved,
          COUNT(CASE WHEN reserved_quantity > 0 THEN 1 END) as locations_with_reserved
        FROM inventory
      `);
      
      console.log('Summary:');
      console.log(`  Total Reserved: ${summary.total_reserved}`);
      console.log(`  Locations with Reserved: ${summary.locations_with_reserved}`);
      
      // Check for issues
      const issues = await db.all(`
        SELECT 
          product_reference,
          location_code,
          quantity,
          reserved_quantity,
          (quantity - reserved_quantity) as available
        FROM inventory
        WHERE reserved_quantity > quantity
        LIMIT 10
      `);
      
      if (issues.length > 0) {
        console.log('\nWARNING: Found locations where reserved > quantity:');
        issues.forEach(i => {
          console.log(`  ${i.product_reference} @ ${i.location_code}: qty=${i.quantity}, reserved=${i.reserved_quantity}`);
        });
      } else {
        console.log('\nOK: No over-reservation issues found');
      }
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
  
  console.log('\n=== RECALCULATION COMPLETE ===\n');
}

if (require.main === module) {
  recalculateReserved()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { recalculateReserved };
