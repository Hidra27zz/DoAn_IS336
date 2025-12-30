// Test script to verify real inventory data loading
const InventoryDataLoader = require('./services/inventory-data-loader');

async function testRealInventoryData() {
  console.log('Testing real inventory data loading...\n');
  
  try {
    const loader = new InventoryDataLoader();
    
    // Load real data
    console.log('1. Loading real inventory data from CSV files...');
    await loader.loadRealInventoryData();
    
    // Test inventory summary
    console.log('\n2. Testing inventory summary...');
    const summary = loader.getInventorySummary();
    console.log('Summary:', {
      total_products: summary.total_products,
      total_locations: summary.total_locations,
      total_quantity: summary.total_quantity,
      total_reserved: summary.total_reserved,
      zones: Object.keys(summary.by_zone),
      abc_codes: Object.keys(summary.by_abc_code)
    });
    
    // Test filtering
    console.log('\n3. Testing filters...');
    
    // Filter by zone A
    const zoneAInventory = loader.getInventory({ zone: 'A' });
    console.log(`Zone A inventory items: ${zoneAInventory.length}`);
    
    // Filter by level 1
    const level1Inventory = loader.getInventory({ level: '1' });
    console.log(`Level 1 inventory items: ${level1Inventory.length}`);
    
    // Filter by ABC code A
    const abcAInventory = loader.getInventory({ abc_code: 'A' });
    console.log(`ABC Code A inventory items: ${abcAInventory.length}`);
    
    // Test locations
    console.log('\n4. Testing locations...');
    const locations = loader.getLocations();
    console.log(`Total locations: ${locations.length}`);
    console.log('Sample locations:', locations.slice(0, 3).map(l => l.location_code));
    
    // Test products
    console.log('\n5. Testing products...');
    const products = loader.getProducts();
    console.log(`Total products: ${products.length}`);
    console.log('Sample products:', products.slice(0, 3).map(p => `${p.reference} (${p.abc_code})`));
    
    // Show sample inventory data
    console.log('\n6. Sample inventory data:');
    const sampleInventory = loader.getInventory({}).slice(0, 5);
    sampleInventory.forEach(inv => {
      console.log(`- ${inv.product_reference} at ${inv.location_code}: ${inv.quantity} units (${inv.product.abc_code} class)`);
    });
    
    console.log('\n✅ Real inventory data loading test completed successfully!');
    console.log('\nData Sources:');
    console.log('- Inventory: Class_Based_Storage.csv');
    console.log('- Locations: Storage_Location.csv');
    console.log('- Products: Product.csv');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
if (require.main === module) {
  testRealInventoryData();
}

module.exports = testRealInventoryData;