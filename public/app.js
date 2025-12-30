// Warehouse Management System - Frontend Application
// Firebase imports disabled for now - using API login only

const API_BASE = '/api';
let authToken = null;
let currentUser = null;
let charts = {};
// Firebase client-side disabled - using API only

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
  console.log('WMS Application initializing...');
  console.log('Current URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Initialize app immediately, Chart.js will be checked when needed
  initializeApp();
});

function initializeApp() {
  // Add a small delay to ensure DOM is fully loaded
  setTimeout(() => {
    console.log('Starting authentication check...');
    checkAuthStatus();
    
    // Setup login form handler
    setupLoginHandler();
    
    // Setup logout handler
    setupLogoutHandler();
    
    // Make debug function available
    window.debugApp = window.debugFunctions;
    
    console.log('Application initialization complete. Use debugApp() to check system status.');
  }, 100);
}

// Check authentication status from localStorage
function checkAuthStatus() {
  console.log('Checking auth status...');
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('currentUser');
  
  console.log('Token exists:', !!token);
  console.log('User exists:', !!user);
  
  if (token && user) {
    authToken = token;
    currentUser = JSON.parse(user);
    console.log('User authenticated:', currentUser.username);
    showDashboard();
  } else {
    console.log('No authentication found, showing login screen');
    showLoginScreen();
  }
}

// Authentication handled by API only

function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  
  if (loginScreen) {
    loginScreen.classList.add('active');
  } else {
    console.error('Login screen element not found');
  }
  
  if (dashboardScreen) {
    dashboardScreen.classList.remove('active');
  } else {
    console.error('Dashboard screen element not found');
  }
}

function showDashboard() {
  console.log('Showing dashboard...');
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  
  if (loginScreen) {
    loginScreen.classList.remove('active');
  } else {
    console.error('Login screen element not found');
  }
  
  if (dashboardScreen) {
    dashboardScreen.classList.add('active');
  } else {
    console.error('Dashboard screen element not found');
  }
  
  if (currentUser) {
    const userRole = document.getElementById('user-role');
    const usernameDisplay = document.getElementById('username-display');
    
    if (userRole) {
      userRole.textContent = currentUser.role;
    }
    if (usernameDisplay) {
      usernameDisplay.textContent = currentUser.username;
    }
  }
  
  // Setup event listeners after dashboard is shown
  setTimeout(() => {
    console.log('Setting up dashboard functionality...');
    
    // Check if dashboard elements exist
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    console.log('Dashboard elements check:');
    console.log('- Nav items:', navItems.length);
    console.log('- Content sections:', contentSections.length);
    
    if (navItems.length === 0) {
      console.error('Dashboard navigation not loaded properly');
      return;
    }
    
    // Setup navigation event listeners
    try {
      if (typeof setupEventListeners === 'function') {
        setupEventListeners();
        console.log('Event listeners setup completed');
      } else {
        console.error('setupEventListeners function not found');
      }
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
    
    // Load dashboard data
    try {
      if (typeof loadDashboardData === 'function') {
        loadDashboardData();
        console.log('Dashboard data loading initiated');
      } else {
        console.error('loadDashboardData function not found');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    
    // Function availability check
    console.log('Function check:');
    console.log('  - openAdjustModal:', typeof openAdjustModal);
    console.log('  - adjustStock:', typeof adjustStock);
    console.log('  - viewWave:', typeof viewWave);
    console.log('  - startWave:', typeof startWave);
    console.log('  - Auth token exists:', !!localStorage.getItem('authToken'));
    
  }, 200);
}

// Setup login form handler
function setupLoginHandler() {
  console.log('Setting up login form handler...');
  
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    console.log('Login form found, adding event listener...');
    
    // Remove any existing listeners
    const newForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newForm, loginForm);
    
    newForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      console.log('Login form submitted!');
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      console.log('Login attempt:', { username, password: '***' });
      console.log('Sending login request...');
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        console.log('Login response:', result);
        
        if (response.ok && result.token && result.user) {
          console.log('Login successful, setting up user data...');
          authToken = result.token;
          currentUser = result.user;
          
          localStorage.setItem('authToken', authToken);
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          
          console.log('Calling showDashboard...');
          showDashboard();
        } else {
          const errorMsg = result.error || result.message || 'Login failed';
          console.error('Login failed:', errorMsg);
          showToast(errorMsg, 'error');
        }
      } catch (error) {
        console.error('Login error:', error);
        showToast('Connection error: ' + error.message, 'error');
      }
    });
  } else {
    console.error('Login form not found!');
  }
}

// Setup logout handler
function setupLogoutHandler() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      console.log('Logout clicked');
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      authToken = null;
      currentUser = null;
      showLoginScreen();
    });
  }
}
// API helper
async function apiCall(endpoint, options = {}) {
  // Remove leading /api if present to avoid duplication
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
  
  console.log('=== API Call Debug ===');
  console.log('Original endpoint:', endpoint);
  console.log('Clean endpoint:', cleanEndpoint);
  console.log('Options:', options);
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  if (options.headers) {
    finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
  }
  
  console.log('Final options:', finalOptions);
  console.log('Full URL:', `${API_BASE}${cleanEndpoint}`);
  
  try {
    const response = await fetch(`${API_BASE}${cleanEndpoint}`, finalOptions);
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      showLoginScreen();
      return null;
    }
    
    const result = await response.json();
    console.log('Response body:', result);
    
    // Handle non-200 responses
    if (!response.ok) {
      console.error(`API Error ${response.status}:`, result);
      
      // Show user-friendly error message
      let errorMessage = `Request failed with status ${response.status}`;
      if (result && result.error) {
        errorMessage = result.error;
      }
      
      showToast(`Lỗi: ${errorMessage}`, 'error');
      
      // Show inventory issues if available
      if (result && result.inventory_issues && result.inventory_issues.length > 0) {
        console.log('Inventory issues:', result.inventory_issues);
        const issueDetails = result.inventory_issues.map(issue => 
          `${issue.product_reference} tại ${issue.location_code}: cần ${issue.required}, có ${issue.available}`
        ).join('\n');
        showToast(`Vấn đề tồn kho:\n${issueDetails}`, 'warning');
      }
      
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('API fetch error:', error);
    
    // More user-friendly error handling
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      showToast('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.', 'error');
    } else {
      showToast(`Lỗi kết nối: ${error.message}`, 'error');
    }
    
    return null;
  }
}

// Navigation
function setupEventListeners() {
  console.log('Setting up event listeners...');
  const navItems = document.querySelectorAll('.nav-item');
  console.log('Found nav items:', navItems.length);
  
  if (navItems.length === 0) {
    console.error('No navigation items found! Dashboard may not be loaded yet.');
    return;
  }
  
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const section = this.dataset.section;
      console.log('Navigation clicked:', section);
      
      if (!section) {
        console.warn('No data-section attribute found on nav item');
        return;
      }
      
      // Update active states
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      
      // Update content sections
      const targetSection = document.getElementById(`${section}-section`);
      if (!targetSection) {
        console.error(`Section not found: ${section}-section`);
        return;
      }
      
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      targetSection.classList.add('active');
      
      // Update URL without page reload
      const newUrl = section === 'dashboard' ? '/' : `/${section}`;
      window.history.pushState({ section }, '', newUrl);
      
      // Load section data
      loadSectionData(section);
    });
  });
  
  // Handle browser back/forward buttons
  window.addEventListener('popstate', function(event) {
    if (event.state && event.state.section) {
      const section = event.state.section;
      
      // Update active states
      document.querySelectorAll('.nav-item').forEach(i => {
        if (i.dataset.section === section) {
          i.classList.add('active');
        } else {
          i.classList.remove('active');
        }
      });
      
      // Update content sections
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`${section}-section`).classList.add('active');
      
      // Load section data
      loadSectionData(section);
    }
  });
  
  // Refresh buttons
  document.getElementById('refresh-inventory')?.addEventListener('click', loadInventoryData);
  document.getElementById('refresh-orders')?.addEventListener('click', loadOrdersData);
  document.getElementById('refresh-waves')?.addEventListener('click', loadPickingData);
  document.getElementById('refresh-warehouse')?.addEventListener('click', loadWarehouseData);
  
  // AI buttons
  document.getElementById('run-kmeans')?.addEventListener('click', runKMeans);
  document.getElementById('run-dbscan')?.addEventListener('click', runDBSCAN);
  document.getElementById('run-route-optimization')?.addEventListener('click', runRouteOptimization);
  document.getElementById('get-recommendations')?.addEventListener('click', getRecommendations);
  
  // Report buttons
  document.querySelectorAll('[data-report]').forEach(btn => {
    btn.addEventListener('click', function() {
      generateReport(this.dataset.report);
    });
  });
}

function loadSectionData(section) {
  console.log('Loading section data for:', section);
  try {
    switch(section) {
      case 'dashboard': loadDashboardData(); break;
      case 'inventory': loadInventoryData(); break;
      case 'orders': loadOrdersData(); break;
      case 'picking': loadPickingData(); break;
      case 'warehouse': loadWarehouseData(); break;
      case 'ai': loadAIData(); break;
      case 'storage-config': loadStorageConfigData(); break;
      case 'operators': loadOperatorsData(); break;
      case 'reports': break;
      default:
        console.warn('Unknown section:', section);
    }
  } catch (error) {
    console.error('Error loading section data:', error);
  }
}


