// Product Management Routes - SQL Database
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// GET /api/products - Get all products with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      abc_filter = '', 
      sector_filter = '' 
    } = req.query;

    let whereConditions = [];
    let params = [];

    // Build WHERE clause based on filters
    if (search) {
      whereConditions.push('(reference LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (abc_filter) {
      whereConditions.push('abc_code = ?');
      params.push(abc_filter);
    }

    if (sector_filter) {
      whereConditions.push('sector = ?');
      params.push(sector_filter);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;
    const countResult = await db.get(countSql, params);
    const total = countResult.total;

    // Get paginated results
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id,
        reference,
        abc_code,
        sector,
        description,
        unit_price,
        created_at,
        updated_at
      FROM products
      ${whereClause}
      ORDER BY reference
      LIMIT ? OFFSET ?
    `;

    const products = await db.all(sql, [...params, parseInt(limit), offset]);

    res.json({
      products: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// GET /api/products/:reference - Get specific product
router.get('/:reference', async (req, res) => {
  try {
    const db = await getDatabase();
    const { reference } = req.params;

    const product = await db.get('SELECT * FROM products WHERE reference = ?', [reference]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get inventory for this product
    const inventorySql = `
      SELECT 
        i.location_code,
        i.quantity,
        i.reserved_quantity,
        sl.zone,
        sl.x, sl.y, sl.z
      FROM inventory i
      JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE i.product_reference = ?
      ORDER BY sl.zone, sl.location_code
    `;

    const inventory = await db.all(inventorySql, [reference]);

    // Calculate totals
    const totalQuantity = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const totalReserved = inventory.reduce((sum, inv) => sum + inv.reserved_quantity, 0);

    res.json({
      product: product,
      inventory: inventory,
      summary: {
        total_quantity: totalQuantity,
        total_reserved: totalReserved,
        available_quantity: totalQuantity - totalReserved,
        location_count: inventory.length
      },
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// POST /api/products - Create new product
router.post('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { reference, abc_code, sector, description, unit_price } = req.body;

    // Validate required fields
    if (!reference) {
      return res.status(400).json({ error: 'Product reference is required' });
    }

    // Check if product already exists
    const existing = await db.get('SELECT * FROM products WHERE reference = ?', [reference]);
    if (existing) {
      return res.status(409).json({ error: 'Product with this reference already exists' });
    }

    // Create product
    const productData = {
      reference,
      abc_code: abc_code || 'C',
      sector: sector || 'GENERAL',
      description: description || `Product ${reference}`,
      unit_price: unit_price || 0
    };

    const result = await db.create('products', productData);

    res.status(201).json({
      success: true,
      product: result,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:reference - Update product
router.put('/:reference', async (req, res) => {
  try {
    const db = await getDatabase();
    const { reference } = req.params;
    const { abc_code, sector, description, unit_price } = req.body;

    // Check if product exists
    const existing = await db.get('SELECT * FROM products WHERE reference = ?', [reference]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product
    const updateData = {};
    if (abc_code !== undefined) updateData.abc_code = abc_code;
    if (sector !== undefined) updateData.sector = sector;
    if (description !== undefined) updateData.description = description;
    if (unit_price !== undefined) updateData.unit_price = unit_price;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await db.update('products', existing.id, updateData);

    // Get updated product
    const updated = await db.get('SELECT * FROM products WHERE reference = ?', [reference]);

    res.json({
      success: true,
      product: updated,
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:reference - Delete product
router.delete('/:reference', async (req, res) => {
  try {
    const db = await getDatabase();
    const { reference } = req.params;

    // Check if product exists
    const existing = await db.get('SELECT * FROM products WHERE reference = ?', [reference]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product has inventory
    const inventory = await db.get('SELECT COUNT(*) as count FROM inventory WHERE product_reference = ?', [reference]);
    if (inventory.count > 0) {
      return res.status(409).json({ error: 'Cannot delete product with existing inventory' });
    }

    // Delete product
    await db.delete('products', existing.id);

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/stats/summary - Get product statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get total products
    const totalProducts = await db.get('SELECT COUNT(*) as count FROM products');

    // Get products by ABC code
    const byAbcCode = await db.all(`
      SELECT 
        abc_code,
        COUNT(*) as product_count
      FROM products
      GROUP BY abc_code
      ORDER BY abc_code
    `);

    // Get products by sector
    const bySector = await db.all(`
      SELECT 
        sector,
        COUNT(*) as product_count
      FROM products
      GROUP BY sector
      ORDER BY product_count DESC
    `);

    // Get products with inventory
    const withInventory = await db.get(`
      SELECT COUNT(DISTINCT product_reference) as count
      FROM inventory
    `);

    res.json({
      total_products: totalProducts.count,
      products_with_inventory: withInventory.count,
      products_without_inventory: totalProducts.count - withInventory.count,
      by_abc_code: byAbcCode.reduce((acc, item) => {
        acc[item.abc_code] = item.product_count;
        return acc;
      }, {}),
      by_sector: bySector.reduce((acc, item) => {
        acc[item.sector] = item.product_count;
        return acc;
      }, {}),
      data_source: 'SQL Database'
    });

  } catch (error) {
    console.error('Get product statistics error:', error);
    res.status(500).json({ error: 'Failed to get product statistics' });
  }
});

module.exports = router;