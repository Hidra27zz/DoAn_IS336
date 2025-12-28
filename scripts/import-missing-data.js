// Import missing picking tasks and navigation points
const { getDatabase } = require('../config/database');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

async function importMissingData() {
  console.log('🔧 Importing missing data...\n');
  
  try {
    const db = await getDatabase();
    
    // Clear existing picking tasks and navigation points
    await db.run('DELETE FROM picking_tasks');
    await db.run('DELETE FROM navigation_points');
    
    console.log('1. Importing Picking Tasks from Picking_Wave.csv...');
    await importPickingTasks(db);
    
    console.log('\n2. Importing Navigation Points from Support_Points_Navigation.csv...');
    await importNavigationPoints(db);
    
    console.log('\n✅ Missing data import completed successfully!');
    
    // Verify counts
    const pickingCount = await db.count('picking_tasks');
    const navCount = await db.count('navigation_points');
    
    console.log(`\n📊 Final counts:`);
    console.log(`   Picking Tasks: ${pickingCount}`);
    console.log(`   Navigation Points: ${navCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

async function importPickingTasks(db) {
  const waveCsvPath = path.join(__dirname, '../datasets/Picking_Wave.csv');
  const pickingTasks = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(waveCsvPath)
      .pipe(csv({ 
        separator: ';',
        skipLinesWithError: true,
        headers: ['waveNumber', 'reference', 'Size (US)', 'quantityToPick (units)', 'locations', 'operator']
      }))
      .on('data', (row) => {
        const waveNumber = row.waveNumber?.toString().trim();
        const productReference = row.reference?.toString().trim();
        const locationCode = row.locations?.toString().trim();
        const quantity = parseFloat(row['quantityToPick (units)']) || 0;
        const operator = row.operator?.toString().trim();
        const size = row['Size (US)']?.toString().trim();
        
        if (!waveNumber || !productReference || !locationCode) {
          return;
        }
        
        pickingTasks.push({
          wave_number: waveNumber,
          product_reference: productReference,
          location_code: locationCode,
          quantity_to_pick: quantity,
          quantity_picked: 0,
          operator: operator,
          size: size,
          status: 'pending'
        });
      })
      .on('end', async () => {
        try {
          console.log(`   Found ${pickingTasks.length} picking tasks`);
          
          if (pickingTasks.length > 0) {
            await db.bulkInsert('picking_tasks', pickingTasks);
            console.log(`   ✅ Imported ${pickingTasks.length} picking tasks`);
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importNavigationPoints(db) {
  const navCsvPath = path.join(__dirname, '../datasets/Support_Points_Navigation.csv');
  const navigationPoints = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(navCsvPath)
      .pipe(csv({ separator: ';' }))
      .on('data', (row) => {
        const pointsStr = row.points_specified?.trim();
        const label = row.labels?.trim();
        
        if (!pointsStr || !label) return;
        
        // Parse coordinates (66.0, -29.0, 1.0) - fixed regex
        const coordMatch = pointsStr.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const coords = coordMatch[1].split(',').map(c => parseFloat(c.trim()));
          if (coords.length === 3) {
            navigationPoints.push({
              label: label,
              x: coords[0],
              y: coords[1],
              z: coords[2],
              point_type: 'support',
              coordinates: pointsStr
            });
          }
        }
      })
      .on('end', async () => {
        try {
          console.log(`   Found ${navigationPoints.length} navigation points`);
          
          if (navigationPoints.length > 0) {
            await db.bulkInsert('navigation_points', navigationPoints);
            console.log(`   ✅ Imported ${navigationPoints.length} navigation points`);
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Run if called directly
if (require.main === module) {
  importMissingData();
}

module.exports = { importMissingData };