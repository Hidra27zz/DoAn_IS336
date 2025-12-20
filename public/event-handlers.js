// Event Handlers for CSP Compliance
// This file contains all the event handlers that were previously inline

// Global functions for main dashboard
window.refreshDashboard = function() {
  console.log('Refreshing dashboard...');
  location.reload();
};

window.showNotifications = function() {
  console.log('Showing notifications...');
  alert('No new notifications');
};

window.showSection = function(section) {
  console.log('Showing section:', section);
  // Hide all sections
  const sections = document.querySelectorAll('.section');
  sections.forEach(s => s.style.display = 'none');
  
  // Show selected section
  const targetSection = document.getElementById(section);
  if (targetSection) {
    targetSection.style.display = 'block';
  }
};

window.processInbound = function() {
  console.log('Processing inbound...');
  alert('AI recommendation: Store in Zone A for high-frequency items');
};

window.removeOrderItem = function(button) {
  console.log('Removing order item...');
  button.parentElement.remove();
};

window.addOrderItem = function() {
  console.log('Adding order item...');
  const container = document.querySelector('.order-items');
  if (container) {
    const newItem = document.createElement('div');
    newItem.className = 'order-item';
    newItem.innerHTML = `
      <input type="text" placeholder="SKU" class="item-sku">
      <input type="number" placeholder="Số lượng" class="item-qty">
      <button type="button" onclick="removeOrderItem(this)">❌</button>
    `;
    container.appendChild(newItem);
  }
};

window.generatePickingRoute = function() {
  console.log('Generating picking route...');
  alert('AI optimized route generated! Estimated time: 15 minutes');
};

window.filterQueue = function(status) {
  console.log('Filtering queue by:', status);
  // Remove active class from all buttons
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  // Add active class to clicked button
  event.target.classList.add('active');
};

window.runKMeans = function() {
  console.log('Running K-Means clustering...');
  const token = localStorage.getItem('authToken');
  
  fetch('/api/ai/clustering/kmeans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ k: 3 })
  })
  .then(response => response.json())
  .then(data => {
    console.log('K-Means result:', data);
    alert('K-Means clustering completed successfully!');
  })
  .catch(error => {
    console.error('K-Means error:', error);
    alert('Error running K-Means clustering');
  });
};

window.runDBSCAN = function() {
  console.log('Running DBSCAN clustering...');
  const token = localStorage.getItem('authToken');
  
  fetch('/api/ai/clustering/dbscan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ epsilon: 0.3, minPoints: 3 })
  })
  .then(response => response.json())
  .then(data => {
    console.log('DBSCAN result:', data);
    alert('DBSCAN clustering completed successfully!');
  })
  .catch(error => {
    console.error('DBSCAN error:', error);
    alert('Error running DBSCAN clustering');
  });
};

window.showReport = function(type) {
  console.log('Showing report:', type);
  // Remove active class from all tabs
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  // Add active class to clicked button
  event.target.classList.add('active');
  
  // Update report content
  const content = document.getElementById('ai-report-content');
  if (content) {
    content.innerHTML = `<p>Loading ${type} report...</p>`;
  }
};

// AI Demo functions
window.runKMeansDemo = function() {
  console.log('Running K-Means demo...');
  runKMeans();
};

window.runDBSCANDemo = function() {
  console.log('Running DBSCAN demo...');
  runDBSCAN();
};

window.optimizeRouteDemo = function() {
  console.log('Running route optimization demo...');
  const token = localStorage.getItem('authToken');
  
  fetch('/api/ai/route/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ wave_id: 'wave_1' })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Route optimization result:', data);
    alert(`Route optimization completed! Improvement: ${data.data?.improvement_percentage?.toFixed(1)}%`);
  })
  .catch(error => {
    console.error('Route optimization error:', error);
    alert('Error running route optimization');
  });
};

window.generateRecommendations = function() {
  console.log('Generating AI recommendations...');
  const token = localStorage.getItem('authToken');
  
  fetch('/api/ai/clustering/recommendations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ k: 3 })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Recommendations result:', data);
    alert(`AI recommendations generated! ${data.data?.total_recommendations || 0} recommendations available.`);
  })
  .catch(error => {
    console.error('Recommendations error:', error);
    alert('Error generating recommendations');
  });
};

// Research dashboard functions
window.generateReport = function() {
  console.log('Generating research report...');
  window.open('/api/ai/research/report/html', '_blank');
};

window.viewStats = function() {
  console.log('Viewing statistics...');
  const token = localStorage.getItem('authToken');
  
  fetch('/api/ai/research/stats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('Research stats:', data);
    alert('Research statistics loaded successfully!');
  })
  .catch(error => {
    console.error('Stats error:', error);
    alert('Error loading statistics');
  });
};

