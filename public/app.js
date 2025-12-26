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
  checkAuthStatus();
  setupEventListeners();
  
  // Setup login form handler
  console.log('Setting up login form handler...');
  const loginForm = document.getElementById('login-form');
  
  if (!loginForm) {
    console.error('Login form not found!');
  } else {
    console.log('Login form found, adding event listener...');
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      console.log('Login form submitted!');
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('login-error');
      
      console.log('Login attempt:', { username, password: '***' });
      
      try {
        console.log('Sending login request...');
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (response.ok) {
          console.log('Login successful, setting up user data...');
          authToken = data.token;
          currentUser = data.user;
          localStorage.setItem('authToken', authToken);
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          errorEl.textContent = '';
          
          console.log('Calling showDashboard...');
          showDashboard();
        } else {
          console.log('Login failed:', data.error);
          errorEl.textContent = data.error || 'Login failed';
        }
      } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = 'Connection error. Please try again.';
      }
    });
  }
  
  // Setup logout handler
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
  
  // Debug: Check if functions are available
  setTimeout(() => {
    console.log('Function check:');
    console.log('  - openAdjustModal:', typeof window.openAdjustModal);
    console.log('  - adjustStock:', typeof window.adjustStock);
    console.log('  - viewWave:', typeof window.viewWave);
    console.log('  - startWave:', typeof window.startWave);
    console.log('  - Auth token exists:', !!localStorage.getItem('authToken'));
  }, 1000);
});

// Check authentication status from localStorage
function checkAuthStatus() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('currentUser');
  
  if (token && user) {
    authToken = token;
    currentUser = JSON.parse(user);
    showDashboard();
  } else {
    showLoginScreen();
  }
}

// Authentication handled by API only

function showLoginScreen() {
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('dashboard-screen').classList.remove('active');
}

function showDashboard() {
  console.log('Showing dashboard...');
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('dashboard-screen').classList.add('active');
  
  if (currentUser) {
    document.getElementById('user-role').textContent = currentUser.role;
    document.getElementById('username-display').textContent = currentUser.username;
  }
  
  // Load dashboard data after showing the screen
  setTimeout(() => {
    loadDashboardData();
  }, 100);
}

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
  console.log('Setting up login form handler...');
  const loginForm = document.getElementById('login-form');
  
  if (!loginForm) {
    console.error('Login form not found!');
    return;
  }
  
  console.log('Login form found, adding event listener...');
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log('Login form submitted!');
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    
    console.log('Login attempt:', { username, password: '***' });
    
    try {
      console.log('Sending login request...');
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      console.log('Login response:', data);
    
    if (response.ok) {
      console.log('Login successful, setting up user data...');
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      errorEl.textContent = '';
      
      console.log('Calling showDashboard...');
      // Stay on main page after login - no redirect needed
      showDashboard();
    } else {
      console.log('Login failed:', data.error);
      errorEl.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = 'Connection error. Please try again.';
  }
});

// API helper
async function apiCall(endpoint, options = {}) {
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
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
    
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      showLoginScreen();
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    return null;
  }
}

// Navigation
function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      const section = this.dataset.section;
      
      if (!section) return; // Skip if no data-section attribute
      
      // Update active states
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      
      // Update content sections
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`${section}-section`).classList.add('active');
      
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
  }
}


// Dashboard
async function loadDashboardData() {
  console.log('Loading dashboard data...');
  try {
    // Try authenticated API first, fallback to demo data
    let [inventorySummary, orderStats, pickingPerf] = await Promise.all([
      apiCall('/inventory/summary'),
      apiCall('/orders/stats/summary'),
      apiCall('/picking/performance')
    ]);
    
    console.log('API responses:', { inventorySummary, orderStats, pickingPerf });
    
    // If auth fails, use demo data
    if (!inventorySummary) {
      console.log('Using demo data...');
      [inventorySummary, orderStats, pickingPerf] = await Promise.all([
        fetch('/api/demo/inventory/summary').then(r => r.json()).catch(() => null),
        fetch('/api/demo/orders/stats/summary').then(r => r.json()).catch(() => null),
        fetch('/api/demo/picking/performance').then(r => r.json()).catch(() => null)
      ]);
    }
    
    // Update stats with fallback values
    document.getElementById('stat-inventory').textContent = inventorySummary?.total_products || '0';
    document.getElementById('stat-orders').textContent = orderStats?.pending || '0';
    document.getElementById('stat-picks').textContent = pickingPerf?.total_picks || '0';
    
    console.log('Dashboard data loaded successfully');
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Set default values on error
    document.getElementById('stat-inventory').textContent = '0';
    document.getElementById('stat-orders').textContent = '0';
    document.getElementById('stat-picks').textContent = '0';
  }
  
  let waves = await apiCall('/picking/waves?status=in_progress');
  if (!waves) {
    waves = await fetch('/api/demo/picking/waves').then(r => r.json());
  }
  if (waves) {
    const activeWaves = waves.waves?.filter(w => w.status === 'in_progress') || [];
    document.getElementById('stat-waves').textContent = activeWaves.length;
  }
  
  renderDashboardCharts(inventorySummary, orderStats);
}

