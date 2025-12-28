// Warehouse Routes - SQL Database
const express = require('express');
const { getDatabase } = require('../config/database');
const { requireRole } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load complete warehouse layout from CSV file
let completeWarehouseLayout = null;
let storageDataCache = null;

function loadStorageData() {
  if (storageDataCache) return storageDataCache;
  
  try {
    const csvPath = path.join(__dirname, '../datasets/Class_Based_Storage.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    
    storageDataCache = new Map();
    
    lines.forEach(line => {
      if (line.trim()) {
        const parts = line.split(';');
        const location = parts[0];
        const abcCode = parts[1];
        
        // Parse products from columns 2-19 (1-18 in the data)
        const products = [];
        for (let i = 2; i < parts.length && i < 20; i++) {
          if (parts[i] && parts[i].trim() && parts[i] !== '""') {
            const productData = parts[i].replace(/"/g, '').trim();
            if (productData.includes(';')) {
              const [productCode, quantity] = productData.split(';');
              if (productCode && quantity) {
                products.push({
                  code: productCode,
                  quantity: parseFloat(quantity) || 0
                });
              }
            }
          }
        }
        
        storageDataCache.set(location, {
          abc_code: abcCode ? abcCode.replace(/"/g, '') : 'EMPTY',
          products: products
        });
      }
    });
    
    console.log(`Loaded storage data for ${storageDataCache.size} locations from Class_Based_Storage.csv`);
    return storageDataCache;
  } catch (error) {
    console.error('Error loading storage data from CSV:', error);
    return new Map();
  }
}

function getUtilizationLevel(products) {
  if (!products || products.length === 0) return 'empty';
  
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  if (totalQuantity === 0) return 'empty';
  if (totalQuantity <= 50) return 'low';
  if (totalQuantity <= 150) return 'medium';
  if (totalQuantity <= 250) return 'high';
  return 'full';
}

function loadCompleteWarehouseLayout() {
  if (completeWarehouseLayout) return completeWarehouseLayout;
  
  try {
    const csvPath = path.join(__dirname, '../datasets/Storage_Location.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    
    completeWarehouseLayout = [];
    
    lines.forEach((line, index) => {
      if (line.trim()) {
        const [originalLocation, position, x, y, z] = line.split(',');
        
        if (originalLocation && x && y && z) {
          // Parse zone from location code (e.g., A-14-11 -> A)
          const zone = originalLocation.split('-')[0];
          
          // Parse aisle and level from location code
          const parts = originalLocation.split('-');
          const aisle = parts[1] || '1';
          const level = parts[2] ? parts[2].substring(0, 1) : '1';
          
          completeWarehouseLayout.push({
            id: `location_${index + 1}`,
            location_code: originalLocation.replace(/"/g, ''),
            x: parseInt(x.trim()),
            y: parseInt(y.trim()),
            z: parseInt(z.trim()),
            zone: zone.replace(/"/g, ''),
            zone_name: `Zone ${zone.replace(/"/g, '')}`,
            aisle: aisle,
            level: level,
            capacity: 100, // Default capacity
            current_occupancy: Math.floor(Math.random() * 80), // Random occupancy for demo
            status: 'active'
          });
        }
      }
    });
    
    console.log(`Loaded ${completeWarehouseLayout.length} locations from CSV layout file`);
    return completeWarehouseLayout;
  } catch (error) {
    console.error('Error loading warehouse layout from CSV:', error);
    return [];
  }
}

// Get warehouse layout
router.get('/layout', async (req, res) => {
  try {
    const { zone } = req.query;
    const db = await getDatabase();
    
    // Get all storage locations from SQL database
    let query = 'SELECT * FROM storage_locations';
    let params = [];
    
    if (zone) {
      query += ' WHERE zone = ?';
      params.push(zone);
    }
    
    const locations = await db.all(query, params);
    
    // Get inventory data
    const inventory = await db.all('SELECT * FROM inventory');
    const products = await db.all('SELECT * FROM products');
    
    const locationInventory = new Map();
    const productMap = new Map(products.map(p => [p.reference, p]));
    
    inventory.forEach(inv => {
      if (!locationInventory.has(inv.location_code)) {
        locationInventory.set(inv.location_code, { 
          products: 0, 
          quantity: 0, 
          reserved: 0,
          product_details: []
        });
      }
      
      const data = locationInventory.get(inv.location_code);
      data.products++;
      data.quantity += inv.quantity || 0;
      data.reserved += inv.reserved_quantity || 0;
      
      // Add product details
      const product = productMap.get(inv.product_reference);
      if (product) {
        data.product_details.push({
          reference: product.reference,
          abc_code: product.abc_code,
          quantity: inv.quantity || 0,
          reserved: inv.reserved_quantity || 0
        });
      }
    });
    
    const locationsWithInventory = locations.map(loc => {
      const invData = locationInventory.get(loc.location_code);
      return {
        ...loc,
        products_stored: invData?.products || 0,
        total_quantity: invData?.quantity || 0,
        total_reserved: invData?.reserved || 0,
        available_quantity: (invData?.quantity || 0) - (invData?.reserved || 0),
        utilization_rate: loc.capacity > 0 ? ((invData?.quantity || 0) / loc.capacity) * 100 : 0,
        product_details: invData?.product_details || []
      };
    });
    
    const zones = [...new Set(locations.map(l => l.zone))].filter(Boolean).sort();
    const zoneSummary = zones.map(z => {
      const zoneLocations = locationsWithInventory.filter(l => l.zone === z);
      return {
        zone: z,
        total_locations: zoneLocations.length,
        total_capacity: zoneLocations.reduce((sum, l) => sum + (l.capacity || 0), 0),
        total_occupancy: zoneLocations.reduce((sum, l) => sum + (l.current_occupancy || 0), 0),
        avg_utilization: zoneLocations.length > 0
          ? zoneLocations.reduce((sum, l) => sum + l.utilization_rate, 0) / zoneLocations.length
          : 0
      };
    });
    
    res.json({
      locations: locationsWithInventory,
      zone_summary: zoneSummary,
      total_locations: locations.length
    });
  } catch (error) {
    console.error('Get warehouse layout error:', error);
    res.status(500).json({ error: 'Failed to get warehouse layout' });
  }
});

// Get warehouse utilization report
router.get('/utilization', async (req, res) => {
  try {
    const db = await getDatabase();
    
    const locations = await db.all('SELECT * FROM storage_locations');
    const inventory = await db.all('SELECT * FROM inventory');
    
    const locationInventory = new Map();
    inventory.forEach(inv => {
      if (!locationInventory.has(inv.location_code)) {
        locationInventory.set(inv.location_code, 0);
      }
      locationInventory.set(inv.location_code, 
        locationInventory.get(inv.location_code) + (inv.quantity || 0));
    });
    
    const utilizationData = locations.map(loc => {
      const quantity = locationInventory.get(loc.location_code) || 0;
      const utilization = loc.capacity > 0 ? (quantity / loc.capacity) * 100 : 0;
      
      return {
        location_code: loc.location_code,
        zone: loc.zone,
        capacity: loc.capacity || 0,
        current_quantity: quantity,
        utilization_percentage: utilization,
        status: getUtilizationStatus(utilization)
      };
    });
    
    const zones = [...new Set(locations.map(l => l.zone))].filter(Boolean);
    const zoneUtilization = zones.map(zone => {
      const zoneLocations = utilizationData.filter(l => l.zone === zone);
      const totalCapacity = zoneLocations.reduce((sum, l) => sum + l.capacity, 0);
      const totalQuantity = zoneLocations.reduce((sum, l) => sum + l.current_quantity, 0);
      
      return {
        zone,
        total_capacity: totalCapacity,
        total_quantity: totalQuantity,
        utilization_percentage: totalCapacity > 0 ? (totalQuantity / totalCapacity) * 100 : 0,
        locations_count: zoneLocations.length
      };
    });
    
    const overall = {
      total_capacity: utilizationData.reduce((sum, l) => sum + l.capacity, 0),
      total_occupancy: utilizationData.reduce((sum, l) => sum + l.current_quantity, 0),
      utilization_percentage: 0
    };
    overall.utilization_percentage = overall.total_capacity > 0 ? 
      (overall.total_occupancy / overall.total_capacity) * 100 : 0;
    
    res.json({
      overall,
      by_zone: zoneUtilization,
      locations: utilizationData,
      summary: {
        empty_locations: utilizationData.filter(l => l.status === 'empty').length,
        low_utilization: utilizationData.filter(l => l.status === 'low').length,
        medium_utilization: utilizationData.filter(l => l.status === 'medium').length,
        high_utilization: utilizationData.filter(l => l.status === 'high').length,
        full_locations: utilizationData.filter(l => l.status === 'full').length
      }
    });
  } catch (error) {
    console.error('Get utilization error:', error);
    res.status(500).json({ error: 'Failed to get utilization data' });
  }
});

function getUtilizationStatus(percentage) {
  if (percentage === 0) return 'empty';
  if (percentage <= 25) return 'low';
  if (percentage <= 75) return 'medium';
  if (percentage < 100) return 'high';
  return 'full';
}

// Get warehouse locations with filtering
router.get('/locations', async (req, res) => {
  try {
    const { zone, status, limit = 100, include_coordinates } = req.query;
    const db = await getDatabase();
    
    let query = 'SELECT * FROM storage_locations';
    let params = [];
    let conditions = [];
    
    if (zone) {
      conditions.push('zone = ?');
      params.push(zone);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' LIMIT ?';
    params.push(parseInt(limit));
    
    const locations = await db.all(query, params);
    
    // Get inventory data for each location
    const inventory = await db.all('SELECT * FROM inventory');
    const locationInventory = new Map();
    
    inventory.forEach(inv => {
      if (!locationInventory.has(inv.location_code)) {
        locationInventory.set(inv.location_code, {
          quantity: 0,
          products: []
        });
      }
      
      const data = locationInventory.get(inv.location_code);
      data.quantity += inv.quantity || 0;
      data.products.push({
        reference: inv.product_reference,
        quantity: inv.quantity || 0
      });
    });
    
    const locationsWithData = locations.map(loc => {
      const invData = locationInventory.get(loc.location_code) || { quantity: 0, products: [] };
      const utilization = loc.capacity > 0 ? (invData.quantity / loc.capacity) * 100 : 0;
      
      let locationData = {
        id: loc.id,
        location_code: loc.location_code,
        zone: loc.zone,
        capacity: loc.capacity || 0,
        current_occupancy: invData.quantity,
        utilization_percentage: utilization,
        status: getUtilizationStatus(utilization),
        inventory_count: invData.products.length,
        product_reference: invData.products.length > 0 ? invData.products[0].reference : null
      };
      
      // Add coordinates if requested (from CSV data)
      if (include_coordinates) {
        const layout = loadCompleteWarehouseLayout();
        const layoutData = layout.find(l => l.location_code === loc.location_code);
        if (layoutData) {
          locationData.x = layoutData.x;
          locationData.y = layoutData.y;
          locationData.z = layoutData.z;
          locationData.aisle = layoutData.aisle;
          locationData.level = layoutData.level;
        }
      }
      
      return locationData;
    });
    
    res.json({
      locations: locationsWithData,
      total_count: locationsWithData.length
    });
  } catch (error) {
    console.error('Get warehouse locations error:', error);
    res.status(500).json({ error: 'Failed to get warehouse locations' });
  }
});

// Get warehouse movements
router.get('/movements', async (req, res) => {
  try {
    const { date, limit = 50 } = req.query;
    const db = await getDatabase();
    
    let query = `
      SELECT 
        m.*,
        p.reference as product_reference,
        sl_from.location_code as from_location_code,
        sl_to.location_code as to_location_code
      FROM movements m
      LEFT JOIN products p ON m.product_reference = p.reference
      LEFT JOIN storage_locations sl_from ON m.from_location_code = sl_from.location_code
      LEFT JOIN storage_locations sl_to ON m.to_location_code = sl_to.location_code
    `;
    
    let params = [];
    
    if (date === 'today') {
      query += ' WHERE DATE(m.created_at) = DATE("now")';
    }
    
    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const movements = await db.all(query, params);
    
    res.json({
      movements,
      total_movements: movements.length
    });
  } catch (error) {
    console.error('Get warehouse movements error:', error);
    res.status(500).json({ error: 'Failed to get warehouse movements' });
  }
});

// Create warehouse movement
router.post('/movements', requireRole(['manager', 'admin']), async (req, res) => {
  try {
    const { 
      movement_type, 
      product_reference, 
      from_location_code, 
      to_location_code, 
      quantity, 
      notes 
    } = req.body;
    
    if (!movement_type || !product_reference || !quantity) {
      return res.status(400).json({ 
        error: 'Movement type, product reference, and quantity are required' 
      });
    }
    
    const validTypes = ['inbound', 'outbound', 'transfer', 'adjustment'];
    if (!validTypes.includes(movement_type)) {
      return res.status(400).json({ 
        error: 'Invalid movement type', 
        valid_types: validTypes 
      });
    }
    
    const db = await getDatabase();
    
    // Verify product exists
    const product = await db.get('SELECT * FROM products WHERE reference = ?', [product_reference]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Verify locations exist if provided
    if (from_location_code) {
      const fromLocation = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [from_location_code]);
      if (!fromLocation) {
        return res.status(404).json({ error: 'From location not found' });
      }
    }
    
    if (to_location_code) {
      const toLocation = await db.get('SELECT * FROM storage_locations WHERE location_code = ?', [to_location_code]);
      if (!toLocation) {
        return res.status(404).json({ error: 'To location not found' });
      }
    }
    
    // Create movement record
    const result = await db.run(`
      INSERT INTO movements (
        movement_type, 
        product_reference, 
        from_location_code, 
        to_location_code, 
        quantity, 
        operator_id, 
        notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      movement_type,
      product_reference,
      from_location_code,
      to_location_code,
      parseInt(quantity),
      req.user?.id || 'system',
      notes
    ]);
    
    // Update inventory based on movement type
    if (movement_type === 'inbound' && to_location_code) {
      // Add to inventory
      await db.run(`
        INSERT OR REPLACE INTO inventory (
          product_reference, 
          location_code, 
          quantity, 
          reserved_quantity,
          updated_at
        ) VALUES (
          ?, 
          ?, 
          COALESCE((SELECT quantity FROM inventory WHERE product_reference = ? AND location_code = ?), 0) + ?,
          COALESCE((SELECT reserved_quantity FROM inventory WHERE product_reference = ? AND location_code = ?), 0),
          datetime('now')
        )
      `, [
        product_reference, to_location_code, 
        product_reference, to_location_code, parseInt(quantity),
        product_reference, to_location_code
      ]);
    } else if (movement_type === 'outbound' && from_location_code) {
      // Remove from inventory
      await db.run(`
        UPDATE inventory 
        SET quantity = MAX(0, quantity - ?), updated_at = datetime('now')
        WHERE product_reference = ? AND location_code = ?
      `, [parseInt(quantity), product_reference, from_location_code]);
    }
    
    // Emit real-time update if socket.io is available
    const io = req.app.get('io');
    if (io) {
      io.emit('warehouse-movement', { 
        movement_type, 
        product_reference, 
        quantity,
        from_location_code,
        to_location_code
      });
    }
    
    res.json({
      message: 'Movement created successfully',
      movement_id: result.lastID,
      product_reference,
      quantity
    });
  } catch (error) {
    console.error('Create movement error:', error);
    res.status(500).json({ error: 'Failed to create movement' });
  }
});

// Get 2D layout data for warehouse visualization
router.get('/2d-layout', async (req, res) => {
  try {
    // Load complete warehouse layout from CSV
    const completeLayout = loadCompleteWarehouseLayout();
    
    if (!completeLayout || completeLayout.length === 0) {
      return res.status(500).json({ 
        error: 'Failed to load warehouse layout from CSV file',
        csv_path: 'datasets/Storage_Location.csv'
      });
    }
    
    // Load storage data from Class_Based_Storage.csv
    const storageData = loadStorageData();
    
    // Map layout with actual storage data
    const layoutWithStorage = completeLayout.map(location => {
      const storageInfo = storageData.get(location.location_code) || {};
      
      return {
        location_code: location.location_code,
        x: location.x,
        y: location.y,
        z: location.z,
        zone: location.zone,
        aisle: location.aisle,
        level: location.level,
        abc_code: storageInfo.abc_code || 'EMPTY',
        products: storageInfo.products || [],
        total_products: storageInfo.products ? storageInfo.products.length : 0,
        is_occupied: storageInfo.products && storageInfo.products.length > 0,
        utilization_level: getUtilizationLevel(storageInfo.products)
      };
    });
    
    // Group by zones for better organization
    const zoneData = {};
    layoutWithStorage.forEach(loc => {
      if (!zoneData[loc.zone]) {
        zoneData[loc.zone] = [];
      }
      zoneData[loc.zone].push(loc);
    });
    
    // Calculate zone statistics
    const zoneStats = Object.keys(zoneData).map(zone => {
      const locations = zoneData[zone];
      const occupied = locations.filter(l => l.is_occupied).length;
      
      return {
        zone,
        total_locations: locations.length,
        occupied_locations: occupied,
        empty_locations: locations.length - occupied,
        occupancy_rate: (occupied / locations.length * 100).toFixed(1)
      };
    });
    
    res.json({
      success: true,
      layout: layoutWithStorage,
      zones: zoneData,
      zone_statistics: zoneStats,
      metadata: {
        total_locations: completeLayout.length,
        occupied_locations: layoutWithStorage.filter(l => l.is_occupied).length,
        empty_locations: layoutWithStorage.filter(l => !l.is_occupied).length,
        zones_count: Object.keys(zoneData).length,
        data_source: 'CSV files (Storage_Location.csv + Class_Based_Storage.csv)'
      }
    });
  } catch (error) {
    console.error('Get 2D layout error:', error);
    res.status(500).json({ error: 'Failed to get 2D layout data' });
  }
});

// Parse CSV line handling quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Load and parse storage map data from CSV files
function loadStorageMapData() {
  try {
    // Load Storage_Location.csv for coordinates
    const locationCsvPath = path.join(__dirname, '../datasets/Storage_Location.csv');
    const locationContent = fs.readFileSync(locationCsvPath, 'utf8');
    const locationLines = locationContent.split('\n').slice(1); // Skip header
    
    // Load Class_Based_Storage.csv for product data
    const storageCsvPath = path.join(__dirname, '../datasets/Class_Based_Storage.csv');
    const storageContent = fs.readFileSync(storageCsvPath, 'utf8');
    const storageLines = storageContent.split('\n').slice(1); // Skip header
    
    // Parse storage data into map (Location -> products)
    const storageMap = new Map();
    storageLines.forEach(line => {
      if (!line.trim()) return;
      
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ';' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim());
      
      const location = parts[0]?.trim();
      const abcCode = parts[1]?.trim() || 'EMPTY';
      
      if (!location) return;
      
      // Parse products from columns 2+
      const products = [];
      for (let i = 2; i < parts.length; i++) {
        const productData = parts[i]?.trim();
        if (productData && productData.includes(';')) {
          const [code, qty] = productData.split(';');
          if (code && qty) {
            products.push({
              code: code.trim(),
              quantity: parseFloat(qty) || 0
            });
          }
        }
      }
      
      storageMap.set(location, {
        abcCode,
        products,
        totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
        productCount: products.length
      });
    });
    
    console.log(`Loaded ${storageMap.size} storage locations from Class_Based_Storage.csv`);
    
    // Parse location coordinates
    const locations = [];
    locationLines.forEach(line => {
      if (!line.trim()) return;
      
      const parts = parseCSVLine(line);
      const locationCode = parts[0]?.trim();
      const x = parseInt(parts[2]) || 0;
      const y = parseInt(parts[3]) || 0;
      const z = parseInt(parts[4]) || 1;
      
      if (!locationCode) return;
      
      // Parse zone, aisle, level from location code
      const locParts = locationCode.split('-');
      const zone = locParts[0] || '';
      const aisle = locParts[1] || '';
      const level = locParts[2] || '';
      
      // Get storage data for this location
      const storageInfo = storageMap.get(locationCode) || {
        abcCode: 'EMPTY',
        products: [],
        totalQuantity: 0,
        productCount: 0
      };
      
      locations.push({
        locationCode,
        zone,
        aisle,
        level,
        x,
        y,
        z,
        abcCode: storageInfo.abcCode,
        products: storageInfo.products,
        totalQuantity: storageInfo.totalQuantity,
        productCount: storageInfo.productCount
      });
    });
    
    console.log(`Loaded ${locations.length} locations from Storage_Location.csv`);
    return locations;
  } catch (error) {
    console.error('Error loading storage map data:', error);
    return [];
  }
}

// GET /api/warehouse/storage-map - Get 2D storage map data
router.get('/storage-map', async (req, res) => {
  try {
    const locations = loadStorageMapData();
    
    if (locations.length === 0) {
      return res.status(500).json({
        error: 'Không thể tải dữ liệu storage map',
        message: 'Failed to load storage map data from CSV files'
      });
    }
    
    // Group locations by zone
    const zoneMap = new Map();
    locations.forEach(loc => {
      if (!zoneMap.has(loc.zone)) {
        zoneMap.set(loc.zone, []);
      }
      zoneMap.get(loc.zone).push(loc);
    });
    
    // Build zone summary
    const zones = Array.from(zoneMap.entries()).map(([zone, locs]) => ({
      zone,
      locationCount: locs.length,
      occupiedCount: locs.filter(l => l.totalQuantity > 0).length,
      totalQuantity: locs.reduce((sum, l) => sum + l.totalQuantity, 0),
      floors: [...new Set(locs.map(l => l.z))].sort((a, b) => a - b)
    })).sort((a, b) => a.zone.localeCompare(b.zone));
    
    // Calculate overall statistics
    const totalLocations = locations.length;
    const occupiedLocations = locations.filter(l => l.totalQuantity > 0).length;
    const totalProducts = locations.reduce((sum, l) => sum + l.productCount, 0);
    const totalQuantity = locations.reduce((sum, l) => sum + l.totalQuantity, 0);
    
    res.json({
      locations,
      zones,
      totalLocations,
      occupiedLocations,
      emptyLocations: totalLocations - occupiedLocations,
      totalProducts,
      totalQuantity,
      floors: [...new Set(locations.map(l => l.z))].sort((a, b) => a - b),
      metadata: {
        dataSource: 'Storage_Location.csv + Class_Based_Storage.csv',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Storage map error:', error);
    res.status(500).json({
      error: 'Lỗi khi tải dữ liệu storage map',
      details: error.message
    });
  }
});

module.exports = router;