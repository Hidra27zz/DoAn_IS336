// Fix Footwear Size Format
// Converts sizes like 115 -> 11.5, 95 -> 9.5, etc.

const { getDatabase } = require('./config/database');

async function fixFootwearSizes() {
  console.log('👟 Fixing Footwear Size Format\n');
  
  try {
    const db = await getDatabase();
    
    // Get all products with sector = 'PF' (Footwear) - trim spaces
    const footwearProducts = await db.all(`
      SELECT DISTINCT reference, TRIM(sector) as sector, description
      FROM products
      WHERE TRIM(sector) = 'PF'
      ORDER BY reference
    `);
    
    console.log(`Found ${footwearProducts.length} footwear products\n`);
    
    if (footwearProducts.length === 0) {
      console.log('No footwear products found. Checking all products...\n');
      
      const allProducts = await db.all(`
        SELECT DISTINCT reference, sector, description
        FROM products
        LIMIT 10
      `);
      
      console.log('Sample products:');
      allProducts.forEach(p => {
        console.log(`  - ${p.reference} | ${p.sector} | ${p.description}`);
      });
      
      return;
    }
    
    // Get all order items and picking tasks with footwear (sector = 'PF')
    const orderItems = await db.all(`
      SELECT DISTINCT oi.size, oi.product_reference, p.sector
      FROM order_items oi
      JOIN products p ON oi.product_reference = p.reference
      WHERE p.sector = 'PF' AND oi.size IS NOT NULL
      ORDER BY oi.size
    `);
    
    const pickingTasks = await db.all(`
      SELECT DISTINCT pt.size, pt.product_reference, p.sector
      FROM picking_tasks pt
      JOIN products p ON pt.product_reference = p.reference
      WHERE p.sector = 'PF' AND pt.size IS NOT NULL
      ORDER BY pt.size
    `);
    
    console.log(`Found ${orderItems.length} unique sizes in order_items`);
    console.log(`Found ${pickingTasks.length} unique sizes in picking_tasks\n`);
    
    // Show current sizes
    console.log('Current Sizes in Database:');
    console.log('='.repeat(60));
    
    const allSizes = new Set([
      ...orderItems.map(i => i.size),
      ...pickingTasks.map(t => t.size)
    ]);
    
    const sizesArray = Array.from(allSizes).sort((a, b) => {
      const numA = parseFloat(a) || 0;
      const numB = parseFloat(b) || 0;
      return numA - numB;
    });
    
    console.log('Sizes found:', sizesArray.join(', '));
    console.log('');
    
    // Function to convert size format
    function convertSize(size) {
      if (!size) return size;
      
      const sizeStr = size.toString().trim();
      
      // If already has decimal point, return as is
      if (sizeStr.includes('.')) return sizeStr;
      
      // If it's a number like 115, 95, 105, etc.
      const num = parseInt(sizeStr);
      if (isNaN(num)) return sizeStr;
      
      // Convert: 115 -> 11.5, 95 -> 9.5, 105 -> 10.5
      if (num >= 30 && num <= 200) {
        const converted = (num / 10).toFixed(1);
        return converted;
      }
      
      return sizeStr;
    }
    
    // Show conversion preview
    console.log('Size Conversion Preview:');
    console.log('='.repeat(60));
    sizesArray.forEach(size => {
      const converted = convertSize(size);
      if (size !== converted) {
        console.log(`  ${size} -> ${converted}`);
      } else {
        console.log(`  ${size} (no change)`);
      }
    });
    console.log('');
    
    // Ask for confirmation (auto-confirm in script)
    console.log('Applying size conversions...\n');
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      let updatedOrderItems = 0;
      let updatedPickingTasks = 0;
      
      // Update order_items
      for (const size of sizesArray) {
        const converted = convertSize(size);
        if (size !== converted) {
          const result = await db.run(`
            UPDATE order_items
            SET size = ?
            WHERE size = ?
          `, [converted, size]);
          
          updatedOrderItems += result.changes || 0;
        }
      }
      
      // Update picking_tasks
      for (const size of sizesArray) {
        const converted = convertSize(size);
        if (size !== converted) {
          const result = await db.run(`
            UPDATE picking_tasks
            SET size = ?
            WHERE size = ?
          `, [converted, size]);
          
          updatedPickingTasks += result.changes || 0;
        }
      }
      
      await db.run('COMMIT');
      
      console.log('✅ Size conversion complete!');
      console.log(`   - Updated ${updatedOrderItems} order items`);
      console.log(`   - Updated ${updatedPickingTasks} picking tasks\n`);
      
      // Verify changes
      const newOrderItems = await db.all(`
        SELECT DISTINCT size
        FROM order_items
        WHERE size IS NOT NULL
        ORDER BY CAST(size AS REAL)
      `);
      
      console.log('New Sizes in Database:');
      console.log('='.repeat(60));
      console.log(newOrderItems.map(i => i.size).join(', '));
      console.log('');
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error fixing footwear sizes:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixFootwearSizes()
    .then(() => {
      console.log('✅ Footwear size fix completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to fix footwear sizes:', error);
      process.exit(1);
    });
}

module.exports = { fixFootwearSizes };
