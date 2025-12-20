// Inventory Routes
const express = require('express');
const db = require('../database/firebase-connection');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all inventory
router.get('/', async (req, res) => {
  try {
    const { zone, abc_code, low_stock, page = 1, limit = 50 } = req.query;
    
    const inventory = await db.getAllInventory();
    const products = await db.getAllProducts();
    const locations = await db.getAllStorageLocations();
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    let result = inventory.map(inv => ({
      ...inv,
      product: productMap.get(inv.product_id),
      location: locationMap.get(inv.location_id)
    })).filter(inv => inv.product && inv.location);
    
    if (zone) {
      result = result.filter(inv => inv.location.zone === zone);
    }
    if (abc_code) {
      result = result.filter(inv => inv.product.abc_code === abc_code);
    }
    if (low_stock === 'true') {
      result = result.filter(inv => (inv.quantity || 0) < 20);
    }
    
    const startIndex = (page - 1) * limit;
    const paginatedResult = result.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({
      inventory: paginatedResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.length,
        pages: Math.ceil(result.length / limit)
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Get inventory summary
router.get('/summary', async (req, res) => {
  try {
    const inventory = await db.getAllInventory();
    const products = await db.getAllProducts();
    const locations = await db.getAllStorageLocations();
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    const enrichedInventory = inventory.map(inv => ({
      ...inv,
      product: productMap.get(inv.product_id),
      location: locationMap.get(inv.location_id)
    })).filter(inv => inv.product && inv.location);
    
    const byZone = {};
    const byAbcCode = {};
    
    enrichedInventory.forEach(inv => {
      const zone = inv.location.zone || 'Unknown';
      const abc = inv.product.abc_code || 'C';
      
      if (!byZone[zone]) {
        byZone[zone] = { total_items: 0, total_quantity: 0 };
      }
      byZone[zone].total_items++;
      byZone[zone].total_quantity += inv.quantity || 0;
      
      if (!byAbcCode[abc]) {
        byAbcCode[abc] = { total_items: 0, total_quantity: 0 };
      }
      byAbcCode[abc].total_items++;
      byAbcCode[abc].total_quantity += inv.quantity || 0;
    });
    
    res.json({
      total_products: new Set(inventory.map(i => i.product_id)).size,
      total_locations: new Set(inventory.map(i => i.location_id)).size,
      total_quantity: inventory.reduce((sum, i) => sum + (i.quantity || 0), 0),
      total_reserved: inventory.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0),
      by_zone: byZone,
      by_abc_code: byAbcCode
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({ error: 'Failed to get inventory summary' });
  }
});

// Get product inventory
router.get('/product/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    const product = await db.getProductByReference(reference);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const inventory = await db.getInventoryByProduct(product.id);
    const locations = await db.getAllStorageLocations();
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    const inventoryWithLocations = inventory.map(inv => ({
      ...inv,
      location: locationMap.get(inv.location_id)
    }));
    
    const totalQuantity = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const totalReserved = inventory.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0);
    
    res.json({
      product_reference: reference,
      total_quantity: totalQuantity,
      total_reserved: totalReserved,
      available_quantity: totalQuantity - totalReserved,
      locations: inventoryWithLocations
    });
  } catch (error) {
    console.error('Get product inventory error:', error);
    res.status(500).json({ error: 'Failed to get product inventory' });
  }
});

// Receive goods (add new inventory)
router.post('/receive', async (req, res) => {
  try {
    const { productId, locationId, quantity, receivedBy, notes } = req.body;
    
    if (!productId || !locationId || !quantity) {
      return res.status(400).json({ 
        error: 'Product ID, Location ID, and Quantity are required' 
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({ 
        error: 'Quantity must be positive' 
      });
    }
    
    // Check if product exists
    const product = await db.getProductByReference(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Check if location exists
    const location = await db.getStorageLocationByCode(locationId);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    // Create inventory record
    const inventoryData = {
      product_reference: productId,
      location_code: locationId,
      quantity: parseInt(quantity),
      received_by: receivedBy || 'system',
      received_at: new Date().toISOString(),
      notes: notes || '',
      status: 'available'
    };
    
    const inventoryId = await db.createInventory(inventoryData);
    
    // Log the transaction
    await db.createLog({
      level: 'info',
      module: 'inventory',
      message: `Received ${quantity} units of ${productId} at ${locationId}`,
      details: inventoryData,
      user_id: req.user ? req.user.id : null
    });
    
    res.status(201).json({
      success: true,
      message: 'Goods received successfully',
      inventory_id: inventoryId,
      data: inventoryData
    });
  } catch (error) {
    console.error('Receive goods error:', error);
    res.status(500).json({ error: 'Failed to receive goods' });
  }
});

// Adjust inventory by product and location
router.post('/adjust', async (req, res) => {
  try {
    const { productId, locationId, adjustment, reason, adjustedBy } = req.body;
    
    if (!productId || !locationId || typeof adjustment !== 'number') {
      return res.status(400).json({ 
        error: 'Product ID, Location ID, and adjustment amount are required' 
      });
    }
    
    // Find existing inventory
    const inventories = await db.getAllInventory();
    const inventory = inventories.find(inv => 
      inv.product_reference === productId && inv.location_code === locationId
    );
    
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    
    const newQuantity = inventory.quantity + adjustment;
    if (newQuantity < 0) {
      return res.status(400).json({ 
        error: 'Adjustment would result in negative inventory' 
      });
    }
    
    // Update inventory
    await db.updateInventory(inventory.id, {
      quantity: newQuantity,
      last_adjusted_at: new Date().toISOString(),
      last_adjusted_by: adjustedBy || 'system'
    });
    
    // Log the adjustment
    await db.createLog({
      level: 'info',
      module: 'inventory',
      message: `Adjusted ${productId} at ${locationId} by ${adjustment}`,
      details: { 
        old_quantity: inventory.quantity, 
        new_quantity: newQuantity, 
        adjustment, 
        reason 
      },
      user_id: req.user ? req.user.id : null
    });
    
    res.json({
      success: true,
      message: 'Inventory adjusted successfully',
      old_quantity: inventory.quantity,
      new_quantity: newQuantity,
      adjustment: adjustment
    });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});

// Adjust inventory by ID
router.put('/:id/adjust', requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason } = req.body;
    
    if (typeof quantity !== 'number') {
      return res.status(400).json({ error: 'Quantity must be a number' });
    }
    
    const inventory = await db.getInventoryById(id);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    const oldQuantity = inventory.quantity || 0;
    const newQuantity = Math.max(0, quantity);
    
    await db.updateInventory(id, { quantity: newQuantity });
    
    await db.createMovement({
      movement_type: 'adjustment',
      product_id: inventory.product_id,
      location_id: inventory.location_id,
      quantity: newQuantity - oldQuantity,
      reference_type: 'adjustment',
      operator_id: req.user.id,
      notes: reason || 'Stock adjustment'
    });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('inventory-updated', { id, old_quantity: oldQuantity, new_quantity: newQuantity });
    }
    
    res.json({
      message: 'Inventory adjusted successfully',
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      difference: newQuantity - oldQuantity
    });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});

// Reserve inventory
router.post('/:id/reserve', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    
    const inventory = await db.getInventoryById(id);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    const available = (inventory.quantity || 0) - (inventory.reserved_quantity || 0);
    if (quantity > available) {
      return res.status(400).json({ error: 'Insufficient available quantity', available, requested: quantity });
    }
    
    const newReserved = (inventory.reserved_quantity || 0) + quantity;
    await db.updateInventory(id, { reserved_quantity: newReserved });
    
    res.json({
      message: 'Inventory reserved successfully',
      reserved_quantity: quantity,
      new_reserved_total: newReserved
    });
  } catch (error) {
    console.error('Reserve inventory error:', error);
    res.status(500).json({ error: 'Failed to reserve inventory' });
  }
});

// Release reserved inventory
router.post('/:id/release', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    
    const inventory = await db.getInventoryById(id);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    const reserved = inventory.reserved_quantity || 0;
    if (quantity > reserved) {
      return res.status(400).json({ error: 'Cannot release more than reserved', reserved, requested: quantity });
    }
    
    const newReserved = reserved - quantity;
    await db.updateInventory(id, { reserved_quantity: newReserved });
    
    res.json({
      message: 'Reserved inventory released successfully',
      released_quantity: quantity,
      new_reserved_total: newReserved
    });
  } catch (error) {
    console.error('Release inventory error:', error);
    res.status(500).json({ error: 'Failed to release inventory' });
  }
});