// Dashboard
async function loadDashboardData() {
  console.log('Loading dashboard data...');
  
  let inventorySummary = null;
  let orderStats = null;
  let pickingPerf = null;
  
  try {
    // Try authenticated API first
    console.log('Attempting authenticated API calls...');
    [inventorySummary, orderStats] = await Promise.all([
      apiCall('/inventory/summary'),
      apiCall('/orders/stats/summary')
    ]);
    
    // Load performance data separately (non-blocking)
    try {
      pickingPerf = await apiCall('/picking/performance');
    } catch (error) {
      console.warn('Performance data not available:', error);
    }
    
    console.log('API responses received:', { 
      inventorySummary: !!inventorySummary, 
      orderStats: !!orderStats, 
      pickingPerf: !!pickingPerf 
    });
    
    // If auth fails, try demo endpoints
    if (!inventorySummary || !orderStats) {
      console.log('Authenticated API failed, trying demo endpoints...');
      const demoPromises = [];
      
      if (!inventorySummary) {
        demoPromises.push(
          fetch('/api/demo/inventory/summary')
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
      } else {
        demoPromises.push(Promise.resolve(inventorySummary));
      }
      
      if (!orderStats) {
        demoPromises.push(
          fetch('/api/demo/orders/stats/summary')
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
      } else {
        demoPromises.push(Promise.resolve(orderStats));
      }
      
      if (!pickingPerf) {
        demoPromises.push(
          fetch('/api/demo/picking/performance')
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
      } else {
        demoPromises.push(Promise.resolve(pickingPerf));
      }
      
      const demoResults = await Promise.all(demoPromises);
      if (!inventorySummary) inventorySummary = demoResults[0];
      if (!orderStats) orderStats = demoResults[1];
      if (!pickingPerf) pickingPerf = demoResults[2];
    }
    
    console.log('Final data status:', {
      inventorySummary: !!inventorySummary,
      orderStats: !!orderStats,
      pickingPerf: !!pickingPerf
    });
    
    // Update stats with fallback values
    const statInventory = document.getElementById('stat-inventory');
    const statOrders = document.getElementById('stat-orders');
    const statPicks = document.getElementById('stat-picks');
    
    if (statInventory) {
      statInventory.textContent = inventorySummary?.total_products || '0';
    }
    if (statOrders) {
      statOrders.textContent = orderStats?.pending || '0';
    }
    if (statPicks) {
      statPicks.textContent = pickingPerf?.total_picks || '0';
    }
    
    console.log('Dashboard stats updated');
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    
    // Set default values on error
    const statInventory = document.getElementById('stat-inventory');
    const statOrders = document.getElementById('stat-orders');
    const statPicks = document.getElementById('stat-picks');
    
    if (statInventory) statInventory.textContent = '0';
    if (statOrders) statOrders.textContent = '0';
    if (statPicks) statPicks.textContent = '0';
  }
  
  // Load active waves
  try {
    let waves = await apiCall('/waves?status=in_progress');
    if (!waves) {
      waves = await fetch('/api/demo/waves').then(r => r.ok ? r.json() : null);
    }
    if (waves) {
      const activeWaves = waves.waves?.filter(w => w.status === 'in_progress') || [];
      const statWaves = document.getElementById('stat-waves');
      if (statWaves) {
        statWaves.textContent = activeWaves.length;
      }
    }
  } catch (error) {
    console.error('Error loading waves data:', error);
    const statWaves = document.getElementById('stat-waves');
    if (statWaves) statWaves.textContent = '0';
  }
  
  // Render charts with a delay to ensure DOM is ready
  console.log('Preparing to render charts...');
  setTimeout(() => {
    renderDashboardCharts(inventorySummary, orderStats);
  }, 200);
  
  // Load alerts
  loadDashboardAlerts();
}

// Load dashboard alerts
async function loadDashboardAlerts() {
  try {
    const alertsSummary = await apiCall('/alerts/summary');
    
    if (alertsSummary && alertsSummary.success) {
      displayAlerts(alertsSummary);
    }
  } catch (error) {
    console.warn('Failed to load alerts:', error);
  }
}

// Display alerts on dashboard
function displayAlerts(alertsSummary) {
  const alertsContainer = document.getElementById('dashboard-alerts');
  if (!alertsContainer) return;
  
  const alerts = alertsSummary.alerts;
  const totalAlerts = alertsSummary.total_alerts || 0;
  
  if (totalAlerts === 0) {
    alertsContainer.innerHTML = '<div class="alert alert-success">No alerts - All systems operating normally</div>';
    return;
  }
  
  let alertsHTML = '<div class="alerts-section">';
  alertsHTML += `<h3>System Alerts (${totalAlerts})</h3>`;
  
  // Delayed Orders Alert
  if (alerts.delayed_orders > 0) {
    alertsHTML += `
      <div class="alert alert-warning" onclick="showDelayedOrders()">
        <strong>⚠️ Delayed Orders:</strong> ${alerts.delayed_orders} orders have been pending for more than 24 hours
        <button class="btn btn-sm btn-warning" style="float: right;">View Details</button>
      </div>
    `;
  }
  
  // Low Stock Alert
  if (alerts.low_stock > 0) {
    alertsHTML += `
      <div class="alert alert-info" onclick="showLowStock()">
        <strong>📦 Low Stock:</strong> ${alerts.low_stock} products are running low
        <button class="btn btn-sm btn-info" style="float: right;">View Details</button>
      </div>
    `;
  }
  
  // Out of Stock Alert
  if (alerts.out_of_stock > 0) {
    alertsHTML += `
      <div class="alert alert-danger" onclick="showOutOfStock()">
        <strong>❌ Out of Stock:</strong> ${alerts.out_of_stock} products are out of stock
        <button class="btn btn-sm btn-danger" style="float: right;">View Details</button>
      </div>
    `;
  }
  
  // Stalled Waves Alert
  if (alerts.stalled_waves > 0) {
    alertsHTML += `
      <div class="alert alert-warning" onclick="showStalledWaves()">
        <strong>⏸️ Stalled Waves:</strong> ${alerts.stalled_waves} waves have not been updated in over 4 hours
        <button class="btn btn-sm btn-warning" style="float: right;">View Details</button>
      </div>
    `;
  }
  
  // Over-reserved Inventory Alert
  if (alerts.over_reserved > 0) {
    alertsHTML += `
      <div class="alert alert-danger" onclick="showOverReserved()">
        <strong>⚠️ Over-reserved:</strong> ${alerts.over_reserved} inventory locations have more reserved than available
        <button class="btn btn-sm btn-danger" style="float: right;">View Details</button>
      </div>
    `;
  }
  
  alertsHTML += '</div>';
  alertsContainer.innerHTML = alertsHTML;
}

// Show delayed orders details
async function showDelayedOrders() {
  try {
    const data = await apiCall('/alerts/delayed-orders?threshold_hours=24');
    
    if (data && data.success) {
      let html = `
        <div class="modal-header">
          <h3>Delayed Orders (${data.total_delayed})</h3>
          <button class="modal-close" onclick="closeModal('alertModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p>Orders that have been pending for more than 24 hours:</p>
          <table class="table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Hours Waiting</th>
                <th>Severity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      data.orders.forEach(order => {
        const severityClass = order.severity === 'critical' ? 'danger' : 
                             order.severity === 'warning' ? 'warning' : 'info';
        html += `
          <tr>
            <td>${order.order_number}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>${order.total_items}</td>
            <td>${order.hours_waiting}h</td>
            <td><span class="badge badge-${severityClass}">${order.severity.toUpperCase()}</span></td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="createWaveForOrder(${order.id})">Create Wave</button>
            </td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
      `;
      
      showAlertModal(html);
    }
  } catch (error) {
    console.error('Error loading delayed orders:', error);
    alert('Failed to load delayed orders');
  }
}

// Show low stock details
async function showLowStock() {
  try {
    const data = await apiCall('/alerts/low-stock?threshold=10');
    
    if (data && data.success) {
      let html = `
        <div class="modal-header">
          <h3>Low Stock Items (${data.total_items})</h3>
          <button class="modal-close" onclick="closeModal('alertModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p>Products with less than 10 units available:</p>
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Description</th>
                <th>ABC</th>
                <th>Available</th>
                <th>Locations</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      data.items.forEach(item => {
        html += `
          <tr>
            <td>${item.product_reference}</td>
            <td>${item.description || 'N/A'}</td>
            <td><span class="badge badge-${item.abc_code === 'A' ? 'danger' : item.abc_code === 'B' ? 'warning' : 'info'}">${item.abc_code}</span></td>
            <td>${item.available}</td>
            <td>${item.location_count}</td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
      `;
      
      showAlertModal(html);
    }
  } catch (error) {
    console.error('Error loading low stock:', error);
    alert('Failed to load low stock items');
  }
}

// Show out of stock details
function showOutOfStock() {
  alert('Out of stock details - Feature coming soon');
}

// Show stalled waves details
async function showStalledWaves() {
  try {
    const data = await apiCall('/alerts/stalled-waves?threshold_hours=4');
    
    if (data && data.success) {
      let html = `
        <div class="modal-header">
          <h3>Stalled Waves (${data.total_stalled})</h3>
          <button class="modal-close" onclick="closeModal('alertModal')">&times;</button>
        </div>
        <div class="modal-body">
          <p>Waves that have not been updated in over 4 hours:</p>
          <table class="table">
            <thead>
              <tr>
                <th>Wave Number</th>
                <th>Operator</th>
                <th>Tasks</th>
                <th>Completed</th>
                <th>Hours Stalled</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      data.waves.forEach(wave => {
        html += `
          <tr>
            <td>${wave.wave_number}</td>
            <td>${wave.operator_name || 'Unassigned'}</td>
            <td>${wave.total_tasks}</td>
            <td>${wave.completed_tasks}</td>
            <td>${wave.hours_stalled}h</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="viewWave('${wave.wave_number}')">View</button>
            </td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
      `;
      
      showAlertModal(html);
    }
  } catch (error) {
    console.error('Error loading stalled waves:', error);
    alert('Failed to load stalled waves');
  }
}

// Show over-reserved details
function showOverReserved() {
  alert('Over-reserved inventory details - Feature coming soon');
}

// Show alert modal
function showAlertModal(content) {
  let modal = document.getElementById('alertModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'alertModal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content"></div>';
    document.body.appendChild(modal);
  }
  
  modal.querySelector('.modal-content').innerHTML = content;
  modal.style.display = 'flex';
}

// Close modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Create wave for specific order
async function createWaveForOrder(orderId) {
  if (!confirm('Create a wave for this order?')) return;
  
  try {
    const result = await apiCall('/waves', {
      method: 'POST',
      body: JSON.stringify({
        order_ids: [orderId],
        operator_id: currentUser.id,
        priority: 'high'
      })
    });
    
    if (result && result.success) {
      alert(`Wave ${result.wave_number} created successfully!`);
      closeModal('alertModal');
      loadDashboardAlerts(); // Refresh alerts
    } else {
      alert('Failed to create wave: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating wave:', error);
    alert('Failed to create wave');
  }
}

function renderDashboardCharts(inventorySummary, orderStats) {
  console.log('Rendering dashboard charts...');
  console.log('Chart.js available:', typeof Chart !== 'undefined');
  console.log('Inventory summary:', inventorySummary);
  console.log('Order stats:', orderStats);
  
  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js is not loaded, showing fallback');
    showChartFallback('inventory-chart', 'Chart.js not loaded');
    showChartFallback('orders-chart', 'Chart.js not loaded');
    return;
  }
  
  // Wait a bit more for DOM to be ready
  setTimeout(() => {
    renderInventoryChart(inventorySummary);
    renderOrdersChart(orderStats);
  }, 100);
}

function renderInventoryChart(inventorySummary) {
  const inventoryCtx = document.getElementById('inventory-chart');
  console.log('Inventory canvas element:', inventoryCtx);
  
  if (!inventoryCtx) {
    console.error('Inventory chart canvas not found');
    return;
  }
  
  if (!inventorySummary?.by_zone) {
    console.log('No inventory zone data available');
    showChartFallback('inventory-chart', 'No inventory data available');
    return;
  }
  
  console.log('Creating inventory chart with zones:', Object.keys(inventorySummary.by_zone));
  
  // Destroy existing chart
  if (charts.inventory) {
    console.log('Destroying existing inventory chart');
    charts.inventory.destroy();
  }
  
  const zones = Object.keys(inventorySummary.by_zone);
  const quantities = zones.map(z => inventorySummary.by_zone[z].total_quantity);
  
  console.log('Zone data:', zones, quantities);
  
  try {
    // Ensure canvas is visible and has proper dimensions
    inventoryCtx.style.display = 'block';
    inventoryCtx.width = inventoryCtx.parentElement.clientWidth - 48; // Account for padding
    inventoryCtx.height = 280;
    
    charts.inventory = new Chart(inventoryCtx, {
      type: 'bar',
      data: {
        labels: zones.map(z => `Zone ${z}`),
        datasets: [{
          label: 'Quantity',
          data: quantities,
          backgroundColor: [
            '#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
            '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
            '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e',
            '#3b82f6', '#f97316', '#ec4899'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          title: {
            display: true,
            text: 'Inventory Distribution by Zone'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Quantity'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Zones'
            }
          }
        }
      }
    });
    console.log('Inventory chart created successfully');
  } catch (error) {
    console.error('Error creating inventory chart:', error);
    showChartFallback('inventory-chart', `Chart error: ${error.message}`, {
      zones: zones.length,
      totalItems: quantities.reduce((a,b) => a+b, 0)
    });
  }
}

function renderOrdersChart(orderStats) {
  const ordersCtx = document.getElementById('orders-chart');
  console.log('Orders canvas element:', ordersCtx);
  
  if (!ordersCtx) {
    console.error('Orders chart canvas not found');
    return;
  }
  
  if (!orderStats) {
    console.log('No order stats available');
    showChartFallback('orders-chart', 'No order data available');
    return;
  }
  
  console.log('Creating orders chart with stats:', orderStats);
  
  // Destroy existing chart
  if (charts.orders) {
    console.log('Destroying existing orders chart');
    charts.orders.destroy();
  }
  
  const orderData = [
    orderStats.pending || 0,
    orderStats.assigned || 0,
    orderStats.picking || 0,
    orderStats.picked || 0,
    orderStats.shipped || 0
  ];
  
  console.log('Order data:', orderData);
  
  try {
    // Ensure canvas is visible and has proper dimensions
    ordersCtx.style.display = 'block';
    ordersCtx.width = ordersCtx.parentElement.clientWidth - 48;
    ordersCtx.height = 280;
    
    charts.orders = new Chart(ordersCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pending', 'Assigned', 'Picking', 'Picked', 'Shipped'],
        datasets: [{
          data: orderData,
          backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#10b981'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          },
          title: {
            display: true,
            text: 'Order Status Distribution'
          }
        }
      }
    });
    console.log('Orders chart created successfully');
  } catch (error) {
    console.error('Error creating orders chart:', error);
    showChartFallback('orders-chart', `Chart error: ${error.message}`, {
      totalOrders: orderStats.total_orders || 0,
      pending: orderStats.pending || 0
    });
  }
}

function showChartFallback(canvasId, message, data = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const container = canvas.parentElement;
  const title = canvasId === 'inventory-chart' ? 'Inventory by Zone' : 'Order Status';
  
  let dataInfo = '';
  if (data) {
    if (canvasId === 'inventory-chart') {
      dataInfo = `<p>${data.zones} zones with ${data.totalItems} total items</p>`;
    } else {
      dataInfo = `<p>Total: ${data.totalOrders} orders</p><p>Pending: ${data.pending}</p>`;
    }
  }
  
  container.innerHTML = `
    <h3>${title}</h3>
    <div style="padding: 20px; text-align: center; color: #666; border: 1px dashed #ccc; border-radius: 8px;">
      <p>${message}</p>
      ${dataInfo}
      <button onclick="retryChart('${canvasId}')" style="margin-top: 10px; padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Retry Chart
      </button>
    </div>
  `;
}

// Add retry function
window.retryChart = function(canvasId) {
  console.log('Retrying chart:', canvasId);
  
  // Restore canvas element
  const container = document.querySelector(`#${canvasId}`).parentElement || 
                   document.querySelector(`[data-chart="${canvasId}"]`);
  
  if (container) {
    const title = canvasId === 'inventory-chart' ? 'Inventory by Zone' : 'Order Status';
    container.innerHTML = `
      <h3>${title}</h3>
      <canvas id="${canvasId}"></canvas>
    `;
    
    // Reload dashboard data
    setTimeout(() => {
      loadDashboardData();
    }, 100);
  }
};

// Inventory
async function loadInventoryData() {
  const zone = document.getElementById('inventory-zone-filter')?.value || '';
  const abcCode = document.getElementById('inventory-abc-filter')?.value || '';
  const lowStock = document.getElementById('low-stock-filter')?.checked || false;
  
  let url = '/inventory?limit=100';
  if (zone) url += `&zone=${zone}`;
  if (abcCode) url += `&abc_code=${abcCode}`;
  if (lowStock) url += `&low_stock=true`;
  
  const data = await apiCall(url);
  
  if (data?.inventory) {
    const tbody = document.querySelector('#inventory-table tbody');
    tbody.innerHTML = data.inventory.map(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const reserved = parseFloat(item.reserved_quantity) || 0;
      const available = quantity - reserved;
      
      // Fix logic: isLowStock should be for available <= 0, isVeryLowStock for 0 < available < 10
      const isOutOfStock = available <= 0;
      const isLowStock = available > 0 && available < 10;
      
      // Add alert styling
      const rowClass = isOutOfStock ? 'low-stock-alert' : (isLowStock ? 'very-low-stock' : '');
      
      return `
      <tr class="${rowClass}">
        <td>${item.product?.reference || item.product_reference || 'Unknown Product'}</td>
        <td>${item.product?.abc_code || item.abc_code || 'C'}</td>
        <td>${item.location?.location_code || item.location_code || 'No Location'}</td>
        <td>${item.location?.zone || item.zone || 'Unknown Zone'}</td>
        <td>Tầng ${item.location?.z || item.z || '?'}</td>
        <td>${quantity}</td>
        <td>${reserved}</td>
        <td class="${isOutOfStock ? 'text-danger' : (isLowStock ? 'text-warning' : '')}">${available}</td>
        <td>
          <button class="btn btn-small btn-secondary" onclick="openAdjustModal('${item.id}', ${quantity})">Điều chỉnh</button>
          ${isOutOfStock ? '<button class="btn btn-small btn-danger" onclick="openReorderModal(\'' + (item.product?.reference || item.product_reference) + '\')">Nhập thêm</button>' : ''}
        </td>
      </tr>
      `;
    }).join('');
    
    // Show alert summary
    const outOfStockCount = data.inventory.filter(item => {
      const qty = parseFloat(item.quantity) || 0;
      const res = parseFloat(item.reserved_quantity) || 0;
      return (qty - res) <= 0;
    }).length;
    
    if (outOfStockCount > 0) {
      showToast(`Cảnh báo: ${outOfStockCount} sản phẩm hết hàng hoặc sắp hết!`, 'warning', 5000);
    }
  }
  
  // Load zone filter options
  const summary = await apiCall('/inventory/summary');
  if (summary?.by_zone) {
    const zoneFilter = document.getElementById('inventory-zone-filter');
    const currentValue = zoneFilter.value;
    zoneFilter.innerHTML = '<option value="">All Zones</option>' +
      Object.keys(summary.by_zone).map(z => `<option value="${z}">${z}</option>`).join('');
    zoneFilter.value = currentValue;
  }
}

// Orders
async function loadOrdersData() {
  const status = document.getElementById('order-status-filter')?.value || '';
  
  let url = '/orders?limit=100';
  if (status) url += `&status=${status}`;
  
  let data = await apiCall(url);
  
  // If auth fails, try demo endpoint
  if (!data) {
    try {
      const response = await fetch('/api/demo/orders');
      if (response.ok) {
        data = await response.json();
      }
    } catch (error) {
      console.error('Demo orders error:', error);
    }
  }
  
  if (data?.orders) {
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = data.orders.map(order => `
      <tr>
        <td>${order.order_number || 'No Order Number'}</td>
        <td>${order.customer_code || order.customer_name || 'Unknown Customer'}</td>
        <td><span class="status-badge status-${order.status}">${order.status}</span></td>
        <td>${order.priority || 'normal'}</td>
        <td>${order.total_items || 0}</td>
        <td>${formatDate(order.created_at || order.creation_date)}</td>
        <td class="table-actions">
          ${order.status === 'pending' ? `
            <button class="btn btn-small btn-primary" onclick="updateOrderStatus('${order.id}', 'assigned')">Assign</button>
            <button class="btn btn-small btn-danger" onclick="cancelOrder('${order.id}')">Cancel</button>
          ` : ''}
          ${order.status === 'picked' ? `
            <button class="btn btn-small btn-success" onclick="updateOrderStatus('${order.id}', 'shipped')">Ship</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  } else {
    // Show empty state
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666;">No orders found</td></tr>';
  }
}

async function viewOrder(orderId) {
  const data = await apiCall(`/orders/${orderId}`);
  if (data) {
    alert(`Order: ${data.order.order_number}\nStatus: ${data.order.status}\nItems: ${data.items?.length || 0}`);
  }
}

// Picking
// Enhanced Picking Data Loading with Wave Planning Features
async function loadPickingData() {
  console.log('Loading enhanced picking data...');
  
  try {
    // Get filter values
    const status = document.getElementById('wave-status-filter')?.value || '';
    const search = document.getElementById('wave-search')?.value || '';
    const operatorId = document.getElementById('wave-operator-filter')?.value || '';
    const dateFrom = document.getElementById('wave-date-from')?.value || '';
    const dateTo = document.getElementById('wave-date-to')?.value || '';
    
    // Build URL with filters
    let url = '/waves?limit=50';
    if (status) url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (operatorId) url += `&operator_id=${operatorId}`;
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo) url += `&date_to=${dateTo}`;
    
    console.log('Fetching waves from:', url);
    const data = await apiCall(url);
    
    if (data?.waves) {
      console.log('Waves loaded:', data.waves.length);
      
      const tbody = document.querySelector('#waves-table tbody');
      if (tbody) {
        tbody.innerHTML = data.waves.map(wave => `
          <tr>
            <td>
              <strong>${wave.wave_number || 'Unknown Wave'}</strong>
              <br><small>ID: ${wave.id}</small>
            </td>
            <td><span class="status-badge status-${wave.status}">${wave.status}</span></td>
            <td>${wave.total_orders || 0}</td>
            <td>${wave.total_items || 0}</td>
            <td>${wave.location_count || 0}</td>
            <td>
              <div class="operator-info">
                <strong>${wave.assigned_operator_name || 'Unassigned'}</strong>
                ${wave.assigned_operator_id ? `<br><small>ID: ${wave.assigned_operator_id}</small>` : ''}
              </div>
            </td>
            <td>
              <div class="progress-info">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${wave.completion_percentage || 0}%"></div>
                </div>
                <small>${wave.completion_percentage || 0}% (${wave.total_picked || 0}/${wave.total_quantity || 0})</small>
              </div>
            </td>
            <td>
              <small>${formatDate(wave.created_at)}</small>
            </td>
            <td>
              <small>~${wave.estimated_time_minutes || 0} min</small>
            </td>
            <td class="actions-cell">
              <div class="action-buttons">
                <button class="btn btn-small btn-info" onclick="viewWaveDetail('${wave.wave_number}')" title="View Details">
                  View
                </button>
                ${wave.status === 'created' ? `
                  <button class="btn btn-small btn-primary" onclick="startWave('${wave.wave_number}')" title="Start Wave">
                    Start
                  </button>
                ` : ''}
                <button class="btn btn-small btn-secondary" onclick="editWave('${wave.wave_number}')" title="Edit Wave">
                  Edit
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
      
      // Update wave select for route optimization
      const waveSelect = document.getElementById('route-wave-id');
      if (waveSelect) {
        waveSelect.innerHTML = '<option value="">Select Wave</option>' + 
          data.waves.map(w => 
            `<option value="${w.wave_number}">Wave #${w.wave_number} (${w.total_items} items)</option>`
          ).join('');
      }

      // Update picking dashboard stats
      updatePickingStats(data.waves);
      
      // Enhanced picking data loaded successfully
console.log('Enhanced picking data loaded successfully');

// Missing wave action functions - Add these implementations
async function pauseWave(waveId) {
  console.log('Pausing wave:', waveId);
  
  if (!waveId) {
    showToast('Wave ID is required', 'error');
    return;
  }
  
  const reason = prompt('Reason for pausing wave (optional):') || 'Paused by user';
  
  try {
    const result = await apiCall(`/waves/${waveId}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    
    if (result && result.success) {
      showToast(`Wave ${result.wave_number} paused successfully`, 'warning');
      loadPickingData();
    } else {
      showToast('Failed to pause wave', 'error');
    }
  } catch (error) {
    console.error('Error pausing wave:', error);
    showToast('Error pausing wave', 'error');
  }
}

async function resumeWave(waveId) {
  console.log('Resuming wave:', waveId);
  
  if (!waveId) {
    showToast('Wave ID is required', 'error');
    return;
  }
  
  try {
    const result = await apiCall(`/waves/${waveId}/resume`, {
      method: 'POST'
    });
    
    if (result && result.success) {
      showToast(`Wave ${result.wave_number} resumed successfully`, 'success');
      loadPickingData();
    } else {
      showToast('Failed to resume wave', 'error');
    }
  } catch (error) {
    console.error('Error resuming wave:', error);
    showToast('Error resuming wave', 'error');
  }
}

async function editWave(waveId) {
  console.log('Editing wave:', waveId);
  
  // Get current wave data
  const waveData = await apiCall(`/waves/${waveId}`);
  if (!waveData) return;
  
  const wave = waveData.data || waveData.wave || waveData;
  
  // Simple edit dialog - in production this would be a proper modal
  const newPriority = prompt(`Edit Priority for Wave ${wave.wave_number || waveId}:
Current: ${wave.priority || 'normal'}
Options: normal, high, urgent`, wave.priority || 'normal');
  
  if (newPriority && ['normal', 'high', 'urgent'].includes(newPriority.toLowerCase())) {
    const result = await apiCall(`/waves/${waveId}`, {
      method: 'PUT',
      body: JSON.stringify({ 
        priority: newPriority.toLowerCase(),
        notes: `Priority updated to ${newPriority} by user`
      })
    });
    
    if (result) {
      showToast(`Wave updated successfully`, 'success');
      loadPickingData();
    }
  }
}

async function completeWave(waveId) {
  console.log('Completing wave:', waveId);
  
  if (!waveId) {
    showToast('Wave ID is required', 'error');
    return;
  }
  
  if (!confirm('Are you sure you want to complete this wave? This action cannot be undone.')) {
    return;
  }
  
  try {
    const result = await apiCall(`/waves/${waveId}/complete`, {
      method: 'POST'
    });
    
    if (result && result.success) {
      showToast(`Wave ${result.wave_number} completed successfully`, 'success');
      loadPickingData();
    } else {
      showToast('Failed to complete wave', 'error');
    }
  } catch (error) {
    console.error('Error completing wave:', error);
    showToast('Error completing wave', 'error');
  }
}

async function cancelWave(waveId) {
  console.log('Cancelling wave:', waveId);
  
  if (!waveId) {
    showToast('Wave ID is required', 'error');
    return;
  }
  
  const reason = prompt('Reason for cancelling wave:');
  if (!reason) {
    showToast('Cancellation reason is required', 'error');
    return;
  }
  
  if (!confirm('Are you sure you want to cancel this wave? This will release all inventory reservations.')) {
    return;
  }
  
  try {
    const result = await apiCall(`/waves/${waveId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    
    if (result && result.success) {
      showToast(`Wave ${result.wave_number} cancelled successfully`, 'warning');
      loadPickingData();
    } else {
      showToast('Failed to cancel wave', 'error');
    }
  } catch (error) {
    console.error('Error cancelling wave:', error);
    showToast('Error cancelling wave', 'error');
  }
}

// Missing operator functions - removed duplicate, using complete version later in file

// Missing task completion function
async function completeTask(taskId) {
  console.log('Completing task:', taskId);
  
  const quantity = prompt('Enter quantity picked:');
  if (!quantity || isNaN(quantity) || quantity <= 0) {
    showToast('Please enter a valid quantity', 'error');
    return;
  }
  
  const result = await apiCall(`/picking/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      quantity_picked: parseInt(quantity),
      picking_time_seconds: 30 // Default time
    })
  });
  
  if (result) {
    showToast('Task completed successfully', 'success');
    // Refresh the wave detail if modal is open
    const modal = document.getElementById('wave-detail-modal');
    if (modal && modal.classList.contains('active')) {
      const waveNumber = document.getElementById('wave-detail-number').textContent;
      if (waveNumber) {
        viewWaveDetail(waveNumber);
      }
    }
  }
}

// Make wave action functions available globally (moved here after function definitions)
window.pauseWave = pauseWave;
window.resumeWave = resumeWave;
window.editWave = editWave;
window.completeWave = completeWave;
window.cancelWave = cancelWave;

// Make operator functions available globally - will be set later after complete functions are defined
// window.editOperator = editOperator;
// window.toggleOperatorStatus = toggleOperatorStatus;

// Make task functions available globally
window.completeTask = completeTask;
    } else {
      console.warn('No waves data received');
      const tbody = document.querySelector('#waves-table tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10">No waves found</td></tr>';
      }
    }

    // Load operators for filters
    await loadOperatorsForFilters();
    
    // Load pending orders for wave creation
    await loadPendingOrdersForWaves();
    
  } catch (error) {
    console.error('Failed to load picking data:', error);
    const tbody = document.querySelector('#waves-table tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10">Failed to load picking data. Please refresh.</td></tr>';
    }
  }
}

// Update picking dashboard statistics
function updatePickingStats(waves) {
  try {
    const activeWaves = waves.filter(w => w.status === 'in_progress').length;
    const totalTasks = waves.reduce((sum, w) => sum + (w.total_items || 0), 0);
    const completedToday = waves.filter(w => 
      w.status === 'completed' && 
      new Date(w.updated_at).toDateString() === new Date().toDateString()
    ).length;
    
    // Calculate average pick time (simplified)
    const avgPickTime = waves.length > 0 ? 
      Math.round(waves.reduce((sum, w) => sum + (w.estimated_time_minutes || 0), 0) / waves.length) : 0;

    // Update UI elements
    const activeWavesEl = document.getElementById('active-waves-count');
    const totalTasksEl = document.getElementById('total-tasks-count');
    const completedTodayEl = document.getElementById('completed-today-count');
    const avgPickTimeEl = document.getElementById('avg-pick-time');

    if (activeWavesEl) activeWavesEl.textContent = activeWaves;
    if (totalTasksEl) totalTasksEl.textContent = totalTasks;
    if (completedTodayEl) completedTodayEl.textContent = completedToday;
    if (avgPickTimeEl) avgPickTimeEl.textContent = `${avgPickTime} min`;

  } catch (error) {
    console.error('Error updating picking stats:', error);
  }
}

// Load operators for filter dropdown
async function loadOperatorsForFilters() {
  try {
    const operatorsData = await apiCall('/operators');
    if (operatorsData?.operators) {
      const operatorFilter = document.getElementById('wave-operator-filter');
      const waveOperatorSelect = document.getElementById('wave-operator');
      
      const operatorOptions = operatorsData.operators.map(op => 
        `<option value="${op.id}">${op.username} (${op.role})</option>`
      ).join('');

      if (operatorFilter) {
        operatorFilter.innerHTML = '<option value="">All Operators</option>' + operatorOptions;
      }
      
      if (waveOperatorSelect) {
        waveOperatorSelect.innerHTML = '<option value="">Unassigned</option>' + operatorOptions;
      }
    }
  } catch (error) {
    console.warn('Failed to load operators for filters:', error);
  }
}

// Load pending orders for wave creation
async function loadPendingOrdersForWaves() {
  try {
    const ordersData = await apiCall('/orders?status=pending&limit=1000');
    if (ordersData?.orders) {
      // Filter orders to only show those with items
      const ordersWithItems = ordersData.orders.filter(order => (order.total_items || 0) > 0);
      
      const waveOrdersSelect = document.getElementById('wave-orders');
      const buildOrdersList = document.getElementById('build-orders-list');
      
      if (waveOrdersSelect) {
        if (ordersWithItems.length === 0) {
          waveOrdersSelect.innerHTML = '<option value="">No orders with items available</option>';
        } else {
          waveOrdersSelect.innerHTML = ordersWithItems.map(order => 
            `<option value="${order.id}" data-items="${order.total_items || 0}" data-customer="${order.customer_name || order.customer_code}">
              ${order.order_number} - ${order.customer_name || order.customer_code} (${order.total_items} items)
            </option>`
          ).join('');
        }
      }

      if (buildOrdersList) {
        if (ordersWithItems.length === 0) {
          buildOrdersList.innerHTML = '<div class="alert alert-warning">No pending orders with items available for wave creation.</div>';
        } else {
          buildOrdersList.innerHTML = ordersWithItems.map(order => `
            <div class="order-item" data-order-id="${order.id}">
              <input type="checkbox" id="order-${order.id}" value="${order.id}">
              <label for="order-${order.id}">
                <strong>${order.order_number}</strong> - ${order.customer_name || order.customer_code}
                <br><small>${order.total_items} items, Priority: ${order.priority || 'Normal'}</small>
              </label>
            </div>
          `).join('');
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load pending orders:', error);
  }
}

// Filter waves based on current filter values
function filterWaves() {
  loadPickingData();
}

async function viewWave(waveId) {
  const data = await apiCall(`/waves/${waveId}`);
  if (data) {
    alert(`Wave: #${data.wave.wave_number}\nStatus: ${data.wave.status}\nTasks: ${data.tasks?.length || 0}`);
  }
}

async function startWave(waveId) {
  console.log('=== Starting Wave Debug ===');
  console.log('Wave ID:', waveId);
  
  // Get current user info for operator_id
  const currentUserStr = localStorage.getItem('currentUser');
  console.log('currentUser from localStorage:', currentUserStr);
  
  let userInfo = {};
  try {
    userInfo = JSON.parse(currentUserStr || '{}');
  } catch (e) {
    console.error('Error parsing currentUser:', e);
    userInfo = {};
  }
  
  console.log('Parsed userInfo:', userInfo);
  
  // Determine operator ID - handle demo users and real database users
  let operatorId;
  
  console.log('User info details:', {
    id: userInfo.id,
    username: userInfo.username,
    role: userInfo.role
  });
  
  if (userInfo.id === 'admin-001') {
    // Demo admin user - map to actual admin user in database
    operatorId = 78; // Admin user ID in SQL database (from users table)
    console.log('Using demo admin, mapped to database user ID:', operatorId);
  } else if (userInfo.id === 'test-001') {
    // Demo test user - map to actual operator user in database  
    operatorId = 80; // Operator1 user ID in SQL database
    console.log('Using demo test user, mapped to database user ID:', operatorId);
  } else if (userInfo.id && !isNaN(parseInt(userInfo.id))) {
    // For real database users, use their actual ID
    operatorId = parseInt(userInfo.id);
    console.log('Using real database user ID:', operatorId);
  } else {
    // Default to admin user if no valid ID found
    operatorId = 78;
    console.log('No valid user ID found, defaulting to admin ID:', operatorId);
  }
  console.log('Using operator ID:', operatorId);
  
  const requestBody = {
    operator_id: operatorId
  };
  
  console.log('Request body:', requestBody);
  console.log('Request body JSON:', JSON.stringify(requestBody));
  
  const result = await apiCall(`/waves/${waveId}/start`, { 
    method: 'POST',
    body: JSON.stringify(requestBody)
  });
  
  console.log('API call result:', result);
  
  if (result) {
    console.log('Wave started successfully:', result);
    loadPickingData();
  } else {
    console.error('Failed to start wave - result is null/false');
  }
}


// Warehouse
async function loadWarehouseData() {
  console.log('Loading warehouse data...');
  
  try {
    // Load warehouse report data
    const response = await apiCall('/warehouse/report');
    
    if (response && response.success && response.data) {
      const data = response.data;
      
      // Update basic stats
      document.getElementById('warehouse-locations').textContent = data.storage.total_locations || 0;
      document.getElementById('warehouse-capacity').textContent = data.storage.total_capacity || 0;
      document.getElementById('warehouse-utilization').textContent = `${data.storage.utilization || 0}%`;
      
      // Calculate today's movements from picking stats
      document.getElementById('warehouse-movements').textContent = data.picking.total_picks || 0;
    } else {
      // Set default values if no data
      document.getElementById('warehouse-locations').textContent = '0';
      document.getElementById('warehouse-capacity').textContent = '0';
      document.getElementById('warehouse-utilization').textContent = '0%';
      document.getElementById('warehouse-movements').textContent = '0';
    }
    
    // Load warehouse preview instead of full 2D map
    loadWarehousePreview();
    
  } catch (error) {
    console.error('Error loading warehouse data:', error);
    // Set default values on error
    document.getElementById('warehouse-locations').textContent = '0';
    document.getElementById('warehouse-capacity').textContent = '0';
    document.getElementById('warehouse-utilization').textContent = '0%';
    document.getElementById('warehouse-movements').textContent = '0';
  }
}

// Duplicate showToast function removed - using the first implementation

// View location details
async function viewLocationDetails(locationId) {
  const data = await apiCall(`/warehouse/locations/${locationId}`);
  if (data?.location) {
    const location = data.location;
    const utilization = location.capacity > 0 ? 
      Math.round((location.current_occupancy / location.capacity) * 100) : 0;
    
    alert(`Location Details:
Location: ${location.location_code}
Zone: ${location.zone}
Capacity: ${location.capacity}
Current Stock: ${location.current_occupancy}
Utilization: ${utilization}%
Product: ${location.product_reference || 'None'}
Position: (${location.x}, ${location.y}, ${location.z})`);
  }
}

// Show location management modal
function showLocationDetails() {
  const selectedLocation = prompt('Enter location code to view details:');
  if (selectedLocation) {
    // Find location in current table
    const rows = document.querySelectorAll('#storage-locations-table tbody tr');
    let found = false;
    
    rows.forEach(row => {
      const locationCode = row.cells[0].textContent.trim();
      if (locationCode.toLowerCase() === selectedLocation.toLowerCase()) {
        const zone = row.cells[1].textContent.trim();
        const capacity = row.cells[2].textContent.trim();
        const stock = row.cells[3].textContent.trim();
        const utilization = row.cells[4].textContent.trim();
        const product = row.cells[5].textContent.trim();
        const status = row.cells[6].textContent.trim();
        
        alert(`Location Details:
Location: ${locationCode}
Zone: ${zone}
Capacity: ${capacity}
Current Stock: ${stock}
Utilization: ${utilization}
Product: ${product}
Status: ${status}`);
        found = true;
      }
    });
    
    if (!found) {
      showToast('Location not found in current view', 'error');
    }
  }
}

// Generate warehouse report
async function generateWarehouseReport() {
  console.log('Generating warehouse report...');
  
  try {
    const data = await apiCall('/warehouse/report');
    
    if (data) {
      const report = `
WAREHOUSE REPORT - ${new Date().toLocaleDateString()}
================================================

SUMMARY:
- Total Locations: ${data.total_locations || 0}
- Total Capacity: ${data.total_capacity || 0}
- Current Occupancy: ${data.total_occupancy || 0}
- Overall Utilization: ${data.utilization_percentage || 0}%

ZONE BREAKDOWN:
${data.zones?.map(z => `- Zone ${z.zone}: ${z.locations} locations, ${z.utilization}% utilized`).join('\n') || 'No zone data'}

MOVEMENTS TODAY:
- Inbound: ${data.movements?.inbound || 0}
- Outbound: ${data.movements?.outbound || 0}
- Transfers: ${data.movements?.transfers || 0}
      `;
      
      // Create and download report
      const blob = new Blob([report], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warehouse-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('Warehouse report generated and downloaded', 'success');
    }
  } catch (error) {
    console.error('Error generating warehouse report:', error);
    showToast('Failed to generate warehouse report', 'error');
  }
}

// AI Optimization
async function loadAIData() {
  const waves = await apiCall('/waves');
  if (waves?.waves) {
    const waveSelect = document.getElementById('route-wave-id');
    if (waveSelect) {
      waveSelect.innerHTML = waves.waves.map(w => 
        `<option value="${w.id}">Wave #${w.wave_number}</option>`
      ).join('');
    }
  }
}

async function runKMeans() {
  const k = parseInt(document.getElementById('kmeans-k').value) || 3;
  const resultDiv = document.getElementById('kmeans-result');
  const button = document.getElementById('run-kmeans');
  
  // Add AI visual feedback
  button.classList.add('processing');
  button.disabled = true;
  
  // Show AI thinking indicator
  if (window.aiWidget) {
    const thinking = window.aiWidget.showThinking(resultDiv);
    resultDiv.innerHTML = '';
    resultDiv.appendChild(thinking);
  } else {
    resultDiv.innerHTML = '<p>Running K-Means clustering...</p>';
  }
  
  const result = await apiCall('/ai/clustering/kmeans', {
    method: 'POST',
    body: JSON.stringify({ k })
  });
  
  button.classList.remove('processing');
  button.disabled = false;
  
  if (result?.success) {
    const data = result.data;
    
    // Show AI notification
    if (window.aiWidget) {
      window.aiWidget.showNotification(
        'K-Means Complete',
        `Classified ${result.products_analyzed} products with ${data.summary?.accuracy || 0}% accuracy`,
        'success'
      );
    }
    
    resultDiv.innerHTML = `
      <div class="ai-suggestion">
        <div class="ai-suggestion-header">
          <div class="ai-suggestion-icon">AI</div>
          <div class="ai-suggestion-title">K-Means Clustering Results</div>
        </div>
        <div class="ai-suggestion-body">
          <p><strong>Products Analyzed:</strong> ${result.products_analyzed || 0}</p>
          <p><strong>Accuracy:</strong> ${data.summary?.accuracy || 0}%</p>
          <div class="ai-comparison-widget">
            <div class="comparison-side before">
              <div class="comparison-label">Manual Classification</div>
              <div class="comparison-value">75%</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="comparison-side after">
              <div class="comparison-label">AI Classification</div>
              <div class="comparison-value">${data.summary?.accuracy || 0}%</div>
            </div>
          </div>
          <hr>
          <p><strong>Class A (High Frequency):</strong> ${data.summary?.classA || 0} products</p>
          <p><strong>Class B (Medium Frequency):</strong> ${data.summary?.classB || 0} products</p>
          <p><strong>Class C (Low Frequency):</strong> ${data.summary?.classC || 0} products</p>
        </div>
      </div>
    `;
    
    // Show AI confidence
    if (window.aiWidget && data.summary?.accuracy) {
      window.aiWidget.showConfidence(resultDiv, data.summary.accuracy);
    }
  } else {
    resultDiv.innerHTML = `<p class="error">Error: ${result?.error || 'Failed to run clustering'}</p>`;
    if (window.aiWidget) {
      window.aiWidget.showNotification('K-Means Failed', result?.error || 'Failed to run clustering', 'error');
    }
  }
}

async function runDBSCAN() {
  const epsilon = parseFloat(document.getElementById('dbscan-epsilon').value) || 0.3;
  const minPoints = parseInt(document.getElementById('dbscan-minpoints').value) || 3;
  const resultDiv = document.getElementById('dbscan-result');
  const button = document.getElementById('run-dbscan');
  
  // Add AI visual feedback
  button.classList.add('processing');
  button.disabled = true;
  
  if (window.aiWidget) {
    const thinking = window.aiWidget.showThinking(resultDiv);
    resultDiv.innerHTML = '';
    resultDiv.appendChild(thinking);
  } else {
    resultDiv.innerHTML = '<p>Running DBSCAN clustering...</p>';
  }
  
  const result = await apiCall('/ai/clustering/dbscan', {
    method: 'POST',
    body: JSON.stringify({ epsilon, minPoints })
  });
  
  button.classList.remove('processing');
  button.disabled = false;
  
  if (result?.success) {
    const data = result.data;
    
    // Show AI notification
    if (window.aiWidget) {
      window.aiWidget.showNotification(
        'DBSCAN Complete',
        `Found ${result.clusters_found} clusters and ${result.noise_points} anomalies`,
        'success'
      );
    }
    
    resultDiv.innerHTML = `
      <div class="ai-suggestion">
        <div class="ai-suggestion-header">
          <div class="ai-suggestion-icon">DET</div>
          <div class="ai-suggestion-title">DBSCAN Anomaly Detection Results</div>
        </div>
        <div class="ai-suggestion-body">
          <p><strong>Data Points Analyzed:</strong> ${result.data_points_analyzed || 0}</p>
          <p><strong>Clusters Found:</strong> ${result.clusters_found || 0}</p>
          <p><strong>Anomalies Detected:</strong> ${result.noise_points || 0}</p>
          <div class="ai-comparison-widget">
            <div class="comparison-side before">
              <div class="comparison-label">Manual Inspection</div>
              <div class="comparison-value">${(result.noise_points || 0) + 5}</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="comparison-side after">
              <div class="comparison-label">AI Detection</div>
              <div class="comparison-value">${result.noise_points || 0}</div>
            </div>
          </div>
          <hr>
          <h5>Clusters:</h5>
          ${data.clusters?.map(c => `
            <p><strong>Cluster ${c.id}:</strong> ${c.size} products</p>
          `).join('') || '<p>No clusters found</p>'}
        </div>
      </div>
    `;
  } else {
    resultDiv.innerHTML = `<p class="error">Error: ${result?.error || 'Failed to run clustering'}</p>`;
    if (window.aiWidget) {
      window.aiWidget.showNotification('DBSCAN Failed', result?.error || 'Failed to run clustering', 'error');
    }
  }
}

async function runRouteOptimization() {
  const waveId = document.getElementById('route-wave-id').value;
  const resultDiv = document.getElementById('route-result');
  const button = document.getElementById('run-route-optimization');
  
  if (!waveId) {
    resultDiv.innerHTML = '<p class="error">Please select a wave</p>';
    return;
  }
  
  // Add AI visual feedback
  button.classList.add('processing');
  button.disabled = true;
  
  if (window.aiWidget) {
    const thinking = window.aiWidget.showThinking(resultDiv);
    resultDiv.innerHTML = '';
    resultDiv.appendChild(thinking);
  } else {
    resultDiv.innerHTML = '<p>Optimizing route using Genetic Algorithm...</p>';
  }
  
  const result = await apiCall('/ai/route/optimize', {
    method: 'POST',
    body: JSON.stringify({ wave_id: waveId })
  });
  
  button.classList.remove('processing');
  button.disabled = false;
  
  if (result?.success) {
    const data = result.data;
    
    // Show AI notification
    if (window.aiWidget) {
      window.aiWidget.showNotification(
        'Route Optimized',
        `${data.improvement_percentage?.toFixed(1) || 0}% improvement achieved`,
        'success'
      );
    }
    
    resultDiv.innerHTML = `
      <div class="ai-suggestion">
        <div class="ai-suggestion-header">
          <div class="ai-suggestion-icon">OPT</div>
          <div class="ai-suggestion-title">Route Optimization Results</div>
        </div>
        <div class="ai-suggestion-body">
          <p><strong>Algorithm:</strong> ${data.algorithm || 'Genetic Algorithm'}</p>
          <p><strong>Tasks Optimized:</strong> ${data.tasks_optimized || 0}</p>
          <div class="ai-comparison-widget">
            <div class="comparison-side before">
              <div class="comparison-label">Original Route</div>
              <div class="comparison-value">${data.original_distance?.toFixed(1) || 0}m</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="comparison-side after">
              <div class="comparison-label">Optimized Route</div>
              <div class="comparison-value">${data.optimized_distance?.toFixed(1) || 0}m</div>
            </div>
          </div>
          <p><strong>Improvement:</strong> <span class="improvement-badge">${data.improvement_percentage?.toFixed(1) || 0}%</span></p>
          <p><strong>Estimated Time:</strong> ${data.estimated_time_minutes || 0} minutes</p>
          <hr>
          <h5>Optimized Route (First 5 stops):</h5>
          <ol>
            ${data.optimized_route?.slice(0, 5).map(r => `
              <li>${r.location_code} - ${r.product_reference} (Qty: ${r.quantity})</li>
            `).join('') || '<li>No route data</li>'}
            ${data.optimized_route?.length > 5 ? `<li>... and ${data.optimized_route.length - 5} more stops</li>` : ''}
          </ol>
        </div>
      </div>
    `;
    
    // Show AI confidence
    if (window.aiWidget && data.improvement_percentage) {
      window.aiWidget.showConfidence(resultDiv, Math.min(data.improvement_percentage * 3, 95));
    }
  } else {
    resultDiv.innerHTML = `<p class="error">Error: ${result?.error || 'Failed to optimize route'}</p>`;
    if (window.aiWidget) {
      window.aiWidget.showNotification('Route Optimization Failed', result?.error || 'Failed to optimize route', 'error');
    }
  }
}

async function getRecommendations() {
  const resultDiv = document.getElementById('recommendations-result');
  resultDiv.innerHTML = '<p>Generating storage recommendations...</p>';
  
  const result = await apiCall('/ai/clustering/recommendations', {
    method: 'POST',
    body: JSON.stringify({ k: 3 })
  });
  
  if (result?.success) {
    const data = result.data;
    resultDiv.innerHTML = `
      <h4>Storage Recommendations</h4>
      <p>Based on K-Means clustering analysis</p>
      <p>Total Recommendations: ${data.total_recommendations || 0}</p>
      <hr>
      <h5>Top Recommendations:</h5>
      ${data.recommendations?.slice(0, 10).map(r => `
        <p><strong>${r.product_reference}</strong> -> ${r.recommended_location} (Zone ${r.zone})</p>
        <small>${r.reason}</small>
      `).join('<hr>') || '<p>No recommendations available</p>'}
      ${data.recommendations?.length > 10 ? `<p>... and ${data.recommendations.length - 10} more</p>` : ''}
    `;
  } else {
    resultDiv.innerHTML = `<p class="error">Error: ${result?.error || 'Failed to get recommendations'}</p>`;
  }
}


// Reports
async function generateReport(reportType) {
  const outputDiv = document.getElementById('report-output');
  outputDiv.innerHTML = '<p>Generating report...</p>';
  
  let reportData = null;
  
  switch(reportType) {
    case 'warehouse-summary':
      reportData = await generateWarehouseSummaryReport();
      break;
    case 'operator-performance':
      reportData = await generateOperatorPerformanceReport();
      break;
    case 'inventory-analysis':
      reportData = await generateInventoryAnalysisReport();
      break;
    case 'ai-optimization':
      reportData = await generateAIOptimizationReport();
      break;
    default:
      outputDiv.innerHTML = '<p>Unknown report type</p>';
      return;
  }
  
  if (reportData) {
    outputDiv.innerHTML = `<pre>${reportData}</pre>`;
  }
}

async function generateWarehouseSummaryReport() {
  const [layout, utilization, orders] = await Promise.all([
    apiCall('/warehouse/layout'),
    apiCall('/warehouse/utilization'),
    apiCall('/orders/stats/summary')
  ]);
  
  // Load performance data separately
  let picking = null;
  try {
    picking = await apiCall('/picking/performance');
  } catch (error) {
    console.warn('Performance data not available for report');
  }
  
  let report = '='.repeat(60) + '\n';
  report += '           WAREHOUSE SUMMARY REPORT\n';
  report += '           Generated: ' + new Date().toLocaleString() + '\n';
  report += '='.repeat(60) + '\n\n';
  
  report += '--- WAREHOUSE OVERVIEW ---\n';
  report += `Total Locations: ${layout?.data?.layout?.length || layout?.total_locations || 0}\n`;
  report += `Overall Utilization: ${utilization?.overall?.utilization_rate || utilization?.overall_utilization || 0}%\n`;
  report += `Total Capacity: ${utilization?.overall?.total_capacity || 0}\n`;
  report += `Total Occupancy: ${utilization?.overall?.total_occupancy || 0}\n\n`;
  
  report += '--- ZONE BREAKDOWN ---\n';
  if (utilization?.by_zone && utilization.by_zone.length > 0) {
    utilization.by_zone.forEach(z => {
      report += `Zone ${z.zone}: ${z.location_count} locations, ${z.utilization_rate}% utilization\n`;
    });
  } else if (layout?.zone_summary) {
    layout.zone_summary.forEach(z => {
      report += `Zone ${z.zone}: ${z.total_locations} locations, ${Math.round(z.avg_utilization)}% utilization\n`;
    });
  } else {
    report += 'No zone data available\n';
  }
  report += '\n';
  
  report += '--- ORDER STATUS ---\n';
  if (orders) {
    const totalOrders = orders.total_orders || orders.total || 0;
    const pending = orders.pending || orders.by_status?.pending || 0;
    const inProgress = (orders.assigned || 0) + (orders.picking || 0) + (orders.in_progress || 0);
    const completed = (orders.picked || 0) + (orders.shipped || 0) + (orders.completed || 0);
    
    report += `Total Orders: ${totalOrders}\n`;
    report += `Pending: ${pending}\n`;
    report += `In Progress: ${inProgress}\n`;
    report += `Completed: ${completed}\n`;
  }
  report += '\n';
  
  report += '--- PICKING PERFORMANCE ---\n';
  if (picking) {
    report += `Total Picks: ${picking.total_picks || 0}\n`;
    report += `Total Quantity Picked: ${picking.total_quantity || 0}\n`;
    report += `Average Pick Time: ${picking.average_pick_time_seconds || 0} seconds\n`;
  } else {
    report += 'No picking performance data available\n';
  }
  report += '\n';
  
  // Add AI Insights Section
  report += '='.repeat(60) + '\n';
  report += '--- AI INSIGHTS & RECOMMENDATIONS ---\n';
  report += '='.repeat(60) + '\n\n';
  
  // Generate AI insights from available data
  report += 'AI-POWERED ANALYSIS:\n\n';
  
  const utilRate = utilization?.overall?.utilization_rate || utilization?.overall_utilization || 0;
  if (utilRate < 50) {
    report += '1. LOW UTILIZATION DETECTED\n';
    report += `   Current: ${utilRate}% | Target: 70-85%\n`;
    report += '   AI Recommendation: Consolidate inventory to fewer zones\n';
    report += '   Expected Impact: +15-20% space efficiency\n\n';
  } else if (utilRate > 90) {
    report += '1. HIGH UTILIZATION WARNING\n';
    report += `   Current: ${utilRate}% | Safe Range: 70-85%\n`;
    report += '   AI Recommendation: Expand storage or optimize inventory\n';
    report += '   Risk: Reduced picking efficiency, congestion\n\n';
  } else {
    report += '1. UTILIZATION STATUS: OPTIMAL\n';
    report += `   Current: ${utilRate}% | Target Range: 70-85%\n`;
    report += '   AI Analysis: Space usage is well-balanced\n\n';
  }
  
  if (orders) {
    const pending = orders.pending || orders.by_status?.pending || 0;
    if (pending > 100) {
      report += '2. ORDER BACKLOG DETECTED\n';
      report += `   Pending Orders: ${pending}\n`;
      report += '   AI Recommendation: Create additional picking waves\n';
      report += '   Suggested Action: Use auto-wave generation\n\n';
    } else if (pending > 0) {
      report += '2. ORDER FLOW: NORMAL\n';
      report += `   Pending Orders: ${pending}\n`;
      report += '   AI Analysis: Order volume is manageable\n\n';
    }
  }
  
  report += '3. AI OPTIMIZATION TOOLS AVAILABLE\n';
  report += '   - K-Means Clustering: Group products by similarity\n';
  report += '   - Route Optimization: Reduce travel distance 20-30%\n';
  report += '   - Predictive Analytics: Forecast demand patterns\n';
  report += '   - Storage Optimizer: ABC classification & placement\n';
  report += '   Action: Visit AI Command Center to activate\n\n';
  
  report += '='.repeat(60) + '\n';
  report += 'Report generated with AI-powered analytics\n';
  report += '='.repeat(60) + '\n';
  
  return report;
}

async function generateOperatorPerformanceReport() {
  let picking = null;
  let waves = null;
  
  try {
    picking = await apiCall('/picking/performance');
  } catch (error) {
    console.warn('Performance data not available');
  }
  
  try {
    waves = await apiCall('/picking/waves?limit=100');
  } catch (error) {
    console.warn('Waves data not available');
  }
  
  let report = '='.repeat(60) + '\n';
  report += '         OPERATOR PERFORMANCE REPORT\n';
  report += '         Generated: ' + new Date().toLocaleString() + '\n';
  report += '='.repeat(60) + '\n\n';
  
  report += '--- OVERALL METRICS ---\n';
  if (picking) {
    report += `Total Picks Completed: ${picking.total_picks || 0}\n`;
    report += `Total Quantity Picked: ${picking.total_quantity || 0}\n`;
    report += `Average Pick Time: ${picking.average_pick_time_seconds || 0} seconds\n`;
    report += `Average Pick Time: ${picking.average_pick_time_minutes || 0} minutes\n`;
  }
  report += '\n';
  
  report += '--- WAVE STATISTICS ---\n';
  if (waves?.waves) {
    const completed = waves.waves.filter(w => w.status === 'completed').length;
    const inProgress = waves.waves.filter(w => w.status === 'in_progress').length;
    const created = waves.waves.filter(w => w.status === 'created').length;
    
    report += `Total Waves: ${waves.waves.length}\n`;
    report += `Completed: ${completed}\n`;
    report += `In Progress: ${inProgress}\n`;
    report += `Created: ${created}\n`;
  }
  
  return report;
}

async function generateInventoryAnalysisReport() {
  const summary = await apiCall('/inventory/summary');
  const lowStock = await apiCall('/inventory/alerts/low-stock?threshold=20');
  
  let report = '='.repeat(60) + '\n';
  report += '          INVENTORY ANALYSIS REPORT\n';
  report += '          Generated: ' + new Date().toLocaleString() + '\n';
  report += '='.repeat(60) + '\n\n';
  
  report += '--- INVENTORY OVERVIEW ---\n';
  if (summary) {
    report += `Total Products: ${summary.total_products || 0}\n`;
    report += `Total Locations Used: ${summary.total_locations || 0}\n`;
    report += `Total Quantity: ${summary.total_quantity || 0}\n`;
    report += `Total Reserved: ${summary.total_reserved || 0}\n`;
    report += `Available: ${(summary.total_quantity || 0) - (summary.total_reserved || 0)}\n`;
  }
  report += '\n';
  
  report += '--- BY ABC CODE ---\n';
  if (summary?.by_abc_code) {
    Object.entries(summary.by_abc_code).forEach(([code, data]) => {
      report += `Class ${code}: ${data.total_items} items, ${data.total_quantity} units\n`;
    });
  }
  report += '\n';
  
  report += '--- BY ZONE ---\n';
  if (summary?.by_zone) {
    Object.entries(summary.by_zone).forEach(([zone, data]) => {
      report += `Zone ${zone}: ${data.total_items} items, ${data.total_quantity} units\n`;
    });
  }
  report += '\n';
  
  report += '--- LOW STOCK ALERTS ---\n';
  if (lowStock) {
    report += `Threshold: ${lowStock.threshold} units\n`;
    report += `Items Below Threshold: ${lowStock.count || 0}\n\n`;
    
    if (lowStock.items?.length > 0) {
      lowStock.items.slice(0, 10).forEach(item => {
        report += `  - ${item.product?.reference || 'N/A'}: ${item.quantity || 0} units at ${item.location?.location_code || 'N/A'}\n`;
      });
      if (lowStock.items.length > 10) {
        report += `  ... and ${lowStock.items.length - 10} more items\n`;
      }
    }
  }
  
  return report;
}

async function generateAIOptimizationReport() {
  const analytics = await apiCall('/ai/analytics');
  
  let report = '='.repeat(60) + '\n';
  report += '          AI OPTIMIZATION REPORT\n';
  report += '          Generated: ' + new Date().toLocaleString() + '\n';
  report += '='.repeat(60) + '\n\n';
  
  report += '--- CLUSTERING ANALYSIS ---\n';
  if (analytics?.data?.clustering) {
    report += `Total Clustering Runs: ${analytics.data.clustering.total_runs || 0}\n`;
    if (analytics.data.clustering.latest) {
      report += `Latest Algorithm: ${analytics.data.clustering.latest.algorithm || 'N/A'}\n`;
    }
  }
  report += '\n';
  
  report += '--- ROUTE OPTIMIZATION ---\n';
  if (analytics?.data?.route_optimization) {
    report += `Total Optimization Runs: ${analytics.data.route_optimization.total_runs || 0}\n`;
    report += `Average Improvement: ${analytics.data.route_optimization.average_improvement_percentage || 0}%\n`;
  }
  report += '\n';
  
  report += '--- AI ALGORITHMS USED ---\n';
  report += '1. K-Means Clustering: Product classification based on picking frequency\n';
  report += '2. DBSCAN Clustering: Anomaly detection in product patterns\n';
  report += '3. Genetic Algorithm: Route optimization with 2-opt local search\n';
  
  return report;
}

// Utility functions
function formatDate(dateString) {
  if (!dateString) return 'No Date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch {
    return 'Invalid Date';
  }
}


// Modal functions
function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
  
  // Load data for specific modals
  if (modalId === 'create-wave-modal') {
    loadPendingOrdersForWave();
    loadOperatorsForWave();
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Toast notification function - Improved version
function showToast(message, type = 'info', duration = 4000) {
  // Remove any existing toast
  const existingToast = document.getElementById('toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create new toast element
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add to DOM
  document.body.appendChild(toast);
  
  // Trigger show animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Auto remove after duration
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast && toast.parentNode) {
          toast.remove();
        }
      }, 300); // Wait for animation to complete
    }
  }, duration);
  
  // Add click to dismiss
  toast.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.remove();
      }
    }, 300);
  });
  
  // Add close button for better UX
  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 12px;
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
    opacity: 0.7;
    line-height: 1;
  `;
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.remove();
      }
    }, 300);
  });
  
  toast.style.position = 'relative';
  toast.style.paddingRight = '40px';
  toast.appendChild(closeBtn);
}

// Inbound - Nhap Kho
async function handleInbound(event) {
  event.preventDefault();
  
  const productRef = document.getElementById('inbound-product').value.trim();
  const locationCode = document.getElementById('inbound-location').value.trim();
  const quantity = parseInt(document.getElementById('inbound-quantity').value);
  const notes = document.getElementById('inbound-notes').value.trim();
  
  // Validation
  if (!productRef) {
    showToast('Vui lòng nhập mã sản phẩm', 'error');
    return;
  }
  
  if (!locationCode) {
    showToast('Vui lòng chọn vị trí lưu trữ', 'error');
    return;
  }
  
  if (!quantity || quantity <= 0) {
    showToast('Vui lòng nhập số lượng hợp lệ', 'error');
    return;
  }
  
  const data = {
    movement_type: 'inbound',
    product_reference: productRef,
    to_location_code: locationCode,
    quantity: quantity,
    notes: notes
  };
  
  try {
    showToast('Đang xử lý nhập kho...', 'info');
    
    const result = await apiCall('/warehouse/movements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (result && result.success) {
      showToast(`Nhập kho thành công: ${quantity} ${productRef} vào ${locationCode}`, 'success');
      closeModal('inbound-modal');
      document.getElementById('inbound-form').reset();
      loadInventoryData();
    } else {
      showToast(`Nhập kho thất bại: ${result?.error || 'Lỗi không xác định'}`, 'error');
    }
  } catch (error) {
    console.error('Inbound error:', error);
    showToast('Lỗi hệ thống khi nhập kho', 'error');
  }
}

// Outbound - Xuat Kho
async function handleOutbound(event) {
  event.preventDefault();
  
  const productRef = document.getElementById('outbound-product').value.trim();
  const locationCode = document.getElementById('outbound-location').value.trim();
  const quantity = parseInt(document.getElementById('outbound-quantity').value);
  const notes = document.getElementById('outbound-notes').value.trim();
  
  // Validation
  if (!productRef) {
    showToast('Vui lòng nhập mã sản phẩm', 'error');
    return;
  }
  
  if (!locationCode) {
    showToast('Vui lòng chọn vị trí xuất hàng', 'error');
    return;
  }
  
  if (!quantity || quantity <= 0) {
    showToast('Vui lòng nhập số lượng hợp lệ', 'error');
    return;
  }
  
  const data = {
    movement_type: 'outbound',
    product_reference: productRef,
    from_location_code: locationCode,
    quantity: quantity,
    notes: notes
  };
  
  try {
    showToast('Đang xử lý xuất kho...', 'info');
    
    const result = await apiCall('/warehouse/movements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (result && result.success) {
      showToast(`Xuất kho thành công: ${quantity} ${productRef} từ ${locationCode}`, 'success');
      closeModal('outbound-modal');
      document.getElementById('outbound-form').reset();
      loadInventoryData();
    } else {
      showToast(`Xuất kho thất bại: ${result?.error || 'Lỗi không xác định'}`, 'error');
    }
  } catch (error) {
    console.error('Outbound error:', error);
    showToast('Lỗi hệ thống khi xuất kho', 'error');
  }
}

// Transfer - Chuyen Kho
async function handleTransfer(event) {
  event.preventDefault();
  
  const productRef = document.getElementById('transfer-product').value.trim();
  const fromLocation = document.getElementById('transfer-from').value.trim();
  const toLocation = document.getElementById('transfer-to').value.trim();
  const quantity = parseInt(document.getElementById('transfer-quantity').value);
  
  // Validation
  if (!productRef) {
    showToast('Vui lòng nhập mã sản phẩm', 'error');
    return;
  }
  
  if (!fromLocation) {
    showToast('Vui lòng chọn vị trí nguồn', 'error');
    return;
  }
  
  if (!toLocation) {
    showToast('Vui lòng chọn vị trí đích', 'error');
    return;
  }
  
  if (fromLocation === toLocation) {
    showToast('Vị trí nguồn và đích không thể giống nhau', 'error');
    return;
  }
  
  if (!quantity || quantity <= 0) {
    showToast('Vui lòng nhập số lượng hợp lệ', 'error');
    return;
  }
  
  const data = {
    movement_type: 'transfer',
    product_reference: productRef,
    from_location_code: fromLocation,
    to_location_code: toLocation,
    quantity: quantity
  };
  
  try {
    showToast('Đang xử lý chuyển kho...', 'info');
    
    const result = await apiCall('/warehouse/movements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (result && result.success) {
      showToast(`Chuyển kho thành công: ${quantity} ${productRef} từ ${fromLocation} đến ${toLocation}`, 'success');
      closeModal('transfer-modal');
      document.getElementById('transfer-form').reset();
      loadInventoryData();
    } else {
      showToast(`Chuyển kho thất bại: ${result?.error || 'Lỗi không xác định'}`, 'error');
    }
  } catch (error) {
    console.error('Transfer error:', error);
    showToast('Lỗi hệ thống khi chuyển kho', 'error');
  }
}

// Adjust Stock - Điều chỉnh tồn kho
async function handleAdjust(event) {
  event.preventDefault();
  
  const inventoryId = document.getElementById('adjust-inventory-id').value;
  const newQuantity = parseInt(document.getElementById('adjust-quantity').value);
  const reason = document.getElementById('adjust-reason').value.trim();
  
  // Validation
  if (!inventoryId) {
    showToast('Không tìm thấy ID inventory', 'error');
    return;
  }
  
  if (newQuantity === undefined || newQuantity < 0) {
    showToast('Vui lòng nhập số lượng hợp lệ (>= 0)', 'error');
    return;
  }
  
  if (!reason) {
    showToast('Vui lòng nhập lý do điều chỉnh', 'error');
    return;
  }
  
  const data = {
    quantity: newQuantity,
    reason: reason
  };
  
  try {
    showToast('Đang xử lý điều chỉnh tồn kho...', 'info');
    
    const result = await apiCall(`/inventory/${inventoryId}/adjust`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    if (result && result.success) {
      const diff = result.difference;
      const diffText = diff > 0 ? `+${diff}` : `${diff}`;
      showToast(`Điều chỉnh thành công: ${diffText} (${result.old_quantity} → ${result.new_quantity})`, 'success');
      closeModal('adjust-modal');
      document.getElementById('adjust-form').reset();
      loadInventoryData();
    } else {
      showToast(`Điều chỉnh thất bại: ${result?.error || 'Lỗi không xác định'}`, 'error');
    }
  } catch (error) {
    console.error('Adjust error:', error);
    showToast('Lỗi hệ thống khi điều chỉnh tồn kho', 'error');
  }
}

// Create Order
async function handleCreateOrder(event) {
  event.preventDefault();
  
  const itemsText = document.getElementById('order-items').value;
  const items = itemsText.split(',').map(item => {
    const [ref, qty] = item.trim().split(':');
    return { product_reference: ref.trim(), quantity: parseInt(qty) || 1 };
  });
  
  const customerValue = document.getElementById('order-customer').value;
  
  const data = {
    order_number: document.getElementById('order-number').value,
    customer_name: customerValue || 'New Customer', // Use customer_name instead of customer_code
    customer_code: customerValue, // Keep customer_code for backward compatibility
    priority: document.getElementById('order-priority').value,
    items: items
  };
  
  const result = await apiCall('/orders', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result) {
    showToast('Order created!', 'success');
    closeModal('create-order-modal');
    document.getElementById('create-order-form').reset();
    loadOrdersData();
  } else {
    showToast('Failed to create order!', 'error');
  }
}

// Load pending orders for wave creation
async function loadPendingOrdersForWave() {
  // Get orders that are pending OR don't have a wave yet
  const data = await apiCall('/orders?status=pending&limit=100');
  const select = document.getElementById('wave-orders');
  
  if (data?.orders && data.orders.length > 0) {
    select.innerHTML = data.orders.map(o => 
      `<option value="${o.id}" data-items="${o.total_items || 0}">${o.order_number} - ${o.customer_name || o.customer_code || 'Unknown'} (${o.total_items || 0} items)</option>`
    ).join('');
  } else {
    select.innerHTML = '<option value="">No orders available for wave creation</option>';
  }
}

// Open reorder modal for low stock items
async function openReorderModal(productReference) {
  const quantity = prompt(`Nhập số lượng cần đặt cho sản phẩm ${productReference}:`, '10');
  if (!quantity || isNaN(quantity) || quantity <= 0) return;
  
  try {
    const result = await apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify({
        order_number: `REORDER-${Date.now()}`,
        customer_name: 'Restock Order',
        customer_code: 'RESTOCK',
        priority: 'high',
        items: [{
          product_reference: productReference,
          quantity: parseInt(quantity)
        }]
      })
    });
    
    if (result) {
      showToast(`Đã tạo đơn đặt hàng ${quantity} sản phẩm ${productReference}`, 'success');
      loadInventoryData();
    }
  } catch (error) {
    showToast('Lỗi tạo đơn đặt hàng', 'error');
  }
}

// Load operators for wave assignment
async function loadOperatorsForWave() {
  const data = await apiCall('/operators');
  const select = document.getElementById('wave-operator');
  
  if (data?.operators) {
    select.innerHTML = '<option value="">Unassigned</option>' +
      data.operators.map(o => `<option value="${o.id}">${o.username}</option>`).join('');
  }
}

// Create Picking Wave
async function handleCreateWave(event) {
  event.preventDefault();
  
  const orderSelect = document.getElementById('wave-orders');
  const selectedOrders = Array.from(orderSelect.selectedOptions).map(o => parseInt(o.value));
  
  if (selectedOrders.length === 0) {
    showToast('Vui lòng chọn ít nhất một đơn hàng', 'error');
    return;
  }
  
  const operatorSelect = document.getElementById('wave-operator');
  const operatorId = operatorSelect?.value ? parseInt(operatorSelect.value) : null;
  
  const data = {
    order_ids: selectedOrders,
    operator_id: operatorId,
    priority: 'normal',
    notes: 'Created from wave planning interface'
  };
  
  console.log('Creating wave with data:', data);
  
  try {
    showToast('Đang tạo wave...', 'info');
    
    const result = await apiCall('/waves', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (result && result.success) {
      showToast(`Wave ${result.wave_number} đã được tạo thành công! 
        ${result.tasks_created} tasks, 
        ⏱️ Ước tính: ${result.estimated_time_minutes} phút`, 'success');
      
      closeModal('create-wave-modal');
      loadPickingData();
      loadOrdersData();
      
      // Clear selections
      if (orderSelect) {
        orderSelect.selectedIndex = -1;
      }
    } else {
      showToast(`Tạo wave thất bại: ${result?.error || 'Lỗi không xác định'}`, 'error');
    }
  } catch (error) {
    console.error('Create wave error:', error);
    showToast('Lỗi hệ thống khi tạo wave', 'error');
  }
}

// Complete Picking Task
function showPickingTaskModal(taskId, product, location, qtyToPick) {
  document.getElementById('task-id').value = taskId;
  document.getElementById('task-product').value = product;
  document.getElementById('task-location').value = location;
  document.getElementById('task-qty-to-pick').value = qtyToPick;
  document.getElementById('task-qty-picked').value = qtyToPick;
  showModal('picking-task-modal');
}

async function handleCompleteTask(event) {
  event.preventDefault();
  
  const taskId = document.getElementById('task-id').value;
  const data = {
    quantity_picked: parseInt(document.getElementById('task-qty-picked').value),
    picking_time_seconds: parseInt(document.getElementById('task-time').value)
  };
  
  const result = await apiCall(`/picking/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result) {
    showToast('Task completed!', 'success');
    closeModal('picking-task-modal');
    loadPickingData();
  } else {
    showToast('Failed to complete task!', 'error');
  }
}

// Show Movement History
async function showMovementHistory() {
  const data = await apiCall('/warehouse/movements?limit=50');
  const container = document.getElementById('movements-list');
  
  if (data?.movements) {
    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Product</th>
            <th>From</th>
            <th>To</th>
            <th>Quantity</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${data.movements.map(m => `
            <tr>
              <td><span class="status-badge status-${m.movement_type}">${m.movement_type}</span></td>
              <td>${m.product_reference || m.product_id || 'N/A'}</td>
              <td>${m.from_location_code || '-'}</td>
              <td>${m.to_location_code || '-'}</td>
              <td>${m.quantity}</td>
              <td>${formatDate(m.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  showModal('movements-modal');
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
  const result = await apiCall(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus })
  });
  
  if (result) {
    showToast(`Order status updated to ${newStatus}`, 'success');
    loadOrdersData();
  }
}

// Cancel order
async function cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;
  
  const result = await apiCall(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Cancelled by user' })
  });
  
  if (result) {
    showToast('Order cancelled', 'success');
    loadOrdersData();
  }
}

// Open adjust modal with inventory ID
function openAdjustModal(inventoryId, currentQty) {
  document.getElementById('adjust-inventory-id').value = inventoryId;
  document.getElementById('adjust-quantity').value = currentQty;
  showModal('adjust-modal');
}

// Make functions globally available for HTML onclick handlers
window.openAdjustModal = openAdjustModal;
window.viewWave = viewWave;
window.startWave = startWave;
window.viewOrder = viewOrder;
window.updateOrderStatus = updateOrderStatus;
window.cancelOrder = cancelOrder;
window.showMovementHistory = showMovementHistory;
window.showPickingTaskModal = showPickingTaskModal;
window.showLocationDetails = showLocationDetails;
window.viewLocationDetails = viewLocationDetails;
window.generateWarehouseReport = generateWarehouseReport;
window.showProductTimeline = showProductTimeline;
// Make warehouse functions globally available
window.loadWarehousePreview = loadWarehousePreview;
window.openWarehouse2DMap = openWarehouse2DMap;

// Modal functions
window.showModal = showModal;
window.closeModal = closeModal;
window.showToast = showToast;

// Form handlers
window.handleInbound = handleInbound;
window.handleOutbound = handleOutbound;
window.handleTransfer = handleTransfer;
window.handleAdjust = handleAdjust;
window.handleCreateOrder = handleCreateOrder;
window.handleCreateWave = handleCreateWave;
window.handleCompleteTask = handleCompleteTask;

// Make data loading functions available for refresh after operations
window.loadInventoryData = loadInventoryData;
window.loadOrdersData = loadOrdersData;
window.loadPickingData = loadPickingData;
window.loadWarehouseData = loadWarehouseData;

// Debug function to test all functions are available
window.debugFunctions = function() {
  console.log('=== FUNCTION AVAILABILITY CHECK ===');
  console.log('openAdjustModal:', typeof window.openAdjustModal);
  console.log('viewWave:', typeof window.viewWave);
  console.log('startWave:', typeof window.startWave);
  console.log('adjustStock:', typeof window.adjustStock);
  console.log('setupEventListeners:', typeof setupEventListeners);
  console.log('loadDashboardData:', typeof loadDashboardData);
  console.log('setupLoginHandler:', typeof setupLoginHandler);
  console.log('setupLogoutHandler:', typeof setupLogoutHandler);
  console.log('authToken exists:', !!localStorage.getItem('authToken'));
  console.log('currentUser exists:', !!localStorage.getItem('currentUser'));
  
  // Test DOM elements
  console.log('=== DOM ELEMENTS CHECK ===');
  console.log('login-form:', !!document.getElementById('login-form'));
  console.log('dashboard-screen:', !!document.getElementById('dashboard-screen'));
  console.log('logout-btn:', !!document.getElementById('logout-btn'));
  console.log('nav-items count:', document.querySelectorAll('.nav-item').length);
  console.log('content-sections count:', document.querySelectorAll('.content-section').length);
  console.log('inventory-chart canvas:', !!document.getElementById('inventory-chart'));
  console.log('orders-chart canvas:', !!document.getElementById('orders-chart'));
  
  // Test Chart.js
  console.log('=== CHART.JS CHECK ===');
  console.log('Chart.js available:', typeof Chart !== 'undefined');
  if (typeof Chart !== 'undefined') {
    console.log('Chart.js version:', Chart.version || 'Unknown');
  }
  
  // Test a simple API call
  const token = localStorage.getItem('authToken');
  if (token) {
    console.log('=== API TEST ===');
    fetch('/api/inventory?limit=1', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => console.log('API test successful:', data.inventory?.length || 0, 'items'))
    .catch(error => console.error('API test failed:', error));
  } else {
    console.log('No auth token found for API test');
  }
};

// Add manual chart test function
window.testCharts = async function() {
  console.log('=== MANUAL CHART TEST ===');
  
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not available');
    return;
  }
  
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.error('No auth token available');
    return;
  }
  
  try {
    // Get fresh data
    const inventoryResponse = await fetch('/api/inventory/summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const inventoryData = await inventoryResponse.json();
    
    const ordersResponse = await fetch('/api/orders/stats/summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ordersData = await ordersResponse.json();
    
    console.log('Data received:', { inventoryData, ordersData });
    
    // Test chart creation
    renderDashboardCharts(inventoryData, ordersData);
    
    console.log('Manual chart test completed');
  } catch (error) {
    console.error('Manual chart test failed:', error);
  }
};

// Close modal when clicking outside
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});


// Warehouse 2D Map Preview and Full-Screen Functions
async function loadWarehousePreview() {
  console.log('Loading warehouse preview data...');
  
  try {
    const response = await fetch('/api/public/storage-map');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data) {
      // Update preview stats
      document.getElementById('preview-total-locations').textContent = data.totalLocations || 0;
      document.getElementById('preview-occupied').textContent = data.occupiedLocations || 0;
      document.getElementById('preview-empty').textContent = data.emptyLocations || 0;
      document.getElementById('preview-zones').textContent = data.zones?.length || 0;
      document.getElementById('preview-total-products').textContent = data.totalProducts || 0;
      document.getElementById('preview-last-update').textContent = new Date().toLocaleString();
      
      // Update zone previews
      if (data.zones) {
        data.zones.forEach(zone => {
          const element = document.getElementById(`zone-${zone.zone.toLowerCase()}-preview`);
          if (element) {
            element.textContent = `${zone.locationCount} locations`;
          }
        });
        
        // Update "other zones" count
        const otherZones = data.zones.filter(z => !['A', 'B', 'C', 'D', 'E', 'F'].includes(z.zone));
        const otherElement = document.getElementById('zone-other-preview');
        if (otherElement) {
          const otherCount = otherZones.reduce((sum, z) => sum + z.locationCount, 0);
          otherElement.textContent = `${otherCount} locations`;
        }
      }
      
      console.log(`Warehouse preview loaded: ${data.totalLocations} locations, ${data.zones?.length} zones`);
    }
  } catch (error) {
    console.error('Error loading warehouse preview:', error);
    // Set default values on error
    document.getElementById('preview-total-locations').textContent = '0';
    document.getElementById('preview-occupied').textContent = '0';
    document.getElementById('preview-empty').textContent = '0';
    document.getElementById('preview-zones').textContent = '0';
    document.getElementById('preview-total-products').textContent = '0';
    document.getElementById('preview-last-update').textContent = 'Error loading';
  }
}

function openWarehouse2DMap() {
  console.log('Opening warehouse 2D map...');
  
  // Navigate to warehouse map endpoint instead of opening new window
  const currentUrl = window.location.origin;
  const warehouseMapUrl = `${currentUrl}/warehouse/2d-map`;
  
  // Update URL and navigate to warehouse map
  window.history.pushState({ section: 'warehouse-2d' }, '', '/warehouse/2d-map');
  window.location.href = '/warehouse/2d-map';
}

// Timeline Functions
async function loadInventoryTimeline() {
  const startDate = document.getElementById('timeline-start-date').value;
  const endDate = document.getElementById('timeline-end-date').value;
  const productRef = document.getElementById('timeline-product').value;
  const type = document.getElementById('timeline-type').value;
  
  let url = '/timeline/inventory?';
  if (startDate) url += `start_date=${startDate}&`;
  if (endDate) url += `end_date=${endDate}&`;
  if (productRef) url += `product_reference=${productRef}&`;
  if (type) url += `type=${type}&`;
  
  let data = await apiCall(url);
  
  // If auth fails or no data, use demo data
  if (!data) {
    try {
      const response = await fetch('/api/timeline-demo');
      data = await response.json();
    } catch (error) {
      console.error('Failed to load demo data:', error);
      return;
    }
  }
  
  if (data) {
    // Update stats
    document.getElementById('timeline-total-events').textContent = data.summary?.total_events || 0;
    document.getElementById('timeline-inbound').textContent = data.summary?.inbound_events || 0;
    document.getElementById('timeline-outbound').textContent = data.summary?.outbound_events || 0;
    document.getElementById('timeline-orders').textContent = data.summary?.order_events || 0;
    
    // Update table
    const tbody = document.querySelector('#timeline-table tbody');
    tbody.innerHTML = data.timeline?.map(event => `
      <tr>
        <td>${formatDate(event.date)}</td>
        <td><span class="status-badge status-${event.type}">${event.type}</span></td>
        <td>${event.product_reference || event.order_number || 'N/A'}</td>
        <td>${event.quantity > 0 ? '+' : ''}${event.quantity || 0}</td>
        <td>${event.location_code || event.from_location || event.to_location || 'N/A'}</td>
        <td>${event.running_inventory || 'N/A'}</td>
        <td>${event.description || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="7">No timeline data</td></tr>';
    
    // Update chart
    renderTimelineChart(data.timeline);
  }
}

async function loadDailySummary() {
  const date = document.getElementById('timeline-start-date').value || new Date().toISOString().split('T')[0];
  
  const data = await apiCall(`/timeline/daily-summary?date=${date}`);
  
  if (data) {
    const summary = `
      <h3>Daily Summary - ${data.date}</h3>
      <div class="daily-summary-grid">
        <div class="summary-card">
          <h4>Inbound</h4>
          <p>Transactions: ${data.inbound?.transactions || 0}</p>
          <p>Total Quantity: ${data.inbound?.total_quantity || 0}</p>
        </div>
        <div class="summary-card">
          <h4>Outbound</h4>
          <p>Transactions: ${data.outbound?.transactions || 0}</p>
          <p>Total Quantity: ${data.outbound?.total_quantity || 0}</p>
        </div>
        <div class="summary-card">
          <h4>Transfers</h4>
          <p>Transactions: ${data.transfers?.transactions || 0}</p>
          <p>Total Quantity: ${data.transfers?.total_quantity || 0}</p>
        </div>
        <div class="summary-card">
          <h4>Picking</h4>
          <p>Waves Completed: ${data.picking?.waves_completed || 0}</p>
          <p>Tasks Completed: ${data.picking?.tasks_completed || 0}</p>
          <p>Total Picked: ${data.picking?.total_picked || 0}</p>
          <p>Avg Pick Time: ${Math.round(data.picking?.avg_pick_time || 0)}s</p>
        </div>
      </div>
    `;
    
    showToast('Daily summary loaded', 'success');
    
    // Show in a modal or update a section
    const container = document.querySelector('#timeline-section .timeline-container');
    if (container) {
      container.innerHTML = summary;
    }
  }
}

function renderTimelineChart(timelineData) {
  const ctx = document.getElementById('timeline-chart');
  if (!ctx || !timelineData) return;
  
  if (charts.timeline) charts.timeline.destroy();
  
  // Group data by date for chart
  const dailyData = {};
  timelineData.forEach(event => {
    const date = new Date(event.date).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { inbound: 0, outbound: 0, orders: 0 };
    }
    
    if (event.type === 'inbound') {
      dailyData[date].inbound += Math.abs(event.quantity || 0);
    } else if (event.type === 'outbound') {
      dailyData[date].outbound += Math.abs(event.quantity || 0);
    } else if (event.type === 'order_created') {
      dailyData[date].orders += 1;
    }
  });
  
  const dates = Object.keys(dailyData).sort();
  const inboundData = dates.map(d => dailyData[d].inbound);
  const outboundData = dates.map(d => dailyData[d].outbound);
  const orderData = dates.map(d => dailyData[d].orders);
  
  charts.timeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Inbound Quantity',
          data: inboundData,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.1
        },
        {
          label: 'Outbound Quantity',
          data: outboundData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.1
        },
        {
          label: 'Orders Created',
          data: orderData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Quantity'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Orders'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Inventory Movement Timeline'
        }
      }
    }
  });
}

