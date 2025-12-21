// Re-import data from new datasets folder
const { FirebaseDB, COLLECTIONS } = require('../config/firebase');

async function clearAndReimportData() {
  console.log('Starting data re-import from datasets folder...');
  
  try {
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    // await clearCollections();
    
    // Run the seed script with new path
    console.log('📥 Importing data from datasets folder...');
    require('./seed-firebase.js');
    
  } catch (error) {
    console.error('Re-import failed:', error);
    process.exit(1);
  }
}

async function clearCollections() {
  const collections = [
    COLLECTIONS.PRODUCTS,
    COLLECTIONS.STORAGE_LOCATIONS, 
    COLLECTIONS.INVENTORY,
    COLLECTIONS.ORDERS,
    COLLECTIONS.PICKING_WAVES,
    COLLECTIONS.PICKING_TASKS
  ];
  
  for (const collection of collections) {
    console.log(`  Clearing ${collection}...`);
    const docs = await FirebaseDB.getAll(collection);
    for (const doc of docs) {
      await FirebaseDB.delete(collection, doc.id);
    }
  }
}

// Run if called directly
if (require.main === module) {
  clearAndReimportData();
}

module.exports = { clearAndReimportData };