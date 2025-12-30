// Fix Shoe Sizes - Simple Version
// Converts: 85 -> 8.5, 95 -> 9.5, 105 -> 10.5, 115 -> 11.5, etc.

const { getDatabase } = require('./config/database');

async function fixShoeSizes() {
  console.log('👟 Fixing Shoe Sizes\n');
  
  try {
    const db = await getDatabase();
    
    // Get all unique sizes
    const sizes = await db.all(`
      SELECT DISTINCT size FROM (
        SELECT DISTINCT size FROM order_items WHERE size IS NOT NULL
        UNION
        SELECT DISTINCT size FROM picking_tasks WHERE size IS NOT NULL
      )
      ORDER BY CAST(size AS REAL)
    `);
    
    console.log('Current sizes in database:');
    console.log(sizes.map(s => s.size).join(', '));
    console.log('');
    
    // Function to convert size
    function convertSize(size) {
      const num = parseInt(size);
      if (isNaN(num)) return size;
      
      // If size ends with 5 and is >= 35, convert to decimal
      // 85 -> 8.5, 95 -> 9.5, 105 -> 10.5, 115 -> 11.5, etc.
      if (num >= 35 && num % 10 === 5) {
        return (num / 10).toFixed(1);
      }
      
      return size;
    }
    
    // Show conversion preview
    console.log('Conversion preview:');
    console.log('='.repeat(60));
    sizes.forEach(s => {
      const converted = convertSize(s.size);
      if (s.size !== converted) {
        console.log(`  ${s.size} -> ${converted}`);
      }
    });
    console.log('');
    
    // Apply conversions
    console.log('Applying conversions...\n');
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      let totalUpdated = 0;
      
      for (const s of sizes) {
        const converted = convertSize(s.size);
        if (s.size !== converted) {
          // Update order_items
          const r1 = await db.run(`
            UPDATE order_items SET size = ? WHERE size = ?
          `, [converted, s.size]);
          
          // Update picking_tasks
          const r2 = await db.run(`
            UPDATE picking_tasks SET size = ? WHERE size = ?
          `, [converted, s.size]);
          
          const updated = (r1.changes || 0) + (r2.changes || 0);
          totalUpdated += updated;
          console.log(`  ✅ ${s.size} -> ${converted} (${updated} records)`);
        }
      }
      
      await db.run('COMMIT');
      
      console.log(`\n✅ Total updated: ${totalUpdated} records\n`);
      
      // Show new sizes
      const newSizes = await db.all(`
        SELECT DISTINCT size FROM (
          SELECT DISTINCT size FROM order_items WHERE size IS NOT NULL
          UNION
          SELECT DISTINCT size FROM picking_tasks WHERE size IS NOT NULL
        )
        ORDER BY CAST(size AS REAL)
      `);
      
      console.log('New sizes in database:');
      console.log(newSizes.map(s => s.size).join(', '));
      console.log('');
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

if (require.main === module) {
  fixShoeSizes()
    .then(() => {
      console.log('✅ Shoe size fix complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { fixShoeSizes };