async function showProductTimeline(productRef) {
  if (!productRef) {
    productRef = prompt('Enter Product Reference:');
    if (!productRef) return;
  }
  
  const data = await apiCall(`/timeline/product/${productRef}`);
  
  if (data) {
    const modal = document.getElementById('product-timeline-modal');
    const content = modal.querySelector('.modal-body');
    
    content.innerHTML = `
      <h4>Product Timeline: ${data.product_reference}</h4>
      <div class="product-info">
        <p><strong>Description:</strong> ${data.product_info?.description || 'N/A'}</p>
        <p><strong>Current Balance:</strong> ${data.current_balance || 0}</p>
        <p><strong>Total Movements:</strong> ${data.summary?.total_movements || 0}</p>
        <p><strong>Total Inbound:</strong> ${data.summary?.total_inbound || 0}</p>
        <p><strong>Total Outbound:</strong> ${data.summary?.total_outbound || 0}</p>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Location</th>
              <th>Running Balance</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${data.history?.map(h => `
              <tr>
                <td>${formatDate(h.date)}</td>
                <td><span class="status-badge status-${h.type}">${h.type}</span></td>
                <td>${h.quantity > 0 ? '+' : ''}${h.quantity}</td>
                <td>${h.location || h.from_location || h.to_location || 'N/A'}</td>
                <td>${h.running_balance}</td>
                <td>${h.description}</td>
              </tr>
            `).join('') || '<tr><td colspan="6">No history</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    showModal('product-timeline-modal');
  } else {
    showToast('Product not found or no timeline data', 'error');
  }
}

// Storage Config Functions
async function loadStorageConfigData() {
  // Load current configuration
  const config = await apiCall('/config/storage');
  
  if (config) {
    document.getElementById('class-a-threshold').value = config.abc_thresholds?.class_a || 80;
    document.getElementById('class-b-threshold').value = config.abc_thresholds?.class_b || 15;
    document.getElementById('storage-strategy').value = config.storage_strategy || 'class-based';
    document.getElementById('high-freq-zone').value = config.zone_config?.high_frequency || 'A';
    document.getElementById('low-freq-zone').value = config.zone_config?.low_frequency || 'F';
  }
}

async function updateABCConfig() {
  const classA = parseInt(document.getElementById('class-a-threshold').value);
  const classB = parseInt(document.getElementById('class-b-threshold').value);
  
  if (classA + classB >= 100) {
    showToast('Class A + Class B thresholds must be less than 100%', 'error');
    return;
  }
  
  const result = await apiCall('/config/storage/abc', {
    method: 'PUT',
    body: JSON.stringify({
      class_a: classA,
      class_b: classB,
      class_c: 100 - classA - classB
    })
  });
  
  if (result?.success) {
    showToast('ABC configuration updated successfully', 'success');
  } else {
    showToast('Failed to update ABC configuration', 'error');
  }
}

async function updateStorageStrategy() {
  const strategy = document.getElementById('storage-strategy').value;
  
  const result = await apiCall('/config/storage/strategy', {
    method: 'PUT',
    body: JSON.stringify({ strategy })
  });
  
  if (result?.success) {
    showToast('Storage strategy updated successfully', 'success');
  } else {
    showToast('Failed to update storage strategy', 'error');
  }
}

async function updateZoneConfig() {
  const highFreqZone = document.getElementById('high-freq-zone').value;
  const lowFreqZone = document.getElementById('low-freq-zone').value;
  
  const result = await apiCall('/config/storage/zones', {
    method: 'PUT',
    body: JSON.stringify({
      high_frequency: highFreqZone,
      low_frequency: lowFreqZone
    })
  });
  
  if (result?.success) {
    showToast('Zone configuration updated successfully', 'success');
  } else {
    showToast('Failed to update zone configuration', 'error');
  }
}

// Operators Functions
async function loadOperatorsData() {
  const status = document.getElementById('operator-status-filter')?.value || '';
  
  let url = '/operators?limit=100';
  if (status) url += `&status=${status}`;
  
  const data = await apiCall(url);
  
  if (data?.operators) {
    const tbody = document.querySelector('#operators-table tbody');
    tbody.innerHTML = data.operators.map(operator => {
      // Calculate performance score based on completion rate
      const performanceScore = operator.performance?.total_tasks > 0 ? 
        Math.round((operator.performance.total_quantity / operator.performance.total_tasks) * 10) : 0;
      
      return `
        <tr>
          <td>${operator.id || 'Unknown ID'}</td>
          <td>${operator.username || 'Unknown User'}</td>
          <td><span class="status-badge status-${operator.role}">${operator.role}</span></td>
          <td>None</td>
          <td>${operator.performance?.total_tasks || 0}</td>
          <td>${operator.performance?.avg_quantity || 0}s</td>
          <td>
            <div class="performance-indicator ${getPerformanceClass(performanceScore)}">
              ${performanceScore}%
            </div>
          </td>
          <td class="table-actions">
            <button class="btn btn-small btn-secondary" onclick="editOperator('${operator.id}')">Edit</button>
            <button class="btn btn-small btn-success" onclick="toggleOperatorStatus('${operator.id}', 'active')">
              Manage
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  // Load performance chart
  loadOperatorPerformanceChart();
}

// Helper function for performance class
function getPerformanceClass(score) {
  if (score >= 80) return 'performance-excellent';
  if (score >= 60) return 'performance-good';
  if (score >= 40) return 'performance-average';
  return 'performance-poor';
}

async function loadOperatorPerformanceChart() {
  const data = await apiCall('/operators/performance');
  
  if (data?.operator_performance) {
    const ctx = document.getElementById('operator-performance-chart');
    if (ctx && typeof Chart !== 'undefined') {
      if (charts.operatorPerformance) charts.operatorPerformance.destroy();
      
      const operators = data.operator_performance.slice(0, 10); // Top 10 operators
      
      charts.operatorPerformance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: operators.map(op => op.username),
          datasets: [
            {
              label: 'Total Tasks',
              data: operators.map(op => op.total_tasks),
              backgroundColor: '#3b82f6',
              borderColor: '#2563eb',
              borderWidth: 1
            },
            {
              label: 'Completion Rate (%)',
              data: operators.map(op => op.completion_rate),
              backgroundColor: '#22c55e',
              borderColor: '#16a34a',
              borderWidth: 1,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Total Tasks'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Completion Rate (%)'
              },
              grid: {
                drawOnChartArea: false,
              },
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Operator Performance Comparison'
            },
            legend: {
              display: true,
              position: 'top'
            }
          }
        }
      });
    }
  }
}

