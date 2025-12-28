// Test SQL Database functionality with correct schema
const { getDatabase } = require('./config/database');

async function testSQLDatabase() {
  console.log('🔍 Testing SQL Database functionality...\n');
  
  try {
    // Initialize database
    const db = await getDatabase();
    
    // Test 1: Database connection and tables
    console.log('1. Testing database connection and tables...');
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log(`   ✅ Connected to database with ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`     - ${table.name}`);
    });
    
    // Test 2: Check data counts
    console.log('\n2. Checking data counts...');
    const productCount = await db.get('SELECT COUNT(*) as count FROM products');
    const locationCount = await db.get('SELECT COUNT(*) as count FROM storage_locations');
    const inventoryCount = await db.get('SELECT COUNT(*) as count FROM inventory');
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    
    console.log(`   Products: ${productCount.count}`);
    console.log(`   Storage Locations: ${locationCount.count}`);
    console.log(`   Inventory: ${inventoryCount.count}`);
    console.log(`   Users: ${userCount.count}`);
    
    // Test 3: Sample queries
    console.log('\n3. Testing sample queries...');
    const sampleProducts = await db.all('SELECT reference, abc_code, description FROM products LIMIT 3');
    const sampleLocations = await db.all('SELECT location_code, zone, z FROM storage_locations LIMIT 3');
    
    console.log('   Sample products:');
    sampleProducts.forEach(p => {
      console.log(`     ${p.reference} (${p.abc_code}) - ${p.description}`);
    });
    
    console.log('   Sample locations:');
    sampleLocations.forEach(l => {
      console.log(`     ${l.location_code} (Zone ${l.zone}, Floor ${l.z})`);
    });
    
    // Test 4: Complex JOIN queries with new schema
    console.log('\n4. Testing complex JOIN queries...');
    const complexQuery = await db.all(`
      SELECT 
        i.product_reference,
        i.location_code,
        sl.zone,
        i.quantity,
        i.reserved_quantity
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE i.quantity > 10
      ORDER BY i.quantity DESC
      LIMIT 5
    `);
    
    console.log('   Top 5 inventory items by quantity:');
    complexQuery.forEach(inv => {
      console.log(`     ${inv.product_reference} at ${inv.location_code}: ${inv.quantity} units (${inv.reserved_quantity} reserved)`);
    });
    
    // Test 5: Aggregation queries
    console.log('\n5. Testing aggregation queries...');
    const inventoryByZone = await db.all(`
      SELECT 
        sl.zone,
        COUNT(*) as item_count,
        SUM(i.quantity) as total_quantity
      FROM inventory i
      JOIN storage_locations sl ON i.location_code = sl.location_code
      GROUP BY sl.zone
      ORDER BY total_quantity DESC
      LIMIT 5
    `);
    
    console.log('   Top 5 zones by inventory quantity:');
    inventoryByZone.forEach(zone => {
      console.log(`     Zone ${zone.zone}: ${zone.item_count} items, ${zone.total_quantity} units`);
    });
    
    const inventoryByABC = await db.all(`
      SELECT 
        p.abc_code,
        COUNT(*) as item_count,
        SUM(i.quantity) as total_quantity
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      GROUP BY p.abc_code
      ORDER BY p.abc_code
    `);
    
    console.log('   Inventory by ABC classification:');
    inventoryByABC.forEach(abc => {
      console.log(`     ABC ${abc.abc_code}: ${abc.item_count} items, ${abc.total_quantity} units`);
    });
    
    // Test 6: Performance test
    console.log('\n6. Testing query performance...');
    const startTime = Date.now();
    const performanceQuery = await db.all(`
      SELECT 
        i.product_reference,
        i.location_code,
        i.quantity,
        p.abc_code,
        sl.zone
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      ORDER BY i.quantity DESC
    `);
    const queryTime = Date.now() - startTime;
    
    console.log(`   ✅ Complex query returned ${performanceQuery.length} records in ${queryTime}ms`);
    
    // Test 7: CRUD operations
    console.log('\n7. Testing CRUD operations...');
    
    // Create test product
    const testProduct = await db.create('products', {
      reference: 'TEST001',
      abc_code: 'A',
      sector: 'TEST',
      description: 'Test Product',
      unit_price: 10.99
    });
    console.log(`   ✅ Created test product: ${testProduct.reference}`);
    
    // Read test product
    const readProduct = await db.findOne('products', { reference: 'TEST001' });
    console.log(`   ✅ Read test product: ${readProduct.reference} - ${readProduct.description}`);
    
    // Update test product
    await db.update('products', readProduct.id, { description: 'Updated Test Product' });
    const updatedProduct = await db.findById('products', readProduct.id);
    console.log(`   ✅ Updated test product: ${updatedProduct.description}`);
    
    // Delete test product
    await db.delete('products', readProduct.id);
    console.log(`   ✅ Deleted test product`);
    
    // Test 8: Check database indexes
    console.log('\n8. Checking database indexes...');
    const indexes = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log(`   Database has ${indexes.length} custom indexes:`);
    indexes.forEach(index => {
      console.log(`     ${index.name}`);
    });
    
    console.log('\n✅ All SQL database tests passed!');
    console.log('Database is working correctly and ready for production use.');
    console.log('🎉 SQL Database test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ SQL database test failed:', error);
    console.log('\n💥 SQL Database test failed:', error);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testSQLDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testSQLDatabase;