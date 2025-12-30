// Reports Routes - Generate Reports with Real Data
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const path = require('path');
const fs = require('fs');

// Store report generation status
const reportJobs = new Map();

// POST /api/reports/generate - Generate report
router.post('/generate', authMiddleware, requirePermission('REPORTS_VIEW'), async (req, res) => {
  try {
    const db = await getDatabase();
    const {
      report_type,
      date_from,
      date_to,
      filters = {},
      format = 'json'
    } = req.body;

    if (!report_type) {
      return res.status(400).json({
        success: false,
        error: 'Report type is required'
      });
    }

    // Generate report ID
    const reportId = `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store job status
    reportJobs.set(reportId, {
      id: reportId,
      type: report_type,
      status: 'processing',
      progress: 0,
      created_at: new Date().toISOString(),
      created_by: req.user.id
    });

    // Generate report asynchronously
    generateReport(db, reportId, report_type, date_from, date_to, filters, format, req.user)
      .catch(error => {
        console.error('Report generation error:', error);
        reportJobs.set(reportId, {
          ...reportJobs.get(reportId),
          status: 'failed',
          error: error.message
        });
      });

    res.json({
      success: true,
      report_id: reportId,
      message: 'Report generation started',
      status_url: `/api/reports/${reportId}/status`
    });

  } catch (error) {
    console.error('Error starting report generation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start report generation',
      details: error.message
    });
  }
});

// GET /api/reports/:id/status - Get report status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const job = reportJobs.get(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: job
    });

  } catch (error) {
    console.error('Error fetching report status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report status',
      details: error.message
    });
  }
});

// GET /api/reports/download/:id - Download report
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const job = reportJobs.get(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Report is not ready yet',
        status: job.status
      });
    }

    if (job.format === 'json') {
      res.json({
        success: true,
        data: job.data
      });
    } else {
      // For file downloads (PDF/Excel)
      const filePath = path.join(__dirname, '../uploads/reports', job.filename);
      if (fs.existsSync(filePath)) {
        res.download(filePath);
      } else {
        res.status(404).json({
          success: false,
          error: 'Report file not found'
        });
      }
    }

  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download report',
      details: error.message
    });
  }
});

// GET /api/reports/list - List all reports
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const reports = Array.from(reportJobs.values())
      .filter(job => job.created_by === req.user.id || req.user.role === 'admin')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list reports',
      details: error.message
    });
  }
});

// Report generation function
async function generateReport(db, reportId, reportType, dateFrom, dateTo, filters, format, user) {
  try {
    // Update progress
    updateReportProgress(reportId, 10, 'Fetching data...');

    let reportData;

    switch (reportType) {
      case 'warehouse_summary':
      case 'warehouse-summary':
        reportData = await generateWarehouseSummaryReport(db);
        break;
      
      case 'inventory':
        reportData = await generateInventoryReport(db, dateFrom, dateTo, filters);
        break;
      
      case 'movement':
        reportData = await generateMovementReport(db, dateFrom, dateTo, filters);
        break;
      
      case 'wave_picking':
        reportData = await generateWavePickingReport(db, dateFrom, dateTo, filters);
        break;
      
      case 'operator_performance':
        reportData = await generateOperatorPerformanceReport(db, dateFrom, dateTo, filters);
        break;
      
      case 'storage_utilization':
        reportData = await generateStorageUtilizationReport(db, filters);
        break;
      
      case 'order_fulfillment':
        reportData = await generateOrderFulfillmentReport(db, dateFrom, dateTo, filters);
        break;
      
      default:
        throw new Error('Invalid report type');
    }

    updateReportProgress(reportId, 90, 'Formatting report...');

    // Store completed report
    reportJobs.set(reportId, {
      ...reportJobs.get(reportId),
      status: 'completed',
      progress: 100,
      data: reportData,
      format: format,
      completed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Report generation failed:', error);
    reportJobs.set(reportId, {
      ...reportJobs.get(reportId),
      status: 'failed',
      error: error.message,
      failed_at: new Date().toISOString()
    });
  }
}

function updateReportProgress(reportId, progress, message) {
  const job = reportJobs.get(reportId);
  if (job) {
    reportJobs.set(reportId, {
      ...job,
      progress,
      message
    });
  }
}

// Report generation functions

async function generateWarehouseSummaryReport(db) {
  // Get warehouse overview
  const warehouseOverview = await db.get(`
    SELECT 
      COUNT(*) as total_locations,
      SUM(capacity) as total_capacity,
      SUM(current_occupancy) as total_occupancy,
      ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as overall_utilization
    FROM storage_locations
    WHERE status = 'active'
  `);

  // Get zone breakdown
  const zoneBreakdown = await db.all(`
    SELECT 
      zone,
      COUNT(*) as location_count,
      SUM(capacity) as zone_capacity,
      SUM(current_occupancy) as zone_occupancy,
      ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as utilization_rate
    FROM storage_locations
    WHERE status = 'active'
    GROUP BY zone
    ORDER BY zone
  `);

  // Get order status
  const orderStatus = await db.get(`
    SELECT 
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
    FROM orders
  `);

  // Get picking performance
  const pickingPerformance = await db.get(`
    SELECT 
      COUNT(*) as total_picks,
      SUM(CASE WHEN quantity_picked IS NOT NULL THEN quantity_picked ELSE 0 END) as total_quantity_picked,
      ROUND(AVG(CASE 
        WHEN status = 'completed' AND updated_at IS NOT NULL AND created_at IS NOT NULL
        THEN (JULIANDAY(updated_at) - JULIANDAY(created_at)) * 24 * 60
        ELSE NULL
      END), 2) as avg_pick_time
    FROM picking_tasks
    WHERE status = 'completed'
  `);

  return {
    report_type: 'Warehouse Summary Report',
    generated_at: new Date().toISOString(),
    warehouse_overview: warehouseOverview || { total_locations: 0, total_capacity: 0, total_occupancy: 0, overall_utilization: 0 },
    zone_breakdown: zoneBreakdown || [],
    order_status: orderStatus || { total_orders: 0, pending: 0, in_progress: 0, completed: 0 },
    picking_performance: pickingPerformance || { total_picks: 0, total_quantity_picked: 0, avg_pick_time: 0 }
  };
}

async function generateInventoryReport(db, dateFrom, dateTo, filters) {
  const whereConditions = ['1=1'];
  const params = [];

  if (filters.product_reference) {
    whereConditions.push('i.product_reference = ?');
    params.push(filters.product_reference);
  }

  if (filters.zone) {
    whereConditions.push('sl.zone = ?');
    params.push(filters.zone);
  }

  const whereClause = whereConditions.join(' AND ');

  const inventory = await db.all(`
    SELECT 
      i.product_reference,
      p.description,
      p.abc_code,
      i.location_code,
      sl.zone,
      i.quantity,
      i.reserved_quantity,
      (i.quantity - i.reserved_quantity) as available_quantity,
      p.unit_price,
      (i.quantity * p.unit_price) as total_value
    FROM inventory i
    JOIN products p ON i.product_reference = p.reference
    JOIN storage_locations sl ON i.location_code = sl.location_code
    WHERE ${whereClause}
    ORDER BY p.abc_code, i.product_reference, i.location_code
  `, params);

  const summary = {
    total_products: new Set(inventory.map(i => i.product_reference)).size,
    total_locations: new Set(inventory.map(i => i.location_code)).size,
    total_quantity: inventory.reduce((sum, i) => sum + i.quantity, 0),
    total_reserved: inventory.reduce((sum, i) => sum + i.reserved_quantity, 0),
    total_available: inventory.reduce((sum, i) => sum + i.available_quantity, 0),
    total_value: inventory.reduce((sum, i) => sum + i.total_value, 0)
  };

  return {
    report_type: 'Inventory Report',
    generated_at: new Date().toISOString(),
    filters: filters,
    summary: summary,
    details: inventory
  };
}

async function generateMovementReport(db, dateFrom, dateTo, filters) {
  const whereConditions = ['1=1'];
  const params = [];

  if (dateFrom) {
    whereConditions.push('DATE(pt.created_at) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    whereConditions.push('DATE(pt.created_at) <= ?');
    params.push(dateTo);
  }

  if (filters.product_reference) {
    whereConditions.push('pt.product_reference = ?');
    params.push(filters.product_reference);
  }

  if (filters.zone) {
    whereConditions.push('sl.zone = ?');
    params.push(filters.zone);
  }

  const whereClause = whereConditions.join(' AND ');

  const movements = await db.all(`
    SELECT 
      pt.id,
      pt.wave_number,
      pt.product_reference,
      p.description,
      pt.location_code,
      sl.zone,
      pt.quantity_to_pick,
      pt.quantity_picked,
      pt.status,
      pt.operator,
      u.username as operator_name,
      pt.created_at,
      pt.updated_at
    FROM picking_tasks pt
    JOIN products p ON pt.product_reference = p.reference
    JOIN storage_locations sl ON pt.location_code = sl.location_code
    LEFT JOIN users u ON pt.operator = u.id
    WHERE ${whereClause}
    ORDER BY pt.created_at DESC
  `, params);

  const summary = {
    total_movements: movements.length,
    total_quantity_picked: movements.reduce((sum, m) => sum + (m.quantity_picked || 0), 0),
    completed_movements: movements.filter(m => m.status === 'completed').length,
    in_progress_movements: movements.filter(m => m.status === 'in_progress').length,
    pending_movements: movements.filter(m => m.status === 'pending').length
  };

  return {
    report_type: 'Movement Report',
    generated_at: new Date().toISOString(),
    date_range: { from: dateFrom, to: dateTo },
    filters: filters,
    summary: summary,
    details: movements
  };
}

async function generateWavePickingReport(db, dateFrom, dateTo, filters) {
  const whereConditions = ['1=1'];
  const params = [];

  if (dateFrom) {
    whereConditions.push('DATE(pw.created_at) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    whereConditions.push('DATE(pw.created_at) <= ?');
    params.push(dateTo);
  }

  if (filters.status) {
    whereConditions.push('pw.status = ?');
    params.push(filters.status);
  }

  const whereClause = whereConditions.join(' AND ');

  const waves = await db.all(`
    SELECT 
      pw.id,
      pw.wave_number,
      pw.status,
      pw.priority,
      pw.operator,
      u.username as operator_name,
      pw.created_at,
      pw.released_at,
      pw.completed_at,
      COUNT(pt.id) as total_tasks,
      COUNT(CASE WHEN pt.status = 'completed' THEN 1 END) as completed_tasks,
      SUM(pt.quantity_to_pick) as total_quantity_to_pick,
      SUM(pt.quantity_picked) as total_quantity_picked
    FROM picking_waves pw
    LEFT JOIN picking_tasks pt ON pw.wave_number = pt.wave_number
    LEFT JOIN users u ON pw.operator = u.id
    WHERE ${whereClause}
    GROUP BY pw.id, pw.wave_number, pw.status, pw.priority, pw.operator, u.username, pw.created_at, pw.released_at, pw.completed_at
    ORDER BY pw.created_at DESC
  `, params);

  const summary = {
    total_waves: waves.length,
    completed_waves: waves.filter(w => w.status === 'completed').length,
    in_progress_waves: waves.filter(w => w.status === 'in_progress').length,
    total_tasks: waves.reduce((sum, w) => sum + w.total_tasks, 0),
    total_quantity_picked: waves.reduce((sum, w) => sum + (w.total_quantity_picked || 0), 0)
  };

  return {
    report_type: 'Wave & Picking Report',
    generated_at: new Date().toISOString(),
    date_range: { from: dateFrom, to: dateTo },
    filters: filters,
    summary: summary,
    details: waves
  };
}

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

  // Calculate summary with NULLIF for safe division
  const totalPickTime = performance.reduce((sum, p) => sum + (p.avg_pick_time || 0), 0);
  const operatorsWithTime = performance.filter(p => p.avg_pick_time > 0).length;

  const summary = {
    total_operators: performance.length,
    total_picks: performance.reduce((sum, p) => sum + (p.total_picks || 0), 0),
    total_quantity: performance.reduce((sum, p) => sum + (p.total_quantity || 0), 0),
    avg_pick_time: operatorsWithTime > 0
      ? Math.round(totalPickTime / operatorsWithTime * 100) / 100
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

  // Get overall summary
  const overallSummary = await db.get(`
    SELECT 
      COUNT(*) as total_locations,
      SUM(capacity) as total_capacity,
      SUM(current_occupancy) as total_occupancy,
      ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as overall_utilization
    FROM storage_locations
    WHERE ${whereClause}
  `, params);

  const summary = {
    total_zones: utilization.length,
    total_locations: overallSummary.total_locations || 0,
    total_capacity: overallSummary.total_capacity || 0,
    total_occupancy: overallSummary.total_occupancy || 0,
    overall_utilization: overallSummary.overall_utilization || 0
  };

  return {
    report_type: 'Storage Utilization Report',
    generated_at: new Date().toISOString(),
    filters: filters,
    summary: summary,
    details: utilization
  };
}

async function generateOrderFulfillmentReport(db, dateFrom, dateTo, filters) {
  const whereConditions = ['1=1'];
  const params = [];

  if (dateFrom) {
    whereConditions.push('DATE(o.created_at) >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    whereConditions.push('DATE(o.created_at) <= ?');
    params.push(dateTo);
  }

  if (filters.status) {
    whereConditions.push('o.status = ?');
    params.push(filters.status);
  }

  const whereClause = whereConditions.join(' AND ');

  const orders = await db.all(`
    SELECT 
      o.order_number,
      o.customer_code,
      o.status,
      o.priority,
      o.created_at,
      o.updated_at,
      COUNT(ol.id) as total_lines,
      SUM(ol.quantity) as total_quantity
    FROM orders o
    LEFT JOIN order_lines ol ON o.order_number = ol.order_number
    WHERE ${whereClause}
    GROUP BY o.order_number, o.customer_code, o.status, o.priority, o.created_at, o.updated_at
    ORDER BY o.created_at DESC
  `, params);

  const summary = {
    total_orders: orders.length,
    pending_orders: orders.filter(o => o.status === 'pending').length,
    completed_orders: orders.filter(o => o.status === 'completed').length,
    total_order_lines: orders.reduce((sum, o) => sum + o.total_lines, 0),
    total_quantity: orders.reduce((sum, o) => sum + (o.total_quantity || 0), 0)
  };

  return {
    report_type: 'Order Fulfillment Report',
    generated_at: new Date().toISOString(),
    date_range: { from: dateFrom, to: dateTo },
    filters: filters,
    summary: summary,
    details: orders
  };
}

module.exports = router;