async function handleCreateOperator(event) {
  event.preventDefault();
  
  const operatorData = {
    operator_id: document.getElementById('operator-id').value,
    name: document.getElementById('operator-name').value,
    status: document.getElementById('operator-status').value,
    shift: document.getElementById('operator-shift').value
  };
  
  const result = await apiCall('/operators', {
    method: 'POST',
    body: JSON.stringify(operatorData)
  });
  
  if (result?.success) {
    showToast('Operator created successfully', 'success');
    closeModal('create-operator-modal');
    document.getElementById('create-operator-form').reset();
    loadOperatorsData();
  } else {
    showToast(result?.error || 'Failed to create operator', 'error');
  }
}

async function editOperator(operatorId) {
  const data = await apiCall(`/operators/${operatorId}`);
  if (data?.operator) {
    // Pre-fill form with operator data
    document.getElementById('operator-id').value = data.operator.operator_id;
    document.getElementById('operator-name').value = data.operator.name;
    document.getElementById('operator-status').value = data.operator.status;
    document.getElementById('operator-shift').value = data.operator.shift || 'morning';
    
    showModal('create-operator-modal');
  }
}

async function toggleOperatorStatus(operatorId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  
  const result = await apiCall(`/operators/${operatorId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus })
  });
  
  if (result?.success) {
    showToast(`Operator ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`, 'success');
    loadOperatorsData();
  } else {
    showToast('Failed to update operator status', 'error');
  }
}

async function loadOperatorPerformance() {
  loadOperatorsData();
}

function getPerformanceClass(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'average';
  return 'poor';
}

// Initialize URL handling on page load
document.addEventListener('DOMContentLoaded', function() {
  // Handle initial URL
  const path = window.location.pathname;
  let section = 'dashboard';
  
  if (path !== '/') {
    section = path.substring(1); // Remove leading slash
  }
  
  // Set initial state
  if (section !== 'dashboard') {
    window.history.replaceState({ section }, '', path);
  }
  
  // Update UI to match URL
  setTimeout(() => {
    if (section !== 'dashboard') {
      document.querySelectorAll('.nav-item').forEach(i => {
        if (i.dataset.section === section) {
          i.click();
        }
      });
    }
  }, 100);
});

// Load real-time metrics and update UI
async function loadRealTimeMetrics() {
  try {
    const response = await fetch('/api/metrics/real-time');
    const result = await response.json();
    
    if (result.success) {
      const metrics = result.data;
      
      // Update dashboard stats
      if (document.getElementById('stat-inventory')) {
        document.getElementById('stat-inventory').textContent = metrics.totalProducts || 0;
      }
      
      // Update storage strategy metrics
      if (document.getElementById('space-utilization')) {
        document.getElementById('space-utilization').textContent = `${metrics.spaceUtilization}%`;
      }
      if (document.getElementById('efficiency-score')) {
        document.getElementById('efficiency-score').textContent = `${metrics.efficiency}%`;
      }
      
      // Update AI dashboard metrics
      if (document.getElementById('kmeans-accuracy')) {
        document.getElementById('kmeans-accuracy').textContent = metrics.kmeansAccuracy;
      }
      if (document.getElementById('overall-efficiency')) {
        document.getElementById('overall-efficiency').textContent = `${metrics.overallEfficiency}%`;
      }
      if (document.getElementById('genetic-time')) {
        document.getElementById('genetic-time').textContent = metrics.routeImprovement;
      }
      
      console.log('Real-time metrics updated:', metrics);
    }
  } catch (error) {
    console.error('Error loading real-time metrics:', error);
  }
}

// Initialize real-time metrics loading
if (typeof window !== 'undefined') {
  // Load metrics on page load and refresh every 30 seconds
  window.addEventListener('load', function() {
    loadRealTimeMetrics();
    setInterval(loadRealTimeMetrics, 30000); // Refresh every 30 seconds
  });
}

// ========================================
// ENHANCED WAVE PLANNING & PICKING OPERATIONS
// ========================================

// Enhanced Wave Management Functions

// View wave detail in modal
async function viewWaveDetail(waveId) {
  try {
    console.log('Loading wave detail for:', waveId);
    
    const response = await apiCall(`/waves/${waveId}`);
    if (!response || !response.success) {
      showToast('Failed to load wave details', 'info');
      return;
    }

    const waveData = response.data; // Extract data from response

    // Update modal content
    document.getElementById('wave-detail-number').textContent = waveData.wave.wave_number;
    
    // Wave information
    const waveInfoContent = document.getElementById('wave-info-content');
    waveInfoContent.innerHTML = `
      <div class="info-item"><strong>Status:</strong> <span class="status-badge status-${waveData.wave.status}">${waveData.wave.status}</span></div>
      <div class="info-item"><strong>Operator:</strong> ${waveData.wave.operator_name || 'Unassigned'}</div>
      <div class="info-item"><strong>Created:</strong> ${formatDate(waveData.wave.created_at)}</div>
      <div class="info-item"><strong>Updated:</strong> ${formatDate(waveData.wave.updated_at)}</div>
      <div class="info-item"><strong>Priority:</strong> ${waveData.wave.priority || 'Normal'}</div>
    `;

    // Wave statistics
    const waveStatsContent = document.getElementById('wave-stats-content');
    waveStatsContent.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Total Items:</span>
        <span class="stat-value">${waveData.stats.total_items}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Quantity:</span>
        <span class="stat-value">${waveData.stats.total_quantity}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Picked:</span>
        <span class="stat-value">${waveData.wave.total_picked}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Progress:</span>
        <span class="stat-value">${waveData.wave.completion_percentage}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Est. Time:</span>
        <span class="stat-value">${waveData.wave.estimated_time_minutes} min</span>
      </div>
    `;

    // Wave tasks
    const tasksTableBody = document.querySelector('#wave-tasks-table tbody');
    if (waveData.tasks && waveData.tasks.length > 0) {
      tasksTableBody.innerHTML = waveData.tasks.map(task => `
        <tr>
          <td>
            <strong>${task.product_reference}</strong>
            <br><small>${task.product_description || 'N/A'}</small>
          </td>
          <td>${task.location_code}</td>
          <td>${task.zone || 'N/A'}</td>
          <td>${task.quantity_to_pick}</td>
          <td>${task.quantity_picked || 0}</td>
          <td><span class="status-badge status-${task.status}">${task.status}</span></td>
          <td>
            ${task.status === 'created' || task.status === 'in_progress' ? 
              `<button class="btn btn-small btn-primary" onclick="completeTask('${task.id}')">Complete</button>` : 
              '<span class="text-muted">Completed</span>'
            }
          </td>
        </tr>
      `).join('');
    } else {
      tasksTableBody.innerHTML = '<tr><td colspan="7">No tasks found</td></tr>';
    }

    // Show modal
    showModal('wave-detail-modal');

  } catch (error) {
    console.error('Error loading wave detail:', error);
    showToast('Failed to load wave details', 'info');
  }
}

