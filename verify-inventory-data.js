// Verify Inventory Data
const { getDatabase } = require('./config/database');

async function verifyInventoryData() {
  console.log('\n=== VERIFY INVENTORY DATA ===\n');
  
  try {
    const db = await getDatabase();
    
    // Check 02MRUH inventory
    console.log('Product: 02MRUH\n');
    
    const items = await db.all(`
      SELECT 
        location_code,
        quantity,
        reserved_quantity,
        (quantity - reserved_quantity) as available
      FROM inventory
      WHERE product_reference = '02MRUH'
      ORDER BY location_code
      LIMIT 10
    `);
    
    console.log('Location      | Qty  | Reserved | Available');
    console.log('--------------|------|----------|----------');
    items.forEach(item => {
      console.log(
        `${item.location_code.padEnd(13)} | ${String(item.quantity).padStart(4)} | ${String(item.reserved_quantity).padStart(8)} | ${String(item.available).padStart(9)}`
      );
    });
    
    // Summary
    const summary = await db.get(`
      SELECT 
        COUNT(*) as locations,
        SUM(quantity) as total_qty,
        SUM(reserved_quantity) as total_reserved,
        SUM(quantity - reserved_quantity) as total_available
      FROM inventory
      WHERE product_reference = '02MRUH'
    `);
    
    console.log('\nSummary:');
    console.log(`  Total Locations: ${summary.locations}`);
    console.log(`  Total Quantity: ${summary.total_qty}`);
    console.log(`  Total Reserved: ${summary.total_reserved}`);
    console.log(`  Total Available: ${summary.total_available}`);
    
    // Check if there are any negative available
    const negative = await db.all(`
      SELECT 
        location_code,
        quantity,
        reserved_quantity,
        (quantity - reserved_quantity) as available
      FROM inventory
      WHERE (quantity - reserved_quantity) < 0
      LIMIT 10
    `);
    
    if (negative.length > 0) {
      console.log('\nWARNING: Found locations with negative available:');
      negative.forEach(item => {
        console.log(`  ${item.location_code}: qty=${item.quantity}, reserved=${item.reserved_quantity}, available=${item.available}`);
      });
    } else {
      console.log('\nOK: No negative available quantities found');
    }
    
    console.log('\n=== VERIFICATION COMPLETE ===\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  verifyInventoryData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyInventoryData };
