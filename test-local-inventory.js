// Test local inventory data loading without Firebase
const InventoryDataLoader = require('./services/inventory-data-loader');
const { setUseLocalDB } = require('./config/firebase');

async function testLocalInventory() {
  console.log('🔍 Testing local inventory data loading...\n');
  
  try {
    // Force use of local database
    setUseLocalDB(true);
    console.log('✅ Set to use local database\n');
    
    // Load real data from CSV
    console.log('1. Loading real data from CSV files...');
    const loader = new InventoryDataLoader();
    await loader.loadRealInventoryData();
    
    // Get inventory data
    console.log('\n2. Testing inventory queries...');
    const allInventory = loader.getInventory();
    console.log(`   Total inventory items: ${allInventory.length}`);
    
    // Test filtering by zone
    const zoneAInventory = loader.getInventory({ zone: 'A' });
    console.log(`   Zone A inventory: ${zoneAInventory.length} items`);
    
    // Test filtering by ABC code
    const abcAInventory = loader.getInventory({ abc_code: 'A' });
    console.log(`   ABC A products: ${abcAInventory.length} items`);
    
    // Test low stock filter
    const lowStockInventory = loader.getInventory({ low_stock: 'true' });
    console.log(`   Low stock items: ${lowStockInventory.length} items`);
    
    // Get summary
    console.log('\n3. Inventory summary:');
    const summary = loader.getInventorySummary();
    console.log(`   Total products: ${summary.total_products}`);
    console.log(`   Total locations: ${summary.total_locations}`);
    console.log(`   Total quantity: ${summary.total_quantity}`);
    console.log(`   Total reserved: ${summary.total_reserved}`);
    
    console.log('\n   By Zone:');
    Object.entries(summary.by_zone).forEach(([zone, data]) => {
      console.log(`     Zone ${zone}: ${data.total_items} items, ${data.total_quantity} units`);
    });
    
    console.log('\n   By ABC Code:');
    Object.entries(summary.by_abc_code).forEach(([abc, data]) => {
      console.log(`     ABC ${abc}: ${data.total_items} items, ${data.total_quantity} units`);
    });
    
    // Test location data
    console.log('\n4. Location data:');
    const locations = loader.getLocations();
    console.log(`   Total locations: ${locations.length}`);
    
    // Show sample locations by zone
    const locationsByZone = {};
    locations.forEach(loc => {
      if (!locationsByZone[loc.zone]) locationsByZone[loc.zone] = [];
      locationsByZone[loc.zone].push(loc);
    });
    
    Object.entries(locationsByZone).slice(0, 3).forEach(([zone, locs]) => {
      console.log(`     Zone ${zone}: ${locs.length} locations (e.g., ${locs[0].location_code})`);
    });
    
    // Test product data
    console.log('\n5. Product data:');
    const products = loader.getProducts();
    console.log(`   Total products: ${products.length}`);
    
    // Show sample products by ABC code
    const productsByAbc = {};
    products.forEach(prod => {
      if (!productsByAbc[prod.abc_code]) productsByAbc[prod.abc_code] = [];
      productsByAbc[prod.abc_code].push(prod);
    });
    
    Object.entries(productsByAbc).forEach(([abc, prods]) => {
      console.log(`     ABC ${abc}: ${prods.length} products (e.g., ${prods[0].reference})`);
    });
    
    console.log('\n✅ Local inventory data loading test completed successfully!');
    console.log('The system can work with local CSV data without Firebase.');
    
  } catch (error) {
    console.error('❌ Local inventory test failed:', error);
    throw error;
  }
}

// Run test
if (require.main === module) {
  testLocalInventory()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = testLocalInventory;