// Script để sửa các lỗi hệ thống
const fs = require('fs');
const path = require('path');

async function fixSystemIssues() {
  console.log('🔧 Fixing System Issues...');
  
  const fixes = [];
  
  // 1. Check and fix missing error handling
  console.log('\n1. Checking error handling...');
  
  try {
    const appJsContent = fs.readFileSync('public/app.js', 'utf8');
    
    // Check for alert() usage (should use showToast)
    const alertMatches = appJsContent.match(/alert\(/g);
    if (alertMatches && alertMatches.length > 0) {
      fixes.push(`Found ${alertMatches.length} alert() calls that should use showToast()`);
    }
    
    // Check for console.error without proper handling
    const errorMatches = appJsContent.match(/console\.error\(/g);
    if (errorMatches) {
      console.log(`✅ Found ${errorMatches.length} console.error calls - good for debugging`);
    }
    
  } catch (error) {
    fixes.push(`Error reading app.js: ${error.message}`);
  }
  
  // 2. Check database connection
  console.log('\n2. Checking database...');
  
  try {
    const { getDatabase } = require('./config/database');
    const db = await getDatabase();
    
    // Test critical tables
    const tables = ['products', 'orders', 'inventory', 'storage_locations', 'picking_tasks', 'users'];
    
    for (const table of tables) {
      try {
        const result = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Table ${table}: ${result.count} records`);
      } catch (error) {
        fixes.push(`Database table ${table} issue: ${error.message}`);
      }
    }
    
  } catch (error) {
    fixes.push(`Database connection issue: ${error.message}`);
  }
  
  // 3. Check API endpoints
  console.log('\n3. Checking API endpoints...');
  
  const criticalEndpoints = [
    '/api/inventory',
    '/api/orders', 
    '/api/waves',
    '/api/operators',
    '/api/warehouse/layout'
  ];
  
  for (const endpoint of criticalEndpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        headers: {
          'Authorization': 'Bearer test-token' // This will fail but we check if endpoint exists
        }
      });
      
      if (response.status === 401) {
        console.log(`✅ ${endpoint} - Protected (401 expected)`);
      } else if (response.status === 200) {
        console.log(`✅ ${endpoint} - Accessible`);
      } else {
        fixes.push(`Endpoint ${endpoint} returned unexpected status: ${response.status}`);
      }
    } catch (error) {
      fixes.push(`Endpoint ${endpoint} connection failed: ${error.message}`);
    }
  }
  
  // 4. Check file permissions and structure
  console.log('\n4. Checking file structure...');
  
  const requiredFiles = [
    'server.js',
    'public/index.html',
    'public/app.js',
    'public/styles.css',
    'config/database.js',
    'routes/auth.js',
    'routes/inventory.js',
    'routes/orders.js',
    'routes/waves.js',
    'routes/picking.js'
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      fixes.push(`Missing required file: ${file}`);
    } else {
      console.log(`✅ ${file} exists`);
    }
  }
  
  // 5. Check for common JavaScript errors
  console.log('\n5. Checking for common JS errors...');
  
  try {
    const appJs = fs.readFileSync('public/app.js', 'utf8');
    
    // Check for undefined variables
    const undefinedChecks = [
      'typeof Chart !== \'undefined\'',
      'authToken !== null',
      'currentUser !== null'
    ];
    
    for (const check of undefinedChecks) {
      if (appJs.includes(check)) {
        console.log(`✅ Found proper undefined check: ${check}`);
      }
    }
    
    // Check for proper error boundaries
    const tryBlocks = appJs.match(/try\s*{/g);
    const catchBlocks = appJs.match(/catch\s*\(/g);
    
    if (tryBlocks && catchBlocks && tryBlocks.length === catchBlocks.length) {
      console.log(`✅ Try-catch blocks balanced: ${tryBlocks.length} pairs`);
    } else {
      fixes.push('Unbalanced try-catch blocks detected');
    }
    
  } catch (error) {
    fixes.push(`Error analyzing JavaScript: ${error.message}`);
  }
  
  // 6. Performance checks
  console.log('\n6. Performance checks...');
  
  try {
    const stats = fs.statSync('warehouse.db');
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Database size: ${sizeInMB} MB`);
    
    if (stats.size > 100 * 1024 * 1024) { // 100MB
      fixes.push('Database size is large, consider optimization');
    }
    
  } catch (error) {
    fixes.push(`Error checking database size: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Fix Summary:');
  
  if (fixes.length === 0) {
    console.log('🎉 No critical issues found! System is healthy.');
  } else {
    console.log(`❌ Found ${fixes.length} issues to address:`);
    fixes.forEach((fix, index) => {
      console.log(`${index + 1}. ${fix}`);
    });
  }
  
  // Auto-fix some issues
  console.log('\n🔧 Auto-fixing issues...');
  
  let autoFixed = 0;
  
  // Fix 1: Replace remaining alert() with showToast()
  try {
    let appJsContent = fs.readFileSync('public/app.js', 'utf8');
    const originalAlerts = (appJsContent.match(/alert\(/g) || []).length;
    
    if (originalAlerts > 0) {
      // Replace simple alert calls
      appJsContent = appJsContent.replace(
        /alert\('([^']+)'\);/g, 
        "showToast('$1', 'info');"
      );
      appJsContent = appJsContent.replace(
        /alert\("([^"]+)"\);/g, 
        "showToast('$1', 'info');"
      );
      
      const newAlerts = (appJsContent.match(/alert\(/g) || []).length;
      
      if (newAlerts < originalAlerts) {
        fs.writeFileSync('public/app.js', appJsContent);
        console.log(`✅ Fixed ${originalAlerts - newAlerts} alert() calls`);
        autoFixed++;
      }
    }
    
  } catch (error) {
    console.log(`❌ Could not auto-fix alerts: ${error.message}`);
  }
  
  console.log(`\n🎯 Auto-fixed ${autoFixed} issues`);
  console.log('🚀 System check complete!');
}

// Run the fix
fixSystemIssues().catch(console.error);