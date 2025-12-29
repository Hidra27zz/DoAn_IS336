// Storage Locations Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');

const router = express.Router();

// GET /api/locations - Get all storage locations
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone, status, limit = 100, page = 1 } = req.query;

    let whereConditions = [];
    let params = [];

    if (zone) {
      whereConditions.push('zone = ?');
      params.push(zone);
    }

    if (status === 'empty') {
      whereConditions.push('current_occupancy = 0');
    } else if (status === 'occupied') {
      whereConditions.push('current_occupancy > 0 AND current_occupancy < capacity');
    } else if (status === 'full') {
      whereConditions.push('current_occupancy >= capacity');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.get(`SELECT COUNT(*) as total FROM storage_locations ${whereClause}`, params);
    const total = countResult?.total || 0;

    // Get paginated results
    const offset = (page - 1) * limit;
    const locations = await db.all(`
      SELECT 
        id,
        location_code,
        zone,
        x, y, z,
        capacity,
        current_occupancy,
        status,
        created_at,
        updated_at
      FROM storage_locations
      ${whereClause}
      ORDER BY zone, location_code
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

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

// GET /api/locations/:id - Get specific location
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    const location = await db.get(`
      SELECT * FROM storage_locations 
      WHERE id = ? OR location_code = ?
    `, [id, id]);

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get inventory for this location
    const inventory = await db.all(`
      SELECT 
        i.*,
        p.description as product_description,
        p.abc_code
      FROM inventory i
      LEFT JOIN products p ON i.product_reference = p.reference
      WHERE i.location_code = ?
    `, [location.location_code]);

    res.json({
      location: location,
      inventory: inventory,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

module.exports = router;