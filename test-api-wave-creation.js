// Test Wave Creation via API
const http = require('http');

function apiRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testWaveCreation() {
  console.log('\n========================================');
  console.log('  Testing Wave Creation via API');
  console.log('========================================\n');

  try {
    // Step 0: Login
    console.log('Step 0: Authenticating...');
    const loginResponse = await apiRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const token = loginResponse.data.token;
    console.log(`  ✓ Logged in as ${loginResponse.data.user.username}`);
    
    // Step 1: Get pending orders with items
    console.log('\nStep 1: Getting pending orders with items...');
    // Get older orders which have items (page 654 = orders around ID 32635)
    const ordersResponse = await apiRequest('GET', '/api/orders?status=pending&limit=50&page=654', null, token);
    
    if (ordersResponse.status !== 200) {
      throw new Error(`Failed to get orders: ${ordersResponse.status}`);
    }
    
    const orders = ordersResponse.data.orders;
    console.log(`  ✓ Found ${orders.length} pending orders`);
    orders.forEach(o => {
      console.log(`    - ${o.order_number}: ${o.total_items || 0} items`);
    });

    if (orders.length === 0) {
      console.log('\n  ⚠️  No pending orders found. Cannot test wave creation.');
      return;
    }

    // Filter orders with items
    const ordersWithItems = orders.filter(o => (o.total_items || 0) > 0);
    if (ordersWithItems.length === 0) {
      console.log('\n  ⚠️  No orders with items found. Cannot test wave creation.');
      return;
    }

    // Step 2: Get waves (should be empty)
    console.log('\nStep 2: Checking existing waves...');
    const wavesResponse = await apiRequest('GET', '/api/waves', null, token);
    
    if (wavesResponse.status !== 200) {
      throw new Error(`Failed to get waves: ${wavesResponse.status}`);
    }
    
    console.log(`  ✓ Current waves: ${wavesResponse.data.waves.length}`);

    // Step 3: Create wave
    console.log('\nStep 3: Creating wave...');
    const orderIds = ordersWithItems.slice(0, 2).map(o => o.id);
    console.log(`  - Selected orders: ${orderIds.join(', ')}`);
    
    const createResponse = await apiRequest('POST', '/api/waves', {
      order_ids: orderIds,
      operator_id: 1,
      priority: 'normal'
    }, token);
    
    console.log(`  - Response status: ${createResponse.status}`);
    
    if (createResponse.status === 201) {
      console.log(`  ✓ Wave created successfully!`);
      console.log(`    - Wave Number: ${createResponse.data.wave_number}`);
      console.log(`    - Tasks Created: ${createResponse.data.tasks_created}`);
      console.log(`    - Orders Assigned: ${createResponse.data.orders_assigned}`);
      
      // Step 4: Verify wave was created
      console.log('\nStep 4: Verifying wave...');
      const verifyResponse = await apiRequest('GET', `/api/waves/${createResponse.data.wave_number}`, null, token);
      
      if (verifyResponse.status === 200) {
        const wave = verifyResponse.data.data.wave;
        const tasks = verifyResponse.data.data.tasks;
        console.log(`  ✓ Wave verified!`);
        console.log(`    - Status: ${wave.status}`);
        console.log(`    - Total Items: ${wave.total_items}`);
        console.log(`    - Total Quantity: ${wave.total_quantity}`);
        console.log(`    - Tasks: ${tasks.length}`);
      } else {
        console.log(`  ✗ Failed to verify wave: ${verifyResponse.status}`);
      }
      
    } else if (createResponse.status === 400) {
      console.log(`  ⚠️  Wave creation rejected (expected if insufficient inventory)`);
      console.log(`    - Error: ${createResponse.data.error}`);
      if (createResponse.data.inventory_issues) {
        console.log(`    - Inventory Issues: ${createResponse.data.inventory_issues.length}`);
        createResponse.data.inventory_issues.slice(0, 3).forEach(issue => {
          console.log(`      * ${issue.product_reference}: Need ${issue.required_quantity}, Available ${issue.available_quantity || 0}`);
        });
      }
    } else {
      console.log(`  ✗ Unexpected response: ${createResponse.status}`);
      console.log(JSON.stringify(createResponse.data, null, 2));
    }

    // Step 5: Check inventory reservation
    console.log('\nStep 5: Checking inventory reservations...');
    const inventoryResponse = await apiRequest('GET', '/api/inventory?limit=5', null, token);
    
    if (inventoryResponse.status === 200) {
      const items = inventoryResponse.data.inventory.slice(0, 5);
      console.log(`  ✓ Inventory status:`);
      items.forEach(item => {
        const reserved = item.reserved_quantity || 0;
        const available = item.quantity - reserved;
        console.log(`    - ${item.product_reference} at ${item.location_code}: ${item.quantity} total, ${reserved} reserved, ${available} available`);
      });
    }

    console.log('\n========================================');
    console.log('  Test Complete');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Wait for server to be ready
setTimeout(() => {
  testWaveCreation();
}, 1000);
