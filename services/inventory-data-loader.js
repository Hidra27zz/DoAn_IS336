// Inventory Data Loader - Load real inventory from Class_Based_Storage.csv
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class InventoryDataLoader {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'datasets');
    this.inventoryData = [];
    this.locationData = [];
    this.productData = [];
  }

  // Load real inventory data from Class_Based_Storage.csv
  async loadRealInventoryData() {
    console.log('Loading real inventory data from Class_Based_Storage.csv...');
    
    try {
      // Load storage locations first
      await this.loadStorageLocations();
      
      // Load products data
      await this.loadProducts();
      
      // Load inventory from Class_Based_Storage
      await this.loadClassBasedInventory();
      
      console.log(`✅ Loaded ${this.inventoryData.length} inventory records from real dataset`);
      return this.inventoryData;
      
    } catch (error) {
      console.error('Error loading real inventory data:', error);
      throw error;
    }
  }

  // Load storage locations from Storage_Location.csv
  async loadStorageLocations() {
    return new Promise((resolve, reject) => {
      const locations = [];
      
      fs.createReadStream(path.join(this.dataPath, 'Storage_Location.csv'))
        .pipe(csv())
        .on('data', (row) => {
          if (row.originalLocation && row.originalLocation !== 'originalLocation') {
            const zone = row.originalLocation.split('-')[0] || 'A';
            locations.push({
              location_code: row.originalLocation,
              x: parseInt(row.x) || 0,
              y: parseInt(row.y) || 0,
              z: parseInt(row.z) || 0,
              zone: zone,
              capacity: 100,
              current_occupancy: 0 // Will be calculated
            });
          }
        })
        .on('end', () => {
          this.locationData = locations;
          console.log(`📍 Loaded ${locations.length} storage locations`);
          resolve();
        })
        .on('error', reject);
    });
  }

  // Load products from Product.csv
  async loadProducts() {
    return new Promise((resolve, reject) => {
      const products = [];
      
      fs.createReadStream(path.join(this.dataPath, 'Product.csv'))
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.Reference && row.Reference !== 'Reference') {
            products.push({
              reference: row.Reference,
              abc_code: row.ABCCOD || 'C',
              sector: row.Sector || 'PF',
              description: `Footwear Product ${row.Reference}`,
              unit_price: Math.floor(Math.random() * 200) + 50
            });
          }
        })
        .on('end', () => {
          this.productData = products;
          console.log(`📦 Loaded ${products.length} products`);
          resolve();
        })
        .on('error', reject);
    });
  }

  // Load inventory from Class_Based_Storage.csv
  async loadClassBasedInventory() {
    return new Promise((resolve, reject) => {
      const inventory = [];
      let rowCount = 0;
      
      fs.createReadStream(path.join(this.dataPath, 'Class_Based_Storage.csv'))
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          rowCount++;
          
          // Get location using Object.entries approach (csv-parser has issues with direct property access)
          const entries = Object.entries(row);
          const locationEntry = entries.find(([key, value]) => key.trim() === 'Location');
          const locationCode = locationEntry ? locationEntry[1] : null;
          
          if (locationCode && locationCode !== 'Location') {
            const location = this.locationData.find(l => l.location_code === locationCode);
            
            if (location) {
              // Process columns 1 to 18 (numbered columns in CSV)
              for (let i = 1; i <= 18; i++) {
                const colName = i.toString();
                let cellValue = row[colName];
                
                if (cellValue && cellValue.includes(';')) {
                  const [productCode, quantityStr] = cellValue.split(';');
                  const quantity = parseFloat(quantityStr) || 0;
                  
                  if (quantity > 0 && productCode) {
                    const product = this.productData.find(p => p.reference === productCode.trim());
                    
                    if (product) {
                      inventory.push({
                        id: `inv_${locationCode}_${productCode.trim()}_${i}`,
                        product_reference: productCode.trim(),
                        location_code: locationCode,
                        quantity: Math.floor(quantity),
                        reserved_quantity: Math.floor(Math.random() * Math.min(3, quantity)), // Random reserved (0-2)
                        product: product,
                        location: location,
                        slot_position: i,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      });
                    }
                  }
                }
              }
            }
          }
        })
        .on('end', () => {
          this.inventoryData = inventory;
          console.log(`📊 Processed ${inventory.length} inventory items from Class_Based_Storage`);
          
          // Show some sample data
          if (inventory.length > 0) {
            console.log('Sample inventory items:');
            inventory.slice(0, 3).forEach(inv => {
              console.log(`  ${inv.product_reference} at ${inv.location_code}: ${inv.quantity} units (${inv.product.abc_code} class)`);
            });
          }
          
          resolve();
        })
        .on('error', reject);
    });
  }

  // Get inventory with filters
  getInventory(filters = {}) {
    let result = [...this.inventoryData];
    
    if (filters.zone) {
      result = result.filter(inv => inv.location.zone === filters.zone);
    }
    
    if (filters.abc_code) {
      result = result.filter(inv => inv.product.abc_code === filters.abc_code);
    }
    
    if (filters.level) {
      result = result.filter(inv => {
        const locationCode = inv.location_code || '';
        return locationCode.endsWith(`-${filters.level}`);
      });
    }
    
    if (filters.location) {
      result = result.filter(inv => inv.location_code === filters.location);
    }
    
    if (filters.low_stock === 'true') {
      result = result.filter(inv => (inv.quantity || 0) < 20);
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(inv => 
        inv.product_reference.toLowerCase().includes(searchTerm) ||
        inv.location_code.toLowerCase().includes(searchTerm)
      );
    }
    
    return result;
  }

  // Get inventory summary
  getInventorySummary() {
    const byZone = {};
    const byAbcCode = {};
    let totalQuantity = 0;
    let totalReserved = 0;
    
    this.inventoryData.forEach(inv => {
      const zone = inv.location.zone || 'Unknown';
      const abc = inv.product.abc_code || 'C';
      const quantity = inv.quantity || 0;
      const reserved = inv.reserved_quantity || 0;
      
      totalQuantity += quantity;
      totalReserved += reserved;
      
      if (!byZone[zone]) {
        byZone[zone] = { total_items: 0, total_quantity: 0 };
      }
      byZone[zone].total_items++;
      byZone[zone].total_quantity += quantity;
      
      if (!byAbcCode[abc]) {
        byAbcCode[abc] = { total_items: 0, total_quantity: 0 };
      }
      byAbcCode[abc].total_items++;
      byAbcCode[abc].total_quantity += quantity;
    });
    
    return {
      total_products: new Set(this.inventoryData.map(i => i.product_reference)).size,
      total_locations: new Set(this.inventoryData.map(i => i.location_code)).size,
      total_quantity: totalQuantity,
      total_reserved: totalReserved,
      by_zone: byZone,
      by_abc_code: byAbcCode
    };
  }

  // Get locations data
  getLocations() {
    return this.locationData;
  }

  // Get products data
  getProducts() {
    return this.productData;
  }
}

module.exports = InventoryDataLoader;