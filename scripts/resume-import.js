// Resume import from where it left off
const InventoryDataLoader = require('../services/inventory-data-loader');
const admin = require('firebase-admin');

class ResumeImporter {
  constructor() {
    this.loader = new InventoryDataLoader();
    this.batchSize = 5; // Very small batch size to avoid quota
    this.delayBetweenBatches = 2000; // 2 second delay
    this.delayBetweenItems = 300; // 300ms delay between individual items
    this.maxRetries = 5;
    this.db = null;
    this.quotaHitCount = 0;
  }

  async initializeFirebase() {
    console.log('🔧 Initializing Firebase connection...');
    
    try {
      if (admin.apps.length > 0) {
        admin.apps.forEach(app => app.delete());
      }
      
      const serviceAccount = require('../erp-project-63a44-firebase-adminsdk-fbsvc-2dad2a0f95.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'erp-project-63a44'
      });
      
      this.db = admin.firestore();
      console.log('   ✅ Firebase initialized successfully');
      
    } catch (error) {
      console.error('   ❌ Firebase initialization failed:', error.message);
      throw error;
    }
  }

  async resumeImport() {
    console.log('🔄 Resuming data import to Firebase...\n');
    console.log('📊 This will check existing data and continue from where it left off.\n');
    
    try {
      await this.initializeFirebase();
      
      console.log('1. Loading real data from CSV files...');
      await this.loader.loadRealInventoryData();
      
      console.log('\n2. Checking existing data in Firebase...');
      const existingData = await this.checkExistingData();
      
      console.log('\n3. Resuming products import...');
      await this.resumeProducts(existingData.products);
      
      console.log('\n4. Resuming storage locations import...');
      await this.resumeStorageLocations(existingData.locations);
      
      console.log('\n5. Resuming inventory import...');
      await this.resumeInventory(existingData.inventory);
      
      console.log('\n✅ Resume import completed successfully!');
      
    } catch (error) {
      console.error('❌ Resume import failed:', error);
      throw error;
    }
  }

  async checkExistingData() {
    try {
      console.log('   Checking what data already exists...');
      
      const productsSnapshot = await this.db.collection('products').get();
      const locationsSnapshot = await this.db.collection('storage_locations').get();
      const inventorySnapshot = await this.db.collection('inventory').get();
      
      const existingProducts = new Set();
      productsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        existingProducts.add(data.reference);
      });
      
      const existingLocations = new Set();
      locationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        existingLocations.add(data.location_code);
      });
      
      console.log(`   Found existing data:`);
      console.log(`     Products: ${productsSnapshot.size}`);
      console.log(`     Locations: ${locationsSnapshot.size}`);
      console.log(`     Inventory: ${inventorySnapshot.size}`);
      
      return {
        products: existingProducts,
        locations: existingLocations,
        inventory: inventorySnapshot.size
      };
      
    } catch (error) {
      console.error('   Error checking existing data:', error);
      return { products: new Set(), locations: new Set(), inventory: 0 };
    }
  }

  async resumeProducts(existingProducts) {
    try {
      const allProducts = this.loader.getProducts();
      const missingProducts = allProducts.filter(p => !existingProducts.has(p.reference));
      
      console.log(`   Products to import: ${missingProducts.length}/${allProducts.length}`);
      
      if (missingProducts.length === 0) {
        console.log('   ✅ All products already imported');
        return;
      }
      
      let imported = 0;
      for (const product of missingProducts) {
        let success = false;
        let retries = 0;
        
        while (!success && retries < this.maxRetries) {
          try {
            const productData = {
              reference: product.reference,
              abc_code: product.abc_code,
              sector: product.sector,
              description: product.description,
              unit_price: product.unit_price,
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('products').add(productData);
            imported++;
            success = true;
            
            if (imported % 10 === 0) {
              console.log(`   Progress: ${imported}/${missingProducts.length} products imported`);
            }
            
          } catch (error) {
            retries++;
            await this.handleError(error, retries, `product ${product.reference}`);
          }
        }
        
        // Rate limiting delay
        await this.sleep(this.delayBetweenItems);
      }
      
      console.log(`   ✅ Successfully imported ${imported}/${missingProducts.length} missing products`);
      
    } catch (error) {
      console.error('   ❌ Product resume failed:', error);
    }
  }

  async resumeStorageLocations(existingLocations) {
    try {
      const allLocations = this.loader.getLocations();
      const missingLocations = allLocations.filter(l => !existingLocations.has(l.location_code));
      
      console.log(`   Locations to import: ${missingLocations.length}/${allLocations.length}`);
      
      if (missingLocations.length === 0) {
        console.log('   ✅ All locations already imported');
        return;
      }
      
      let imported = 0;
      for (const location of missingLocations) {
        let success = false;
        let retries = 0;
        
        while (!success && retries < this.maxRetries) {
          try {
            const locationData = {
              location_code: location.location_code,
              x: location.x,
              y: location.y,
              z: location.z,
              zone: location.zone,
              capacity: location.capacity,
              current_occupancy: location.current_occupancy,
              status: 'active',
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('storage_locations').add(locationData);
            imported++;
            success = true;
            
            if (imported % 50 === 0) {
              console.log(`   Progress: ${imported}/${missingLocations.length} locations imported`);
            }
            
          } catch (error) {
            retries++;
            await this.handleError(error, retries, `location ${location.location_code}`);
          }
        }
        
        // Rate limiting delay
        await this.sleep(this.delayBetweenItems);
      }
      
      console.log(`   ✅ Successfully imported ${imported}/${missingLocations.length} missing locations`);
      
    } catch (error) {
      console.error('   ❌ Location resume failed:', error);
    }
  }

  async resumeInventory(existingInventoryCount) {
    try {
      // Get Firebase IDs for products and locations
      console.log('   Getting Firebase product and location IDs...');
      const productsSnapshot = await this.db.collection('products').get();
      const locationsSnapshot = await this.db.collection('storage_locations').get();
      
      const productMap = new Map();
      productsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        productMap.set(data.reference, doc.id);
      });
      
      const locationMap = new Map();
      locationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        locationMap.set(data.location_code, doc.id);
      });
      
      console.log(`   Product mapping: ${productMap.size} products`);
      console.log(`   Location mapping: ${locationMap.size} locations`);
      
      // Prepare inventory data
      const inventory = this.loader.getInventory();
      const validInventory = inventory.filter(inv => {
        const productId = productMap.get(inv.product_reference);
        const locationId = locationMap.get(inv.location_code);
        return productId && locationId;
      }).map(inv => ({
        ...inv,
        product_id: productMap.get(inv.product_reference),
        location_id: locationMap.get(inv.location_code)
      }));
      
      console.log(`   Total valid inventory: ${validInventory.length}`);
      console.log(`   Already imported: ${existingInventoryCount}`);
      
      // Skip already imported items (approximate)
      const remainingInventory = validInventory.slice(existingInventoryCount);
      console.log(`   Remaining to import: ${remainingInventory.length}`);
      
      if (remainingInventory.length === 0) {
        console.log('   ✅ All inventory already imported');
        return;
      }
      
      // Import remaining inventory one by one with heavy rate limiting
      let imported = 0;
      let failed = 0;
      const startTime = Date.now();
      
      for (let i = 0; i < remainingInventory.length; i++) {
        const inv = remainingInventory[i];
        let success = false;
        let retries = 0;
        
        while (!success && retries < this.maxRetries) {
          try {
            const inventoryData = {
              product_id: inv.product_id,
              location_id: inv.location_id,
              quantity: inv.quantity,
              reserved_quantity: inv.reserved_quantity,
              slot_position: inv.slot_position,
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('inventory').add(inventoryData);
            imported++;
            success = true;
            
          } catch (error) {
            retries++;
            await this.handleError(error, retries, `inventory item ${i}`);
          }
        }
        
        if (!success) {
          failed++;
        }
        
        // Progress update every 50 items
        if (i % 50 === 0 || i === remainingInventory.length - 1) {
          const elapsed = (Date.now() - startTime) / 1000 / 60;
          const rate = imported / elapsed;
          const remaining = remainingInventory.length - i - 1;
          const eta = remaining > 0 ? remaining / rate : 0;
          
          console.log(`   Progress: ${i + 1}/${remainingInventory.length} processed`);
          console.log(`   Imported: ${imported}, Failed: ${failed}, Rate: ${rate.toFixed(1)}/min, ETA: ${eta.toFixed(1)}min`);
        }
        
        // Rate limiting delay
        await this.sleep(this.delayBetweenItems);
        
        // Extra break every 100 items
        if (i % 100 === 0 && i > 0) {
          console.log(`   Taking a 10-second break after ${i} items...`);
          await this.sleep(10000);
        }
      }
      
      const totalTime = (Date.now() - startTime) / 1000 / 60;
      console.log(`   ✅ Inventory resume completed in ${totalTime.toFixed(1)} minutes`);
      console.log(`   Successfully imported: ${imported}/${remainingInventory.length} remaining records`);
      console.log(`   Failed: ${failed} records`);
      console.log(`   Total quota hits: ${this.quotaHitCount}`);
      
    } catch (error) {
      console.error('   ❌ Inventory resume failed:', error);
    }
  }

  async handleError(error, retries, itemDescription) {
    if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota')) {
      this.quotaHitCount++;
      const backoffDelay = Math.min(60000, 5000 * Math.pow(2, retries));
      console.log(`   Quota exceeded for ${itemDescription} (hit #${this.quotaHitCount}), waiting ${backoffDelay}ms...`);
      await this.sleep(backoffDelay);
      
    } else if (error.message.includes('timeout')) {
      console.log(`   Timeout for ${itemDescription}, waiting ${2000 * retries}ms...`);
      await this.sleep(2000 * retries);
      
    } else {
      console.log(`   Error for ${itemDescription} (retry ${retries}): ${error.message}`);
      await this.sleep(1000 * retries);
    }
  }

  async verifyImport() {
    try {
      console.log('\n6. Verifying current state...');
      
      const productsSnapshot = await this.db.collection('products').get();
      const locationsSnapshot = await this.db.collection('storage_locations').get();
      const inventorySnapshot = await this.db.collection('inventory').get();
      
      console.log(`   Products in Firebase: ${productsSnapshot.size}`);
      console.log(`   Locations in Firebase: ${locationsSnapshot.size}`);
      console.log(`   Inventory in Firebase: ${inventorySnapshot.size}`);
      
      // Compare with expected totals
      const expectedProducts = this.loader.getProducts().length;
      const expectedLocations = this.loader.getLocations().length;
      const expectedInventory = this.loader.getInventory().length;
      
      console.log(`\n   Expected vs Actual:`);
      console.log(`   Products: ${productsSnapshot.size}/${expectedProducts} (${((productsSnapshot.size/expectedProducts)*100).toFixed(1)}%)`);
      console.log(`   Locations: ${locationsSnapshot.size}/${expectedLocations} (${((locationsSnapshot.size/expectedLocations)*100).toFixed(1)}%)`);
      console.log(`   Inventory: ${inventorySnapshot.size}/${expectedInventory} (${((inventorySnapshot.size/expectedInventory)*100).toFixed(1)}%)`);
      
      console.log('\n   ✅ Verification completed');
      
    } catch (error) {
      console.log(`   Verification failed: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run resume import if called directly
if (require.main === module) {
  const importer = new ResumeImporter();
  
  console.log('🔄 This will RESUME the data import from where it left off.');
  console.log('🔄 It will check existing data and only import missing items.');
  console.log('🔄 Very slow but should avoid quota issues.');
  console.log('🔄 Press Ctrl+C within 5 seconds to cancel...\n');
  
  setTimeout(async () => {
    try {
      await importer.resumeImport();
      await importer.verifyImport();
      
      console.log('\n🎉 Resume import completed successfully!');
      console.log('Check the verification results above to see progress.');
      process.exit(0);
      
    } catch (error) {
      console.error('\n💥 Resume import failed:', error);
      process.exit(1);
    }
  }, 5000);
}

module.exports = ResumeImporter;