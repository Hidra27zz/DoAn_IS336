// Simple system test without puppeteer
const http = require('http');
const fs = require('fs');

async function testSystemEndpoints() {
  console.log('🧪 Testing System Endpoints...');
  
  const baseUrl = 'http://localhost:3000';
  
  // Test endpoints
  const endpoints = [
    '/',
    '/api/auth/login',
    '/api/inventory',
    '/api/orders', 
    '/api/waves',
    '/api/operators',
    '/api/warehouse/layout',
    '/api/metrics/real-time'
  ];
  
  console.log('\n1. Testing endpoint availability...');
  
  for (const endpoint of endpoints) {
    try {
      const url = `${baseUrl}${endpoint}`;
      const response = await fetch(url);
      
      if (response.ok || response.status === 401) { // 401 is expected for protected routes
        console.log(`✅ ${endpoint} - Available (${response.status})`);
      } else {
        console.log(`❌ ${endpoint} - Error (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Connection failed: ${error.message}`);
    }
  }
  
  console.log('\n2. Testing login flow...');
  
  try {
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
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Login successful');
      
      // Test authenticated endpoint
      const token = loginData.token;
      const inventoryResponse = await fetch(`${baseUrl}/api/inventory`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (inventoryResponse.ok) {
        console.log('✅ Authenticated API call successful');
      } else {
        console.log('❌ Authenticated API call failed');
      }
      
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.log(`❌ Login test failed: ${error.message}`);
  }
  
  console.log('\n3. Testing database connection...');
  
  try {
    const { getDatabase } = require('./config/database');
    const db = await getDatabase();
    
    // Test simple query
    const result = await db.get('SELECT COUNT(*) as count FROM products');
    console.log(`✅ Database connected - Products count: ${result.count}`);
    
    // Test other tables
    const tables = ['orders', 'inventory', 'storage_locations', 'picking_tasks'];
    for (const table of tables) {
      try {
        const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Table ${table}: ${count.count} records`);
      } catch (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Database test failed: ${error.message}`);
  }
  
  console.log('\n4. Testing file structure...');
  
  const requiredFiles = [
    'server.js',
    'public/index.html',
    'public/app.js',
    'public/styles.css',
    'warehouse.db',
    'config/database.js'
  ];
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} - Exists`);
    } else {
      console.log(`❌ ${file} - Missing`);
    }
  }
  
  console.log('\n📊 System Test Complete!');
}

// Run test
testSystemEndpoints().catch(console.error);