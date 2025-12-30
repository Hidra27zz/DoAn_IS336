# APPLY ALL FIXES - HƯỚNG DẪN THỰC HIỆN

## 🎯 MỤC TIÊU
Fix tất cả 4 problems trong 1 lần:
1. ✅ Warehouse Page Data
2. ✅ Wave Details (Operator/Product)
3. ✅ Reports Data
4. ✅ AI Widget Loading

---

## 📝 CÁC FILE CẦN SỬA

### 1. routes/warehouse.js
**Thêm endpoint mới:**
```javascript
// GET /api/warehouse/report - Warehouse summary report
router.get('/report', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Storage stats
    const storageStats = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as utilization
      FROM storage_locations
      WHERE status = 'active'
    `);
    
    // Zone breakdown
    const zoneStats = await db.all(`
      SELECT 
        zone,
        COUNT(*) as location_count,
        SUM(capacity) as zone_capacity,
        SUM(current_occupancy) as zone_occupancy,
        ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as zone_utilization
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `);
    
    // Order stats
    const orderStats = await db.get(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM orders
    `);
    
    // Picking stats
    const pickingStats = await db.get(`
      SELECT 
        COUNT(*) as total_picks,
        SUM(CASE WHEN quantity_picked IS NOT NULL THEN quantity_picked ELSE 0 END) as total_quantity,
        ROUND(AVG(CASE 
          WHEN status = 'completed' AND updated_at IS NOT NULL AND created_at IS NOT NULL
          THEN (JULIANDAY(updated_at) - JULIANDAY(created_at)) * 24 * 60
          ELSE NULL
        END), 2) as avg_time
      FROM picking_tasks
      WHERE status = 'completed'
    `);
    
    res.json({
      success: true,
      data: {
        storage: storageStats || { total_locations: 0, total_capacity: 0, total_occupancy: 0, utilization: 0 },
        zones: zoneStats || [],
        orders: orderStats || { total_orders: 0, pending: 0, in_progress: 0, completed: 0 },
        picking: pickingStats || { total_picks: 0, total_quantity: 0, avg_time: 0 }
      }
    });
    
  } catch (error) {
    console.error('Error generating warehouse report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate warehouse report',
      details: error.message
    });
  }
});
```

### 2. routes/waves.js
**Fix wave details query (tìm dòng GET /:id và thay thế):**
```javascript
// GET /api/waves/:id - Get wave details with full info
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    
    // Get wave tasks with full details
    const tasks = await db.all(`
      SELECT 
        pt.*,
        u.username as operator_name,
        u.role as operator_role,
        p.reference as product_ref,
        p.description as product_name,
        p.unit_price as product_price,
        p.abc_code,
        sl.zone,
        sl.x, sl.y, sl.z
      FROM picking_tasks pt
      LEFT JOIN users u ON pt.operator = u.id
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      WHERE pt.wave_number = ?
      ORDER BY pt.id
    `, [id]);
    
    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Wave not found'
      });
    }
    
    // Calculate stats
    const totalQuantity = tasks.reduce((sum, t) => sum + (t.quantity_to_pick || 0), 0);
    const pickedQuantity = tasks.reduce((sum, t) => sum + (t.quantity_picked || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const estimatedTime = Math.ceil(totalQuantity * 0.5); // 0.5 min per item
    
    // Get wave info from first task
    const waveInfo = {
      wave_number: id,
      status: tasks[0].status,
      operator_id: tasks[0].operator,
      operator_name: tasks[0].operator_name || 'Unassigned',
      priority: tasks[0].priority || 'normal',
      created_at: tasks[0].created_at,
      updated_at: tasks[0].updated_at
    };
    
    res.json({
      success: true,
      data: {
        wave: waveInfo,
        tasks: tasks,
        stats: {
          total_items: tasks.length,
          total_quantity: totalQuantity,
          picked_quantity: pickedQuantity,
          completed_tasks: completedTasks,
          progress: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
          estimated_time: estimatedTime
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching wave details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wave details',
      details: error.message
    });
  }
});
```

### 3. routes/reports.js
**Fix generateStorageUtilizationReport (thay thế function):**
```javascript
async function generateStorageUtilizationReport(db, filters) {
  const whereConditions = ['sl.status = ?'];
  const params = ['active'];

  if (filters.zone) {
    whereConditions.push('sl.zone = ?');
    params.push(filters.zone);
  }

  const whereClause = whereConditions.join(' AND ');

  const utilization = await db.all(`
    SELECT 
      sl.zone,
      COUNT(*) as total_locations,
      SUM(sl.capacity) as total_capacity,
      SUM(sl.current_occupancy) as total_occupancy,
      ROUND(CAST(SUM(sl.current_occupancy) AS FLOAT) / NULLIF(SUM(sl.capacity), 0) * 100, 2) as utilization_rate,
      COUNT(CASE WHEN sl.current_occupancy = 0 THEN 1 END) as empty_locations,
      COUNT(CASE WHEN sl.current_occupancy >= sl.capacity THEN 1 END) as full_locations,
      COUNT(DISTINCT i.product_reference) as unique_products
    FROM storage_locations sl
    LEFT JOIN inventory i ON sl.location_code = i.location_code
    WHERE ${whereClause}
    GROUP BY sl.zone
    ORDER BY sl.zone
  `, params);

  const summary = {
    total_zones: utilization.length,
    total_locations: utilization.reduce((sum, u) => sum + (u.total_locations || 0), 0),
    total_capacity: utilization.reduce((sum, u) => sum + (u.total_capacity || 0), 0),
    total_occupancy: utilization.reduce((sum, u) => sum + (u.total_occupancy || 0), 0),
    overall_utilization: utilization.length > 0
      ? Math.round(utilization.reduce((sum, u) => sum + (u.utilization_rate || 0), 0) / utilization.length * 100) / 100
      : 0
  };

  return {
    report_type: 'Storage Utilization Report',
    generated_at: new Date().toISOString(),
    filters: filters,
    summary: summary,
    details: utilization
  };
}
```

**Fix generateOperatorPerformanceReport (tìm và thay thế):**
```javascript
async function generateOperatorPerformanceReport(db, dateFrom, dateTo, filters) {
  const whereConditions = ['pt.status = ?'];
  const params = ['completed'];

  if (dateFrom) {
    whereConditions.push('DATE(pt.created_at) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    whereConditions.push('DATE(pt.created_at) <= ?');
    params.push(dateTo);
  }

  if (filters.operator_id) {
    whereConditions.push('pt.operator = ?');
    params.push(filters.operator_id);
  }

  const whereClause = whereConditions.join(' AND ');

  const performance = await db.all(`
    SELECT 
      u.id as operator_id,
      u.username as operator_name,
      u.role,
      COUNT(pt.id) as total_picks,
      SUM(CASE WHEN pt.quantity_picked IS NOT NULL THEN pt.quantity_picked ELSE 0 END) as total_quantity,
      ROUND(AVG(CASE 
        WHEN pt.updated_at IS NOT NULL AND pt.created_at IS NOT NULL
        THEN (JULIANDAY(pt.updated_at) - JULIANDAY(pt.created_at)) * 24 * 60
        ELSE NULL
      END), 2) as avg_pick_time,
      COUNT(DISTINCT pt.wave_number) as waves_completed
    FROM picking_tasks pt
    JOIN users u ON pt.operator = u.id
    WHERE ${whereClause}
    GROUP BY u.id, u.username, u.role
    ORDER BY total_picks DESC
  `, params);

  const summary = {
    total_operators: performance.length,
    total_picks: performance.reduce((sum, p) => sum + (p.total_picks || 0), 0),
    total_quantity: performance.reduce((sum, p) => sum + (p.total_quantity || 0), 0),
    avg_pick_time: performance.length > 0
      ? Math.round(performance.reduce((sum, p) => sum + (p.avg_pick_time || 0), 0) / performance.length * 100) / 100
      : 0
  };

  return {
    report_type: 'Operator Performance Report',
    generated_at: new Date().toISOString(),
    date_range: { from: dateFrom, to: dateTo },
    filters: filters,
    summary: summary,
    details: performance
  };
}
```

### 4. public/ai-assistant-widget.html
**Fix loadAIInsights function (tìm và thay thế):**
```javascript
// Load AI insights with timeout and error handling
async function loadAIInsights() {
  const content = document.getElementById('ai-content');
  content.innerHTML = '<div class="ai-loading"><div class="ai-loading-spinner"></div><div>AI đang phân tích...</div></div>';

  try {
    // Set timeout 10 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch('/api/ai/optimization/comprehensive', {
      headers: { 'Authorization': `Bearer ${authToken}` },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      displayInsights(data.data);
    } else {
      throw new Error('Invalid response data');
    }
    
  } catch (error) {
    console.error('Error loading AI insights:', error);
    
    // Show error with retry button
    content.innerHTML = `
      <div class="ai-empty">
        <div class="ai-empty-icon">⚠️</div>
        <div>Không thể tải AI insights</div>
        <div style="font-size: 12px; margin-top: 5px; color: #999;">
          ${error.name === 'AbortError' ? 'Timeout - API quá chậm' : error.message}
        </div>
        <button class="ai-action-button" onclick="refreshAI()" style="margin-top: 10px;">
          🔄 Thử lại
        </button>
      </div>
    `;
  }
}

function displayInsights(data) {
  const content = document.getElementById('ai-content');
  const recs = data.comprehensive_recommendations?.recommendations || [];
  
  let html = '<div class="ai-stats">';
  html += `<div class="ai-stat">
    <div class="ai-stat-value">${data.ai_confidence_score || 0}%</div>
    <div class="ai-stat-label">AI Confidence</div>
  </div>`;
  html += `<div class="ai-stat">
    <div class="ai-stat-value">${recs.length}</div>
    <div class="ai-stat-label">Đề xuất</div>
  </div>`;
  html += `<div class="ai-stat">
    <div class="ai-stat-value">${recs.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH').length}</div>
    <div class="ai-stat-label">Ưu tiên cao</div>
  </div>`;
  html += '</div>';

  if (recs.length > 0) {
    recs.slice(0, 5).forEach(rec => {
      html += `
        <div class="ai-insight priority-${rec.priority}">
          <div class="ai-insight-header">
            <div class="ai-insight-title">${rec.title || rec.type}</div>
            <div class="ai-priority ${rec.priority}">${rec.priority}</div>
          </div>
          <div class="ai-insight-message">${rec.description || rec.message}</div>
          ${rec.impact ? `<div class="ai-insight-impact">💡 ${rec.impact}</div>` : ''}
        </div>
      `;
    });
  } else {
    html += `
      <div class="ai-empty">
        <div class="ai-empty-icon">✅</div>
        <div>Hệ thống đang hoạt động tốt!</div>
      </div>
    `;
  }

  content.innerHTML = html;
  
  // Update notification badge
  const criticalCount = recs.filter(r => r.priority === 'CRITICAL' || r.priority === 'HIGH').length;
  const badge = document.getElementById('ai-notification-badge');
  if (badge) {
    if (criticalCount > 0) {
      badge.textContent = criticalCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}
```

---

## 🚀 CÁCH APPLY

### Option 1: Tự Động (Khuyến Nghị)
Tôi sẽ apply tất cả fixes trong 1 lần.

### Option 2: Thủ Công
1. Mở từng file
2. Tìm function/endpoint cần fix
3. Copy code từ tài liệu này
4. Paste và save
5. Restart server

---

## ✅ SAU KHI APPLY

### Test 1: Warehouse Page
```
1. Vào http://localhost:3000
2. Click "Warehouse"
3. Kiểm tra:
   - Storage Locations: 2292 ✅
   - Total Capacity: >0 ✅
   - Utilization Rate: >0% ✅
```

### Test 2: Wave Details
```
1. Vào "Picking"
2. Click vào 1 wave
3. Kiểm tra:
   - Operator: Hiện tên ✅
   - Product: Hiện description ✅
   - Est. Time: Hiện số phút ✅
```

### Test 3: Reports
```
1. Vào "Reports"
2. Generate "Warehouse Summary"
3. Kiểm tra:
   - Total Locations: 2292 ✅
   - Total Picks: >0 ✅
   - Average Pick Time: >0 ✅
```

### Test 4: AI Widget
```
1. Login vào hệ thống
2. Nhìn góc phải màn hình
3. Kiểm tra:
   - Widget hiện ✅
   - Có recommendations ✅
   - Không loading mãi ✅
```

---

## 📊 KẾT QUẢ MONG ĐỢI

**Trước Fix:**
- Warehouse: 0 locations ❌
- Wave: undefined fields ❌
- Reports: 0 data ❌
- AI Widget: loading mãi ❌

**Sau Fix:**
- Warehouse: 2,292 locations ✅
- Wave: Full info ✅
- Reports: Real data ✅
- AI Widget: Hoạt động ✅

---

Bạn muốn tôi apply tự động hay hướng dẫn thủ công?