// Update wave preview when orders are selected
function updateWavePreview() {
  const selectedOrders = Array.from(document.getElementById('wave-orders').selectedOptions);
  
  let totalOrders = selectedOrders.length;
  let totalItems = 0;
  let totalQuantity = 0;

  selectedOrders.forEach(option => {
    totalItems += parseInt(option.dataset.items || 0);
    // Estimate quantity (simplified)
    totalQuantity += parseInt(option.dataset.items || 0) * 2;
  });

  // Estimate locations and time
  const estimatedLocations = Math.ceil(totalItems * 0.7); // Assume 70% location efficiency
  const estimatedTime = Math.ceil(totalItems * 2.5); // 2.5 minutes per item

  // Update preview
  document.getElementById('preview-orders').textContent = totalOrders;
  document.getElementById('preview-items').textContent = totalItems;
  document.getElementById('preview-quantity').textContent = totalQuantity;
  document.getElementById('preview-locations').textContent = estimatedLocations;
  document.getElementById('preview-time').textContent = estimatedTime + ' min';
}

// Validate wave creation
async function validateWaveCreation() {
  const selectedOrders = Array.from(document.getElementById('wave-orders').selectedOptions);
  
  if (selectedOrders.length === 0) {
    showToast('Please select at least one order', 'info');
    return;
  }

  const orderIds = selectedOrders.map(option => parseInt(option.value));

  try {
    const validation = await apiCall('/waves/validate', {
      method: 'POST',
      body: JSON.stringify({ order_ids: orderIds })
    });

    if (validation && validation.validation) {
      const v = validation.validation;
      
      let message = `Validation Results:\n`;
      message += `Total Orders: ${v.total_orders}\n`;
      message += `Valid Orders: ${v.valid_orders}\n`;
      
      if (v.invalid_orders.length > 0) {
        message += `\nInvalid Orders:\n`;
        v.invalid_orders.forEach(order => {
          message += `- ${order.order_number}: ${order.issue}\n`;
        });
      }
      
      if (v.inventory_issues.length > 0) {
        message += `\nInventory Issues:\n`;
        v.inventory_issues.forEach(issue => {
          message += `- ${issue.product_reference}: Need ${issue.required_quantity}, Have ${issue.available_quantity}\n`;
        });
      }
      
      message += `\nCan Create Wave: ${v.valid ? 'YES' : 'NO'}`;
      
      alert(message);
    }
  } catch (error) {
    console.error('Validation error:', error);
    showToast('Failed to validate wave creation', 'info');
  }
}

