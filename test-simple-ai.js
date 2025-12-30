// Test Simple AI APIs
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
  console.log('=== Testing Simple AI APIs ===\n');
  
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login successful\n');
  
  // 1. Get AI stats
  console.log('1. GET /api/ai/stats');
  const statsRes = await fetch('http://localhost:3000/api/ai/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stats = await statsRes.json();
  console.log(JSON.stringify(stats, null, 2));
  console.log('');
  
  // 2. Run K-Means
  console.log('2. POST /api/ai/kmeans');
  const kmeansRes = await fetch('http://localhost:3000/api/ai/kmeans', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const kmeans = await kmeansRes.json();
  console.log('K-Means Result:');
  console.log(`- Products analyzed: ${kmeans.products_analyzed}`);
  console.log(`- Clusters: ${kmeans.clusters}`);
  console.log(`- Distribution:`, kmeans.cluster_distribution);
  console.log(`- Recommendations:`, kmeans.recommendations);
  console.log('');
  
  // 3. Run DBSCAN
  console.log('3. POST /api/ai/dbscan');
  const dbscanRes = await fetch('http://localhost:3000/api/ai/dbscan', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const dbscan = await dbscanRes.json();
  console.log('DBSCAN Result:');
  console.log(`- Locations checked: ${dbscan.total_locations_checked}`);
  console.log(`- Anomalies found: ${dbscan.anomalies_found}`);
  console.log(`- Critical issues: ${dbscan.critical_issues}`);
  console.log(`- Anomaly types:`, dbscan.anomaly_types);
  console.log('');
  
  // 4. Demand Forecast
  console.log('4. POST /api/ai/demand-forecast');
  const forecastRes = await fetch('http://localhost:3000/api/ai/demand-forecast', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ days: 30 })
  });
  const forecast = await forecastRes.json();
  console.log('Demand Forecast Result:');
  console.log(`- Products forecasted: ${forecast.products_forecasted}`);
  console.log(`- Total forecasted demand: ${forecast.total_forecasted_demand}`);
  console.log(`- Average confidence: ${forecast.average_confidence}%`);
  console.log(`- Top 3 products:`, forecast.top_products.slice(0, 3).map(p => 
    `${p.product} (${p.forecasted_demand} units)`
  ));
  console.log('');
  
  // 5. Route Optimization (need a wave)
  console.log('5. POST /api/ai/route-optimization');
  const wavesRes = await fetch('http://localhost:3000/api/waves?limit=1', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const wavesData = await wavesRes.json();
  
  if (wavesData.waves && wavesData.waves.length > 0) {
    const waveNumber = wavesData.waves[0].wave_number;
    const routeRes = await fetch('http://localhost:3000/api/ai/route-optimization', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ wave_number: waveNumber })
    });
    const route = await routeRes.json();
    
    if (route.success) {
      console.log('Route Optimization Result:');
      console.log(`- Wave: ${route.wave_number}`);
      console.log(`- Total picks: ${route.total_picks}`);
      console.log(`- Manual route: ${route.manual_route.distance_meters}m (${route.manual_route.estimated_time_minutes} min)`);
      console.log(`- Optimized route: ${route.optimized_route.distance_meters}m (${route.optimized_route.estimated_time_minutes} min)`);
      console.log(`- Improvement: ${route.improvement.improvement_percentage}% (saved ${route.improvement.distance_saved_meters}m, ${route.improvement.time_saved_minutes} min)`);
    } else {
      console.log('Route optimization failed:', route.error);
    }
  } else {
    console.log('No waves available for route optimization');
  }
  
  console.log('\nAll AI tests completed!');
}

test().catch(console.error);
