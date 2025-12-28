// Test script to verify dashboard charts functionality
const puppeteer = require('puppeteer');

async function testDashboardCharts() {
  console.log('Starting dashboard charts test...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // Set to true for headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });
    
    // Enable error logging
    page.on('pageerror', error => {
      console.error(`[PAGE ERROR] ${error.message}`);
    });
    
    console.log('Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    console.log('Attempting login...');
    
    // Wait for login form
    await page.waitForSelector('#login-form', { timeout: 5000 });
    
    // Fill login form
    await page.type('#username', 'admin');
    await page.type('#password', 'admin123');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    console.log('Waiting for dashboard to load...');
    
    // Wait for dashboard to appear
    await page.waitForSelector('#dashboard-screen.active', { timeout: 10000 });
    
    console.log('Dashboard loaded successfully');
    
    // Wait for charts to be created
    await page.waitForTimeout(3000);
    
    console.log('Checking chart elements...');
    
    // Check if chart canvases exist
    const inventoryChart = await page.$('#inventory-chart');
    const ordersChart = await page.$('#orders-chart');
    
    console.log('Inventory chart element:', !!inventoryChart);
    console.log('Orders chart element:', !!ordersChart);
    
    // Check if Chart.js is loaded
    const chartJsLoaded = await page.evaluate(() => {
      return typeof Chart !== 'undefined';
    });
    
    console.log('Chart.js loaded:', chartJsLoaded);
    
    // Check if charts are actually rendered
    const chartsRendered = await page.evaluate(() => {
      const inventoryCanvas = document.getElementById('inventory-chart');
      const ordersCanvas = document.getElementById('orders-chart');
      
      return {
        inventoryExists: !!inventoryCanvas,
        ordersExists: !!ordersCanvas,
        inventoryHasChart: inventoryCanvas && inventoryCanvas.chart,
        ordersHasChart: ordersCanvas && ordersCanvas.chart,
        globalCharts: typeof window.charts !== 'undefined' ? Object.keys(window.charts) : []
      };
    });
    
    console.log('Charts rendered status:', chartsRendered);
    
    // Get dashboard stats
    const stats = await page.evaluate(() => {
      return {
        inventory: document.getElementById('stat-inventory')?.textContent,
        orders: document.getElementById('stat-orders')?.textContent,
        waves: document.getElementById('stat-waves')?.textContent,
        picks: document.getElementById('stat-picks')?.textContent
      };
    });
    
    console.log('Dashboard stats:', stats);
    
    // Test API endpoints directly from browser
    const apiTest = await page.evaluate(async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        const inventoryResponse = await fetch('/api/inventory/summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const inventoryData = await inventoryResponse.json();
        
        const ordersResponse = await fetch('/api/orders/stats/summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const ordersData = await ordersResponse.json();
        
        return {
          inventorySuccess: inventoryResponse.ok,
          ordersSuccess: ordersResponse.ok,
          inventoryZones: inventoryData.by_zone ? Object.keys(inventoryData.by_zone).length : 0,
          ordersPending: ordersData.pending || 0
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('API test results:', apiTest);
    
    // Take a screenshot
    await page.screenshot({ path: 'dashboard-test.png', fullPage: true });
    console.log('Screenshot saved as dashboard-test.png');
    
    // Test chart creation manually
    const manualChartTest = await page.evaluate(async () => {
      try {
        // Get fresh data
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/inventory/summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        // Try to create a chart manually
        const canvas = document.getElementById('inventory-chart');
        if (canvas && data.by_zone) {
          const zones = Object.keys(data.by_zone);
          const quantities = zones.map(z => data.by_zone[z].total_quantity);
          
          const chart = new Chart(canvas, {
            type: 'bar',
            data: {
              labels: zones.map(z => `Zone ${z}`),
              datasets: [{
                label: 'Quantity',
                data: quantities,
                backgroundColor: '#2563eb'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false
            }
          });
          
          return {
            success: true,
            zones: zones.length,
            totalQuantity: quantities.reduce((a, b) => a + b, 0)
          };
        }
        
        return { success: false, reason: 'Canvas or data not available' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Manual chart test:', manualChartTest);
    
    console.log('Test completed successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
if (require.main === module) {
  testDashboardCharts().catch(console.error);
}

module.exports = testDashboardCharts;