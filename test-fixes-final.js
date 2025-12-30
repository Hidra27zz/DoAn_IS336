// Test final fixes - SQL ambiguous column and alerts
const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:3000/api';
let authToken = null;

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function login() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  const result = await response.json();
  if (result.token) {
    authToken = result.token;
    console.log('✅ Login successful');
    return true;
  }
  console.error('❌ Login failed:', result);
  return false;
}

async function testWavesQuery() {
  console.log('\n=== Testing Waves Query (SQL ambiguous column fix) ===');
  
  const response = await fetch(`${API_BASE}/waves?status=in_progress&limit=5`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  const result = await response.json();
  
  if (response.ok) {
    console.log('✅ Waves query successful');
    console.log(`   Found ${result.waves?.length || 0} waves`);
    console.log(`   Total: ${result.pagination?.total || 0}`);
  } else {
    console.error('❌ Waves query failed:', result.error);
  }
  
  return response.ok;
}

async function testAlertsSummary() {
  console.log('\n=== Testing Alerts Summary ===');
  
  const response = await fetch(`${API_BASE}/alerts/summary`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  const result = await response.json();
  
  if (response.ok && result.success) {
    console.log('✅ Alerts summary successful');
    console.log('   Alerts:', result.alerts);
    console.log(`   Total alerts: ${result.total_alerts}`);
  } else {
    console.error('❌ Alerts summary failed:', result.error);
  }
  
  return response.ok;
}

async function testDelayedOrders() {
  console.log('\n=== Testing Delayed Orders ===');
  
  const response = await fetch(`${API_BASE}/alerts/delayed-orders?threshold_hours=24`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  const result = await response.json();
  
  if (response.ok && result.success) {
    console.log('✅ Delayed orders query successful');
    console.log(`   Total delayed: ${result.total_delayed}`);
    console.log('   Severity:', result.severity);
    if (result.orders.length > 0) {
      console.log(`   First order: ${result.orders[0].order_number} (${result.orders[0].hours_waiting}h)`);
    }
  } else {
    console.error('❌ Delayed orders failed:', result.error);
  }
  
  return response.ok;
}

async function runTests() {
  console.log('Starting tests...\n');
  
  if (!await login()) {
    console.error('Cannot proceed without authentication');
    process.exit(1);
  }
  
  const results = {
    wavesQuery: await testWavesQuery(),
    alertsSummary: await testAlertsSummary(),
    delayedOrders: await testDelayedOrders()
  };
  
  console.log('\n=== Test Results ===');
  console.log('Waves Query:', results.wavesQuery ? '✅ PASS' : '❌ FAIL');
  console.log('Alerts Summary:', results.alertsSummary ? '✅ PASS' : '❌ FAIL');
  console.log('Delayed Orders:', results.delayedOrders ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '✅ All tests passed!' : '❌ Some tests failed'));
  
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
