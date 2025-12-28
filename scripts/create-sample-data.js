// Create sample data for testing
const fs = require('fs').promises;
const path = require('path');

class SampleDataCreator {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
  }

  generateId() {
    return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async createSampleData() {
    console.log('🌱 Creating sample data for testing...');
    
    // Read existing products and locations
    const productsData = await fs.readFile(path.join(this.dataDir, 'products.json'), 'utf8');
    const products = JSON.parse(productsData);
    
    const locationsData = await fs.readFile(path.join(this.dataDir, 'storage_locations.json'), 'utf8');
    const locations = JSON.parse(locationsData);
    
    console.log(`📦 Found ${products.length} products`);
    console.log(`📍 Found ${locations.length} locations`);
    
    // Create sample inventory
    const inventory = [];
    const sampleSize = Math.min(1000, products.length * 2); // Create up to 1000 inventory records
    
    for (let i = 0; i < sampleSize; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      
      inventory.push({
        id: this.generateId(),
        product_id: product.id,
        location_id: location.id,
        quantity: Math.floor(Math.random() * 100) + 1,
        reserved_quantity: Math.floor(Math.random() * 10),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    await fs.writeFile(path.join(this.dataDir, 'inventory.json'), JSON.stringify(inventory, null, 2));
    console.log(`✅ Created inventory.json with ${inventory.length} records`);
    
    // Create sample picking waves
    const waves = [];
    const tasks = [];
    
    for (let i = 1; i <= 10; i++) {
      const waveId = this.generateId();
      const status = i <= 5 ? 'completed' : (i <= 8 ? 'in_progress' : 'created');
      
      waves.push({
        id: waveId,
        wave_number: `W${String(i).padStart(3, '0')}`,
        status: status,
        total_items: Math.floor(Math.random() * 50) + 10,
        assigned_operator_id: null,
        created_at: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // Create tasks for each wave
      const taskCount = Math.floor(Math.random() * 20) + 5;
      for (let j = 0; j < taskCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const location = locations[Math.floor(Math.random() * locations.length)];
        
        tasks.push({
          id: this.generateId(),
          wave_id: waveId,
          product_id: product.id,
          location_id: location.id,
          quantity_to_pick: Math.floor(Math.random() * 10) + 1,
          quantity_picked: status === 'completed' ? Math.floor(Math.random() * 10) + 1 : 0,
          status: status === 'completed' ? 'completed' : 'pending',
          picking_time_seconds: status === 'completed' ? Math.floor(Math.random() * 120) + 30 : null,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    
    await fs.writeFile(path.join(this.dataDir, 'picking_waves.json'), JSON.stringify(waves, null, 2));
    console.log(`✅ Created picking_waves.json with ${waves.length} records`);
    
    await fs.writeFile(path.join(this.dataDir, 'picking_tasks.json'), JSON.stringify(tasks, null, 2));
    console.log(`✅ Created picking_tasks.json with ${tasks.length} records`);
    
    console.log('\n🎉 Sample data creation completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Products: ${products.length} records`);
    console.log(`   - Storage Locations: ${locations.length} records`);
    console.log(`   - Inventory: ${inventory.length} records`);
    console.log(`   - Orders: ${JSON.parse(await fs.readFile(path.join(this.dataDir, 'orders.json'), 'utf8')).length} records`);
    console.log(`   - Picking Waves: ${waves.length} records`);
    console.log(`   - Picking Tasks: ${tasks.length} records`);
  }
}

// Run if called directly
if (require.main === module) {
  const creator = new SampleDataCreator();
  creator.createSampleData()
    .then(() => {
      console.log('\n🔐 Login with: admin / admin123');
      console.log('🌐 Open: http://localhost:3000/');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Sample data creation failed:', error);
      process.exit(1);
    });
}

module.exports = SampleDataCreator;