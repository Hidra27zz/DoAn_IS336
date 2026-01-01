// Warehouse Management Routes - Complete Implementation
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { requireRole, requirePermission } = require('../middleware/permissions');

// GET /api/warehouse/overview - Get warehouse overview statistics
router.get('/overview', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get storage statistics
    const storageStats = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as utilization_rate,
        COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_locations,
        COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_locations,
        COUNT(DISTINCT zone) as total_zones
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
        ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as zone_utilization,
        COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_count,
        COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_count
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `);

    // Get today's movements (simulated from picking tasks)
    const today = new Date().toISOString().split('T')[0];
    const todayMovements = await db.get(`
      SELECT 
        COUNT(*) as total_movements,
        SUM(quantity_picked) as total_quantity_moved,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_movements,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_movements
      FROM picking_tasks
      WHERE DATE(created_at) = ?
    `, [today]);

    // Get product distribution
    const productDistribution = await db.get(`
      SELECT 
        COUNT(DISTINCT product_reference) as total_products,
        COUNT(*) as total_inventory_records,
        SUM(quantity) as total_stock_units,
        SUM(reserved_quantity) as total_reserved_units
      FROM inventory
    `);

    res.json({
      success: true,
      data: {
        storage_overview: storageStats,
        zone_breakdown: zoneBreakdown,
        today_movements: todayMovements,
        product_distribution: productDistribution,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching warehouse overview:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch warehouse overview',
      details: error.message 
    });
  }
});

// GET /api/warehouse/layout - Get 2D warehouse layout data
router.get('/layout', async (req, res) => {
  try {
    const db = await getDatabase();
    const { floor, zone, include_inventory = 'false' } = req.query;

    let whereConditions = ['sl.status = ?'];
    let params = ['active'];

    // Filter by floor (z coordinate)
    if (floor) {
      whereConditions.push('sl.z = ?');
      params.push(parseInt(floor));
    }

    // Filter by zone
    if (zone) {
      whereConditions.push('sl.zone = ?');
      params.push(zone);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get layout data with optional inventory information
    let layoutQuery = `
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
        ROUND(CAST(sl.current_occupancy AS FLOAT) / sl.capacity * 100, 2) as utilization_percentage
    `;

    if (include_inventory === 'true') {
      layoutQuery += `,
        GROUP_CONCAT(i.product_reference) as products,
        COUNT(DISTINCT i.product_reference) as product_count,
        SUM(i.quantity) as total_quantity,
        SUM(i.reserved_quantity) as total_reserved
      `;
    }

    layoutQuery += `
      FROM storage_locations sl
    `;

    if (include_inventory === 'true') {
      layoutQuery += `
        LEFT JOIN inventory i ON sl.location_code = i.location_code
      `;
    }

    layoutQuery += `
      WHERE ${whereClause}
    `;

    if (include_inventory === 'true') {
      layoutQuery += `
        GROUP BY sl.id, sl.location_code, sl.x, sl.y, sl.z, sl.zone, sl.capacity, sl.current_occupancy, sl.status
      `;
    }

    layoutQuery += `
      ORDER BY sl.zone, sl.x, sl.y, sl.z
    `;

    const layoutData = await db.all(layoutQuery, params);

    // Get warehouse dimensions
    const dimensions = await db.get(`
      SELECT 
        MIN(x) as min_x, MAX(x) as max_x,
        MIN(y) as min_y, MAX(y) as max_y,
        MIN(z) as min_z, MAX(z) as max_z
      FROM storage_locations
      WHERE status = 'active'
    `);

    // Get zone boundaries
    const zoneBoundaries = await db.all(`
      SELECT 
        zone,
        MIN(x) as min_x, MAX(x) as max_x,
        MIN(y) as min_y, MAX(y) as max_y,
        COUNT(*) as location_count
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `);

    res.json({
      success: true,
      data: {
        layout: layoutData,
        dimensions: dimensions,
        zone_boundaries: zoneBoundaries,
        filters: {
          floor: floor ? parseInt(floor) : null,
          zone: zone || null,
          include_inventory: include_inventory === 'true'
        },
        metadata: {
          total_locations: layoutData.length,
          floors_available: Array.from(new Set(layoutData.map(l => l.z))).sort(),
          zones_available: Array.from(new Set(layoutData.map(l => l.zone))).sort()
        }
      }
    });

  } catch (error) {
    console.error('Error fetching warehouse layout:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch warehouse layout',
      details: error.message 
    });
  }
});

// POST /api/warehouse/movements - Create warehouse movement (inbound/outbound/transfer)
router.post('/movements', async (req, res) => {
  try {
    const db = await getDatabase();
    const { movement_type, product_reference, location_code, from_location, to_location, quantity, notes = '' } = req.body;

    // Validation
    if (!movement_type || !product_reference || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Movement type, product reference, and quantity are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0'
      });
    }

    // Route to appropriate handler based on movement type
    switch (movement_type.toLowerCase()) {
      case 'inbound':
        if (!location_code) {
          return res.status(400).json({
            success: false,
            error: 'Location code is required for inbound movement'
          });
        }
        return await handleInboundMovement(db, { product_reference, location_code, quantity, notes }, req, res);

      case 'outbound':
        if (!location_code) {
          return res.status(400).json({
            success: false,
            error: 'Location code is required for outbound movement'
          });
        }
        return await handleOutboundMovement(db, { product_reference, location_code, quantity, notes }, req, res);

      case 'transfer':
        if (!from_location || !to_location) {
          return res.status(400).json({
            success: false,
            error: 'From location and to location are required for transfer movement'
          });
        }
        return await handleTransferMovement(db, { product_reference, from_location, to_location, quantity, notes }, req, res);

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid movement type. Must be: inbound, outbound, or transfer'
        });
    }

  } catch (error) {
    console.error('Error processing warehouse movement:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process warehouse movement',
      details: error.message 
    });
  }
});

// Helper function for inbound movement
async function handleInboundMovement(db, { product_reference, location_code, quantity, notes }, req, res) {
  try {
    // Check if product exists
    const product = await db.get('SELECT * FROM products WHERE reference = ?', [product_reference]);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check if location exists and has capacity
    const location = await db.get('SELECT * FROM storage_locations WHERE location_code = ? AND status = ?', [location_code, 'active']);
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found or inactive'
      });
    }

    if (location.current_occupancy + quantity > location.capacity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient capacity. Available: ${location.capacity - location.current_occupancy}, Required: ${quantity}`
      });
    }

    // Check if inventory record exists
    const existingInventory = await db.get(
      'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
      [product_reference, location_code]
    );

    if (existingInventory) {
      // Update existing inventory
      await db.run(`
        UPDATE inventory 
        SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_reference = ? AND location_code = ?
      `, [quantity, product_reference, location_code]);
    } else {
      // Create new inventory record
      await db.run(`
        INSERT INTO inventory (product_reference, location_code, quantity, reserved_quantity, slot_position)
        VALUES (?, ?, ?, 0, 1)
      `, [product_reference, location_code, quantity]);
    }

    // Update location occupancy
    await db.run(`
      UPDATE storage_locations 
      SET current_occupancy = current_occupancy + ?, updated_at = CURRENT_TIMESTAMP
      WHERE location_code = ?
    `, [quantity, location_code]);

    // Log the movement
    await db.run(`
      INSERT INTO system_logs (level, module, message, details, user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'INFO',
      'WAREHOUSE',
      'Inbound movement completed',
      JSON.stringify({
        product_reference,
        location_code,
        quantity,
        notes,
        movement_type: 'inbound'
      }),
      req.user?.id || 1
    ]);

    return res.json({
      success: true,
      message: 'Inbound movement completed successfully',
      data: {
        movement_type: 'inbound',
        product_reference,
        location_code,
        quantity_added: quantity,
        new_location_occupancy: location.current_occupancy + quantity,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    throw error;
  }
}

// Helper function for outbound movement
async function handleOutboundMovement(db, { product_reference, location_code, quantity, notes }, req, res) {
  try {
    // Check inventory availability
    const inventory = await db.get(
      'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
      [product_reference, location_code]
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'No inventory found for this product at this location'
      });
    }

    const availableQuantity = inventory.quantity - (inventory.reserved_quantity || 0);
    if (availableQuantity < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient available quantity. Available: ${availableQuantity}, Required: ${quantity}`
      });
    }

    // Update inventory
    await db.run(`
      UPDATE inventory 
      SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_reference = ? AND location_code = ?
    `, [quantity, product_reference, location_code]);

    // Update location occupancy
    await db.run(`
      UPDATE storage_locations 
      SET current_occupancy = current_occupancy - ?, updated_at = CURRENT_TIMESTAMP
      WHERE location_code = ?
    `, [quantity, location_code]);

    // Remove inventory record if quantity becomes 0
    await db.run(`
      DELETE FROM inventory 
      WHERE product_reference = ? AND location_code = ? AND quantity = 0
    `, [product_reference, location_code]);

    // Log the movement
    await db.run(`
      INSERT INTO system_logs (level, module, message, details, user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'INFO',
      'WAREHOUSE',
      'Outbound movement completed',
      JSON.stringify({
        product_reference,
        location_code,
        quantity,
        notes,
        movement_type: 'outbound'
      }),
      req.user?.id || 1
    ]);

    return res.json({
      success: true,
      message: 'Outbound movement completed successfully',
      data: {
        movement_type: 'outbound',
        product_reference,
        location_code,
        quantity_removed: quantity,
        remaining_quantity: inventory.quantity - quantity,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    throw error;
  }
}

// Helper function for transfer movement
async function handleTransferMovement(db, { product_reference, from_location, to_location, quantity, notes }, req, res) {
  try {
    if (from_location === to_location) {
      return res.status(400).json({
        success: false,
        error: 'From and to locations cannot be the same'
      });
    }

    // Check source inventory
    const sourceInventory = await db.get(
      'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
      [product_reference, from_location]
    );

    if (!sourceInventory) {
      return res.status(404).json({
        success: false,
        error: 'No inventory found at source location'
      });
    }

    const availableQuantity = sourceInventory.quantity - (sourceInventory.reserved_quantity || 0);
    if (availableQuantity < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient available quantity at source. Available: ${availableQuantity}, Required: ${quantity}`
      });
    }

    // Check destination location capacity
    const destLocation = await db.get('SELECT * FROM storage_locations WHERE location_code = ? AND status = ?', [to_location, 'active']);
    if (!destLocation) {
      return res.status(404).json({
        success: false,
        error: 'Destination location not found or inactive'
      });
    }

    if (destLocation.current_occupancy + quantity > destLocation.capacity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient capacity at destination. Available: ${destLocation.capacity - destLocation.current_occupancy}, Required: ${quantity}`
      });
    }

    // Perform transfer in transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Remove from source
      await db.run(`
        UPDATE inventory 
        SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_reference = ? AND location_code = ?
      `, [quantity, product_reference, from_location]);

      // Update source location occupancy
      await db.run(`
        UPDATE storage_locations 
        SET current_occupancy = current_occupancy - ?, updated_at = CURRENT_TIMESTAMP
        WHERE location_code = ?
      `, [quantity, from_location]);

      // Add to destination
      const destInventory = await db.get(
        'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
        [product_reference, to_location]
      );

      if (destInventory) {
        await db.run(`
          UPDATE inventory 
          SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_reference = ? AND location_code = ?
        `, [quantity, product_reference, to_location]);
      } else {
        await db.run(`
          INSERT INTO inventory (product_reference, location_code, quantity, reserved_quantity, slot_position)
          VALUES (?, ?, ?, 0, 1)
        `, [product_reference, to_location, quantity]);
      }

      // Update destination location occupancy
      await db.run(`
        UPDATE storage_locations 
        SET current_occupancy = current_occupancy + ?, updated_at = CURRENT_TIMESTAMP
        WHERE location_code = ?
      `, [quantity, to_location]);

      // Remove source inventory if quantity becomes 0
      await db.run(`
        DELETE FROM inventory 
        WHERE product_reference = ? AND location_code = ? AND quantity = 0
      `, [product_reference, from_location]);

      // Log the transfer
      await db.run(`
        INSERT INTO system_logs (level, module, message, details, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'INFO',
        'WAREHOUSE',
        'Stock transfer completed',
        JSON.stringify({
          product_reference,
          from_location,
          to_location,
          quantity,
          notes,
          movement_type: 'transfer'
        }),
        req.user?.id || 1
      ]);

      await db.run('COMMIT');

      return res.json({
        success: true,
        message: 'Stock transfer completed successfully',
        data: {
          movement_type: 'transfer',
          product_reference,
          from_location,
          to_location,
          quantity_transferred: quantity,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    throw error;
  }
}

// GET /api/warehouse/movements - Get movement history
router.get('/movements', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      limit = 50,
      page = 1
    } = req.query;

    // Simplified query - just get recent movements
    const offset = (page - 1) * limit;
    
    const movements = await db.all(`
      SELECT 
        pt.id,
        pt.wave_number,
        pt.product_reference,
        pt.location_code,
        pt.quantity_to_pick,
        pt.quantity_picked,
        pt.status,
        pt.operator,
        pt.created_at,
        pt.updated_at,
        p.description as product_description,
        p.abc_code,
        sl.zone,
        sl.x, sl.y, sl.z,
        u.username as operator_name
      FROM picking_tasks pt
      LEFT JOIN products p ON pt.product_reference = p.reference
      LEFT JOIN storage_locations sl ON pt.location_code = sl.location_code
      LEFT JOIN users u ON pt.operator = u.id
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);

    // Get total count
    const countResult = await db.get(`
      SELECT COUNT(*) as total
      FROM picking_tasks
    `);

    // Get movement statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_movements,
        SUM(quantity_picked) as total_quantity,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(DISTINCT location_code) as locations_involved,
        COUNT(DISTINCT product_reference) as products_involved
      FROM picking_tasks
    `);

    res.json({
      success: true,
      data: {
        movements: movements || [],
        statistics: stats || {
          total_movements: 0,
          total_quantity: 0,
          completed_count: 0,
          in_progress_count: 0,
          pending_count: 0,
          locations_involved: 0,
          products_involved: 0
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult?.total || 0,
          pages: Math.ceil((countResult?.total || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching warehouse movements:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch warehouse movements',
      details: error.message 
    });
  }
});

// POST /api/warehouse/inbound - Quick inbound operation
router.post('/inbound', requirePermission('INVENTORY_RECEIVE'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { product_reference, location_code, quantity, notes = '' } = req.body;

    // Validation
    if (!product_reference || !location_code || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Product reference, location code, and quantity are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0'
      });
    }

    // Check if product exists
    const product = await db.get('SELECT * FROM products WHERE reference = ?', [product_reference]);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check if location exists and has capacity
    const location = await db.get('SELECT * FROM storage_locations WHERE location_code = ? AND status = ?', [location_code, 'active']);
    if (!location) {
      return res.status(404).json({
        success: false,
        error: 'Location not found or inactive'
      });
    }

    if (location.current_occupancy + quantity > location.capacity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient capacity. Available: ${location.capacity - location.current_occupancy}, Required: ${quantity}`
      });
    }

    // Check if inventory record exists
    const existingInventory = await db.get(
      'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
      [product_reference, location_code]
    );

    if (existingInventory) {
      // Update existing inventory
      await db.run(`
        UPDATE inventory 
        SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_reference = ? AND location_code = ?
      `, [quantity, product_reference, location_code]);
    } else {
      // Create new inventory record
      await db.run(`
        INSERT INTO inventory (product_reference, location_code, quantity, reserved_quantity, slot_position)
        VALUES (?, ?, ?, 0, 1)
      `, [product_reference, location_code, quantity]);
    }

    // Update location occupancy
    await db.run(`
      UPDATE storage_locations 
      SET current_occupancy = current_occupancy + ?, updated_at = CURRENT_TIMESTAMP
      WHERE location_code = ?
    `, [quantity, location_code]);

    // Log the movement
    await db.run(`
      INSERT INTO system_logs (level, module, message, details, user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'INFO',
      'WAREHOUSE',
      'Inbound operation completed',
      JSON.stringify({
        product_reference,
        location_code,
        quantity,
        notes,
        operation: 'inbound'
      }),
      req.user?.id || 'system'
    ]);

    res.json({
      success: true,
      message: 'Inbound operation completed successfully',
      data: {
        product_reference,
        location_code,
        quantity_added: quantity,
        new_location_occupancy: location.current_occupancy + quantity,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error processing inbound operation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process inbound operation',
      details: error.message 
    });
  }
});

