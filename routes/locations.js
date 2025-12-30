// Storage Location Management Routes - Complete Implementation
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { requireRole, requirePermission } = require('../middleware/permissions');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for CSV uploads
const upload = multer({ dest: 'uploads/' });

// GET /api/locations - Get all locations with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      zone = '', 
      level = '',
      status = 'active',
      sort_by = 'location_code',
      sort_order = 'ASC',
      occupancy_filter = '' // 'empty', 'partial', 'full'
    } = req.query;

    let whereConditions = ['1=1']; // Always true condition to simplify building
    let params = [];

    // Search by location code
    if (search) {
      whereConditions.push('location_code LIKE ?');
      params.push(`%${search}%`);
    }

    // Filter by zone
    if (zone) {
      whereConditions.push('zone = ?');
      params.push(zone);
    }

    // Filter by level (z coordinate)
    if (level) {
      whereConditions.push('z = ?');
      params.push(parseInt(level));
    }

    // Filter by status
    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    // Filter by occupancy
    if (occupancy_filter) {
      switch (occupancy_filter) {
        case 'empty':
          whereConditions.push('current_occupancy = 0');
          break;
        case 'partial':
          whereConditions.push('current_occupancy > 0 AND current_occupancy < capacity');
          break;
        case 'full':
          whereConditions.push('current_occupancy >= capacity');
          break;
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM storage_locations ${whereClause}`;
    const countResult = await db.get(countSql, params);
    const total = countResult.total;

    // Validate sort parameters
    const validSortColumns = ['location_code', 'zone', 'x', 'y', 'z', 'capacity', 'current_occupancy', 'created_at'];
    const validSortOrders = ['ASC', 'DESC'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'location_code';
    const sortOrder = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

    // Get paginated results with inventory summary
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        sl.id,
        sl.location_code,
        sl.x,
        sl.y,
        sl.z,
        sl.zone,
        sl.capacity,
        sl.current_occupancy,
        sl.status,
        sl.created_at,
        sl.updated_at,
        COALESCE(inv_summary.product_count, 0) as product_count,
        COALESCE(inv_summary.total_quantity, 0) as total_quantity,
        ROUND(CAST(sl.current_occupancy AS FLOAT) / sl.capacity * 100, 2) as occupancy_percentage
      FROM storage_locations sl
      LEFT JOIN (
        SELECT 
          location_code,
          COUNT(DISTINCT product_reference) as product_count,
          SUM(quantity) as total_quantity
        FROM inventory
        GROUP BY location_code
      ) inv_summary ON sl.location_code = inv_summary.location_code
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const locations = await db.all(sql, [...params, parseInt(limit), offset]);

    // Get summary statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        COUNT(DISTINCT zone) as total_zones,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_occupancy_percentage,
        COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_locations,
        COUNT(CASE WHEN current_occupancy > 0 AND current_occupancy < capacity THEN 1 END) as partial_locations,
        COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_locations
      FROM storage_locations
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        locations: locations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        },
        statistics: stats,
        filters: {
          search,
          zone,
          level,
          status,
          occupancy_filter,
          sort_by: sortColumn,
          sort_order: sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch locations',
      details: error.message 
    });
  }
});

// GET /api/locations/zones - Get all zones
router.get('/zones', async (req, res) => {
  try {
    const db = await getDatabase();

    const zones = await db.all(`
      SELECT 
        zone,
        COUNT(*) as location_count,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_occupancy_percentage,
        MIN(x) as min_x, MAX(x) as max_x,
        MIN(y) as min_y, MAX(y) as max_y,
        MIN(z) as min_z, MAX(z) as max_z
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `);

    res.json({
      success: true,
      data: { zones }
    });

  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch zones',
      details: error.message 
    });
  }
});

// GET /api/locations/zones/:zone/levels - Get levels in a zone
router.get('/zones/:zone/levels', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone } = req.params;

    const levels = await db.all(`
      SELECT 
        z as level,
        COUNT(*) as location_count,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_occupancy_percentage
      FROM storage_locations
      WHERE zone = ? AND status = 'active'
      GROUP BY z
      ORDER BY z
    `, [zone]);

    res.json({
      success: true,
      data: { 
        zone,
        levels 
      }
    });

  } catch (error) {
    console.error('Error fetching levels:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch levels',
      details: error.message 
    });
  }
});

// GET /api/locations/zones/:zone/levels/:level/locations - Get locations in zone/level
router.get('/zones/:zone/levels/:level/locations', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone, level } = req.params;

    const locations = await db.all(`
      SELECT 
        sl.id,
        sl.location_code,
        sl.x,
        sl.y,
        sl.z,
        sl.capacity,
        sl.current_occupancy,
        sl.status,
        ROUND(CAST(sl.current_occupancy AS FLOAT) / sl.capacity * 100, 2) as occupancy_percentage,
        COALESCE(inv_summary.product_count, 0) as product_count
      FROM storage_locations sl
      LEFT JOIN (
        SELECT 
          location_code,
          COUNT(DISTINCT product_reference) as product_count
        FROM inventory
        GROUP BY location_code
      ) inv_summary ON sl.location_code = inv_summary.location_code
      WHERE sl.zone = ? AND sl.z = ? AND sl.status = 'active'
      ORDER BY sl.x, sl.y
    `, [zone, parseInt(level)]);

    res.json({
      success: true,
      data: { 
        zone,
        level: parseInt(level),
        locations 
      }
    });

  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch locations',
      details: error.message 
    });
  }
});

// GET /api/locations/:id - Get single location with detailed info
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    const location = await db.get(`
      SELECT 
        id,
        location_code,
        x, y, z,
        zone,
        capacity,
        current_occupancy,
        status,
        created_at,
        updated_at,
        ROUND(CAST(current_occupancy AS FLOAT) / capacity * 100, 2) as occupancy_percentage
      FROM storage_locations 
      WHERE id = ?
    `, [id]);

    if (!location) {
      return res.status(404).json({ 
        success: false, 
        error: 'Location not found' 
      });
    }

    // Get inventory at this location
    const inventory = await db.all(`
      SELECT 
        i.product_reference,
        i.quantity,
        i.reserved_quantity,
        i.slot_position,
        p.abc_code,
        p.sector,
        p.description,
        p.unit_price
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      WHERE i.location_code = ?
      ORDER BY i.quantity DESC
    `, [location.location_code]);

    // Get recent movements at this location
    const recentMovements = await db.all(`
      SELECT 
        'picking' as movement_type,
        pt.product_reference,
        pt.quantity_to_pick as quantity,
        pt.operator,
        pt.created_at,
        pt.status
      FROM picking_tasks pt
      WHERE pt.location_code = ?
      ORDER BY pt.created_at DESC
      LIMIT 10
    `, [location.location_code]);

    res.json({
      success: true,
      data: {
        location: location,
        inventory: inventory,
        recent_movements: recentMovements,
        summary: {
          total_products: inventory.length,
          total_quantity: inventory.reduce((sum, inv) => sum + inv.quantity, 0),
          total_reserved: inventory.reduce((sum, inv) => sum + inv.reserved_quantity, 0),
          available_capacity: location.capacity - location.current_occupancy
        }
      }
    });

  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch location',
      details: error.message 
    });
  }
});

// POST /api/locations - Create new location
router.post('/', requirePermission('LOCATION_CREATE'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { location_code, x, y, z, zone, capacity } = req.body;

    // Validation
    if (!location_code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Location code is required' 
      });
    }

    if (x === undefined || y === undefined || z === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Coordinates (x, y, z) are required' 
      });
    }

    // Check if location code already exists
    const existing = await db.get('SELECT id FROM storage_locations WHERE location_code = ?', [location_code]);
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'Location code already exists' 
      });
    }

    // Check if coordinates already occupied
    const coordConflict = await db.get('SELECT id FROM storage_locations WHERE x = ? AND y = ? AND z = ?', [x, y, z]);
    if (coordConflict) {
      return res.status(409).json({ 
        success: false, 
        error: 'Coordinates already occupied by another location' 
      });
    }

    // Insert new location
    const result = await db.run(`
      INSERT INTO storage_locations (location_code, x, y, z, zone, capacity, current_occupancy, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'active')
    `, [location_code, parseInt(x), parseInt(y), parseInt(z), zone, parseInt(capacity) || 100]);

    // Get the created location
    const newLocation = await db.get('SELECT * FROM storage_locations WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: { location: newLocation }
    });

  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create location',
      details: error.message 
    });
  }
});

// PUT /api/locations/:id - Update location
router.put('/:id', requirePermission('LOCATION_UPDATE'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { location_code, x, y, z, zone, capacity, status } = req.body;

    // Check if location exists
    const existing = await db.get('SELECT * FROM storage_locations WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Location not found' 
      });
    }

    // Check if new location code conflicts (if changed)
    if (location_code && location_code !== existing.location_code) {
      const conflict = await db.get('SELECT id FROM storage_locations WHERE location_code = ? AND id != ?', [location_code, id]);
      if (conflict) {
        return res.status(409).json({ 
          success: false, 
          error: 'Location code already exists' 
        });
      }
    }

    // Check if new coordinates conflict (if changed)
    if ((x !== undefined && x !== existing.x) || (y !== undefined && y !== existing.y) || (z !== undefined && z !== existing.z)) {
      const newX = x !== undefined ? parseInt(x) : existing.x;
      const newY = y !== undefined ? parseInt(y) : existing.y;
      const newZ = z !== undefined ? parseInt(z) : existing.z;
      
      const coordConflict = await db.get('SELECT id FROM storage_locations WHERE x = ? AND y = ? AND z = ? AND id != ?', [newX, newY, newZ, id]);
      if (coordConflict) {
        return res.status(409).json({ 
          success: false, 
          error: 'Coordinates already occupied by another location' 
        });
      }
    }

    // Check if reducing capacity below current occupancy
    if (capacity !== undefined && parseInt(capacity) < existing.current_occupancy) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot reduce capacity below current occupancy (${existing.current_occupancy})` 
      });
    }

    // Update location
    await db.run(`
      UPDATE storage_locations 
      SET location_code = COALESCE(?, location_code),
          x = COALESCE(?, x),
          y = COALESCE(?, y),
          z = COALESCE(?, z),
          zone = COALESCE(?, zone),
          capacity = COALESCE(?, capacity),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [location_code, x ? parseInt(x) : null, y ? parseInt(y) : null, z ? parseInt(z) : null, zone, capacity ? parseInt(capacity) : null, status, id]);

    // Get updated location
    const updatedLocation = await db.get('SELECT * FROM storage_locations WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: { location: updatedLocation }
    });

  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update location',
      details: error.message 
    });
  }
});

// DELETE /api/locations/:id - Delete location
router.delete('/:id', requirePermission('LOCATION_DELETE'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Check if location exists
    const existing = await db.get('SELECT * FROM storage_locations WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Location not found' 
      });
    }

    // Check if location has inventory
    const inventory = await db.get('SELECT COUNT(*) as count FROM inventory WHERE location_code = ?', [existing.location_code]);
    if (inventory.count > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Cannot delete location with existing inventory' 
      });
    }

    // Check if location has picking tasks
    const pickingTasks = await db.get('SELECT COUNT(*) as count FROM picking_tasks WHERE location_code = ?', [existing.location_code]);
    if (pickingTasks.count > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Cannot delete location with existing picking tasks' 
      });
    }

    // Delete location
    await db.run('DELETE FROM storage_locations WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete location',
      details: error.message 
    });
  }
});

// GET /api/locations/stats - Get location statistics
router.get('/stats', async (req, res) => {
  try {
    const db = await getDatabase();

    // Overall statistics
    const overallStats = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        COUNT(DISTINCT zone) as total_zones,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_occupancy_percentage,
        COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_locations,
        COUNT(CASE WHEN current_occupancy > 0 AND current_occupancy < capacity THEN 1 END) as partial_locations,
        COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_locations
      FROM storage_locations
      WHERE status = 'active'
    `);

    // Statistics by zone
    const zoneStats = await db.all(`
      SELECT 
        zone,
        COUNT(*) as location_count,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_occupancy_percentage,
        COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_locations,
        COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_locations
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `);

    // Statistics by level
    const levelStats = await db.all(`
      SELECT 
        z as level,
        COUNT(*) as location_count,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_occupancy_percentage
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY z
      ORDER BY z
    `);

    res.json({
      success: true,
      data: {
        overall: overallStats,
        by_zone: zoneStats,
        by_level: levelStats
      }
    });

  } catch (error) {
    console.error('Error fetching location stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch location statistics',
      details: error.message 
    });
  }
});

module.exports = router;