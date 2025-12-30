// Product Management Routes - Complete Implementation
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { requireRole, requirePermission } = require('../middleware/permissions');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Configure multer for CSV uploads
const upload = multer({ dest: 'uploads/' });

// GET /api/products - Get all products with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      abc_code = '', 
      sector = '',
      sort_by = 'reference',
      sort_order = 'ASC'
    } = req.query;

    let whereConditions = [];
    let params = [];

    // Search by reference or description
    if (search) {
      whereConditions.push('(reference LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filter by ABC code
    if (abc_code) {
      whereConditions.push('abc_code = ?');
      params.push(abc_code);
    }

    // Filter by sector
    if (sector) {
      whereConditions.push('sector = ?');
      params.push(sector);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;
    const countResult = await db.get(countSql, params);
    const total = countResult.total;

    // Validate sort parameters
    const validSortColumns = ['reference', 'abc_code', 'sector', 'description', 'unit_price', 'created_at'];
    const validSortOrders = ['ASC', 'DESC'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'reference';
    const sortOrder = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

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
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const products = await db.all(sql, [...params, parseInt(limit), offset]);

    // Get summary statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN abc_code = 'A' THEN 1 END) as class_a_count,
        COUNT(CASE WHEN abc_code = 'B' THEN 1 END) as class_b_count,
        COUNT(CASE WHEN abc_code = 'C' THEN 1 END) as class_c_count,
        COUNT(DISTINCT sector) as total_sectors,
        AVG(unit_price) as avg_price,
        MIN(unit_price) as min_price,
        MAX(unit_price) as max_price
      FROM products
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        products: products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        },
        statistics: stats,
        filters: {
          search,
          abc_code,
          sector,
          sort_by: sortColumn,
          sort_order: sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch products',
      details: error.message 
    });
  }
});

// GET /api/products/stats - Get product statistics
router.get('/stats', async (req, res) => {
  try {
    const db = await getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN abc_code = 'A' THEN 1 END) as class_a_count,
        COUNT(CASE WHEN abc_code = 'B' THEN 1 END) as class_b_count,
        COUNT(CASE WHEN abc_code = 'C' THEN 1 END) as class_c_count,
        COUNT(DISTINCT sector) as total_sectors,
        AVG(unit_price) as avg_price,
        MIN(unit_price) as min_price,
        MAX(unit_price) as max_price
      FROM products
    `);

    // Get sector breakdown
    const sectorStats = await db.all(`
      SELECT 
        sector,
        COUNT(*) as product_count,
        AVG(unit_price) as avg_price
      FROM products
      WHERE sector IS NOT NULL
      GROUP BY sector
      ORDER BY product_count DESC
    `);

    // Get ABC distribution
    const abcStats = await db.all(`
      SELECT 
        abc_code,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 2) as percentage
      FROM products
      WHERE abc_code IS NOT NULL
      GROUP BY abc_code
      ORDER BY abc_code
    `);

    res.json({
      success: true,
      data: {
        overview: stats,
        by_sector: sectorStats,
        by_abc_class: abcStats
      }
    });

  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch product statistics',
      details: error.message 
    });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    const product = await db.get(`
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
      WHERE id = ?
    `, [id]);

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }

    // Get inventory information for this product
    const inventory = await db.all(`
      SELECT 
        i.location_code,
        i.quantity,
        i.reserved_quantity,
        sl.zone,
        sl.x, sl.y, sl.z
      FROM inventory i
      JOIN storage_locations sl ON i.location_code = sl.location_code
      WHERE i.product_reference = ?
      ORDER BY i.quantity DESC
    `, [product.reference]);

    // Get recent order history
    const orderHistory = await db.all(`
      SELECT 
        o.order_number,
        o.customer_name,
        oi.quantity,
        oi.picked_quantity,
        o.created_at,
        o.status
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_reference = ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [product.reference]);

    res.json({
      success: true,
      data: {
        product: product,
        inventory: inventory,
        order_history: orderHistory,
        summary: {
          total_stock: inventory.reduce((sum, inv) => sum + inv.quantity, 0),
          total_reserved: inventory.reduce((sum, inv) => sum + inv.reserved_quantity, 0),
          locations_count: inventory.length,
          recent_orders: orderHistory.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch product',
      details: error.message 
    });
  }
});

