// Test All 4 Fixes - Comprehensive Verification
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Simple fetch replacement
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 3000,
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
          status: res.statusCode,
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

// Login
async function login() {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const data = await response.json();
    if (data.success) {
      authToken = data.token;
      log('✅ Login successful', 'green');
      return true;
    }
  } catch (error) {
    log(`❌ Login failed: ${error.message}`, 'red');
  }
  return false;
}

// Test 1: Warehouse Report API
async function testWarehouseReport() {
  log('\n========================================', 'cyan');
  log('TEST 1: WAREHOUSE REPORT API', 'cyan');
  log('========================================', 'cyan');
  
  try {
    const response = await fetch(`${BASE_URL}/api/warehouse/report`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
      log(`❌ API returned ${response.status}`, 'red');
      return false;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      log('❌ Response success = false', 'red');
      return false;
    }
    
    log('\n📊 Storage Stats:', 'blue');
    log(`   Total Locations: ${data.data.storage.total_locations}`, 'yellow');
    log(`   Total Capacity: ${data.data.storage.total_capacity}`, 'yellow');
    log(`   Total Occupancy: ${data.data.storage.total_occupancy}`, 'yellow');
    log(`   Utilization: ${data.data.storage.utilization}%`, 'yellow');
    
    log('\n📊 Zone Breakdown:', 'blue');
    log(`   Total Zones: ${data.data.zones.length}`, 'yellow');
    
    log('\n📊 Order Stats:', 'blue');
    log(`   Total Orders: ${data.data.orders.total_orders}`, 'yellow');
    log(`   Pending: ${data.data.orders.pending}`, 'yellow');
    log(`   In Progress: ${data.data.orders.in_progress}`, 'yellow');
    log(`   Completed: ${data.data.orders.completed}`, 'yellow');
    
    log('\n📊 Picking Stats:', 'blue');
    log(`   Total Picks: ${data.data.picking.total_picks}`, 'yellow');
    log(`   Total Quantity: ${data.data.picking.total_quantity}`, 'yellow');
    log(`   Avg Time: ${data.data.picking.avg_time} minutes`, 'yellow');
    
    // Validation
    if (data.data.storage.total_locations === 2292) {
      log('\n✅ TEST 1 PASSED: Warehouse report shows correct data (2,292 locations)', 'green');
      return true;
    } else {
      log(`\n❌ TEST 1 FAILED: Expected 2,292 locations, got ${data.data.storage.total_locations}`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`\n❌ TEST 1 FAILED: ${error.message}`, 'red');
    return false;
  }
}

// Test 2: Wave Details with Operator and Product Names
async function testWaveDetails() {
  log('\n========================================', 'cyan');
  log('TEST 2: WAVE DETAILS (Operator & Product)', 'cyan');
  log('========================================', 'cyan');
  
  try {
    // Get first wave
    const wavesResponse = await fetch(`${BASE_URL}/api/waves?limit=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const wavesData = await wavesResponse.json();
    
    if (!wavesData.waves || wavesData.waves.length === 0) {
      log('❌ No waves found', 'red');
      return false;
    }
    
    const waveNumber = wavesData.waves[0].wave_number;
    log(`\n🔍 Testing wave: ${waveNumber}`, 'blue');
    
    // Get wave details
    const response = await fetch(`${BASE_URL}/api/waves/${waveNumber}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) {
      log(`❌ API returned ${response.status}`, 'red');
      return false;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      log('❌ Response success = false', 'red');
      return false;
    }
    
    log('\n📊 Wave Info:', 'blue');
    log(`   Wave Number: ${data.data.wave.wave_number}`, 'yellow');
    log(`   Operator ID: ${data.data.wave.operator_id}`, 'yellow');
    log(`   Operator Name: ${data.data.wave.operator_name}`, 'yellow');
    log(`   Status: ${data.data.wave.status}`, 'yellow');
    
    log('\n📊 Stats:', 'blue');
    log(`   Total Items: ${data.data.stats.total_items}`, 'yellow');
    log(`   Total Quantity: ${data.data.stats.total_quantity}`, 'yellow');
    log(`   Estimated Time: ${data.data.stats.estimated_time} minutes`, 'yellow');
    
    if (data.data.tasks.length > 0) {
      const firstTask = data.data.tasks[0];
      log('\n📊 First Task:', 'blue');
      log(`   Product Ref: ${firstTask.product_reference}`, 'yellow');
      log(`   Product Name: ${firstTask.product_name || 'undefined'}`, 'yellow');
      log(`   Operator Name: ${firstTask.operator_name || 'undefined'}`, 'yellow');
      log(`   Location: ${firstTask.location_code}`, 'yellow');
      log(`   Zone: ${firstTask.zone}`, 'yellow');
      
      // Validation
      if (firstTask.product_name && firstTask.product_name !== 'undefined' && 
          data.data.stats.estimated_time > 0) {
        log('\n✅ TEST 2 PASSED: Wave details show operator name, product name, and estimated time', 'green');
        return true;
      } else {
        log('\n❌ TEST 2 FAILED: Missing product name or estimated time', 'red');
        return false;
      }
    } else {
      log('\n❌ TEST 2 FAILED: No tasks found in wave', 'red');
      return false;
    }
    
  } catch (error) {
    log(`\n❌ TEST 2 FAILED: ${error.message}`, 'red');
    return false;
  }
}

// Test 3: Reports Data (Storage Utilization & Operator Performance)
async function testReportsData() {
  log('\n========================================', 'cyan');
  log('TEST 3: REPORTS DATA', 'cyan');
  log('========================================', 'cyan');
  
  try {
    // Test Storage Utilization Report
    log('\n📊 Testing Storage Utilization Report...', 'blue');
    const storageResponse = await fetch(`${BASE_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        report_type: 'storage_utilization',
        filters: {}
      })
    });
    
    const storageData = await storageResponse.json();
    
    if (!storageData.success) {
      log('❌ Storage report generation failed', 'red');
      return false;
    }
    
    log(`   Report ID: ${storageData.report_id}`, 'yellow');
    
    // Wait for report to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Download report
    const downloadResponse = await fetch(`${BASE_URL}/api/reports/download/${storageData.report_id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const reportData = await downloadResponse.json();
    
    if (reportData.success && reportData.data) {
      log('\n📊 Storage Utilization Report:', 'blue');
      log(`   Total Zones: ${reportData.data.summary.total_zones}`, 'yellow');
      log(`   Total Locations: ${reportData.data.summary.total_locations}`, 'yellow');
      log(`   Total Capacity: ${reportData.data.summary.total_capacity}`, 'yellow');
      log(`   Total Occupancy: ${reportData.data.summary.total_occupancy}`, 'yellow');
      log(`   Overall Utilization: ${reportData.data.summary.overall_utilization}%`, 'yellow');
      
      if (reportData.data.summary.total_locations === 2292) {
        log('\n✅ TEST 3A PASSED: Storage report shows correct data (2,292 locations)', 'green');
      } else {
        log(`\n❌ TEST 3A FAILED: Expected 2,292 locations, got ${reportData.data.summary.total_locations}`, 'red');
        return false;
      }
    }
    
    // Test Operator Performance Report
    log('\n📊 Testing Operator Performance Report...', 'blue');
    const operatorResponse = await fetch(`${BASE_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        report_type: 'operator_performance',
        filters: {}
      })
    });
    
    const operatorData = await operatorResponse.json();
    
    if (!operatorData.success) {
      log('❌ Operator report generation failed', 'red');
      return false;
    }
    
    log(`   Report ID: ${operatorData.report_id}`, 'yellow');
    
    // Wait for report to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Download report
    const operatorDownloadResponse = await fetch(`${BASE_URL}/api/reports/download/${operatorData.report_id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const operatorReportData = await operatorDownloadResponse.json();
    
    if (operatorReportData.success && operatorReportData.data) {
      log('\n📊 Operator Performance Report:', 'blue');
      log(`   Total Operators: ${operatorReportData.data.summary.total_operators}`, 'yellow');
      log(`   Total Picks: ${operatorReportData.data.summary.total_picks}`, 'yellow');
      log(`   Total Quantity: ${operatorReportData.data.summary.total_quantity}`, 'yellow');
      log(`   Avg Pick Time: ${operatorReportData.data.summary.avg_pick_time} minutes`, 'yellow');
      
      if (operatorReportData.data.summary.total_picks > 0) {
        log('\n✅ TEST 3B PASSED: Operator report shows real data', 'green');
        return true;
      } else {
        log('\n❌ TEST 3B FAILED: No picks found in operator report', 'red');
        return false;
      }
    }
    
    return false;
    
  } catch (error) {
    log(`\n❌ TEST 3 FAILED: ${error.message}`, 'red');
    return false;
  }
}

// Test 4: AI Widget Loading
async function testAIWidget() {
  log('\n========================================', 'cyan');
  log('TEST 4: AI WIDGET LOADING', 'cyan');
  log('========================================', 'cyan');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}/api/ai/optimization/comprehensive`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    log(`\n⏱️  Response Time: ${responseTime}ms`, 'blue');
    
    if (!response.ok) {
      log(`❌ API returned ${response.status}`, 'red');
      return false;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      log('❌ Response success = false', 'red');
      return false;
    }
    
    log('\n📊 AI Analysis:', 'blue');
    log(`   AI Confidence: ${data.data.ai_confidence_score}%`, 'yellow');
    
    const recs = data.data.comprehensive_recommendations?.recommendations || [];
    log(`   Total Recommendations: ${recs.length}`, 'yellow');
    
    const criticalCount = recs.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH').length;
    log(`   High Priority: ${criticalCount}`, 'yellow');
    
    if (recs.length > 0) {
      log('\n📊 Top Recommendations:', 'blue');
      recs.slice(0, 3).forEach((rec, i) => {
        log(`   ${i + 1}. [${rec.priority}] ${rec.title || rec.type}`, 'yellow');
      });
    }
    
    // Validation
    if (responseTime < 10000) {
      log('\n✅ TEST 4 PASSED: AI widget loads within 10 seconds', 'green');
      return true;
    } else {
      log(`\n❌ TEST 4 FAILED: Response took ${responseTime}ms (> 10000ms)`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`\n❌ TEST 4 FAILED: ${error.message}`, 'red');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   COMPREHENSIVE FIX VERIFICATION TEST  ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  
  const loggedIn = await login();
  if (!loggedIn) {
    log('\n❌ Cannot proceed without login', 'red');
    return;
  }
  
  const results = {
    test1: await testWarehouseReport(),
    test2: await testWaveDetails(),
    test3: await testReportsData(),
    test4: await testAIWidget()
  };
  
  // Summary
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║           TEST SUMMARY                 ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  
  log(`\nTest 1 (Warehouse Report):     ${results.test1 ? '✅ PASSED' : '❌ FAILED'}`, results.test1 ? 'green' : 'red');
  log(`Test 2 (Wave Details):         ${results.test2 ? '✅ PASSED' : '❌ FAILED'}`, results.test2 ? 'green' : 'red');
  log(`Test 3 (Reports Data):         ${results.test3 ? '✅ PASSED' : '❌ FAILED'}`, results.test3 ? 'green' : 'red');
  log(`Test 4 (AI Widget):            ${results.test4 ? '✅ PASSED' : '❌ FAILED'}`, results.test4 ? 'green' : 'red');
  
  const passedCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.keys(results).length;
  
  log(`\n📊 Overall: ${passedCount}/${totalCount} tests passed`, passedCount === totalCount ? 'green' : 'yellow');
  
  if (passedCount === totalCount) {
    log('\n🎉 ALL FIXES VERIFIED SUCCESSFULLY!', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the output above.', 'yellow');
  }
}

// Start tests
runAllTests().catch(error => {
  log(`\n❌ Test execution failed: ${error.message}`, 'red');
  console.error(error);
});