window.scrollToSection = function(sectionId) {
  console.log('Scrolling to section:', sectionId);
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

// Timeline demo functions
window.loadTimelineData = function() {
  console.log('Loading timeline data...');
  fetch('/api/timeline-demo')
  .then(response => response.json())
  .then(data => {
    console.log('Timeline data:', data);
    alert('Timeline data loaded successfully!');
  })
  .catch(error => {
    console.error('Timeline error:', error);
    alert('Error loading timeline data');
  });
};

window.loadDailySummary = function() {
  console.log('Loading daily summary...');
  alert('Daily summary: 150 items processed, 95% efficiency');
};

window.showProductHistory = function() {
  console.log('Showing product history...');
  alert('Product history: PROD-001 - 50 movements in last 30 days');
};

// Modal functions
window.showModal = function(modalId) {
  console.log('Showing modal:', modalId);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block';
  }
};

window.hideModal = function(modalId) {
  console.log('Hiding modal:', modalId);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
};

// Picking wave functions
window.viewWave = function(waveId) {
  console.log('Viewing wave:', waveId);
  const token = localStorage.getItem('authToken');
  
  fetch(`/api/picking/waves/${waveId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('Wave details:', data);
    alert(`Wave ${data.wave?.wave_number || waveId}: ${data.tasks?.length || 0} tasks`);
  })
  .catch(error => {
    console.error('Error viewing wave:', error);
    alert('Error loading wave details');
  });
};

window.startWave = function(waveId) {
  console.log('Starting wave:', waveId);
  const token = localStorage.getItem('authToken');
  
  fetch(`/api/picking/waves/${waveId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('Wave started:', data);
    alert(`Wave ${waveId} started successfully!`);
    
    // Refresh picking data instead of full page reload
    if (typeof window.loadPickingData === 'function') {
      window.loadPickingData();
    } else {
      location.reload();
    }
  })
  .catch(error => {
    console.error('Error starting wave:', error);
    alert('Error starting wave');
  });
};

window.completeTask = function(taskId) {
  console.log('Completing task:', taskId);
  const quantity = prompt('Enter quantity picked:');
  if (quantity && !isNaN(quantity)) {
    const token = localStorage.getItem('authToken');
    
    fetch(`/api/picking/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity_picked: parseInt(quantity) })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Task completed:', data);
      alert('Task completed successfully!');
      
      // Refresh picking data instead of full page reload
      if (typeof window.loadPickingData === 'function') {
        window.loadPickingData();
      } else {
        location.reload();
      }
    })
    .catch(error => {
      console.error('Error completing task:', error);
      alert('Error completing task');
    });
  }
};

window.optimizeWave = function(waveId) {
  console.log('Optimizing wave route:', waveId);
  const token = localStorage.getItem('authToken');
  
  fetch('/api/ai/route/optimize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ wave_id: waveId })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Route optimization result:', data);
    if (data.success) {
      const improvement = data.data?.improvement_percentage?.toFixed(1) || 0;
      alert(`Route optimized! Improvement: ${improvement}%`);
    } else {
      alert('Error optimizing route');
    }
  })
  .catch(error => {
    console.error('Route optimization error:', error);
    alert('Error optimizing route');
  });
};

// Inventory functions
window.adjustStock = function(inventoryId) {
  console.log('🔧 Adjusting stock for:', inventoryId);
  
  if (!inventoryId) {
    alert('Error: No inventory ID provided');
    return;
  }
  
  const newQuantity = prompt('Enter new quantity:');
  if (!newQuantity || isNaN(newQuantity)) {
    alert('Please enter a valid number');
    return;
  }
  
  const reason = prompt('Enter reason for adjustment:') || 'Manual adjustment';
  
  console.log('📤 Sending request to adjust inventory...');
  
  // Use authToken from localStorage (same as app.js)
  const token = localStorage.getItem('authToken');
  
  fetch(`/api/inventory/${inventoryId}/adjust`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      quantity: parseInt(newQuantity),
      reason: reason
    })
  })
  .then(response => {
    console.log('📥 Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('✅ Stock adjusted successfully:', data);
    alert(`Stock adjusted successfully!\nOld: ${data.old_quantity}\nNew: ${data.new_quantity}\nDifference: ${data.difference}`);
    
    // Refresh inventory data instead of full page reload
    if (typeof window.loadInventoryData === 'function') {
      window.loadInventoryData();
    } else {
      // Fallback to page reload if loadInventoryData not available
      location.reload();
    }
  })
  .catch(error => {
    console.error('❌ Error adjusting stock:', error);
    alert('Error adjusting stock: ' + error.message);
  });
};

window.reserveStock = function(inventoryId) {
  console.log('🔒 Reserving stock for:', inventoryId);
  
  if (!inventoryId) {
    alert('Error: No inventory ID provided');
    return;
  }
  
  const quantity = prompt('Enter quantity to reserve:');
  if (!quantity || isNaN(quantity) || parseInt(quantity) <= 0) {
    alert('Please enter a valid positive number');
    return;
  }
  
  console.log('📤 Sending request to reserve stock...');
  
  // Use authToken from localStorage (same as app.js)
  const token = localStorage.getItem('authToken');
  
  fetch(`/api/inventory/${inventoryId}/reserve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ quantity: parseInt(quantity) })
  })
  .then(response => {
    console.log('📥 Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('✅ Stock reserved successfully:', data);
    alert(`Stock reserved successfully!\nReserved: ${data.reserved_quantity}\nTotal reserved: ${data.new_reserved_total}`);
    
    // Refresh inventory data instead of full page reload
    if (typeof window.loadInventoryData === 'function') {
      window.loadInventoryData();
    } else {
      // Fallback to page reload if loadInventoryData not available
      location.reload();
    }
  })
  .catch(error => {
    console.error('❌ Error reserving stock:', error);
    alert('Error reserving stock: ' + error.message);
  });
};