// POST /api/warehouse/outbound - Quick outbound operation
router.post('/outbound', requirePermission('INVENTORY_ADJUST'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { product_reference, location_code, quantity, notes = '' } = req.body;

    // Validation
    if (!product_reference || !location_code || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Product reference, location code, and quantity are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0'
      });
    }

    // Check inventory availability
    const inventory = await db.get(
      'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
      [product_reference, location_code]
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        error: 'No inventory found for this product at this location'
      });
    }

    const availableQuantity = inventory.quantity - inventory.reserved_quantity;
    if (availableQuantity < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient available quantity. Available: ${availableQuantity}, Required: ${quantity}`
      });
    }

    // Update inventory
    await db.run(`
      UPDATE inventory 
      SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_reference = ? AND location_code = ?
    `, [quantity, product_reference, location_code]);

    // Update location occupancy
    await db.run(`
      UPDATE storage_locations 
      SET current_occupancy = current_occupancy - ?, updated_at = CURRENT_TIMESTAMP
      WHERE location_code = ?
    `, [quantity, location_code]);

    // Remove inventory record if quantity becomes 0
    await db.run(`
      DELETE FROM inventory 
      WHERE product_reference = ? AND location_code = ? AND quantity = 0
    `, [product_reference, location_code]);

    // Log the movement
    await db.run(`
      INSERT INTO system_logs (level, module, message, details, user_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'INFO',
      'WAREHOUSE',
      'Outbound operation completed',
      JSON.stringify({
        product_reference,
        location_code,
        quantity,
        notes,
        operation: 'outbound'
      }),
      req.user?.id || 'system'
    ]);

    res.json({
      success: true,
      message: 'Outbound operation completed successfully',
      data: {
        product_reference,
        location_code,
        quantity_removed: quantity,
        remaining_quantity: inventory.quantity - quantity,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error processing outbound operation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process outbound operation',
      details: error.message 
    });
  }
});

