// Warehouse Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/warehouse/layout - Get warehouse layout summary
router.get('/layout', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get total locations
    const totalLocations = await db.get('SELECT COUNT(*) as count FROM storage_locations');

    // Get zone summary
    const zoneSummary = await db.all(`
      SELECT 
        zone,
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy,
        AVG(CASE WHEN capacity > 0 THEN (current_occupancy * 100.0 / capacity) ELSE 0 END) as avg_utilization
      FROM storage_locations
      GROUP BY zone
      ORDER BY zone
    `);

    res.json({
      total_locations: totalLocations?.count || 0,
      zone_summary: zoneSummary.map(z => ({
        zone: z.zone,
        total_locations: z.total_locations,
        total_capacity: z.total_capacity || 0,
        total_occupancy: z.total_occupancy || 0,
        avg_utilization: Math.round(z.avg_utilization || 0)
      })),
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get warehouse layout error:', error);
    res.status(500).json({ error: 'Failed to get warehouse layout' });
  }
});

// GET /api/warehouse/locations - Get all storage locations
router.get('/locations', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone, status, limit = 100, page = 1, include_coordinates } = req.query;

    let whereConditions = [];
    let params = [];

    if (zone) {
      whereConditions.push('sl.zone = ?');
      params.push(zone);
    }

    if (status === 'empty') {
      whereConditions.push('sl.current_occupancy = 0');
    } else if (status === 'occupied') {
      whereConditions.push('sl.current_occupancy > 0 AND sl.current_occupancy < sl.capacity');
    } else if (status === 'full') {
      whereConditions.push('sl.current_occupancy >= sl.capacity');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.get(`SELECT COUNT(*) as total FROM storage_locations sl ${whereClause}`, params);
    const total = countResult?.total || 0;

    // Get locations with inventory info
    const offset = (page - 1) * limit;
    const locations = await db.all(`
      SELECT 
        sl.id,
        sl.location_code,
        sl.zone,
        sl.x,
        sl.y,
        sl.z,
        sl.capacity,
        sl.current_occupancy,
        sl.status,
        i.product_reference
      FROM storage_locations sl
      LEFT JOIN inventory i ON sl.location_code = i.location_code
      ${whereClause}
      GROUP BY sl.id
      ORDER BY sl.zone, sl.location_code
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
    console.error('Get warehouse locations error:', error);
    res.status(500).json({ error: 'Failed to get warehouse locations' });
  }
});

// GET /api/warehouse/locations/:id - Get single location
router.get('/locations/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    const location = await db.get(`
      SELECT 
        sl.*,
        i.product_reference,
        i.quantity as inventory_quantity
      FROM storage_locations sl
      LEFT JOIN inventory i ON sl.location_code = i.location_code
      WHERE sl.id = ? OR sl.location_code = ?
    `, [id, id]);

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({
      location: location,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

// PUT /api/warehouse/locations/:id - Update location
router.put('/locations/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { status, capacity } = req.body;

    // Check if location exists
    const existing = await db.get('SELECT * FROM storage_locations WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Build update
    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (capacity !== undefined) {
      updates.push('capacity = ?');
      params.push(capacity);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(`UPDATE storage_locations SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({
      success: true,
      location_id: id,
      message: 'Location updated successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// GET /api/warehouse/utilization - Get utilization stats
router.get('/utilization', async (req, res) => {
  try {
    const db = await getDatabase();

    // Overall utilization
    const overall = await db.get(`
      SELECT 
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy
      FROM storage_locations
    `);

    const utilizationPercentage = overall?.total_capacity > 0 
      ? Math.round((overall.total_occupancy / overall.total_capacity) * 100) 
      : 0;

    // By zone
    const byZone = await db.all(`
      SELECT 
        zone,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy
      FROM storage_locations
      GROUP BY zone
      ORDER BY zone
    `);

    res.json({
      overall: {
        total_capacity: overall?.total_capacity || 0,
        total_occupancy: overall?.total_occupancy || 0,
        utilization_percentage: utilizationPercentage
      },
      by_zone: byZone.map(z => ({
        zone: z.zone,
        total_capacity: z.total_capacity || 0,
        total_occupancy: z.total_occupancy || 0,
        utilization_percentage: z.total_capacity > 0 
          ? Math.round((z.total_occupancy / z.total_capacity) * 100) 
          : 0
      })),
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get utilization error:', error);
    res.status(500).json({ error: 'Failed to get utilization' });
  }
});

// GET /api/warehouse/movements - Get movement history
router.get('/movements', async (req, res) => {
  try {
    const db = await getDatabase();
    const { date, limit = 50 } = req.query;

    // For now, return mock data since we don't have a movements table
    // In production, you'd query a movements/transactions table
    
    res.json({
      movements: [],
      total_movements: 0,
      message: 'Movement tracking not yet implemented',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({ error: 'Failed to get movements' });
  }
});

// POST /api/warehouse/movements - Create movement (inbound/outbound/transfer)
router.post('/movements', async (req, res) => {
  const db = await getDatabase();
  
  try {
    await db.run('BEGIN TRANSACTION');
    
    const { movement_type, product_reference, from_location_code, to_location_code, quantity, notes } = req.body;
    
    // Validate common fields
    if (!movement_type || !product_reference || !quantity || quantity <= 0) {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: 'Movement type, product reference, and valid quantity are required' });
    }

    // Validate product exists
    const product = await db.get('SELECT * FROM products WHERE reference = ?', [product_reference]);
    if (!product) {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: `Product ${product_reference} not found` });
    }

    if (movement_type === 'inbound') {
      // A. NHẬP KHO (INBOUND)
      if (!to_location_code) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Destination location is required for inbound' });
      }

      // Kiểm tra vị trí lưu trữ hợp lệ
      const location = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [to_location_code]);
      if (!location) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Location ${to_location_code} not found` });
      }

      // Kiểm tra hoặc tạo inventory record
      let inventory = await db.get(
        'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
        [product_reference, to_location_code]
      );

      if (inventory) {
        // Cập nhật số lượng tồn kho
        await db.run(
          'UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [quantity, inventory.id]
        );
      } else {
        // Tạo inventory record mới
        await db.run(
          'INSERT INTO inventory (product_reference, location_code, quantity, reserved_quantity) VALUES (?, ?, ?, 0)',
          [product_reference, to_location_code, quantity]
        );
      }

      // Update location occupancy
      await db.run(
        'UPDATE storage_locations SET current_occupancy = COALESCE(current_occupancy, 0) + ? WHERE location_code = ?',
        [quantity, to_location_code]
      );

      // Ghi log movement history
      await db.run(
        `INSERT INTO system_logs (level, module, message, details) VALUES (?, ?, ?, ?)`,
        ['INFO', 'inventory', `Inbound: ${quantity} units of ${product_reference} to ${to_location_code}`, 
         JSON.stringify({ 
           movement_type: 'inbound',
           product_reference,
           to_location_code,
           quantity,
           notes: notes || '',
           timestamp: new Date().toISOString()
         })]
      );

      await db.run('COMMIT');
      
      res.json({
        success: true,
        message: `Successfully added ${quantity} units of ${product_reference} to ${to_location_code}`,
        movement: {
          type: 'inbound',
          product_reference,
          location: to_location_code,
          quantity,
          notes
        },
        data_source: 'SQL Database'
      });

    } else if (movement_type === 'outbound') {
      // B. XUẤT KHO (OUTBOUND)
      if (!from_location_code) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Source location is required for outbound' });
      }

      // Kiểm tra vị trí xuất hàng
      const location = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [from_location_code]);
      if (!location) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Location ${from_location_code} not found` });
      }

      // Kiểm tra đủ hàng tồn kho
      const inventory = await db.get(
        'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
        [product_reference, from_location_code]
      );

      if (!inventory) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `No inventory found for ${product_reference} at ${from_location_code}` });
      }

      const availableQuantity = inventory.quantity - inventory.reserved_quantity;
      if (quantity > availableQuantity) {
        await db.run('ROLLBACK');
        return res.status(400).json({ 
          error: `Insufficient inventory. Available: ${availableQuantity}, Requested: ${quantity}` 
        });
      }

      // Trừ số lượng từ inventory
      await db.run(
        'UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, inventory.id]
      );

      // Update location occupancy
      await db.run(
        'UPDATE storage_locations SET current_occupancy = COALESCE(current_occupancy, 0) - ? WHERE location_code = ?',
        [quantity, from_location_code]
      );

      // Ghi log movement history
      await db.run(
        `INSERT INTO system_logs (level, module, message, details) VALUES (?, ?, ?, ?)`,
        ['INFO', 'inventory', `Outbound: ${quantity} units of ${product_reference} from ${from_location_code}`, 
         JSON.stringify({ 
           movement_type: 'outbound',
           product_reference,
           from_location_code,
           quantity,
           notes: notes || '',
           timestamp: new Date().toISOString()
         })]
      );

      await db.run('COMMIT');
      
      res.json({
        success: true,
        message: `Successfully removed ${quantity} units of ${product_reference} from ${from_location_code}`,
        movement: {
          type: 'outbound',
          product_reference,
          location: from_location_code,
          quantity,
          remaining: inventory.quantity - quantity,
          notes
        },
        data_source: 'SQL Database'
      });

    } else if (movement_type === 'transfer') {
      // C. CHUYỂN KHO (TRANSFER)
      if (!from_location_code || !to_location_code) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Both source and destination locations are required for transfer' });
      }

      if (from_location_code === to_location_code) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Source and destination locations cannot be the same' });
      }

      // Kiểm tra cả hai vị trí
      const fromLocation = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [from_location_code]);
      const toLocation = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [to_location_code]);
      
      if (!fromLocation) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Source location ${from_location_code} not found` });
      }
      
      if (!toLocation) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Destination location ${to_location_code} not found` });
      }

      // Kiểm tra hàng tại vị trí nguồn
      const fromInventory = await db.get(
        'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
        [product_reference, from_location_code]
      );

      if (!fromInventory) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `No inventory found for ${product_reference} at ${from_location_code}` });
      }

      const availableQuantity = fromInventory.quantity - fromInventory.reserved_quantity;
      if (quantity > availableQuantity) {
        await db.run('ROLLBACK');
        return res.status(400).json({ 
          error: `Insufficient inventory at source. Available: ${availableQuantity}, Requested: ${quantity}` 
        });
      }

      // Chuyển hàng giữa các vị trí
      // 1. Trừ từ vị trí nguồn
      await db.run(
        'UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, fromInventory.id]
      );

      // 2. Thêm vào vị trí đích
      let toInventory = await db.get(
        'SELECT * FROM inventory WHERE product_reference = ? AND location_code = ?',
        [product_reference, to_location_code]
      );

      if (toInventory) {
        await db.run(
          'UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [quantity, toInventory.id]
        );
      } else {
        await db.run(
          'INSERT INTO inventory (product_reference, location_code, quantity, reserved_quantity) VALUES (?, ?, ?, 0)',
          [product_reference, to_location_code, quantity]
        );
      }

      // Update location occupancies
      await db.run(
        'UPDATE storage_locations SET current_occupancy = COALESCE(current_occupancy, 0) - ? WHERE location_code = ?',
        [quantity, from_location_code]
      );
      await db.run(
        'UPDATE storage_locations SET current_occupancy = COALESCE(current_occupancy, 0) + ? WHERE location_code = ?',
        [quantity, to_location_code]
      );

      // Ghi log movement history
      await db.run(
        `INSERT INTO system_logs (level, module, message, details) VALUES (?, ?, ?, ?)`,
        ['INFO', 'inventory', `Transfer: ${quantity} units of ${product_reference} from ${from_location_code} to ${to_location_code}`, 
         JSON.stringify({ 
           movement_type: 'transfer',
           product_reference,
           from_location_code,
           to_location_code,
           quantity,
           notes: notes || '',
           timestamp: new Date().toISOString()
         })]
      );

      await db.run('COMMIT');
      
      res.json({
        success: true,
        message: `Successfully transferred ${quantity} units of ${product_reference} from ${from_location_code} to ${to_location_code}`,
        movement: {
          type: 'transfer',
          product_reference,
          from_location: from_location_code,
          to_location: to_location_code,
          quantity,
          notes
        },
        data_source: 'SQL Database'
      });

    } else {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: 'Invalid movement type. Must be inbound, outbound, or transfer' });
    }

  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Movement error:', error);
    res.status(500).json({ error: 'Failed to process movement: ' + error.message });
  }
});

