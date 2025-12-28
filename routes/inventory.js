// Inventory Routes - SQL Database with Correct Schema
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all inventory
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { zone, abc_code, low_stock, level, location, page = 1, limit = 50, search } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    // Build WHERE clause based on filters
    if (zone) {
      whereConditions.push('sl.zone = ?');
      params.push(zone);
    }
    
    if (abc_code) {
      whereConditions.push('p.abc_code = ?');
      params.push(abc_code);
    }
    
    if (low_stock === 'true') {
      whereConditions.push('i.quantity < 20');
    }
    
    if (level) {
      whereConditions.push('sl.z = ?');
      params.push(parseInt(level));
    }
    
    if (location) {
      whereConditions.push('sl.location_code = ?');
      params.push(location);
    }
    
    if (search) {
      whereConditions.push('(p.reference LIKE ? OR sl.location_code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      ${whereClause}
    `;
    
    const countResult = await db.get(countSql, params);
    const total = countResult.total;
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        i.id,
        i.product_reference,
        i.location_code,
        i.quantity,
        i.reserved_quantity,
        i.slot_position,
        i.created_at,
        i.updated_at,
        p.abc_code,
        p.sector,
        p.description as product_description,
        p.unit_price,
        sl.zone,
        sl.x,
        sl.y,
        sl.z,
        sl.capacity
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      ${whereClause}
      ORDER BY p.reference, sl.location_code
      LIMIT ? OFFSET ?
    `;
    
    const inventory = await db.all(sql, [...params, parseInt(limit), offset]);
    
    // Format response
    const formattedInventory = inventory.map(inv => ({
      id: inv.id,
      quantity: inv.quantity,
      reserved_quantity: inv.reserved_quantity,
      slot_position: inv.slot_position,
      created_at: inv.created_at,
      updated_at: inv.updated_at,
      product: {
        reference: inv.product_reference,
        abc_code: inv.abc_code,
        sector: inv.sector,
        description: inv.product_description,
        unit_price: inv.unit_price
      },
      location: {
        location_code: inv.location_code,
        zone: inv.zone,
        x: inv.x,
        y: inv.y,
        z: inv.z,
        capacity: inv.capacity
      }
    }));
    
    res.json({
      inventory: formattedInventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Get inventory summary
router.get('/summary', async (req, res) => {
  try {
    const db = await getDatabase();
    
    // Get total counts
    const totalProducts = await db.get('SELECT COUNT(DISTINCT product_reference) as count FROM inventory');
    const totalLocations = await db.get('SELECT COUNT(DISTINCT location_code) as count FROM inventory');
    const totalQuantity = await db.get('SELECT SUM(quantity) as total FROM inventory');
    const totalReserved = await db.get('SELECT SUM(reserved_quantity) as total FROM inventory');
    
    // Get inventory by zone
    const byZone = await db.all(`
      SELECT 
        sl.zone,
        COUNT(*) as total_items,
        SUM(i.quantity) as total_quantity
      FROM inventory i
      JOIN storage_locations sl ON i.location_code = sl.location_code
      GROUP BY sl.zone
      ORDER BY sl.zone
    `);
    
    // Get inventory by ABC code
    const byAbcCode = await db.all(`
      SELECT 
        p.abc_code,
        COUNT(*) as total_items,
        SUM(i.quantity) as total_quantity
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      GROUP BY p.abc_code
      ORDER BY p.abc_code
    `);
    
    // Format zone data
    const zoneData = {};
    byZone.forEach(zone => {
      zoneData[zone.zone] = {
        total_items: zone.total_items,
        total_quantity: zone.total_quantity
      };
    });
    
    // Format ABC data
    const abcData = {};
    byAbcCode.forEach(abc => {
      abcData[abc.abc_code] = {
        total_items: abc.total_items,
        total_quantity: abc.total_quantity
      };
    });
    
    res.json({
      total_products: totalProducts.count,
      total_locations: totalLocations.count,
      total_quantity: totalQuantity.total || 0,
      total_reserved: totalReserved.total || 0,
      by_zone: zoneData,
      by_abc_code: abcData,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({ error: 'Failed to get inventory summary' });
  }
});

// Get inventory by product
router.get('/product/:productReference', async (req, res) => {
  try {
    const db = await getDatabase();
    const { productReference } = req.params;
    
    const sql = `
      SELECT 
        i.id,
        i.product_reference,
        i.location_code,
        i.quantity,
        i.reserved_quantity,
        i.slot_position,
        i.created_at,
        i.updated_at,
        p.abc_code,
        p.sector,
        p.description as product_description,
        p.unit_price,
        sl.zone,
        sl.x,
        sl.y,
        sl.z,
        sl.capacity
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE i.product_reference = ?
      ORDER BY sl.zone, sl.location_code
    `;
    
    const inventory = await db.all(sql, [productReference]);
    
    if (inventory.length === 0) {
      return res.status(404).json({ error: 'Product not found in inventory' });
    }
    
    // Format response
    const formattedInventory = inventory.map(inv => ({
      id: inv.id,
      quantity: inv.quantity,
      reserved_quantity: inv.reserved_quantity,
      slot_position: inv.slot_position,
      created_at: inv.created_at,
      updated_at: inv.updated_at,
      product: {
        reference: inv.product_reference,
        abc_code: inv.abc_code,
        sector: inv.sector,
        description: inv.product_description,
        unit_price: inv.unit_price
      },
      location: {
        location_code: inv.location_code,
        zone: inv.zone,
        x: inv.x,
        y: inv.y,
        z: inv.z,
        capacity: inv.capacity
      }
    }));
    
    // Calculate totals
    const totalQuantity = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const totalReserved = inventory.reduce((sum, inv) => sum + inv.reserved_quantity, 0);
    
    res.json({
      product_reference: productReference,
      total_quantity: totalQuantity,
      total_reserved: totalReserved,
      available_quantity: totalQuantity - totalReserved,
      locations: formattedInventory,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get inventory by product error:', error);
    res.status(500).json({ error: 'Failed to get inventory by product' });
  }
});

// Get inventory by location
router.get('/location/:locationCode', async (req, res) => {
  try {
    const db = await getDatabase();
    const { locationCode } = req.params;
    
    const sql = `
      SELECT 
        i.id,
        i.product_reference,
        i.location_code,
        i.quantity,
        i.reserved_quantity,
        i.slot_position,
        i.created_at,
        i.updated_at,
        p.abc_code,
        p.sector,
        p.description as product_description,
        p.unit_price,
        sl.zone,
        sl.x,
        sl.y,
        sl.z,
        sl.capacity
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE i.location_code = ?
      ORDER BY p.reference
    `;
    
    const inventory = await db.all(sql, [locationCode]);
    
    if (inventory.length === 0) {
      return res.status(404).json({ error: 'Location not found or empty' });
    }
    
    // Format response
    const formattedInventory = inventory.map(inv => ({
      id: inv.id,
      quantity: inv.quantity,
      reserved_quantity: inv.reserved_quantity,
      slot_position: inv.slot_position,
      created_at: inv.created_at,
      updated_at: inv.updated_at,
      product: {
        reference: inv.product_reference,
        abc_code: inv.abc_code,
        sector: inv.sector,
        description: inv.product_description,
        unit_price: inv.unit_price
      },
      location: {
        location_code: inv.location_code,
        zone: inv.zone,
        x: inv.x,
        y: inv.y,
        z: inv.z,
        capacity: inv.capacity
      }
    }));
    
    // Calculate totals
    const totalQuantity = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const totalReserved = inventory.reduce((sum, inv) => sum + inv.reserved_quantity, 0);
    
    res.json({
      location_code: locationCode,
      total_quantity: totalQuantity,
      total_reserved: totalReserved,
      available_quantity: totalQuantity - totalReserved,
      products: formattedInventory,
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get inventory by location error:', error);
    res.status(500).json({ error: 'Failed to get inventory by location' });
  }
});

// Update inventory quantity
router.put('/:id', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { quantity, reserved_quantity } = req.body;
    
    // Validate input
    if (quantity !== undefined && quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }
    
    if (reserved_quantity !== undefined && reserved_quantity < 0) {
      return res.status(400).json({ error: 'Reserved quantity cannot be negative' });
    }
    
    // Check if inventory record exists
    const existing = await db.get('SELECT * FROM inventory WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    
    // Update inventory
    const updateData = {};
    if (quantity !== undefined) updateData.quantity = quantity;
    if (reserved_quantity !== undefined) updateData.reserved_quantity = reserved_quantity;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    await db.update('inventory', id, updateData);
    
    // Get updated record with joins
    const sql = `
      SELECT 
        i.id,
        i.product_reference,
        i.location_code,
        i.quantity,
        i.reserved_quantity,
        i.slot_position,
        i.created_at,
        i.updated_at,
        p.abc_code,
        p.sector,
        p.description as product_description,
        p.unit_price,
        sl.zone,
        sl.x,
        sl.y,
        sl.z,
        sl.capacity
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE i.id = ?
    `;
    
    const updated = await db.get(sql, [id]);
    
    res.json({
      success: true,
      inventory: {
        id: updated.id,
        quantity: updated.quantity,
        reserved_quantity: updated.reserved_quantity,
        slot_position: updated.slot_position,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        product: {
          reference: updated.product_reference,
          abc_code: updated.abc_code,
          sector: updated.sector,
          description: updated.product_description,
          unit_price: updated.unit_price
        },
        location: {
          location_code: updated.location_code,
          zone: updated.zone,
          x: updated.x,
          y: updated.y,
          z: updated.z,
          capacity: updated.capacity
        }
      },
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Get low stock items
router.get('/low-stock', async (req, res) => {
  try {
    const db = await getDatabase();
    const { threshold = 20 } = req.query;
    
    const sql = `
      SELECT 
        i.product_reference,
        p.abc_code,
        p.sector,
        p.description as product_description,
        SUM(i.quantity) as total_quantity,
        SUM(i.reserved_quantity) as total_reserved,
        COUNT(*) as location_count
      FROM inventory i
      JOIN products p ON i.product_reference = p.reference
      GROUP BY i.product_reference, p.abc_code, p.sector, p.description
      HAVING total_quantity < ?
      ORDER BY total_quantity ASC, p.abc_code ASC
    `;
    
    const lowStockItems = await db.all(sql, [parseInt(threshold)]);
    
    res.json({
      threshold: parseInt(threshold),
      low_stock_items: lowStockItems.map(item => ({
        product_reference: item.product_reference,
        abc_code: item.abc_code,
        sector: item.sector,
        description: item.product_description,
        total_quantity: item.total_quantity,
        total_reserved: item.total_reserved,
        available_quantity: item.total_quantity - item.total_reserved,
        location_count: item.location_count
      })),
      data_source: 'SQL Database'
    });
    
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to get low stock items' });
  }
});

module.exports = router;