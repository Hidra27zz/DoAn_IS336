// Generate Realistic Picking Data for AI Demo
const { getDatabase } = require('./config/database');

async function generateRealisticPickingData() {
  try {
    const db = await getDatabase();
    
    console.log('🚀 Generating realistic picking data for AI demonstration...\n');
    
    // Get all products
    const products = await db.all('SELECT reference, abc_code FROM products LIMIT 100');
    console.log(`📦 Found ${products.length} products`);
    
    // Get storage locations
    const locations = await db.all('SELECT location_code, zone FROM storage_locations LIMIT 500');
    console.log(`📍 Found ${locations.length} storage locations`);
    
    // Create waves
    const waves = [];
    for (let i = 1; i <= 20; i++) {
      const waveNumber = `W${String(i).padStart(3, '0')}`;
      waves.push(waveNumber);
      
      await db.run(`
        INSERT OR IGNORE INTO picking_waves (wave_number, status, priority, operator)
        VALUES (?, ?, ?, ?)
      `, [
        waveNumber,
        i <= 5 ? 'completed' : i <= 10 ? 'in_progress' : i <= 15 ? 'released' : 'created',
        Math.floor(Math.random() * 3) + 1,
        i <= 15 ? 'admin-001' : null
      ]);
    }
    console.log(`🌊 Created ${waves.length} waves`);
    
    // Generate picking tasks with realistic patterns
    let tasksCreated = 0;
    const statuses = ['completed', 'in_progress', 'pending'];
    
    for (const wave of waves) {
      // Each wave has 10-30 tasks
      const tasksInWave = Math.floor(Math.random() * 20) + 10;
      
      for (let i = 0; i < tasksInWave; i++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        
        // ABC products have different picking frequencies
        let quantity;
        if (product.abc_code === 'A') {
          quantity = Math.floor(Math.random() * 50) + 20; // 20-70 units
        } else if (product.abc_code === 'B') {
          quantity = Math.floor(Math.random() * 30) + 10; // 10-40 units
        } else {
          quantity = Math.floor(Math.random() * 20) + 5; // 5-25 units
        }
        
        const status = wave.includes('W00') && parseInt(wave.substring(1)) <= 5 
          ? 'completed' 
          : wave.includes('W00') && parseInt(wave.substring(1)) <= 10
          ? 'in_progress'
          : 'pending';
        
        const quantityPicked = status === 'completed' ? quantity : status === 'in_progress' ? Math.floor(quantity * 0.6) : 0;
        
        try {
          await db.run(`
            INSERT INTO picking_tasks (
              wave_number, product_reference, location_code, 
              quantity_to_pick, quantity_picked, status, operator
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            wave,
            product.reference,
            location.location_code,
            quantity,
            quantityPicked,
            status,
            status !== 'pending' ? 'admin-001' : null
          ]);
          tasksCreated++;
        } catch (error) {
          // Skip duplicates
        }
      }
    }
    
    console.log(`✅ Created ${tasksCreated} picking tasks`);
    
    // Update inventory based on picking
    console.log('\n📊 Updating inventory...');
    const completedTasks = await db.all(`
      SELECT product_reference, location_code, SUM(quantity_picked) as total_picked
      FROM picking_tasks
      WHERE status = 'completed'
      GROUP BY product_reference, location_code
    `);
    
    for (const task of completedTasks) {
      // Add inventory if not exists
      await db.run(`
        INSERT OR IGNORE INTO inventory (product_reference, location_code, quantity, reserved_quantity)
        VALUES (?, ?, ?, 0)
      `, [task.product_reference, task.location_code, task.total_picked + 100]);
      
      // Update storage location occupancy
      await db.run(`
        UPDATE storage_locations 
        SET current_occupancy = current_occupancy + ?
        WHERE location_code = ?
      `, [task.total_picked, task.location_code]);
    }
    
    console.log(`✅ Updated ${completedTasks.length} inventory records`);
    
    // Generate some orders
    console.log('\n📋 Generating orders...');
    for (let i = 1; i <= 50; i++) {
      const orderNumber = `ORD${String(Date.now() + i).slice(-8)}`;
      const status = i <= 10 ? 'completed' : i <= 25 ? 'picking' : i <= 40 ? 'assigned' : 'pending';
      
      await db.run(`
        INSERT OR IGNORE INTO orders (order_number, customer_name, status, priority)
        VALUES (?, ?, ?, ?)
      `, [
        orderNumber,
        `Customer ${String(i).padStart(4, '0')}`,
        status,
        Math.floor(Math.random() * 3) + 1
      ]);
      
      // Add order lines
      const numLines = Math.floor(Math.random() * 5) + 2;
      for (let j = 0; j < numLines; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        await db.run(`
          INSERT OR IGNORE INTO order_lines (order_number, product_reference, quantity)
          VALUES (?, ?, ?)
        `, [orderNumber, product.reference, Math.floor(Math.random() * 20) + 5]);
      }
    }
    
    console.log('✅ Created 50 orders with order lines');
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATA GENERATION SUMMARY');
    console.log('='.repeat(60));
    
    const summary = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM storage_locations) as total_locations,
        (SELECT COUNT(*) FROM picking_waves) as total_waves,
        (SELECT COUNT(*) FROM picking_tasks) as total_tasks,
        (SELECT COUNT(*) FROM picking_tasks WHERE status = 'completed') as completed_tasks,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM inventory) as inventory_records
    `);
    
    console.log(`Products: ${summary.total_products}`);
    console.log(`Storage Locations: ${summary.total_locations}`);
    console.log(`Picking Waves: ${summary.total_waves}`);
    console.log(`Picking Tasks: ${summary.total_tasks} (${summary.completed_tasks} completed)`);
    console.log(`Orders: ${summary.total_orders}`);
    console.log(`Inventory Records: ${summary.inventory_records}`);
    console.log('='.repeat(60));
    
    console.log('\n✅ Realistic picking data generated successfully!');
    console.log('🎯 AI algorithms now have sufficient data for meaningful analysis\n');
    
  } catch (error) {
    console.error('❌ Error generating data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateRealisticPickingData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { generateRealisticPickingData };