// Get low stock alerts
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 20;
    
    const inventory = await db.getAllInventory();
    const products = await db.getAllProducts();
    const locations = await db.getAllStorageLocations();
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    const lowStockItems = inventory
      .filter(inv => (inv.quantity || 0) < threshold)
      .map(inv => ({
        id: inv.id,
        quantity: inv.quantity,
        reserved_quantity: inv.reserved_quantity,
        product: productMap.get(inv.product_id),
        location: locationMap.get(inv.location_id)
      }))
      .filter(inv => inv.product && inv.location)
      .sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
    
    res.json({
      threshold,
      count: lowStockItems.length,
      items: lowStockItems
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({ error: 'Failed to get low stock alerts' });
  }
});

// Export inventory to CSV
router.get('/export', async (req, res) => {
  try {
    const { zone, abc_code, low_stock } = req.query;
    
    const inventory = await db.getAllInventory();
    const products = await db.getAllProducts();
    const locations = await db.getAllStorageLocations();
    
    const productMap = new Map(products.map(p => [p.id, p]));
    const locationMap = new Map(locations.map(l => [l.id, l]));
    
    let result = inventory.map(inv => ({
      ...inv,
      product: productMap.get(inv.product_id),
      location: locationMap.get(inv.location_id)
    })).filter(inv => inv.product && inv.location);
    
    // Apply filters
    if (zone) {
      result = result.filter(inv => inv.location.zone === zone);
    }
    if (abc_code) {
      result = result.filter(inv => inv.product.abc_code === abc_code);
    }
    if (low_stock === 'true') {
      result = result.filter(inv => (inv.quantity || 0) < 20);
    }
    
    // Generate CSV
    const csvHeader = 'Product Reference,ABC Code,Location,Zone,Quantity,Reserved,Available\n';
    const csvRows = result.map(inv => {
      const available = (inv.quantity || 0) - (inv.reserved_quantity || 0);
      return [
        inv.product.reference,
        inv.product.abc_code || 'C',
        inv.location.location_id,
        inv.location.zone || '',
        inv.quantity || 0,
        inv.reserved_quantity || 0,
        available
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export inventory error:', error);
    res.status(500).json({ error: 'Failed to export inventory' });
  }
});

module.exports = router;
