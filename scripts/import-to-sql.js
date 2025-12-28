// Import all data to SQL database - Much faster than Firebase
const InventoryDataLoader = require('../services/inventory-data-loader');
const { getDatabase } = require('../config/database');

class SQLImporter {
  constructor() {
    this.loader = new InventoryDataLoader();
    this.db = null;
  }

  async importAllData() {
    console.log('🚀 Starting data import to SQL database...\n');
    console.log('📊 This should be much faster than Firebase!\n');
    
    try {
      // Initialize database
      console.log('1. Initializing SQL database...');
      this.db = await getDatabase();
      
      // Load real data from CSV
      console.log('\n2. Loading real data from CSV files...');
      await this.loader.loadRealInventoryData();
      
      // Clear existing data
      console.log('\n3. Clearing existing data...');
      await this.clearExistingData();
      
      // Import products
      console.log('\n4. Importing products...');
      await this.importProducts();
      
      // Import storage locations
      console.log('\n5. Importing storage locations...');
      await this.importStorageLocations();
      
      // Import inventory
      console.log('\n6. Importing inventory...');
      await this.importInventory();
      
      // Create sample users
      console.log('\n7. Creating sample users...');
      await this.createSampleUsers();
      
      console.log('\n✅ SQL database import completed successfully!');
      
    } catch (error) {
      console.error('❌ SQL import failed:', error);
      throw error;
    }
  }

  async clearExistingData() {
    try {
      const tables = ['inventory', 'order_items', 'orders', 'products', 'storage_locations', 'users', 'system_logs'];
      
      for (const table of tables) {
        await this.db.run(`DELETE FROM ${table}`);
        console.log(`   Cleared ${table} table`);
      }
      
      console.log('   ✅ All existing data cleared');
    } catch (error) {
      console.error('   Error clearing data:', error);
    }
  }

  async importProducts() {
    try {
      const products = this.loader.getProducts();
      console.log(`   Importing ${products.length} products...`);
      
      const productData = products.map(product => ({
        reference: product.reference,
        abc_code: product.abc_code,
        sector: product.sector,
        description: product.description,
        unit_price: product.unit_price
      }));
      
      await this.db.bulkInsert('products', productData);
      console.log(`   ✅ Successfully imported ${products.length} products`);
      
    } catch (error) {
      console.error('   ❌ Product import failed:', error);
      throw error;
    }
  }

  async importStorageLocations() {
    try {
      const locations = this.loader.getLocations();
      console.log(`   Importing ${locations.length} storage locations...`);
      
      const locationData = locations.map(location => ({
        location_code: location.location_code,
        x: location.x,
        y: location.y,
        z: location.z,
        zone: location.zone,
        capacity: location.capacity,
        current_occupancy: location.current_occupancy,
        status: 'active'
      }));
      
      await this.db.bulkInsert('storage_locations', locationData);
      console.log(`   ✅ Successfully imported ${locations.length} storage locations`);
      
    } catch (error) {
      console.error('   ❌ Storage location import failed:', error);
      throw error;
    }
  }

  async importInventory() {
    try {
      const inventory = this.loader.getInventory();
      console.log(`   Importing ${inventory.length} inventory records...`);
      
      // Prepare inventory data using direct references instead of IDs
      const inventoryData = inventory.map(inv => ({
        product_reference: inv.product_reference,
        location_code: inv.location_code,
        quantity: inv.quantity,
        reserved_quantity: inv.reserved_quantity,
        slot_position: inv.slot_position
      }));
      
      // Bulk insert inventory - this should be very fast with SQL
      await this.db.bulkInsert('inventory', inventoryData, 5000); // Larger batch size for SQL
      
      console.log(`   ✅ Successfully imported ${inventoryData.length} inventory records`);
      
    } catch (error) {
      console.error('   ❌ Inventory import failed:', error);
      throw error;
    }
  }

