// Test Storage Config API
const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = http.request(reqOptions, (res) => {
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
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function test() {
  console.log('=== Testing Storage Config API ===\n');
  
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✅ Login successful\n');
  
  // 1. Get current config
  console.log('1. GET /api/storage-config');
  const getRes = await fetch('http://localhost:3000/api/storage-config', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const config = await getRes.json();
  console.log('Current config:', JSON.stringify(config, null, 2));
  console.log('');
  
  // 2. Update ABC config
  console.log('2. POST /api/storage-config/abc');
  const abcRes = await fetch('http://localhost:3000/api/storage-config/abc', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      class_a_threshold: 75,
      class_b_threshold: 90
    })
  });
  const abcResult = await abcRes.json();
  console.log('ABC update result:', abcResult);
  console.log('');
  
  // 3. Update storage strategy
  console.log('3. POST /api/storage-config/strategy');
  const strategyRes = await fetch('http://localhost:3000/api/storage-config/strategy', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      strategy_type: 'hybrid'
    })
  });
  const strategyResult = await strategyRes.json();
  console.log('Strategy update result:', strategyResult);
  console.log('');
  
  // 4. Update zone config
  console.log('4. POST /api/storage-config/zones');
  const zonesRes = await fetch('http://localhost:3000/api/storage-config/zones', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      high_frequency_zones: ['A', 'B'],
      low_frequency_zones: ['E', 'F']
    })
  });
  const zonesResult = await zonesRes.json();
  console.log('Zones update result:', zonesResult);
  console.log('');
  
  // 5. Apply configuration
  console.log('5. POST /api/storage-config/apply');
  const applyRes = await fetch('http://localhost:3000/api/storage-config/apply', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const applyResult = await applyRes.json();
  console.log('Apply result:', JSON.stringify(applyResult, null, 2));
  console.log('');
  
  // 6. Get updated config
  console.log('6. GET /api/storage-config (after updates)');
  const getRes2 = await fetch('http://localhost:3000/api/storage-config', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const config2 = await getRes2.json();
  console.log('Updated config:', JSON.stringify(config2, null, 2));
  
  console.log('\n✅ All tests completed!');
}

test().catch(console.error);
