// Test script để kiểm tra luồng hệ thống và phát hiện lỗi
const puppeteer = require('puppeteer');

async function testSystemFlow() {
  let browser;
  
  try {
    console.log('🧪 Testing System Flow...');
    
    browser = await puppeteer.launch({ 
      headless: false,
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('❌ Console Error:', msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('❌ Page Error:', error.message);
    });
    
    // Test 1: Load main page
    console.log('\n1. Testing main page load...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Test 2: Login flow
    console.log('2. Testing login flow...');
    await page.waitForSelector('#username', { timeout: 5000 });
    await page.type('#username', 'admin');
    await page.type('#password', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForSelector('.dashboard-screen.active', { timeout: 10000 });
    console.log('✅ Login successful');
    
    // Test 3: Dashboard data loading
    console.log('3. Testing dashboard data...');
    await page.waitForTimeout(3000); // Wait for data to load
    
    const dashboardStats = await page.evaluate(() => {
      return {
        inventory: document.getElementById('stat-inventory')?.textContent || 'N/A',
        orders: document.getElementById('stat-orders')?.textContent || 'N/A',
        waves: document.getElementById('stat-waves')?.textContent || 'N/A',
        picks: document.getElementById('stat-picks')?.textContent || 'N/A'
      };
    });
    
    console.log('Dashboard Stats:', dashboardStats);
    
    // Test 4: Navigation
    console.log('4. Testing navigation...');
    const sections = ['inventory', 'orders', 'picking', 'warehouse'];
    
    for (const section of sections) {
      console.log(`Testing ${section} section...`);
      await page.click(`[data-section="${section}"]`);
      await page.waitForTimeout(2000);
      
      const isActive = await page.evaluate((sec) => {
        const element = document.getElementById(`${sec}-section`);
        return element && element.style.display !== 'none';
      }, section);
      
      if (isActive) {
        console.log(`✅ ${section} section loaded`);
      } else {
        console.log(`❌ ${section} section failed to load`);
      }
    }
    
    // Test 5: API calls
    console.log('5. Testing API calls...');
    const apiTests = [
      '/api/inventory',
      '/api/orders',
      '/api/waves',
      '/api/metrics/real-time'
    ];
    
    for (const endpoint of apiTests) {
      try {
        const response = await page.evaluate(async (url) => {
          const res = await fetch(url);
          return { status: res.status, ok: res.ok };
        }, endpoint);
        
        if (response.ok) {
          console.log(`✅ ${endpoint} - OK`);
        } else {
          console.log(`❌ ${endpoint} - Status: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint} - Error: ${error.message}`);
      }
    }
    
    // Test 6: Wave creation flow
    console.log('6. Testing wave creation...');
    await page.click('[data-section="picking"]');
    await page.waitForTimeout(2000);
    
    // Try to create a wave
    const createWaveButton = await page.$('button:contains("Create Wave")');
    if (createWaveButton) {
      await createWaveButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Wave creation modal opened');
    } else {
      console.log('❌ Create Wave button not found');
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`Total errors found: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors to fix:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    } else {
      console.log('✅ No critical errors found!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run if this file is executed directly
if (require.main === module) {
  testSystemFlow().catch(console.error);
}

module.exports = { testSystemFlow };