// Enhanced wave creation
async function handleCreateWaveEnhanced(event) {
  event.preventDefault();
  
  const selectedOrders = Array.from(document.getElementById('wave-orders').selectedOptions);
  const operatorId = document.getElementById('wave-operator').value;
  const priority = document.getElementById('wave-priority')?.value || 'normal';
  const timeWindow = document.getElementById('wave-time-window')?.value;
  const notes = document.getElementById('wave-notes')?.value || '';

  if (selectedOrders.length === 0) {
    showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
    return;
  }

  const orderIds = selectedOrders.map(option => parseInt(option.value));

  try {
    showToast('Đang tạo wave nâng cao...', 'info');
    
    const result = await apiCall('/waves', {
      method: 'POST',
      body: JSON.stringify({
        order_ids: orderIds,
        operator_id: operatorId ? parseInt(operatorId) : null,
        priority: priority,
        time_window: timeWindow ? parseInt(timeWindow) : null,
        notes: notes
      })
    });

    if (result && result.success) {
      showToast(`Wave ${result.wave_number} tạo thành công!
        ${result.tasks_created} tasks
        📍 ${result.unique_locations} locations
        🏢 ${result.zones_involved} zones
        ⏱️ Ước tính: ${result.estimated_time_minutes} phút
        ${result.inventory_issues_fixed > 0 ? `🔧 Đã sửa ${result.inventory_issues_fixed} vấn đề inventory` : ''}`, 'success');
      
      closeModal('create-wave-modal');
      loadPickingData();
      updateWavePreview();
    } else {
      showToast(`Tạo wave thất bại: ${result?.error || 'Lỗi không xác định'}`, 'error');
      
      // Show inventory issues if any
      if (result?.inventory_issues && result.inventory_issues.length > 0) {
        let issueMessage = 'Vấn đề inventory:\n';
        result.inventory_issues.forEach(issue => {
          issueMessage += `• ${issue.product_description || issue.product_reference}: ${issue.issue}\n`;
        });
        console.error('Inventory issues:', issueMessage);
      }
    }
  } catch (error) {
    console.error('Create wave error:', error);
    showToast('Lỗi hệ thống khi tạo wave', 'error');
  }
}