// POST /api/warehouse/transfer - Transfer stock between locations
router.post('/transfer', requirePermission('INVENTORY_ADJUST'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { product_reference, from_location, to_location, quantity, notes = '' } = req.body;

    // Validation
    if (!product_reference || !from_location || !to_location || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Product reference, from location, to location, and quantity are required'
      });
    }

    if (from_location === to_location) {
      return res.status(400).json({
        success: false,
        error: 'From and to locations cannot be the same'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0'
      });
    }

    // Check source inventory
    const sourceInventory = await db.get(
      'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
      [product_reference, from_location]
    );

    if (!sourceInventory) {
      return res.status(404).json({
        success: false,
        error: 'No inventory found at source location'
      });
    }

    const availableQuantity = sourceInventory.quantity - sourceInventory.reserved_quantity;
    if (availableQuantity < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient available quantity at source. Available: ${availableQuantity}, Required: ${quantity}`
      });
    }

    // Check destination location capacity
    const destLocation = await db.get('SELECT * FROM storage_locations WHERE location_code = ? AND status = ?', [to_location, 'active']);
    if (!destLocation) {
      return res.status(404).json({
        success: false,
        error: 'Destination location not found or inactive'
      });
    }

    if (destLocation.current_occupancy + quantity > destLocation.capacity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient capacity at destination. Available: ${destLocation.capacity - destLocation.current_occupancy}, Required: ${quantity}`
      });
    }

    // Perform transfer
    await db.run('BEGIN TRANSACTION');

    try {
      // Remove from source
      await db.run(`
        UPDATE inventory 
        SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_reference = ? AND location_code = ?
      `, [quantity, product_reference, from_location]);

      // Update source location occupancy
      await db.run(`
        UPDATE storage_locations 
        SET current_occupancy = current_occupancy - ?, updated_at = CURRENT_TIMESTAMP
        WHERE location_code = ?
      `, [quantity, from_location]);

      // Add to destination
      const destInventory = await db.get(
        'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
        [product_reference, to_location]
      );

      if (destInventory) {
        await db.run(`
          UPDATE inventory 
          SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_reference = ? AND location_code = ?
        `, [quantity, product_reference, to_location]);
      } else {
        await db.run(`
          INSERT INTO inventory (product_reference, location_code, quantity, reserved_quantity, slot_position)
          VALUES (?, ?, ?, 0, 1)
        `, [product_reference, to_location, quantity]);
      }

      // Update destination location occupancy
      await db.run(`
        UPDATE storage_locations 
        SET current_occupancy = current_occupancy + ?, updated_at = CURRENT_TIMESTAMP
        WHERE location_code = ?
      `, [quantity, to_location]);

      // Remove source inventory if quantity becomes 0
      await db.run(`
        DELETE FROM inventory 
        WHERE product_reference = ? AND location_code = ? AND quantity = 0
      `, [product_reference, from_location]);

      // Log the transfer
      await db.run(`
        INSERT INTO system_logs (level, module, message, details, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'INFO',
        'WAREHOUSE',
        'Stock transfer completed',
        JSON.stringify({
          product_reference,
          from_location,
          to_location,
          quantity,
          notes,
          operation: 'transfer'
        }),
        req.user?.id || 'system'
      ]);

      await db.run('COMMIT');

      res.json({
        success: true,
        message: 'Stock transfer completed successfully',
        data: {
          product_reference,
          from_location,
          to_location,
          quantity_transferred: quantity,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error processing stock transfer:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process stock transfer',
      details: error.message 
    });
  }
});

// GET /api/warehouse/reports - Generate warehouse reports
router.get('/reports', requirePermission('REPORTS_VIEW'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { type = 'summary', date_from, date_to } = req.query;

    let reportData = {};

    switch (type) {
      case 'summary':
        reportData = await generateSummaryReport(db);
        break;
      case 'utilization':
        reportData = await generateUtilizationReport(db);
        break;
      case 'movements':
        reportData = await generateMovementsReport(db, date_from, date_to);
        break;
      case 'performance':
        reportData = await generatePerformanceReport(db, date_from, date_to);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type. Available types: summary, utilization, movements, performance'
        });
    }

    res.json({
      success: true,
      data: {
        report_type: type,
        generated_at: new Date().toISOString(),
        ...reportData
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

// Helper functions for report generation
async function generateSummaryReport(db) {
  const summary = await db.get(`
    SELECT 
      COUNT(*) as total_locations,
      SUM(capacity) as total_capacity,
      SUM(current_occupancy) as total_occupancy,
      ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as avg_utilization,
      COUNT(DISTINCT zone) as total_zones
    FROM storage_locations
    WHERE status = 'active'
  `);

  const productSummary = await db.get(`
    SELECT 
      COUNT(DISTINCT product_reference) as total_products,
      COUNT(*) as total_inventory_records,
      SUM(quantity) as total_stock_units
    FROM inventory
  `);

  return {
    warehouse_summary: summary,
    product_summary: productSummary
  };
}

async function generateUtilizationReport(db) {
  const zoneUtilization = await db.all(`
    SELECT 
      zone,
      COUNT(*) as location_count,
      SUM(capacity) as total_capacity,
      SUM(current_occupancy) as total_occupancy,
      ROUND(AVG(CAST(current_occupancy AS FLOAT) / capacity * 100), 2) as utilization_percentage,
      COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_locations,
      COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_locations
    FROM storage_locations
    WHERE status = 'active'
    GROUP BY zone
    ORDER BY utilization_percentage DESC
  `);

  return {
    zone_utilization: zoneUtilization
  };
}

async function generateMovementsReport(db, dateFrom, dateTo) {
  let whereClause = '1=1';
  let params = [];

  if (dateFrom) {
    whereClause += ' AND DATE(created_at) >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    whereClause += ' AND DATE(created_at) <= ?';
    params.push(dateTo);
  }

  const movements = await db.all(`
    SELECT 
      DATE(created_at) as movement_date,
      COUNT(*) as total_movements,
      SUM(quantity_picked) as total_quantity,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_movements,
      COUNT(DISTINCT location_code) as locations_involved
    FROM picking_tasks
    WHERE ${whereClause}
    GROUP BY DATE(created_at)
    ORDER BY movement_date DESC
  `, params);

  return {
    movements_by_date: movements,
    date_range: { from: dateFrom, to: dateTo }
  };
}

async function generatePerformanceReport(db, dateFrom, dateTo) {
  let whereClause = '1=1';
  let params = [];

  if (dateFrom) {
    whereClause += ' AND DATE(pt.created_at) >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    whereClause += ' AND DATE(pt.created_at) <= ?';
    params.push(dateTo);
  }

  const performance = await db.all(`
    SELECT 
      sl.zone,
      COUNT(pt.id) as total_picks,
      SUM(pt.quantity_picked) as total_quantity,
      AVG(pt.quantity_picked) as avg_pick_quantity,
      COUNT(DISTINCT pt.product_reference) as unique_products,
      COUNT(DISTINCT pt.operator) as operators_involved
    FROM picking_tasks pt
    JOIN storage_locations sl ON pt.location_code = sl.location_code
    WHERE ${whereClause}
    GROUP BY sl.zone
    ORDER BY total_picks DESC
  `, params);

  return {
    performance_by_zone: performance,
    date_range: { from: dateFrom, to: dateTo }
  };
}

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

// GET /api/warehouse/utilization - Warehouse utilization stats
router.get('/utilization', async (req, res) => {
  try {
    const db = await getDatabase();
    
    const utilizationStats = await db.all(`
      SELECT 
        zone,
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as utilization_rate,
        COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_locations,
        COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_locations
      FROM storage_locations
      WHERE status = 'active'
      GROUP BY zone
      ORDER BY zone
    `);
    
    const overallStats = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        ROUND(CAST(SUM(current_occupancy) AS FLOAT) / NULLIF(SUM(capacity), 0) * 100, 2) as overall_utilization
      FROM storage_locations
      WHERE status = 'active'
    `);
    
    res.json({
      success: true,
      overall: overallStats,
      by_zone: utilizationStats,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Error fetching warehouse utilization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warehouse utilization',
      details: error.message
    });
  }
});

module.exports = router;