// GET /api/warehouse/report - Generate warehouse report
router.get('/report', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get totals
    const totals = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy
      FROM storage_locations
    `);

    // Get zone breakdown
    const zones = await db.all(`
      SELECT 
        zone,
        COUNT(*) as locations,
        SUM(capacity) as capacity,
        SUM(current_occupancy) as occupancy
      FROM storage_locations
      GROUP BY zone
      ORDER BY zone
    `);

    const utilizationPercentage = totals?.total_capacity > 0
      ? Math.round((totals.total_occupancy / totals.total_capacity) * 100)
      : 0;

    res.json({
      total_locations: totals?.total_locations || 0,
      total_capacity: totals?.total_capacity || 0,
      total_occupancy: totals?.total_occupancy || 0,
      utilization_percentage: utilizationPercentage,
      zones: zones.map(z => ({
        zone: z.zone,
        locations: z.locations,
        capacity: z.capacity || 0,
        occupancy: z.occupancy || 0,
        utilization: z.capacity > 0 ? Math.round((z.occupancy / z.capacity) * 100) : 0
      })),
      movements: {
        inbound: 0,
        outbound: 0,
        transfers: 0
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/warehouse - Get warehouse overview
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();

    const totals = await db.get(`
      SELECT 
        COUNT(*) as total_locations,
        SUM(capacity) as total_capacity,
        SUM(current_occupancy) as total_occupancy
      FROM storage_locations
    `);

    res.json({
      success: true,
      total_locations: totals?.total_locations || 0,
      total_capacity: totals?.total_capacity || 0,
      total_occupancy: totals?.total_occupancy || 0,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get warehouse error:', error);
    res.status(500).json({ error: 'Failed to get warehouse' });
  }
});

module.exports = router;