  async createSampleUsers() {
    try {
      const users = [
        {
          username: 'admin',
          email: 'admin@warehouse.com',
          password_hash: 'hashed_password_admin',
          role: 'admin'
        },
        {
          username: 'manager',
          email: 'manager@warehouse.com',
          password_hash: 'hashed_password_manager',
          role: 'manager'
        },
        {
          username: 'operator1',
          email: 'operator1@warehouse.com',
          password_hash: 'hashed_password_operator1',
          role: 'operator'
        },
        {
          username: 'operator2',
          email: 'operator2@warehouse.com',
          password_hash: 'hashed_password_operator2',
          role: 'operator'
        }
      ];
      
      await this.db.bulkInsert('users', users);
      console.log(`   ✅ Created ${users.length} sample users`);
      
    } catch (error) {
      console.error('   ❌ User creation failed:', error);
    }
  }

  async verifyImport() {
    try {
      console.log('\n8. Verifying import...');
      
      const productCount = await this.db.count('products');
      const locationCount = await this.db.count('storage_locations');
      const inventoryCount = await this.db.count('inventory');
      const userCount = await this.db.count('users');
      
      console.log(`   Products in database: ${productCount}`);
      console.log(`   Locations in database: ${locationCount}`);
      console.log(`   Inventory in database: ${inventoryCount}`);
      console.log(`   Users in database: ${userCount}`);
      
      // Show sample data
      console.log('\n   Sample inventory records:');
      const sampleInventory = await this.db.all(`
        SELECT 
          i.product_reference,
          i.location_code,
          i.quantity,
          i.reserved_quantity
        FROM inventory i
        LIMIT 5
      `);
      
      sampleInventory.forEach(inv => {
        console.log(`     ${inv.product_reference} at ${inv.location_code}: ${inv.quantity} units (${inv.reserved_quantity} reserved)`);
      });
      
      // Show inventory by zone
      console.log('\n   Inventory by zone:');
      const inventoryByZone = await this.db.all(`
        SELECT 
          sl.zone,
          COUNT(*) as item_count,
          SUM(i.quantity) as total_quantity
        FROM inventory i
        JOIN storage_locations sl ON i.location_code = sl.location_code
        GROUP BY sl.zone
        ORDER BY sl.zone
      `);
      
      inventoryByZone.forEach(zone => {
        console.log(`     Zone ${zone.zone}: ${zone.item_count} items, ${zone.total_quantity} units`);
      });
      
      // Show inventory by ABC code
      console.log('\n   Inventory by ABC code:');
      const inventoryByABC = await this.db.all(`
        SELECT 
          p.abc_code,
          COUNT(*) as item_count,
          SUM(i.quantity) as total_quantity
        FROM inventory i
        JOIN products p ON i.product_reference = p.reference
        GROUP BY p.abc_code
        ORDER BY p.abc_code
      `);
      
      inventoryByABC.forEach(abc => {
        console.log(`     ABC ${abc.abc_code}: ${abc.item_count} items, ${abc.total_quantity} units`);
      });
      
      console.log('\n   ✅ Import verification completed');
      
    } catch (error) {
      console.log(`   Verification failed: ${error.message}`);
    }
  }
}

// Run import if called directly
if (require.main === module) {
  const importer = new SQLImporter();
  
  console.log('🚀 This will import all data to SQL database.');
  console.log('🚀 Should be much faster than Firebase!');
  console.log('🚀 Press Ctrl+C within 3 seconds to cancel...\n');
  
  setTimeout(async () => {
    try {
      const startTime = Date.now();
      
      await importer.importAllData();
      await importer.verifyImport();
      
      const totalTime = (Date.now() - startTime) / 1000;
      
      console.log('\n🎉 SQL database import completed successfully!');
      console.log(`⚡ Total time: ${totalTime.toFixed(1)} seconds`);
      console.log('Database file: warehouse.db');
      process.exit(0);
      
    } catch (error) {
      console.error('\n💥 SQL import failed:', error);
      process.exit(1);
    }
  }, 3000);
}

module.exports = SQLImporter;