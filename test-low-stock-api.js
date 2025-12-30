// Test low stock API
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
  // Login first
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  
  // Get low stock
  const res = await fetch('http://localhost:3000/api/alerts/low-stock?threshold=10', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await res.json();
  
  console.log('Low Stock API Response:');
  console.log('Success:', data.success);
  console.log('Total items:', data.total_items);
  console.log('First 3 items:');
  data.items.slice(0, 3).forEach((item, i) => {
    console.log(`\n${i+1}. ${item.product_reference}`);
    console.log('   Description:', item.description);
    console.log('   ABC:', item.abc_code);
    console.log('   Available:', item.available);
    console.log('   Locations:', item.location_count);
  });
}

test().catch(console.error);
