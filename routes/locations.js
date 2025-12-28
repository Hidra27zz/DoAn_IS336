// Locations Routes - SQL Database with Correct Schema
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all locations with hierarchical filtering
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone, level, page = 1, limit = 100 } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    // Build WHERE clause based on filters
    if (zone) {
      whereConditions.push('zone = ?');
      params.push(zone);
    }
    
    if (level) {
      whereConditions.push('z = ?');
      params.push(parseInt(level));
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM storage_locations ${whereClause}`;
    const countResult = await db.get(countSql, params);
    const total = countResult.total;
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        location_code,
        x,
        y,
        z,
        zone,
        capacity,
        current_occupancy,
        status,
        created_at,
        updated_at
      FROM storage_locations
      ${whereClause}
      ORDER BY zone, z, location_code
      LIMIT ? OFFSET ?
    `;
    
    const locations = await db.all(sql, [...params, parseInt(limit), offset]);
    
    res.json({
      locations: locations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Failed to get locations' });
  }
});

// Get zones for cascading dropdown
router.get('/zones', async (req, res) => {
  try {
    const db = await getDatabase();
    
    const sql = `
      SELECT 
        zone,
        COUNT(*) as location_count,
        MIN(z) as min_level,
        MAX(z) as max_level
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `;
    
    const zones = await db.all(sql);
    
    res.json({
      zones: zones,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({ error: 'Failed to get zones' });
  }
});

// Get levels by zone for cascading dropdown
router.get('/zones/:zone/levels', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone } = req.params;
    
    const sql = `
      SELECT 
        z as level,
        COUNT(*) as location_count
      FROM storage_locations
      WHERE zone = ? AND status = 'active'
      GROUP BY z
      ORDER BY z
    `;
    
    const levels = await db.all(sql, [zone]);
    
    res.json({
      zone: zone,
      levels: levels,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get levels by zone error:', error);
    res.status(500).json({ error: 'Failed to get levels by zone' });
  }
});

// Get locations by zone and level for cascading dropdown
router.get('/zones/:zone/levels/:level/locations', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone, level } = req.params;
    
    const sql = `
      SELECT 
        id,
        location_code,
        x,
        y,
        z,
        zone,
        capacity,
        current_occupancy,
        status
      FROM storage_locations
      WHERE zone = ? AND z = ? AND status = 'active'
      ORDER BY location_code
    `;
    
    const locations = await db.all(sql, [zone, parseInt(level)]);
    
    res.json({
      zone: zone,
      level: parseInt(level),
      locations: locations,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get locations by zone and level error:', error);
    res.status(500).json({ error: 'Failed to get locations by zone and level' });
  }
});

// Get specific location details
router.get('/:locationCode', async (req, res) => {
  try {
    const db = await getDatabase();
    const { locationCode } = req.params;
    
    const sql = `
      SELECT 
        id,
        location_code,
        x,
        y,
        z,
        zone,
        capacity,
        current_occupancy,
        status,
        created_at,
        updated_at
      FROM storage_locations
      WHERE location_code = ?
    `;
    
    const location = await db.get(sql, [locationCode]);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Get inventory at this location
    const inventorySql = `
      SELECT 
        i.id,
        i.product_reference,
        i.quantity,
        i.reserved_quantity,
        i.slot_position,
        p.abc_code,
        p.sector,
        p.description as product_description,
        p.unit_price
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      WHERE i.location_code = ?
      ORDER BY p.reference
    `;
    
    const inventory = await db.all(inventorySql, [locationCode]);
    
    // Calculate occupancy
    const totalQuantity = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const occupancyPercentage = location.capacity > 0 ? (totalQuantity / location.capacity) * 100 : 0;
    
    res.json({
      location: {
        ...location,
        occupancy_percentage: Math.round(occupancyPercentage * 10) / 10
      },
      inventory: inventory.map(inv => ({
        id: inv.id,
        product_reference: inv.product_reference,
        quantity: inv.quantity,
        reserved_quantity: inv.reserved_quantity,
        slot_position: inv.slot_position,
        product: {
          reference: inv.product_reference,
          abc_code: inv.abc_code,
          sector: inv.sector,
          description: inv.product_description,
          unit_price: inv.unit_price
        }
      })),
      summary: {
        total_products: inventory.length,
        total_quantity: totalQuantity,
        total_reserved: inventory.reduce((sum, inv) => sum + inv.reserved_quantity, 0),
        available_quantity: totalQuantity - inventory.reduce((sum, inv) => sum + inv.reserved_quantity, 0)
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get location details error:', error);
    res.status(500).json({ error: 'Failed to get location details' });
  }
});

// Update location
router.put('/:locationCode', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const db = await getDatabase();
    const { locationCode } = req.params;
    const { capacity, status } = req.body;
    
    // Check if location exists
    const existing = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [locationCode]);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Update location
    const updateData = {};
    if (capacity !== undefined) updateData.capacity = capacity;
    if (status !== undefined) updateData.status = status;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    await db.update('storage_locations', existing.id, updateData);
    
    // Get updated location
    const updated = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [locationCode]);
    
    res.json({
      success: true,
      location: updated,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Get location statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Get total locations
    const totalLocations = await db.get('SELECT COUNT(*) as count FROM storage_locations');
    
    // Get locations by zone
    const byZone = await db.all(`
      SELECT 
        zone,
        COUNT(*) as location_count,
        AVG(capacity) as avg_capacity,
        SUM(current_occupancy) as total_occupancy
      FROM storage_locations
      GROUP BY zone
      ORDER BY zone
    `);
    
    // Get locations by level
    const byLevel = await db.all(`
      SELECT 
        z as level,
        COUNT(*) as location_count,
        AVG(capacity) as avg_capacity
      FROM storage_locations
      GROUP BY z
      ORDER BY z
    `);
    
    // Get occupancy statistics
    const occupancyStats = await db.all(`
      SELECT 
        sl.zone,
        sl.z as level,
        COUNT(*) as location_count,
        SUM(CASE WHEN i.location_code IS NOT NULL THEN 1 ELSE 0 END) as occupied_count,
        SUM(COALESCE(i.quantity, 0)) as total_quantity
      FROM storage_locations sl
      LEFT JOIN (
        SELECT location_code, SUM(quantity) as quantity
        FROM inventory
        GROUP BY location_code
      ) i ON sl.location_code = i.location_code
      GROUP BY sl.zone, sl.z
      ORDER BY sl.zone, sl.z
    `);
    
    res.json({
      total_locations: totalLocations.count,
      by_zone: byZone.reduce((acc, zone) => {
        acc[zone.zone] = {
          location_count: zone.location_count,
          avg_capacity: Math.round(zone.avg_capacity * 10) / 10,
          total_occupancy: zone.total_occupancy
        };
        return acc;
      }, {}),
      by_level: byLevel.reduce((acc, level) => {
        acc[`Level_${level.level}`] = {
          location_count: level.location_count,
          avg_capacity: Math.round(level.avg_capacity * 10) / 10
        };
        return acc;
      }, {}),
      occupancy_stats: occupancyStats.map(stat => ({
        zone: stat.zone,
        level: stat.level,
        location_count: stat.location_count,
        occupied_count: stat.occupied_count,
        occupancy_rate: stat.location_count > 0 ? Math.round((stat.occupied_count / stat.location_count) * 100) : 0,
        total_quantity: stat.total_quantity
      })),
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get location statistics error:', error);
    res.status(500).json({ error: 'Failed to get location statistics' });
  }
});

module.exports = router;