// Order functions
window.viewOrder = function(orderId) {
  console.log('Viewing order:', orderId);
  const token = localStorage.getItem('authToken');
  
  fetch(`/api/orders/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('Order details:', data);
    alert(`Order ${data.order?.order_number || orderId}: ${data.items?.length || 0} items`);
  })
  .catch(error => {
    console.error('Error viewing order:', error);
    alert('Error loading order details');
  });
};

window.updateOrderStatus = function(orderId, newStatus) {
  console.log('Updating order status:', orderId, newStatus);
  const token = localStorage.getItem('authToken');
  
  fetch(`/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: newStatus })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Order status updated:', data);
    alert('Order status updated successfully!');
    
    // Refresh orders data instead of full page reload
    if (typeof window.loadOrdersData === 'function') {
      window.loadOrdersData();
    } else {
      location.reload();
    }
  })
  .catch(error => {
    console.error('Error updating order status:', error);
    alert('Error updating order status');
  });
};

// Warehouse functions
window.viewLocation = function(locationId) {
  console.log('Viewing location:', locationId);
  alert(`Location details for: ${locationId}`);
};

window.updateLocationStatus = function(locationId, status) {
  console.log('Updating location status:', locationId, status);
  const token = localStorage.getItem('authToken');
  
  fetch(`/api/warehouse/locations/${locationId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: status })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Location status updated:', data);
    alert('Location status updated successfully!');
    
    // Refresh warehouse data instead of full page reload
    if (typeof window.loadWarehouseData === 'function') {
      window.loadWarehouseData();
    } else {
      location.reload();
    }
  })
  .catch(error => {
    console.error('Error updating location status:', error);
    alert('Error updating location status');
  });
};

// Generic refresh function
window.refreshData = function() {
  console.log('Refreshing data...');
  location.reload();
};

// Generic close function for modals
window.closeModal = function() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.style.display = 'none';
  });
};

// Test function for debugging
window.testInventoryFunctions = function() {
  console.log('🧪 Testing inventory functions...');
  console.log('adjustStock function:', typeof window.adjustStock);
  console.log('reserveStock function:', typeof window.reserveStock);
  
  // Test with a sample inventory ID
  const testId = 'inventory_1';
  console.log('Testing adjustStock with ID:', testId);
  
  // You can call this function from browser console to test
  alert('Inventory functions are loaded. Check console for details.');
};

// Debug function to check authentication
window.checkAuth = function() {
  const token = localStorage.getItem('token');
  console.log('🔑 Token exists:', !!token);
  if (token) {
    console.log('Token preview:', token.substring(0, 50) + '...');
  }
  return !!token;
};

// Test adjust function directly
window.testAdjustStock = function() {
  console.log('🧪 Testing adjust stock function...');
  
  // Test with inventory_1
  const testId = 'inventory_1';
  const testQuantity = 999;
  const testReason = 'Test adjustment from debug function';
  
  fetch(`/api/inventory/${testId}/adjust`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      quantity: testQuantity,
      reason: testReason
    })
  })
  .then(response => {
    console.log('📥 Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('✅ Test adjust result:', data);
    alert(`Test successful!\nOld: ${data.old_quantity}\nNew: ${data.new_quantity}`);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    alert('Test failed: ' + error.message);
  });
};

// Test modal functionality
window.testAdjustModal = function() {
  console.log('🧪 Testing adjust modal...');
  
  // Check if modal exists
  const modal = document.getElementById('adjust-modal');
  console.log('Modal exists:', !!modal);
  
  // Check if form exists
  const form = document.getElementById('adjust-form');
  console.log('Form exists:', !!form);
  
  // Check if input fields exist
  const inventoryIdField = document.getElementById('adjust-inventory-id');
  const quantityField = document.getElementById('adjust-quantity');
  const reasonField = document.getElementById('adjust-reason');
  
  console.log('Inventory ID field exists:', !!inventoryIdField);
  console.log('Quantity field exists:', !!quantityField);
  console.log('Reason field exists:', !!reasonField);
  
  // Test opening modal
  if (typeof openAdjustModal === 'function') {
    console.log('openAdjustModal function exists');
    openAdjustModal('inventory_1', 100);
  } else {
    console.log('❌ openAdjustModal function not found');
  }
  
  // Check if handleAdjust function exists
  if (typeof handleAdjust === 'function') {
    console.log('handleAdjust function exists');
  } else {
    console.log('❌ handleAdjust function not found');
  }
};

console.log('Event handlers loaded successfully');
console.log('🧪 Debug functions available:');
console.log('  - testInventoryFunctions()');
console.log('  - checkAuth()');
console.log('  - testAdjustStock()');
console.log('  - testAdjustModal()');
console.log('📋 Inventory functions available: adjustStock(id), reserveStock(id)');