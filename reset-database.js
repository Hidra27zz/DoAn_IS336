// Script để xóa dữ liệu cũ và import lại dữ liệu mới
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function resetDatabase() {
  console.log('🗑️ Resetting Database...');
  
  const dbPath = path.join(__dirname, 'warehouse.db');
  
  try {
    // 1. Backup current database (optional)
    const backupPath = `warehouse_backup_${Date.now()}.db`;
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`✅ Database backed up to: ${backupPath}`);
    }
    
    // 2. Delete old database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ Old database file deleted');
    }
    
    // 3. Run import script to create fresh database
    console.log('\n📥 Importing fresh data...');
    
    const { spawn } = require('child_process');
    
    // Run import-to-sql.js
    const importProcess = spawn('node', ['scripts/import-to-sql.js'], {
      stdio: 'inherit'
    });
    
    importProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Database reset completed successfully!');
        
        // Run verification
        verifyDatabase();
      } else {
        console.error(`❌ Import process failed with code ${code}`);
      }
    });
    
    importProcess.on('error', (error) => {
      console.error('❌ Failed to start import process:', error);
    });
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
  }
}

async function verifyDatabase() {
  console.log('\n🔍 Verifying database...');
  
  try {
    const { getDatabase } = require('./config/database');
    const db = await getDatabase();
    
    // Check all tables
    const tables = [
      'products',
      'orders', 
      'inventory',
      'storage_locations',
      'picking_tasks',
      'users'
    ];
    
    console.log('\n📊 Table counts:');
    for (const table of tables) {
      try {
        const result = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result.count} records`);
      } catch (error) {
        console.log(`  ${table}: ❌ Error - ${error.message}`);
      }
    }
    
    console.log('\n🎉 Database verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run reset if this file is executed directly
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase, verifyDatabase };