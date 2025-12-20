// Product Management Routes
const express = require('express');
const router = express.Router();
const db = require('../database/firebase-connection');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// GET /api/products - Get all products with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      abc_filter = '', 
      sector_filter = '' 
    } = req.query;

    let products = await db.getAllProducts();

    // Apply filters
    if (search) {
      products = products.filter(p => 
        p.reference.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (abc_filter) {
      products = products.filter(p => p.abc_code === abc_filter);
    }

    if (sector_filter) {
      products = products.filter(p => p.sector_code === sector_filter);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedProducts = products.slice(startIndex, endIndex);

    res.json({
      products: paginatedProducts,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(products.length / limit),
        total_items: products.length,
        items_per_page: parseInt(limit)
      },
      filters: {
        abc_codes: ['A', 'B', 'C'],
        sectors: [...new Set(products.map(p => p.sector_code))].filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get inventory for this product
    const inventory = await db.getInventoryByProduct(req.params.id);
    
    res.json({
      ...product,
      inventory_locations: inventory.length,
      total_quantity: inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0)
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create new product
router.post('/', async (req, res) => {
  try {
    const { reference, abc_code, sector_code, description, unit_price } = req.body;

    // Validation
    if (!reference || !abc_code) {
      return res.status(400).json({ 
        error: 'Reference and ABC code are required' 
      });
    }

    if (!['A', 'B', 'C'].includes(abc_code)) {
      return res.status(400).json({ 
        error: 'ABC code must be A, B, or C' 
      });
    }

    // Check if reference already exists
    const existingProduct = await db.getProductByReference(reference);
    if (existingProduct) {
      return res.status(409).json({ 
        error: 'Product reference already exists' 
      });
    }

    const productData = {
      reference: reference.trim().toUpperCase(),
      abc_code: abc_code.toUpperCase(),
      sector_code: sector_code || 'PF',
      description: description || `Product ${reference}`,
      unit_price: parseFloat(unit_price) || 0,
      category: 'Footwear',
      status: 'active'
    };

    const newProduct = await db.createProduct(productData);
    
    // Log activity
    await db.createLog({
      action: 'product_created',
      entity_type: 'product',
      entity_id: newProduct.id,
      details: { reference: productData.reference },
      user_id: req.user?.id || 'system'
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res) => {
  try {
    const { reference, abc_code, sector_code, description, unit_price, status } = req.body;

    const existingProduct = await db.getProductById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validation
    if (abc_code && !['A', 'B', 'C'].includes(abc_code)) {
      return res.status(400).json({ 
        error: 'ABC code must be A, B, or C' 
      });
    }

    const updateData = {};
    if (reference) updateData.reference = reference.trim().toUpperCase();
    if (abc_code) updateData.abc_code = abc_code.toUpperCase();
    if (sector_code) updateData.sector_code = sector_code;
    if (description) updateData.description = description;
    if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price);
    if (status) updateData.status = status;

    const updatedProduct = await db.updateProduct(req.params.id, updateData);
    
    // Log activity
    await db.createLog({
      action: 'product_updated',
      entity_type: 'product',
      entity_id: req.params.id,
      details: { changes: updateData },
      user_id: req.user?.id || 'system'
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product has inventory
    const inventory = await db.getInventoryByProduct(req.params.id);
    if (inventory.length > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete product with existing inventory' 
      });
    }

    await db.delete('products', req.params.id);
    
    // Log activity
    await db.createLog({
      action: 'product_deleted',
      entity_type: 'product',
      entity_id: req.params.id,
      details: { reference: product.reference },
      user_id: req.user?.id || 'system'
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// POST /api/products/import - Import products from CSV
router.post('/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const results = [];
    const errors = [];
    let lineNumber = 1;

    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv({ separator: ';' }))
      .on('data', (data) => {
        lineNumber++;
        try {
          // Validate required fields
          if (!data.Reference || !data.ABCCOD) {
            errors.push(`Line ${lineNumber}: Missing Reference or ABC Code`);
            return;
          }

          if (!['A', 'B', 'C'].includes(data.ABCCOD)) {
            errors.push(`Line ${lineNumber}: Invalid ABC Code (${data.ABCCOD})`);
            return;
          }

          results.push({
            reference: data.Reference.trim().toUpperCase(),
            abc_code: data.ABCCOD.toUpperCase(),
            sector_code: data.Sector || 'PF',
            description: `Product ${data.Reference}`,
            unit_price: 0,
            category: 'Footwear',
            status: 'active'
          });
        } catch (error) {
          errors.push(`Line ${lineNumber}: ${error.message}`);
        }
      })
      .on('end', async () => {
        try {
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          if (errors.length > 0) {
            return res.status(400).json({ 
              error: 'Validation errors found',
              errors: errors,
              valid_records: results.length
            });
          }

          // Import valid records
          let imported = 0;
          let skipped = 0;
          const importErrors = [];

          for (const productData of results) {
            try {
              // Check if product already exists
              const existing = await db.getProductByReference(productData.reference);
              if (existing) {
                skipped++;
                continue;
              }

              await db.createProduct(productData);
              imported++;
            } catch (error) {
              importErrors.push(`${productData.reference}: ${error.message}`);
            }
          }

          // Log import activity
          await db.createLog({
            action: 'products_imported',
            entity_type: 'product',
            details: { 
              imported, 
              skipped, 
              errors: importErrors.length,
              total_records: results.length 
            },
            user_id: req.user?.id || 'system'
          });

          res.json({
            message: 'Import completed',
            summary: {
              total_records: results.length,
              imported,
              skipped,
              errors: importErrors.length
            },
            import_errors: importErrors
          });
        } catch (error) {
          console.error('Import processing error:', error);
          res.status(500).json({ error: 'Failed to process import' });
        }
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Invalid CSV file format' });
      });
  } catch (error) {
    console.error('Import error:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to import products' });
  }
});

// GET /api/products/export - Export products to CSV
router.get('/export', async (req, res) => {
  try {
    const products = await db.getAllProducts();
    
    // Generate CSV content
    const csvHeader = 'Reference;ABCCOD;Sector;Description;Unit_Price;Status\n';
    const csvRows = products.map(p => 
      `${p.reference};${p.abc_code};${p.sector_code || ''};${p.description || ''};${p.unit_price || 0};${p.status || 'active'}`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export products' });
  }
});

// GET /api/products/stats - Get product statistics
router.get('/stats', async (req, res) => {
  try {
    const products = await db.getAllProducts();
    
    const stats = {
      total_products: products.length,
      abc_distribution: {
        A: products.filter(p => p.abc_code === 'A').length,
        B: products.filter(p => p.abc_code === 'B').length,
        C: products.filter(p => p.abc_code === 'C').length
      },
      sector_distribution: {},
      active_products: products.filter(p => p.status === 'active').length,
      inactive_products: products.filter(p => p.status === 'inactive').length
    };

    // Calculate sector distribution
    products.forEach(p => {
      const sector = p.sector_code || 'Unknown';
      stats.sector_distribution[sector] = (stats.sector_distribution[sector] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get product statistics' });
  }
});

module.exports = router;