function renderDashboardCharts(inventorySummary, orderStats) {
  // Inventory by Zone Chart
  const inventoryCtx = document.getElementById('inventory-chart');
  if (inventoryCtx && inventorySummary?.by_zone) {
    if (charts.inventory) charts.inventory.destroy();
    
    const zones = Object.keys(inventorySummary.by_zone);
    const quantities = zones.map(z => inventorySummary.by_zone[z].total_quantity);
    
    charts.inventory = new Chart(inventoryCtx, {
      type: 'bar',
      data: {
        labels: zones.map(z => `Zone ${z}`),
        datasets: [{
          label: 'Quantity',
          data: quantities,
          backgroundColor: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  }
  
  // Order Status Chart
  const ordersCtx = document.getElementById('orders-chart');
  if (ordersCtx && orderStats) {
    if (charts.orders) charts.orders.destroy();
    
    charts.orders = new Chart(ordersCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pending', 'Assigned', 'Picking', 'Picked', 'Shipped'],
        datasets: [{
          data: [
            orderStats.pending || 0,
            orderStats.assigned || 0,
            orderStats.picking || 0,
            orderStats.picked || 0,
            orderStats.shipped || 0
          ],
          backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#10b981']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

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
    tbody.innerHTML = data.inventory.map(item => `
      <tr>
        <td>${item.product?.reference || item.product_reference || 'N/A'}</td>
        <td>${item.product?.abc_code || item.abc_code || 'C'}</td>
        <td>${item.location?.location_code || item.location_code || 'N/A'}</td>
        <td>${item.location?.zone || item.zone || 'N/A'}</td>
        <td>${item.quantity || 0}</td>
        <td>${item.reserved_quantity || 0}</td>
        <td>${(item.quantity || 0) - (item.reserved_quantity || 0)}</td>
        <td>
          <button class="btn btn-small btn-secondary" onclick="openAdjustModal('${item.id}', ${item.quantity || 0})">Adjust</button>
        </td>
      </tr>
    `).join('');
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
  
  const data = await apiCall(url);
  
  if (data?.orders) {
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = data.orders.map(order => `
      <tr>
        <td>${order.order_number || 'N/A'}</td>
        <td>${order.customer_code || 'N/A'}</td>
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
  }
}

async function viewOrder(orderId) {
  const data = await apiCall(`/orders/${orderId}`);
  if (data) {
    alert(`Order: ${data.order.order_number}\nStatus: ${data.order.status}\nItems: ${data.items?.length || 0}`);
  }
}

// Picking
async function loadPickingData() {
  const status = document.getElementById('wave-status-filter')?.value || '';
  
  let url = '/picking/waves?limit=50';
  if (status) url += `&status=${status}`;
  
  const data = await apiCall(url);
  
  if (data?.waves) {
    const tbody = document.querySelector('#waves-table tbody');
    tbody.innerHTML = data.waves.map(wave => `
      <tr>
        <td>${wave.wave_number || 'N/A'}</td>
        <td><span class="status-badge status-${wave.status}">${wave.status}</span></td>
        <td>${wave.total_items || 0}</td>
        <td>${wave.assigned_operator_id || 'Unassigned'}</td>
        <td>${formatDate(wave.started_at)}</td>
        <td>
          <button class="btn btn-secondary" onclick="viewWave('${wave.id}')">View</button>
          ${wave.status === 'created' ? `<button class="btn btn-primary" onclick="startWave('${wave.id}')">Start</button>` : ''}
        </td>
      </tr>
    `).join('');
    
    // Update wave select for route optimization
    const waveSelect = document.getElementById('route-wave-id');
    if (waveSelect) {
      waveSelect.innerHTML = data.waves.map(w => 
        `<option value="${w.id}">Wave #${w.wave_number}</option>`
      ).join('');
    }
  }
}

async function viewWave(waveId) {
  const data = await apiCall(`/picking/waves/${waveId}`);
  if (data) {
    alert(`Wave: #${data.wave.wave_number}\nStatus: ${data.wave.status}\nTasks: ${data.tasks?.length || 0}`);
  }
}

async function startWave(waveId) {
  const result = await apiCall(`/picking/waves/${waveId}/start`, { method: 'POST' });
  if (result) {
    loadPickingData();
  }
}


// Warehouse
async function loadWarehouseData() {
  const data = await apiCall('/warehouse/layout');
  
  if (data) {
    document.getElementById('warehouse-locations').textContent = data.total_locations || 0;
    
    const totalCapacity = data.zone_summary?.reduce((sum, z) => sum + z.total_capacity, 0) || 0;
    document.getElementById('warehouse-capacity').textContent = totalCapacity;
    
    const totalOccupancy = data.zone_summary?.reduce((sum, z) => sum + z.total_occupancy, 0) || 0;
    const utilization = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;
    document.getElementById('warehouse-utilization').textContent = `${utilization}%`;
    
    renderZoneChart(data.zone_summary);
    loadWarehouseLayout();
  }
}

// Load warehouse layout visualization
function loadWarehouseLayout() {
  const layoutContainer = document.querySelector('.warehouse-map-container');
  if (layoutContainer) {
    // Add zone selector
    const zoneSelector = document.createElement('div');
    zoneSelector.innerHTML = `
      <h4>Warehouse Layout</h4>
      <div class="layout-controls">
        <label>Select Zone:</label>
        <select id="zone-selector" onchange="showZoneLayout(this.value)">
          <option value="Z1">Zone 1</option>
          <option value="Z2">Zone 2</option>
          <option value="Z3">Zone 3</option>
          <option value="Z4">Zone 4</option>
        </select>
      </div>
      <div id="layout-display"></div>
    `;
    layoutContainer.innerHTML = '';
    layoutContainer.appendChild(zoneSelector);
    
    // Load default zone
    showZoneLayout('Z1');
  }
}

// Show specific zone layout
function showZoneLayout(zone) {
  const layoutDisplay = document.getElementById('layout-display');
  if (layoutDisplay) {
    layoutDisplay.innerHTML = `
      <div class="layout-viewer">
        <h5>Zone ${zone.replace('Z', '')} Layout</h5>
        <div class="layout-options">
          <button onclick="showLayoutFile('${zone}', 'svg')" class="btn btn-secondary">SVG View</button>
          <button onclick="showLayoutFile('${zone}', 'pdf')" class="btn btn-secondary">PDF View</button>
        </div>
        <div id="layout-content-${zone}" class="layout-content"></div>
      </div>
    `;
  }
}

// Show layout file
function showLayoutFile(zone, type) {
  const contentDiv = document.getElementById(`layout-content-${zone}`);
  if (contentDiv) {
    if (type === 'svg') {
      contentDiv.innerHTML = `
        <div class="svg-container">
          <object data="/layouts/Layout_${zone}.0.svg" type="image/svg+xml" width="100%" height="600">
            <p>Your browser does not support SVG. <a href="/layouts/Layout_${zone}.0.pdf">View PDF instead</a></p>
          </object>
        </div>
      `;
    } else if (type === 'pdf') {
      contentDiv.innerHTML = `
        <div class="pdf-container">
          <embed src="/layouts/Layout_${zone}.0.pdf" type="application/pdf" width="100%" height="600">
          <p>If PDF doesn't load, <a href="/layouts/Layout_${zone}.0.pdf" target="_blank">click here to open in new tab</a></p>
        </div>
      `;
    }
  }
}

function renderZoneChart(zoneSummary) {
  const ctx = document.getElementById('zone-chart');
  if (!ctx || !zoneSummary) return;
  
  if (charts.zone) charts.zone.destroy();
  
  charts.zone = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: zoneSummary.map(z => `Zone ${z.zone}`),
      datasets: [
        {
          label: 'Capacity',
          data: zoneSummary.map(z => z.total_capacity),
          backgroundColor: '#e2e8f0'
        },
        {
          label: 'Occupancy',
          data: zoneSummary.map(z => z.total_occupancy),
          backgroundColor: '#2563eb'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// AI Optimization
async function loadAIData() {
  const waves = await apiCall('/picking/waves');
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
  resultDiv.innerHTML = '<p>Running K-Means clustering...</p>';
  
  const result = await apiCall('/ai/clustering/kmeans', {
    method: 'POST',
    body: JSON.stringify({ k })
  });
  
  if (result?.success) {
    const data = result.data;
    resultDiv.innerHTML = `
      <h4>K-Means Clustering Results</h4>
      <p>Total Products: ${data.summary?.totalProducts || 0}</p>
      <p>Class A (High Frequency): ${data.summary?.classA || 0} products</p>
      <p>Class B (Medium Frequency): ${data.summary?.classB || 0} products</p>
      <p>Class C (Low Frequency): ${data.summary?.classC || 0} products</p>
      <hr>
      <h5>Clusters:</h5>
      ${data.clusters?.map(c => `
        <p><strong>Cluster ${c.id} (Class ${c.class}):</strong> ${c.size} products</p>
      `).join('') || ''}
    `;
  } else {
    resultDiv.innerHTML = `<p class="error">Error: ${result?.error || 'Failed to run clustering'}</p>`;
  }
}

async function runDBSCAN() {
  const epsilon = parseFloat(document.getElementById('dbscan-epsilon').value) || 0.3;
  const minPoints = parseInt(document.getElementById('dbscan-minpoints').value) || 3;
  const resultDiv = document.getElementById('dbscan-result');
  resultDiv.innerHTML = '<p>Running DBSCAN clustering...</p>';
  
  const result = await apiCall('/ai/clustering/dbscan', {
    method: 'POST',
    body: JSON.stringify({ epsilon, minPoints })
  });
  
  if (result?.success) {
    const data = result.data;
    resultDiv.innerHTML = `
      <h4>DBSCAN Clustering Results</h4>
      <p>Total Products: ${data.summary?.totalProducts || 0}</p>
      <p>Number of Clusters: ${data.summary?.numClusters || 0}</p>
      <p>Noise Points (Outliers): ${data.summary?.numNoisePoints || 0}</p>
      <hr>
      <h5>Clusters:</h5>
      ${data.clusters?.map(c => `
        <p><strong>Cluster ${c.id}:</strong> ${c.size} products</p>
      `).join('') || ''}
      ${data.noisePoints?.length > 0 ? `
        <hr>
        <h5>Outliers:</h5>
        ${data.noisePoints.slice(0, 10).map(p => `
          <p>${p.reference}: ${p.reason}</p>
        `).join('')}
        ${data.noisePoints.length > 10 ? `<p>... and ${data.noisePoints.length - 10} more</p>` : ''}
      ` : ''}
    `;
  } else {
    resultDiv.innerHTML = `<p class="error">Error: ${result?.error || 'Failed to run clustering'}</p>`;
  }
}

async function runRouteOptimization() {
  const waveId = document.getElementById('route-wave-id').value;
  const resultDiv = document.getElementById('route-result');
  
  if (!waveId) {
    resultDiv.innerHTML = '<p class="error">Please select a wave</p>';
    return;
  }
  
  resultDiv.innerHTML = '<p>Optimizing route using Genetic Algorithm...</p>';
  
  const result = await apiCall('/ai/route/optimize', {
    method: 'POST',
    body: JSON.stringify({ wave_id: waveId })
  });
  
  if (result?.success) {
    const data = result.data;
    resultDiv.innerHTML = `
      <h4>Route Optimization Results</h4>
      <p>Algorithm: ${data.algorithm || 'Genetic Algorithm'}</p>
      <p>Original Distance: ${data.original_distance?.toFixed(2) || 0} meters</p>
      <p>Optimized Distance: ${data.optimized_distance?.toFixed(2) || 0} meters</p>
      <p><strong>Improvement: ${data.improvement_percentage?.toFixed(2) || 0}%</strong></p>
      <p>Estimated Time: ${data.estimated_time_minutes || 0} minutes</p>
      <hr>
      <h5>Optimized Route:</h5>
      <ol>
        ${data.optimized_route?.map(r => `
          <li>${r.location_code} (Qty: ${r.quantity})</li>
        `).join('') || '<li>No route data</li>'}
      </ol>
    `;
  } else {
    resultDiv.innerHTML = `<p class="error">Error: ${result?.error || 'Failed to optimize route'}</p>`;
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
  const [layout, utilization, orders, picking] = await Promise.all([
    apiCall('/warehouse/layout'),
    apiCall('/warehouse/utilization'),
    apiCall('/orders/stats/summary'),
    apiCall('/picking/performance')
  ]);
  
  let report = '='.repeat(60) + '\n';
  report += '           WAREHOUSE SUMMARY REPORT\n';
  report += '           Generated: ' + new Date().toLocaleString() + '\n';
  report += '='.repeat(60) + '\n\n';
  
  report += '--- WAREHOUSE OVERVIEW ---\n';
  report += `Total Locations: ${layout?.total_locations || 0}\n`;
  report += `Overall Utilization: ${utilization?.overall?.utilization_percentage || 0}%\n`;
  report += `Total Capacity: ${utilization?.overall?.total_capacity || 0}\n`;
  report += `Total Occupancy: ${utilization?.overall?.total_occupancy || 0}\n\n`;
  
  report += '--- ZONE BREAKDOWN ---\n';
  if (layout?.zone_summary) {
    layout.zone_summary.forEach(z => {
      report += `Zone ${z.zone}: ${z.total_locations} locations, ${Math.round(z.avg_utilization)}% utilization\n`;
    });
  }
  report += '\n';
  
  report += '--- ORDER STATUS ---\n';
  if (orders) {
    report += `Total Orders: ${orders.total_orders || 0}\n`;
    report += `Pending: ${orders.pending || 0}\n`;
    report += `In Progress: ${(orders.assigned || 0) + (orders.picking || 0)}\n`;
    report += `Completed: ${(orders.picked || 0) + (orders.shipped || 0)}\n`;
  }
  report += '\n';
  
  report += '--- PICKING PERFORMANCE ---\n';
  if (picking) {
    report += `Total Picks: ${picking.total_picks || 0}\n`;
    report += `Total Quantity Picked: ${picking.total_quantity || 0}\n`;
    report += `Average Pick Time: ${picking.average_pick_time_seconds || 0} seconds\n`;
  }
  
  return report;
}

async function generateOperatorPerformanceReport() {
  const picking = await apiCall('/picking/performance');
  const waves = await apiCall('/picking/waves?limit=100');
  
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
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch {
    return dateString;
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

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Inbound - Nhap Kho
async function handleInbound(event) {
  event.preventDefault();
  
  const data = {
    movement_type: 'inbound',
    product_reference: document.getElementById('inbound-product').value,
    to_location_code: document.getElementById('inbound-location').value,
    quantity: parseInt(document.getElementById('inbound-quantity').value),
    notes: document.getElementById('inbound-notes').value
  };
  
  const result = await apiCall('/warehouse/movements', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result) {
    showToast('Inbound successful!', 'success');
    closeModal('inbound-modal');
    document.getElementById('inbound-form').reset();
    loadInventoryData();
  } else {
    showToast('Inbound failed!', 'error');
  }
}

// Outbound - Xuat Kho
async function handleOutbound(event) {
  event.preventDefault();
  
  const data = {
    movement_type: 'outbound',
    product_reference: document.getElementById('outbound-product').value,
    from_location_code: document.getElementById('outbound-location').value,
    quantity: parseInt(document.getElementById('outbound-quantity').value),
    notes: document.getElementById('outbound-notes').value
  };
  
  const result = await apiCall('/warehouse/movements', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result) {
    showToast('Outbound successful!', 'success');
    closeModal('outbound-modal');
    document.getElementById('outbound-form').reset();
    loadInventoryData();
  } else {
    showToast('Outbound failed!', 'error');
  }
}

// Transfer - Chuyen Kho
async function handleTransfer(event) {
  event.preventDefault();
  
  const data = {
    movement_type: 'transfer',
    product_reference: document.getElementById('transfer-product').value,
    from_location_code: document.getElementById('transfer-from').value,
    to_location_code: document.getElementById('transfer-to').value,
    quantity: parseInt(document.getElementById('transfer-quantity').value)
  };
  
  const result = await apiCall('/warehouse/movements', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result) {
    showToast('Transfer successful!', 'success');
    closeModal('transfer-modal');
    document.getElementById('transfer-form').reset();
    loadInventoryData();
  } else {
    showToast('Transfer failed!', 'error');
  }
}

// Adjust Stock
async function handleAdjust(event) {
  event.preventDefault();
  
  const inventoryId = document.getElementById('adjust-inventory-id').value;
  const data = {
    quantity: parseInt(document.getElementById('adjust-quantity').value),
    reason: document.getElementById('adjust-reason').value
  };
  
  const result = await apiCall(`/inventory/${inventoryId}/adjust`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  
  if (result) {
    showToast('Stock adjusted!', 'success');
    closeModal('adjust-modal');
    document.getElementById('adjust-form').reset();
    loadInventoryData();
  } else {
    showToast('Adjustment failed!', 'error');
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
  
  const data = {
    order_number: document.getElementById('order-number').value,
    customer_code: document.getElementById('order-customer').value,
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
  const data = await apiCall('/orders?status=pending&limit=50');
  const select = document.getElementById('wave-orders');
  
  if (data?.orders) {
    select.innerHTML = data.orders.map(o => 
      `<option value="${o.id}">${o.order_number} - ${o.customer_code} (${o.total_items} items)</option>`
    ).join('');
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
  const selectedOrders = Array.from(orderSelect.selectedOptions).map(o => o.value);
  
  if (selectedOrders.length === 0) {
    showToast('Please select at least one order', 'error');
    return;
  }
  
  const data = {
    order_ids: selectedOrders,
    operator_id: document.getElementById('wave-operator').value || null
  };
  
  const result = await apiCall('/picking/waves', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result) {
    showToast(`Wave #${result.wave_number} created!`, 'success');
    closeModal('create-wave-modal');
    loadPickingData();
    loadOrdersData();
  } else {
    showToast('Failed to create wave!', 'error');
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
window.loadWarehouseVisualization = loadWarehouseVisualization;
window.showZoneLayout = showZoneLayout;
window.showLayoutFile = showLayoutFile;
window.visualizePickingRoute = visualizePickingRoute;
window.loadInventoryTimeline = loadInventoryTimeline;
window.loadDailySummary = loadDailySummary;
window.showProductTimeline = showProductTimeline;

// Make data loading functions available for refresh after operations
window.loadInventoryData = loadInventoryData;
window.loadOrdersData = loadOrdersData;
window.loadPickingData = loadPickingData;
window.loadWarehouseData = loadWarehouseData;

// Debug function to test all functions are available
window.debugFunctions = function() {
  console.log('Checking function availability:');
  console.log('openAdjustModal:', typeof window.openAdjustModal);
  console.log('viewWave:', typeof window.viewWave);
  console.log('startWave:', typeof window.startWave);
  console.log('adjustStock:', typeof window.adjustStock);
  console.log('reserveStock:', typeof window.reserveStock);
  console.log('updateOrderStatus:', typeof window.updateOrderStatus);
  console.log('authToken in localStorage:', !!localStorage.getItem('authToken'));
  
  // Test a simple API call
  const token = localStorage.getItem('authToken');
  if (token) {
    fetch('/api/inventory?limit=1', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => console.log('API test successful:', data.inventory?.length || 0, 'items'))
    .catch(error => console.error('API test failed:', error));
  } else {
    console.log('No auth token found');
  }
};

// Close modal when clicking outside
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});


// Warehouse Visualization
let warehouseLocations = [];
let canvasScale = 1;
let canvasOffsetX = 50;
let canvasOffsetY = 50;

async function loadWarehouseVisualization() {
  const data = await apiCall('/warehouse/3d-layout');
  if (!data?.locations) return;
  
  warehouseLocations = data.locations;
  const colorBy = document.getElementById('viz-color-by').value;
  
  drawWarehouseMap(warehouseLocations, colorBy);
  updateLegend(colorBy);
  loadWavesForRouteViz();
}

function drawWarehouseMap(locations, colorBy = 'zone') {
  const canvas = document.getElementById('warehouse-canvas');
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (locations.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No location data available', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Calculate scale
  const maxX = Math.max(...locations.map(l => l.x || 0));
  const maxY = Math.max(...locations.map(l => l.y || 0));
  const minX = Math.min(...locations.map(l => l.x || 0));
  const minY = Math.min(...locations.map(l => l.y || 0));
  
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  
  canvasScale = Math.min((canvas.width - 100) / rangeX, (canvas.height - 100) / rangeY);
  canvasOffsetX = 50 - minX * canvasScale;
  canvasOffsetY = 50 - minY * canvasScale;
  
  // Draw grid
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= canvas.width; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i <= canvas.height; i += 50) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
  
  // Draw entrance
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(canvasOffsetX, canvasOffsetY, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = '11px Inter';
  ctx.fillText('Entrance', canvasOffsetX - 20, canvasOffsetY + 25);
  
  // Draw locations
  locations.forEach(loc => {
    const x = loc.x * canvasScale + canvasOffsetX;
    const y = loc.y * canvasScale + canvasOffsetY;
    
    let color = getLocationColor(loc, colorBy);
    
    ctx.fillStyle = color;
    ctx.fillRect(x - 6, y - 6, 12, 12);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6, y - 6, 12, 12);
  });
  
  // Draw zone labels
  const zones = [...new Set(locations.map(l => l.zone))];
  zones.forEach(zone => {
    const zoneLocs = locations.filter(l => l.zone === zone);
    if (zoneLocs.length > 0) {
      const avgX = zoneLocs.reduce((s, l) => s + l.x, 0) / zoneLocs.length;
      const avgY = zoneLocs.reduce((s, l) => s + l.y, 0) / zoneLocs.length;
      const x = avgX * canvasScale + canvasOffsetX;
      const y = avgY * canvasScale + canvasOffsetY;
      
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 14px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(`Zone ${zone}`, x, y - 20);
    }
  });
}

function getLocationColor(loc, colorBy) {
  const zoneColors = {
    'A': '#ef4444', 'B': '#f59e0b', 'C': '#22c55e', 
    'H': '#3b82f6', 'S': '#8b5cf6', 'D': '#ec4899'
  };
  
  if (colorBy === 'zone') {
    return zoneColors[loc.zone] || '#94a3b8';
  } else if (colorBy === 'utilization') {
    const util = loc.capacity > 0 ? loc.current_occupancy / loc.capacity : 0;
    if (util > 0.8) return '#ef4444';
    if (util > 0.5) return '#f59e0b';
    if (util > 0.2) return '#22c55e';
    return '#94a3b8';
  } else if (colorBy === 'abc') {
    // Based on pick frequency
    if (loc.pick_frequency > 10) return '#ef4444';
    if (loc.pick_frequency > 5) return '#f59e0b';
    if (loc.pick_frequency > 0) return '#22c55e';
    return '#94a3b8';
  }
  return '#94a3b8';
}

function updateLegend(colorBy) {
  const legend = document.getElementById('viz-legend');
  
  if (colorBy === 'zone') {
    legend.innerHTML = `
      <div class="legend-item"><span class="legend-color" style="background:#ef4444"></span> Zone A</div>
      <div class="legend-item"><span class="legend-color" style="background:#f59e0b"></span> Zone B</div>
      <div class="legend-item"><span class="legend-color" style="background:#22c55e"></span> Zone C</div>
      <div class="legend-item"><span class="legend-color" style="background:#3b82f6"></span> Zone H</div>
      <div class="legend-item"><span class="legend-color" style="background:#8b5cf6"></span> Zone S</div>
    `;
  } else if (colorBy === 'utilization') {
    legend.innerHTML = `
      <div class="legend-item"><span class="legend-color" style="background:#ef4444"></span> High (>80%)</div>
      <div class="legend-item"><span class="legend-color" style="background:#f59e0b"></span> Medium (50-80%)</div>
      <div class="legend-item"><span class="legend-color" style="background:#22c55e"></span> Low (20-50%)</div>
      <div class="legend-item"><span class="legend-color" style="background:#94a3b8"></span> Empty (<20%)</div>
    `;
  } else if (colorBy === 'abc') {
    legend.innerHTML = `
      <div class="legend-item"><span class="legend-color" style="background:#ef4444"></span> Class A (High freq)</div>
      <div class="legend-item"><span class="legend-color" style="background:#f59e0b"></span> Class B (Medium)</div>
      <div class="legend-item"><span class="legend-color" style="background:#22c55e"></span> Class C (Low)</div>
      <div class="legend-item"><span class="legend-color" style="background:#94a3b8"></span> No picks</div>
    `;
  }
}

// Canvas hover tooltip
document.getElementById('warehouse-canvas')?.addEventListener('mousemove', function(e) {
  const rect = this.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const tooltip = document.getElementById('location-tooltip');
  let found = false;
  
  for (const loc of warehouseLocations) {
    const x = loc.x * canvasScale + canvasOffsetX;
    const y = loc.y * canvasScale + canvasOffsetY;
    
    if (Math.abs(mouseX - x) < 10 && Math.abs(mouseY - y) < 10) {
      tooltip.innerHTML = `
        <strong>${loc.location_code}</strong><br>
        Zone: ${loc.zone}<br>
        Position: (${loc.x}, ${loc.y}, ${loc.z})<br>
        Capacity: ${loc.current_occupancy || 0}/${loc.capacity || 100}<br>
        Pick Frequency: ${loc.pick_frequency || 0}
      `;
      tooltip.style.left = (e.clientX + 15) + 'px';
      tooltip.style.top = (e.clientY + 15) + 'px';
      tooltip.classList.add('visible');
      found = true;
      break;
    }
  }
  
  if (!found) {
    tooltip.classList.remove('visible');
  }
});

// Picking Route Visualization
async function loadWavesForRouteViz() {
  const data = await apiCall('/picking/waves?limit=20');
  const select = document.getElementById('route-viz-wave');
  
  if (data?.waves) {
    select.innerHTML = '<option value="">Select Wave</option>' +
      data.waves.map(w => `<option value="${w.id}">Wave #${w.wave_number} (${w.status})</option>`).join('');
  }
}

async function visualizePickingRoute() {
  const waveId = document.getElementById('route-viz-wave').value;
  if (!waveId) {
    showToast('Please select a wave', 'error');
    return;
  }
  
  const data = await apiCall(`/ai/route/visualization/${waveId}`);
  if (!data?.success) {
    showToast('Failed to get route data', 'error');
    return;
  }
  
  drawPickingRoute(data.data);
  showRouteInfo(data.data);
}

function drawPickingRoute(routeData) {
  const canvas = document.getElementById('route-canvas');
  const ctx = canvas.getContext('2d');
  
  // Clear
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const viz = routeData.visualization;
  if (!viz?.path || viz.path.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No route data', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Calculate scale
  const points = viz.path;
  const maxX = Math.max(...points.map(p => p.x || 0));
  const maxY = Math.max(...points.map(p => p.y || 0));
  const minX = Math.min(...points.map(p => p.x || 0));
  const minY = Math.min(...points.map(p => p.y || 0));
  
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  
  const scale = Math.min((canvas.width - 100) / rangeX, (canvas.height - 100) / rangeY);
  const offsetX = 50 - minX * scale;
  const offsetY = 50 - minY * scale;
  
  // Draw path lines
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  
  points.forEach((point, i) => {
    const x = point.x * scale + offsetX;
    const y = point.y * scale + offsetY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw points
  points.forEach((point, i) => {
    const x = point.x * scale + offsetX;
    const y = point.y * scale + offsetY;
    
    // Circle
    ctx.beginPath();
    if (i === 0 || i === points.length - 1) {
      ctx.fillStyle = '#22c55e';
      ctx.arc(x, y, 12, 0, Math.PI * 2);
    } else {
      ctx.fillStyle = '#3b82f6';
      ctx.arc(x, y, 10, 0, Math.PI * 2);
    }
    ctx.fill();
    
    // Number
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(point.sequence.toString(), x, y);
    
    // Label
    ctx.fillStyle = '#333';
    ctx.font = '11px Inter';
    ctx.textBaseline = 'top';
    ctx.fillText(point.label, x, y + 15);
  });
}

function showRouteInfo(routeData) {
  const info = document.getElementById('route-info');
  const opt = routeData.optimization;
  const viz = routeData.visualization;
  
  info.innerHTML = `
    <h4>Route Optimization Results</h4>
    <p><strong>Original Distance:</strong> ${opt.original_distance?.toFixed(2) || 0} m</p>
    <p><strong>Optimized Distance:</strong> ${opt.optimized_distance?.toFixed(2) || 0} m</p>
    <p><strong>Improvement:</strong> ${opt.improvement_percentage?.toFixed(2) || 0}%</p>
    <p><strong>Estimated Time:</strong> ${opt.estimated_time_minutes || 0} minutes</p>
    <hr>
    <h4>Route Steps</h4>
    <div class="route-steps">
      ${viz?.path?.map((p, i) => `
        <div class="route-step">
          <span class="step-number">${p.sequence}</span>
          <div class="step-info">
            <div class="step-location">${p.label}</div>
            <div class="step-product">Position: (${p.x}, ${p.y})</div>
          </div>
        </div>
      `).join('') || 'No steps'}
    </div>
  `;
}

// Update loadWarehouseData to also load visualization
const originalLoadWarehouseData = loadWarehouseData;
loadWarehouseData = async function() {
  await originalLoadWarehouseData();
  loadWarehouseVisualization();
};

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
    tbody.innerHTML = data.operators.map(operator => `
      <tr>
        <td>${operator.operator_id || 'N/A'}</td>
        <td>${operator.name || 'N/A'}</td>
        <td><span class="status-badge status-${operator.status}">${operator.status}</span></td>
        <td>${operator.current_wave || 'None'}</td>
        <td>${operator.total_picks || 0}</td>
        <td>${operator.avg_pick_time || 0}s</td>
        <td>
          <div class="performance-indicator ${getPerformanceClass(operator.performance_score)}">
            ${operator.performance_score || 0}%
          </div>
        </td>
        <td class="table-actions">
          <button class="btn btn-small btn-secondary" onclick="editOperator('${operator.id}')">Edit</button>
          <button class="btn btn-small ${operator.status === 'active' ? 'btn-warning' : 'btn-success'}" 
                  onclick="toggleOperatorStatus('${operator.id}', '${operator.status}')">
            ${operator.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  // Load performance chart
  loadOperatorPerformanceChart();
}

async function loadOperatorPerformanceChart() {
  const data = await apiCall('/operators/performance');
  
  if (data?.operators) {
    const ctx = document.getElementById('operator-performance-chart');
    if (ctx) {
      if (charts.operatorPerformance) charts.operatorPerformance.destroy();
      
      charts.operatorPerformance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.operators.map(op => op.name || op.operator_id),
          datasets: [
            {
              label: 'Total Picks',
              data: data.operators.map(op => op.total_picks || 0),
              backgroundColor: '#3b82f6',
              yAxisID: 'y'
            },
            {
              label: 'Avg Pick Time (s)',
              data: data.operators.map(op => op.avg_pick_time || 0),
              backgroundColor: '#ef4444',
              type: 'line',
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: {
                drawOnChartArea: false,
              },
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

// Toast notification function
function showToast(message, type = 'info') {
  // Create toast element if it doesn't exist
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
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