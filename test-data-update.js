// Test script to verify metrics update when data changes
const fs = require('fs').promises;
const path = require('path');

async function testDataUpdate() {
  console.log('🧪 Testing data update and metrics recalculation...');
  
  // Read current inventory
  const inventoryPath = path.join(__dirname, 'data', 'inventory.json');
  const inventoryData = JSON.parse(await fs.readFile(inventoryPath, 'utf8'));
  
  console.log(`📊 Current inventory records: ${inventoryData.length}`);
  
  // Add a new inventory record
  const newRecord = {
    id: 'doc_test_' + Date.now(),
    product_id: inventoryData[0].product_id, // Use existing product
    location_id: inventoryData[0].location_id, // Use existing location
    quantity: 999, // Large quantity to see change
    reserved_quantity: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  inventoryData.push(newRecord);
  
  // Write updated data
  await fs.writeFile(inventoryPath, JSON.stringify(inventoryData, null, 2));
  console.log(`✅ Added new inventory record with quantity: ${newRecord.quantity}`);
  
  // Test API to see if metrics changed
  console.log('🔄 Testing API response...');
  
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  const loginResult = await response.json();
  const token = loginResult.token;
  
  if (token) {
    const inventoryResponse = await fetch('http://localhost:3000/api/inventory/summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const summary = await inventoryResponse.json();
    console.log('📈 Updated inventory summary:');
    console.log(`   - Total products: ${summary.total_products}`);
    console.log(`   - Total quantity: ${summary.total_quantity}`);
    console.log(`   - Total locations: ${summary.total_locations}`);
    
    // Test real-time metrics
    const metricsResponse = await fetch('http://localhost:3000/api/metrics/real-time');
    const metrics = await metricsResponse.json();
    
    if (metrics.success) {
      console.log('🎯 Real-time metrics:');
      console.log(`   - Total Products: ${metrics.data.totalProducts}`);
      console.log(`   - Space Utilization: ${metrics.data.spaceUtilization}%`);
      console.log(`   - Overall Efficiency: ${metrics.data.overallEfficiency}%`);
    }
  }
  
  console.log('✅ Test completed! Check dashboard to see if numbers updated.');
  console.log('🌐 Open: http://localhost:3000/ and login to see changes');
}

// Run test
testDataUpdate().catch(console.error);