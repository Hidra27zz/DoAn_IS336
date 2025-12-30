// Fix Duplicate Inventory Records
// This script merges duplicate inventory records for the same product at the same location

const { getDatabase } = require('./config/database');

async function fixDuplicateInventory() {
  console.log('🔧 Starting duplicate inventory fix...\n');
  
  try {
    const db = await getDatabase();
    
    // Find duplicate inventory records
    console.log('1. Finding duplicate inventory records...');
    const duplicates = await db.all(`
      SELECT 
        product_reference,
        location_code,
        COUNT(*) as duplicate_count,
        SUM(quantity) as total_quantity,
        SUM(reserved_quantity) as total_reserved,
        GROUP_CONCAT(id) as record_ids
      FROM inventory
      GROUP BY product_reference, location_code
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate inventory records found!\n');
      return;
    }
    
    console.log(`   Found ${duplicates.length} duplicate inventory groups\n`);
    
    // Fix each duplicate group
    let fixed = 0;
    await db.run('BEGIN TRANSACTION');
    
    try {
      for (const dup of duplicates) {
        const ids = dup.record_ids.split(',').map(id => parseInt(id));
        const keepId = ids[0]; // Keep the first record
        const deleteIds = ids.slice(1); // Delete the rest
        
        console.log(`   Fixing: ${dup.product_reference} at ${dup.location_code}`);
        console.log(`     - Merging ${dup.duplicate_count} records (IDs: ${dup.record_ids})`);
        console.log(`     - Total quantity: ${dup.total_quantity}, Reserved: ${dup.total_reserved}`);
        
        // Update the first record with merged quantities
        await db.run(`
          UPDATE inventory 
          SET quantity = ?, 
              reserved_quantity = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [dup.total_quantity, dup.total_reserved, keepId]);
        
        // Delete duplicate records
        for (const deleteId of deleteIds) {
          await db.run('DELETE FROM inventory WHERE id = ?', [deleteId]);
        }
        
        console.log(`     ✅ Merged into record ID ${keepId}, deleted ${deleteIds.length} duplicates\n`);
        fixed++;
      }
      
      await db.run('COMMIT');
      console.log(`\n✅ Successfully fixed ${fixed} duplicate inventory groups!\n`);
      
      // Verify no duplicates remain
      const remainingDuplicates = await db.all(`
        SELECT 
          product_reference,
          location_code,
          COUNT(*) as count
        FROM inventory
        GROUP BY product_reference, location_code
        HAVING COUNT(*) > 1
      `);
      
      if (remainingDuplicates.length === 0) {
        console.log('✅ Verification: No duplicates remain in database\n');
      } else {
        console.log(`⚠️  Warning: ${remainingDuplicates.length} duplicate groups still exist\n`);
      }
      
      // Show inventory summary
      const summary = await db.get(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT product_reference) as unique_products,
          COUNT(DISTINCT location_code) as unique_locations,
          SUM(quantity) as total_quantity
        FROM inventory
      `);
      
      console.log('📊 Inventory Summary:');
      console.log(`   - Total records: ${summary.total_records}`);
      console.log(`   - Unique products: ${summary.unique_products}`);
      console.log(`   - Unique locations: ${summary.unique_locations}`);
      console.log(`   - Total quantity: ${summary.total_quantity}\n`);
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error fixing duplicate inventory:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixDuplicateInventory()
    .then(() => {
      console.log('✅ Duplicate inventory fix completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to fix duplicate inventory:', error);
      process.exit(1);
    });
}

module.exports = { fixDuplicateInventory };
