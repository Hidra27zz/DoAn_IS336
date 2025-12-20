// Storage Location Management Routes
const express = require('express');
const router = express.Router();
const db = require('../database/firebase-connection');

// GET /api/locations - Get all storage locations with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      zone_filter = '', 
      floor_filter = '',
      status_filter = ''
    } = req.query;

    let locations = await db.getAllStorageLocations();

    // Apply filters
    if (search) {
      locations = locations.filter(l => 
        l.location_code.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (zone_filter) {
      locations = locations.filter(l => l.zone === zone_filter);
    }

    if (floor_filter) {
      locations = locations.filter(l => l.z === parseInt(floor_filter));
    }

    if (status_filter) {
      locations = locations.filter(l => l.status === status_filter);
    }

    // Sort by location code
    locations.sort((a, b) => a.location_code.localeCompare(b.location_code));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedLocations = locations.slice(startIndex, endIndex);

    // Get unique zones and floors for filters
    const zones = [...new Set(locations.map(l => l.zone))].filter(Boolean).sort();
    const floors = [...new Set(locations.map(l => l.z))].filter(Boolean).sort();

    res.json({
      locations: paginatedLocations,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(locations.length / limit),
        total_items: locations.length,
        items_per_page: parseInt(limit)
      },
      filters: {
        zones,
        floors,
        statuses: ['active', 'inactive', 'maintenance']
      }
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// GET /api/locations/:id - Get location by ID
router.get('/:id', async (req, res) => {
  try {
    const location = await db.getStorageLocationById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get inventory for this location
    const inventory = await db.getInventoryByLocation(req.params.id);
    
    res.json({
      ...location,
      inventory_items: inventory.length,
      total_quantity: inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0),
      occupancy_rate: location.capacity ? 
        (inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0) / location.capacity * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

// POST /api/locations - Create new location
router.post('/', async (req, res) => {
  try {
    const { location_code, x, y, z, capacity, zone, aisle, level } = req.body;

    // Validation
    if (!location_code) {
      return res.status(400).json({ 
        error: 'Location code is required' 
      });
    }

    // Validate location code format (A-14-11)
    const locationPattern = /^[A-Z]-\d+-\d+$/;
    if (!locationPattern.test(location_code)) {
      return res.status(400).json({ 
        error: 'Location code must follow format: A-14-11' 
      });
    }

    // Check if location already exists
    const existingLocation = await db.getStorageLocationByCode(location_code);
    if (existingLocation) {
      return res.status(409).json({ 
        error: 'Location code already exists' 
      });
    }

    // Parse location code to extract zone, aisle, level
    const [parsedZone, parsedAisle, parsedLevel] = location_code.split('-');

    const locationData = {
      location_code: location_code.trim().toUpperCase(),
      x: parseInt(x) || 0,
      y: parseInt(y) || 0,
      z: parseInt(z) || 1,
      capacity: parseInt(capacity) || 100,
      zone: zone || parsedZone,
      aisle: aisle || parsedAisle,
      level: level || parsedLevel,
      status: 'active',
      current_occupancy: 0
    };

    const newLocation = await db.create('storage_locations', locationData);
    
    // Log activity
    await db.createLog({
      action: 'location_created',
      entity_type: 'storage_location',
      entity_id: newLocation.id,
      details: { location_code: locationData.location_code },
      user_id: req.user?.id || 'system'
    });

    res.status(201).json(newLocation);
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// PUT /api/locations/:id - Update location
router.put('/:id', async (req, res) => {
  try {
    const { location_code, x, y, z, capacity, status } = req.body;

    const existingLocation = await db.getStorageLocationById(req.params.id);
    if (!existingLocation) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const updateData = {};
    if (location_code) {
      // Validate format
      const locationPattern = /^[A-Z]-\d+-\d+$/;
      if (!locationPattern.test(location_code)) {
        return res.status(400).json({ 
          error: 'Location code must follow format: A-14-11' 
        });
      }
      updateData.location_code = location_code.trim().toUpperCase();
      
      // Update zone, aisle, level from location code
      const [zone, aisle, level] = location_code.split('-');
      updateData.zone = zone;
      updateData.aisle = aisle;
      updateData.level = level;
    }
    
    if (x !== undefined) updateData.x = parseInt(x);
    if (y !== undefined) updateData.y = parseInt(y);
    if (z !== undefined) updateData.z = parseInt(z);
    if (capacity !== undefined) updateData.capacity = parseInt(capacity);
    if (status) updateData.status = status;

    const updatedLocation = await db.updateStorageLocation(req.params.id, updateData);
    
    // Log activity
    await db.createLog({
      action: 'location_updated',
      entity_type: 'storage_location',
      entity_id: req.params.id,
      details: { changes: updateData },
      user_id: req.user?.id || 'system'
    });

    res.json(updatedLocation);
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /api/locations/:id - Delete location
router.delete('/:id', async (req, res) => {
  try {
    const location = await db.getStorageLocationById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Check if location has inventory
    const inventory = await db.getInventoryByLocation(req.params.id);
    if (inventory.length > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete location with existing inventory' 
      });
    }

    await db.delete('storage_locations', req.params.id);
    
    // Log activity
    await db.createLog({
      action: 'location_deleted',
      entity_type: 'storage_location',
      entity_id: req.params.id,
      details: { location_code: location.location_code },
      user_id: req.user?.id || 'system'
    });

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// GET /api/locations/stats - Get location statistics
router.get('/stats', async (req, res) => {
  try {
    const locations = await db.getAllStorageLocations();
    const inventory = await db.getAllInventory();
    
    // Calculate occupancy
    const locationOccupancy = {};
    inventory.forEach(inv => {
      if (!locationOccupancy[inv.location_id]) {
        locationOccupancy[inv.location_id] = 0;
      }
      locationOccupancy[inv.location_id] += inv.quantity || 0;
    });

    const stats = {
      total_locations: locations.length,
      occupied_locations: Object.keys(locationOccupancy).length,
      empty_locations: locations.length - Object.keys(locationOccupancy).length,
      zone_distribution: {},
      floor_distribution: {},
      status_distribution: {},
      capacity_utilization: 0
    };

    let totalCapacity = 0;
    let totalOccupancy = 0;

    locations.forEach(loc => {
      // Zone distribution
      const zone = loc.zone || 'Unknown';
      stats.zone_distribution[zone] = (stats.zone_distribution[zone] || 0) + 1;
      
      // Floor distribution
      const floor = loc.z || 1;
      stats.floor_distribution[floor] = (stats.floor_distribution[floor] || 0) + 1;
      
      // Status distribution
      const status = loc.status || 'active';
      stats.status_distribution[status] = (stats.status_distribution[status] || 0) + 1;
      
      // Capacity calculation
      totalCapacity += loc.capacity || 100;
      totalOccupancy += locationOccupancy[loc.id] || 0;
    });

    stats.capacity_utilization = totalCapacity > 0 ? 
      ((totalOccupancy / totalCapacity) * 100).toFixed(1) : 0;

    res.json(stats);
  } catch (error) {
    console.error('Location stats error:', error);
    res.status(500).json({ error: 'Failed to get location statistics' });
  }
});

// GET /api/locations/layout - Get layout data for visualization
router.get('/layout', async (req, res) => {
  try {
    const { floor = 1 } = req.query;
    
    const locations = await db.getAllStorageLocations();
    const inventory = await db.getAllInventory();
    
    // Filter by floor
    const floorLocations = locations.filter(l => l.z === parseInt(floor));
    
    // Add inventory data to locations
    const locationMap = new Map();
    inventory.forEach(inv => {
      if (!locationMap.has(inv.location_id)) {
        locationMap.set(inv.location_id, { items: 0, quantity: 0 });
      }
      const data = locationMap.get(inv.location_id);
      data.items += 1;
      data.quantity += inv.quantity || 0;
    });

    const layoutData = floorLocations.map(loc => ({
      id: loc.id,
      location_code: loc.location_code,
      x: loc.x,
      y: loc.y,
      z: loc.z,
      zone: loc.zone,
      capacity: loc.capacity || 100,
      current_items: locationMap.get(loc.id)?.items || 0,
      current_quantity: locationMap.get(loc.id)?.quantity || 0,
      occupancy_rate: loc.capacity ? 
        ((locationMap.get(loc.id)?.quantity || 0) / loc.capacity * 100).toFixed(1) : 0,
      status: loc.status || 'active'
    }));

    // Calculate bounds for visualization
    const xs = layoutData.map(l => l.x);
    const ys = layoutData.map(l => l.y);
    
    res.json({
      locations: layoutData,
      bounds: {
        min_x: Math.min(...xs),
        max_x: Math.max(...xs),
        min_y: Math.min(...ys),
        max_y: Math.max(...ys)
      },
      floor: parseInt(floor),
      total_locations: layoutData.length
    });
  } catch (error) {
    console.error('Layout data error:', error);
    res.status(500).json({ error: 'Failed to get layout data' });
  }
});

module.exports = router;