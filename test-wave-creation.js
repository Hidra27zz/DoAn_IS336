// Test script để kiểm tra chức năng tạo wave
async function testWaveCreation() {
  console.log('🧪 Testing Wave Creation...');
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // 1. Login first
    console.log('\n1. Logging in...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error('Login failed');
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful');
    
    // 2. Get pending orders
    console.log('\n2. Getting pending orders...');
    const ordersResponse = await fetch(`${baseUrl}/api/orders?status=pending&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!ordersResponse.ok) {
      throw new Error('Failed to get orders');
    }
    
    const ordersData = await ordersResponse.json();
    console.log(`✅ Found ${ordersData.orders?.length || 0} pending orders`);
    
    if (!ordersData.orders || ordersData.orders.length === 0) {
      console.log('❌ No pending orders found for testing');
      return;
    }
    
    // 3. Test wave creation
    console.log('\n3. Creating test wave...');
    const orderIds = ordersData.orders.slice(0, 3).map(o => o.id); // Take first 3 orders
    
    const waveData = {
      order_ids: orderIds,
      operator_id: 17, // Admin user ID
      priority: 'normal',
      notes: 'Test wave creation'
    };
    
    console.log('Wave data:', waveData);
    
    const waveResponse = await fetch(`${baseUrl}/api/waves`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(waveData)
    });
    
    const waveResult = await waveResponse.json();
    
    if (waveResponse.ok && waveResult.success) {
      console.log('✅ Wave created successfully!');
      console.log(`   Wave Number: ${waveResult.wave_number}`);
      console.log(`   Tasks Created: ${waveResult.tasks_created}`);
      console.log(`   Orders Assigned: ${waveResult.orders_assigned}`);
      console.log(`   Estimated Time: ${waveResult.estimated_time_minutes} minutes`);
      console.log(`   Unique Locations: ${waveResult.unique_locations}`);
      console.log(`   Zones Involved: ${waveResult.zones_involved}`);
      
      if (waveResult.inventory_issues_fixed > 0) {
        console.log(`   🔧 Inventory Issues Fixed: ${waveResult.inventory_issues_fixed}`);
      }
      
      // 4. Verify wave was created
      console.log('\n4. Verifying wave creation...');
      const verifyResponse = await fetch(`${baseUrl}/api/waves/${waveResult.wave_number}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        console.log('✅ Wave verification successful');
        console.log(`   Wave Status: ${verifyData.wave?.status}`);
        console.log(`   Total Tasks: ${verifyData.tasks?.length || 0}`);
        
        // Show sample tasks
        if (verifyData.tasks && verifyData.tasks.length > 0) {
          console.log('\n📋 Sample tasks:');
          verifyData.tasks.slice(0, 3).forEach((task, index) => {
            console.log(`   ${index + 1}. ${task.product_reference} at ${task.location_code} (${task.quantity_to_pick} units)`);
          });
        }
      } else {
        console.log('❌ Wave verification failed');
      }
      
    } else {
      console.log('❌ Wave creation failed');
      console.log('Error:', waveResult.error);
      
      if (waveResult.inventory_issues) {
        console.log('\n📦 Inventory Issues:');
        waveResult.inventory_issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.product_reference}: ${issue.issue}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n🏁 Wave creation test completed');
}

// Run test
testWaveCreation().catch(console.error);