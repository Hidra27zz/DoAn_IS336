// Fix WMS Logic - Remove Invalid Tasks and Recalculate
const { getDatabase } = require('./config/database');

async function fixWMSLogic() {
  console.log('\n=== FIX WMS LOGIC ===\n');
  
  try {
    const db = await getDatabase();
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Step 1: Find and remove tasks that cause over-reservation
      console.log('Step 1: Finding invalid picking tasks...');
      
      // Get current inventory
      const inventory = await db.all(`
        SELECT product_reference, location_code, quantity
        FROM inventory
      `);
      
      const invMap = {};
      inventory.forEach(i => {
        const key = `${i.product_reference}|${i.location_code}`;
        invMap[key] = i.quantity;
      });
      
      // Get all active tasks
      const tasks = await db.all(`
        SELECT 
          id,
          product_reference,
          location_code,
          quantity_to_pick,
          quantity_picked,
          status,
          wave_number
        FROM picking_tasks
        WHERE status IN ('pending', 'in_progress', 'created')
        ORDER BY created_at
      `);
      
      console.log(`Checking ${tasks.length} active tasks...\n`);
      
      const allocated = {};
      const invalidTasks = [];
      
      for (const task of tasks) {
        const key = `${task.product_reference}|${task.location_code}`;
        const available = invMap[key] || 0;
        const alreadyAllocated = allocated[key] || 0;
        const needed = task.quantity_to_pick - (task.quantity_picked || 0);
        
        if (alreadyAllocated + needed > available) {
          invalidTasks.push(task.id);
        } else {
          allocated[key] = alreadyAllocated + needed;
        }
      }
      
      console.log(`Found ${invalidTasks.length} invalid tasks (over-allocated)\n`);
      
      if (invalidTasks.length > 0) {
        // Delete invalid tasks
        const placeholders = invalidTasks.map(() => '?').join(',');
        await db.run(`
          DELETE FROM picking_tasks
          WHERE id IN (${placeholders})
        `, invalidTasks);
        
        console.log(`Deleted ${invalidTasks.length} invalid tasks\n`);
      }
      
      // Step 2: Recalculate reserved quantities
      console.log('Step 2: Recalculating reserved quantities...');
      
      await db.run('UPDATE inventory SET reserved_quantity = 0');
      
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
      
      for (const item of reserved) {
        await db.run(`
          UPDATE inventory
          SET reserved_quantity = ?
          WHERE product_reference = ? AND location_code = ?
        `, [item.to_reserve, item.product_reference, item.location_code]);
      }
      
      await db.run('COMMIT');
      
      console.log('Reserved quantities recalculated\n');
      
      // Verify
      const issues = await db.all(`
        SELECT COUNT(*) as count
        FROM inventory
        WHERE reserved_quantity > quantity
      `);
      
      if (issues[0].count > 0) {
        console.log(`WARNING: Still have ${issues[0].count} over-reserved locations`);
      } else {
        console.log('OK: No over-reservation issues');
      }
      
      // Summary
      const summary = await db.get(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(quantity_to_pick) as total_to_pick,
          SUM(quantity_picked) as total_picked
        FROM picking_tasks
        WHERE status IN ('pending', 'in_progress', 'created')
      `);
      
      console.log('\nActive Tasks Summary:');
      console.log(`  Total Tasks: ${summary.total_tasks}`);
      console.log(`  To Pick: ${summary.total_to_pick}`);
      console.log(`  Already Picked: ${summary.total_picked || 0}`);
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
  
  console.log('\n=== FIX COMPLETE ===\n');
}

if (require.main === module) {
  fixWMSLogic()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { fixWMSLogic };