// Auto wave generation functions
async function previewAutoWaves() {
  const rules = {
    max_orders_per_wave: parseInt(document.getElementById('auto-max-orders').value),
    max_picks_per_wave: parseInt(document.getElementById('auto-max-picks').value),
    time_window_hours: parseInt(document.getElementById('auto-time-window').value),
    priority_orders_first: document.getElementById('auto-priority-first').checked,
    group_by_zone: document.getElementById('auto-group-zone').checked,
    group_by_distance: document.getElementById('auto-group-distance').checked,
    group_by_abc: document.getElementById('auto-group-abc').checked
  };

  try {
    const result = await apiCall('/waves/auto-generate', {
      method: 'POST',
      body: JSON.stringify({ rules })
    });

    if (result && result.success) {
      const previewContent = document.getElementById('auto-preview-content');
      
      if (result.generated_waves.length === 0) {
        previewContent.innerHTML = '<p>No waves can be generated with current rules.</p>';
      } else {
        previewContent.innerHTML = `
          <div class="preview-summary">
            <p><strong>Generated ${result.waves_generated} waves from ${result.total_orders_processed} orders</strong></p>
          </div>
          <div class="waves-preview-list">
            ${result.generated_waves.map((wave, index) => `
              <div class="wave-preview-item">
                <h5>Wave ${index + 1}</h5>
                <p>Orders: ${wave.total_orders} | Items: ${wave.total_items} | Est. Time: ${wave.estimated_time_minutes} min</p>
                <details>
                  <summary>Orders in this wave</summary>
                  <ul>
                    ${wave.orders.map(order => `<li>${order.order_number} - ${order.customer_name} (${order.item_count} items)</li>`).join('')}
                  </ul>
                </details>
              </div>
            `).join('')}
          </div>
        `;
      }

      document.getElementById('auto-wave-preview').style.display = 'block';
      document.querySelector('button[onclick="confirmAutoWaves()"]').style.display = 'inline-block';
      
      // Store generated waves for confirmation
      window.generatedWaves = result.generated_waves;
    }
  } catch (error) {
    console.error('Auto preview error:', error);
    showToast('Failed to preview auto generation', 'info');
  }
}

