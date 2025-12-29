// Script để sửa bảng picking_tasks - thêm các cột thiếu
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function fixPickingTasksTable() {
  console.log('🔧 Fixing picking_tasks table...');
  
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
    
    // Check current table structure
    console.log('📋 Checking current table structure...');
    
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(picking_tasks)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('Current columns:', tableInfo.map(col => col.name).join(', '));
    
    // Add missing columns if they don't exist
    const columnsToAdd = [
      { name: 'estimated_time_minutes', type: 'INTEGER DEFAULT 3' },
      { name: 'zone', type: 'TEXT DEFAULT "A"' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ];
    
    for (const column of columnsToAdd) {
      const exists = tableInfo.some(col => col.name === column.name);
      
      if (!exists) {
        try {
          await runQuery(`ALTER TABLE picking_tasks ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✅ Added column: ${column.name}`);
        } catch (error) {
          if (error.message.includes('duplicate column name')) {
            console.log(`ℹ️ Column ${column.name} already exists`);
          } else {
            console.error(`❌ Error adding column ${column.name}:`, error.message);
          }
        }
      } else {
        console.log(`ℹ️ Column ${column.name} already exists`);
      }
    }
    
    // Update existing records with default values
    console.log('\n🔄 Updating existing records...');
    
    // Set estimated_time_minutes for existing records
    await runQuery(`
      UPDATE picking_tasks 
      SET estimated_time_minutes = 3 
      WHERE estimated_time_minutes IS NULL
    `);
    
    // Set zone based on location_code
    await runQuery(`
      UPDATE picking_tasks 
      SET zone = SUBSTR(location_code, 1, 1)
      WHERE zone IS NULL AND location_code IS NOT NULL AND location_code != 'UNKNOWN'
    `);
    
    // Set default zone for unknown locations
    await runQuery(`
      UPDATE picking_tasks 
      SET zone = 'A'
      WHERE zone IS NULL
    `);
    
    // Set updated_at for existing records
    await runQuery(`
      UPDATE picking_tasks 
      SET updated_at = created_at
      WHERE updated_at IS NULL AND created_at IS NOT NULL
    `);
    
    // Verify the fixes
    const sampleRecord = await getQuery(`
      SELECT * FROM picking_tasks 
      WHERE estimated_time_minutes IS NOT NULL 
      LIMIT 1
    `);
    
    if (sampleRecord) {
      console.log('\n✅ Sample record after fix:');
      console.log(`  Wave: ${sampleRecord.wave_number}`);
      console.log(`  Product: ${sampleRecord.product_reference}`);
      console.log(`  Location: ${sampleRecord.location_code}`);
      console.log(`  Zone: ${sampleRecord.zone}`);
      console.log(`  Estimated Time: ${sampleRecord.estimated_time_minutes} minutes`);
    }
    
    // Count records
    const count = await getQuery('SELECT COUNT(*) as count FROM picking_tasks');
    console.log(`\n📊 Total picking tasks: ${count.count}`);
    
    console.log('\n🎉 Picking tasks table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    db.close();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  fixPickingTasksTable();
}

module.exports = { fixPickingTasksTable };