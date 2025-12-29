// Script để xóa dữ liệu trong database mà không xóa file
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function clearDatabaseData() {
  console.log('🧹 Clearing Database Data...');
  
  const dbPath = path.join(__dirname, 'warehouse.db');
  const db = new sqlite3.Database(dbPath);
  
  try {
    // Wrap in promise for async/await
    const runQuery = (query) => {
      return new Promise((resolve, reject) => {
        db.run(query, function(err) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    };
    
    const getQuery = (query) => {
      return new Promise((resolve, reject) => {
        db.get(query, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    
    // 1. Check current data counts
    console.log('\n📊 Current data counts:');
    const tables = ['products', 'orders', 'inventory', 'storage_locations', 'picking_tasks', 'users'];
    
    for (const table of tables) {
      try {
        const result = await getQuery(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result.count} records`);
      } catch (error) {
        console.log(`  ${table}: Table may not exist`);
      }
    }
    
    // 2. Clear all data tables (keep structure)
    console.log('\n🗑️ Clearing data...');
    
    // Disable foreign key constraints temporarily
    await runQuery('PRAGMA foreign_keys = OFF');
    
    // Clear tables in correct order (respecting dependencies)
    const clearOrder = [
      'picking_tasks',
      'inventory', 
      'orders',
      'products',
      'storage_locations'
      // Keep users table for login
    ];
    
    for (const table of clearOrder) {
      try {
        await runQuery(`DELETE FROM ${table}`);
        console.log(`  ✅ Cleared ${table}`);
      } catch (error) {
        console.log(`  ❌ Error clearing ${table}: ${error.message}`);
      }
    }
    
    // Reset auto-increment counters
    await runQuery('DELETE FROM sqlite_sequence WHERE name IN ("products", "orders", "inventory", "storage_locations", "picking_tasks")');
    console.log('  ✅ Reset auto-increment counters');
    
    // Re-enable foreign key constraints
    await runQuery('PRAGMA foreign_keys = ON');
    
    // 3. Verify data is cleared
    console.log('\n📊 After clearing:');
    for (const table of tables) {
      try {
        const result = await getQuery(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result.count} records`);
      } catch (error) {
        console.log(`  ${table}: Error - ${error.message}`);
      }
    }
    
    console.log('\n✅ Database data cleared successfully!');
    
  } catch (error) {
    console.error('❌ Clear failed:', error);
  } finally {
    db.close();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  clearDatabaseData();
}

module.exports = { clearDatabaseData };