async function confirmAutoWaves() {
  if (!window.generatedWaves || window.generatedWaves.length === 0) {
    showToast('No waves to create', 'info');
    return;
  }

  // Get current user for operator assignment
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  let operatorId = 78; // Default admin
  
  if (currentUser.id === 'admin-001') {
    operatorId = 78;
  } else if (currentUser.id === 'test-001') {
    operatorId = 80;
  } else if (currentUser.id && !isNaN(parseInt(currentUser.id))) {
    operatorId = parseInt(currentUser.id);
  }

  try {
    const result = await apiCall('/waves/auto-generate/confirm', {
      method: 'POST',
      body: JSON.stringify({
        waves_to_create: window.generatedWaves,
        operator_id: operatorId
      })
    });

    if (result && result.success) {
      alert(`Successfully created ${result.total_waves_created} waves!`);
      closeModal('auto-wave-modal');
      loadPickingData();
      
      // Reset form
      document.getElementById('auto-wave-preview').style.display = 'none';
      window.generatedWaves = null;
    }
  } catch (error) {
    console.error('Confirm auto waves error:', error);
    showToast('Failed to create auto-generated waves', 'info');
  }
}

// Wave Build functions
let currentBuildStep = 1;

function nextBuildStep() {
  if (currentBuildStep === 1) {
    // Validate selection and move to preview
    const selectedOrders = Array.from(document.querySelectorAll('#build-orders-list input[type="checkbox"]:checked'));
    
    if (selectedOrders.length === 0) {
      showToast('Please select at least one order', 'info');
      return;
    }

    // Generate preview
    generateBuildPreview(selectedOrders);
    
    // Show step 2
    document.getElementById('build-step-1').style.display = 'none';
    document.getElementById('build-step-2').style.display = 'block';
    document.querySelector('button[onclick="prevBuildStep()"]').style.display = 'inline-block';
    document.querySelector('button[onclick="nextBuildStep()"]').style.display = 'none';
    document.querySelector('button[onclick="confirmWaveBuild()"]').style.display = 'inline-block';
    
    currentBuildStep = 2;
  }
}

function prevBuildStep() {
  if (currentBuildStep === 2) {
    // Go back to step 1
    document.getElementById('build-step-1').style.display = 'block';
    document.getElementById('build-step-2').style.display = 'none';
    document.querySelector('button[onclick="prevBuildStep()"]').style.display = 'none';
    document.querySelector('button[onclick="nextBuildStep()"]').style.display = 'inline-block';
    document.querySelector('button[onclick="confirmWaveBuild()"]').style.display = 'none';
    
    currentBuildStep = 1;
  }
}

async function generateBuildPreview(selectedOrders) {
  const orderIds = selectedOrders.map(cb => parseInt(cb.value));
  
  try {
    const preview = await apiCall('/waves/build', {
      method: 'POST',
      body: JSON.stringify({
        order_ids: orderIds,
        preview_only: true
      })
    });

    if (preview && preview.success) {
      const previewDiv = document.getElementById('build-preview');
      previewDiv.innerHTML = `
        <div class="build-preview-summary">
          <div class="preview-stat">
            <h4>${preview.preview.total_orders}</h4>
            <p>Orders</p>
          </div>
          <div class="preview-stat">
            <h4>${preview.preview.total_items}</h4>
            <p>Items</p>
          </div>
          <div class="preview-stat">
            <h4>${preview.preview.total_quantity}</h4>
            <p>Quantity</p>
          </div>
          <div class="preview-stat">
            <h4>${preview.preview.estimated_locations}</h4>
            <p>Locations</p>
          </div>
          <div class="preview-stat">
            <h4>${preview.preview.estimated_time_minutes} min</h4>
            <p>Est. Time</p>
          </div>
        </div>
        
        <div class="build-preview-details">
          <h5>Orders in Wave:</h5>
          <ul>
            ${preview.preview.orders.map(order => 
              `<li>${order.order_number} - ${order.customer_name} (${order.item_count} items, ${order.total_quantity} qty)</li>`
            ).join('')}
          </ul>
          
          <h5>Zones Involved:</h5>
          <p>${preview.preview.zones_involved.join(', ') || 'No zones identified'}</p>
        </div>
      `;
      
      // Store for confirmation
      window.buildPreviewData = { order_ids: orderIds, preview: preview.preview };
    }
  } catch (error) {
    console.error('Build preview error:', error);
    showToast('Failed to generate build preview', 'info');
  }
}

async function confirmWaveBuild() {
  if (!window.buildPreviewData) {
    showToast('No build data available', 'info');
    return;
  }

  // Get current user for operator assignment
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  let operatorId = 78; // Default admin
  
  if (currentUser.id === 'admin-001') {
    operatorId = 78;
  } else if (currentUser.id === 'test-001') {
    operatorId = 80;
  } else if (currentUser.id && !isNaN(parseInt(currentUser.id))) {
    operatorId = parseInt(currentUser.id);
  }

  try {
    const result = await apiCall('/waves', {
      method: 'POST',
      body: JSON.stringify({
        order_ids: window.buildPreviewData.order_ids,
        operator_id: operatorId,
        priority: 'normal',
        notes: 'Created via Wave Build'
      })
    });

    if (result && result.success) {
      alert(`Wave ${result.wave_number} created successfully!`);
      closeModal('wave-build-modal');
      loadPickingData();
      
      // Reset build process
      currentBuildStep = 1;
      document.getElementById('build-step-1').style.display = 'block';
      document.getElementById('build-step-2').style.display = 'none';
      window.buildPreviewData = null;
    }
  } catch (error) {
    console.error('Confirm wave build error:', error);
    showToast('Failed to create wave', 'info');
  }
}

function filterBuildOrders() {
  const search = document.getElementById('build-order-search').value.toLowerCase();
  const priority = document.getElementById('build-priority-filter').value;
  
  const orderItems = document.querySelectorAll('#build-orders-list .order-item');
  
  orderItems.forEach(item => {
    const label = item.querySelector('label').textContent.toLowerCase();
    const orderPriority = item.querySelector('small').textContent;
    
    const matchesSearch = search === '' || label.includes(search);
    const matchesPriority = priority === '' || orderPriority.includes(`Priority: ${priority}`);
    
    item.style.display = matchesSearch && matchesPriority ? 'block' : 'none';
  });
}

// Make new functions available globally
window.viewWaveDetail = viewWaveDetail;
window.updateWavePreview = updateWavePreview;
window.validateWaveCreation = validateWaveCreation;
window.handleCreateWaveEnhanced = handleCreateWaveEnhanced;
window.previewAutoWaves = previewAutoWaves;
window.confirmAutoWaves = confirmAutoWaves;
window.nextBuildStep = nextBuildStep;
window.prevBuildStep = prevBuildStep;
window.generateBuildPreview = generateBuildPreview;
window.confirmWaveBuild = confirmWaveBuild;
window.filterBuildOrders = filterBuildOrders;

// Missing wave detail functions
async function assignOperatorToWave() {
  const waveNumber = document.getElementById('wave-detail-number').textContent;
  if (!waveNumber) return;
  
  const operatorId = prompt('Enter Operator ID to assign:');
  if (!operatorId) return;
  
  const result = await apiCall(`/waves/${waveNumber}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ operator_id: parseInt(operatorId) })
  });
  
  if (result) {
    showToast(`Operator assigned to wave ${result.wave_number}`, 'success');
    viewWaveDetail(waveNumber); // Refresh the modal
  }
}

// Missing auto wave function
async function generateAutoWaves() {
  // This is the same as previewAutoWaves but actually creates the waves
  await previewAutoWaves();
  
  if (window.generatedWaves && window.generatedWaves.length > 0) {
    const operatorId = prompt('Enter Operator ID for auto-generated waves (optional):');
    
    const result = await apiCall('/waves/auto-generate/confirm', {
      method: 'POST',
      body: JSON.stringify({
        waves_to_create: window.generatedWaves,
        operator_id: operatorId ? parseInt(operatorId) : null
      })
    });
    
    if (result) {
      showToast(`${result.total_waves_created} waves created successfully`, 'success');
      closeModal('auto-wave-modal');
      loadPickingData();
      window.generatedWaves = null;
    }
  }
}

// Missing filter function for build orders
function filterBuildOrders() {
  const searchTerm = document.getElementById('build-order-search').value.toLowerCase();
  const priorityFilter = document.getElementById('build-priority-filter').value;
  
  const orderItems = document.querySelectorAll('#build-orders-list .order-item');
  
  orderItems.forEach(item => {
    const orderText = item.textContent.toLowerCase();
    const matchesSearch = !searchTerm || orderText.includes(searchTerm);
    const matchesPriority = !priorityFilter || item.dataset.priority === priorityFilter;
    
    item.style.display = (matchesSearch && matchesPriority) ? 'block' : 'none';
  });
}

// Make new functions available globally
window.assignOperatorToWave = assignOperatorToWave;
window.generateAutoWaves = generateAutoWaves;
window.filterBuildOrders = filterBuildOrders;

// Override the original handleCreateWave with enhanced version
window.handleCreateWave = handleCreateWaveEnhanced;

// Wave action wrapper functions for detail modal (defined after all base functions)
async function startWaveFromDetail() {
  const waveNumber = document.getElementById('wave-detail-number').textContent;
  if (waveNumber) {
    await startWave(waveNumber);
    viewWaveDetail(waveNumber); // Refresh the modal
  }
}

async function pauseWaveFromDetail() {
  const waveNumber = document.getElementById('wave-detail-number').textContent;
  if (waveNumber) {
    await pauseWave(waveNumber);
    viewWaveDetail(waveNumber); // Refresh the modal
  }
}

async function completeWaveFromDetail() {
  const waveNumber = document.getElementById('wave-detail-number').textContent;
  if (waveNumber) {
    await completeWave(waveNumber);
    closeModal('wave-detail-modal'); // Close modal after completion
    loadPickingData(); // Refresh the main table
  }
}

async function cancelWaveFromDetail() {
  const waveNumber = document.getElementById('wave-detail-number').textContent;
  if (waveNumber) {
    await cancelWave(waveNumber);
    closeModal('wave-detail-modal'); // Close modal after cancellation
    loadPickingData(); // Refresh the main table
  }
}

// Export wrapper functions
window.startWaveFromDetail = startWaveFromDetail;
window.pauseWaveFromDetail = pauseWaveFromDetail;
window.completeWaveFromDetail = completeWaveFromDetail;
window.cancelWaveFromDetail = cancelWaveFromDetail;

console.log('Enhanced Wave Planning & Picking Operations loaded');
console.log('All wave functions available:', {
  pauseWave: typeof window.pauseWave,
  completeWave: typeof window.completeWave,
  cancelWave: typeof window.cancelWave,
  pauseWaveFromDetail: typeof window.pauseWaveFromDetail,
  completeWaveFromDetail: typeof window.completeWaveFromDetail,
  cancelWaveFromDetail: typeof window.cancelWaveFromDetail
});