// POST /api/products - Create new product
router.post('/', requirePermission('PRODUCT_CREATE'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { reference, abc_code, sector, description, unit_price } = req.body;

    // Validation
    if (!reference) {
      return res.status(400).json({ 
        success: false, 
        error: 'Product reference is required' 
      });
    }

    if (abc_code && !['A', 'B', 'C'].includes(abc_code)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ABC code must be A, B, or C' 
      });
    }

    // Check if reference already exists
    const existing = await db.get('SELECT id FROM products WHERE reference = ?', [reference]);
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: 'Product reference already exists' 
      });
    }

    // Insert new product
    const result = await db.run(`
      INSERT INTO products (reference, abc_code, sector, description, unit_price)
      VALUES (?, ?, ?, ?, ?)
    `, [reference, abc_code, sector, description, unit_price]);

    // Get the created product
    const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product: newProduct }
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create product',
      details: error.message 
    });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', requirePermission('PRODUCT_UPDATE'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { reference, abc_code, sector, description, unit_price } = req.body;

    // Check if product exists
    const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }

    // Validation
    if (abc_code && !['A', 'B', 'C'].includes(abc_code)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ABC code must be A, B, or C' 
      });
    }

    // Check if new reference conflicts with existing (if changed)
    if (reference && reference !== existing.reference) {
      const conflict = await db.get('SELECT id FROM products WHERE reference = ? AND id != ?', [reference, id]);
      if (conflict) {
        return res.status(409).json({ 
          success: false, 
          error: 'Product reference already exists' 
        });
      }
    }

    // Update product
    await db.run(`
      UPDATE products 
      SET reference = COALESCE(?, reference),
          abc_code = COALESCE(?, abc_code),
          sector = COALESCE(?, sector),
          description = COALESCE(?, description),
          unit_price = COALESCE(?, unit_price),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [reference, abc_code, sector, description, unit_price, id]);

    // Get updated product
    const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updatedProduct }
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update product',
      details: error.message 
    });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', requirePermission('PRODUCT_DELETE'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    // Check if product exists
    const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }

    // Check if product has inventory
    const inventory = await db.get('SELECT COUNT(*) as count FROM inventory WHERE product_reference = ?', [existing.reference]);
    if (inventory.count > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Cannot delete product with existing inventory' 
      });
    }

    // Check if product has orders
    const orders = await db.get('SELECT COUNT(*) as count FROM order_items WHERE product_reference = ?', [existing.reference]);
    if (orders.count > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Cannot delete product with existing orders' 
      });
    }

    // Delete product
    await db.run('DELETE FROM products WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete product',
      details: error.message 
    });
  }
});

// POST /api/products/import - Import products from CSV
router.post('/import', requirePermission('PRODUCT_IMPORT'), upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No CSV file provided' 
      });
    }

    const db = await getDatabase();
    const results = [];
    const errors = [];
    let lineNumber = 0;

    // Read and parse CSV file
    const csvData = await new Promise((resolve, reject) => {
      const data = [];
      fs.createReadStream(req.file.path)
        .pipe(csv({ separator: ';' })) // Assuming semicolon separator
        .on('data', (row) => {
          lineNumber++;
          data.push({ ...row, lineNumber });
        })
        .on('end', () => resolve(data))
        .on('error', reject);
    });

    // Process each row
    for (const row of csvData) {
      try {
        const { reference, abc_code, sector, description, unit_price } = row;

        // Validation
        if (!reference || !reference.trim()) {
          errors.push({ line: row.lineNumber, error: 'Reference is required' });
          continue;
        }

        if (abc_code && !['A', 'B', 'C'].includes(abc_code.trim().toUpperCase())) {
          errors.push({ line: row.lineNumber, error: 'ABC code must be A, B, or C' });
          continue;
        }

        // Check if reference already exists
        const existing = await db.get('SELECT id FROM products WHERE reference = ?', [reference.trim()]);
        if (existing) {
          errors.push({ line: row.lineNumber, error: `Product reference '${reference}' already exists` });
          continue;
        }

        // Insert product
        const result = await db.run(`
          INSERT INTO products (reference, abc_code, sector, description, unit_price)
          VALUES (?, ?, ?, ?, ?)
        `, [
          reference.trim(),
          abc_code ? abc_code.trim().toUpperCase() : null,
          sector ? sector.trim() : null,
          description ? description.trim() : null,
          unit_price ? parseFloat(unit_price) : null
        ]);

        results.push({
          line: row.lineNumber,
          reference: reference.trim(),
          id: result.lastID,
          status: 'success'
        });

      } catch (error) {
        errors.push({ 
          line: row.lineNumber, 
          error: error.message 
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Import completed. ${results.length} products imported, ${errors.length} errors`,
      data: {
        imported: results,
        errors: errors,
        summary: {
          total_rows: csvData.length,
          successful_imports: results.length,
          failed_imports: errors.length
        }
      }
    });

  } catch (error) {
    console.error('Error importing products:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to import products',
      details: error.message 
    });
  }
});

// GET /api/products/export - Export products to CSV
router.get('/export', requirePermission('PRODUCT_VIEW'), async (req, res) => {
  try {
    const db = await getDatabase();
    const { abc_code, sector } = req.query;

    let whereConditions = [];
    let params = [];

    if (abc_code) {
      whereConditions.push('abc_code = ?');
      params.push(abc_code);
    }

    if (sector) {
      whereConditions.push('sector = ?');
      params.push(sector);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const products = await db.all(`
      SELECT 
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
    `, params);

    // Generate CSV content
    const csvHeader = 'reference;abc_code;sector;description;unit_price;created_at;updated_at\n';
    const csvContent = products.map(p => 
      `${p.reference};${p.abc_code || ''};${p.sector || ''};${p.description || ''};${p.unit_price || ''};${p.created_at};${p.updated_at}`
    ).join('\n');

    const csv = csvHeader + csvContent;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export products',
      details: error.message 
    });
  }
});

module.exports = router;