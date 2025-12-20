// Seed Firebase with Real Warehouse Dataset
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { FirebaseDB, COLLECTIONS } = require('../config/firebase');

const DATA_DIR = path.join(__dirname, '..', 'datasets');

// Mapping for readable names
const SECTOR_MAP = {
  'PF': 'Footwear',
  'AC': 'Accessories',
  'SP': 'Sports',
  'CS': 'Casual',
  'FM': 'Formal'
};

const ZONE_MAP = {
  'A': 'Zone A - High Frequency',
  'B': 'Zone B - Medium Frequency', 
  'C': 'Zone C - Low Frequency',
  'H': 'Zone H - Heavy Items',
  'S': 'Zone S - Small Items'
};

const ABC_DESCRIPTION = {
  'A': 'High demand - Fast moving',
  'B': 'Medium demand - Regular',
  'C': 'Low demand - Slow moving'
};

function getSectorName(code) {
  return SECTOR_MAP[code] || 'General Footwear';
}

function getZoneName(code) {
  return ZONE_MAP[code] || `Zone ${code}`;
}

function parseCSV(content, delimiter = ',') {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() || '';
    });
    data.push(row);
  }
  return data;
}

function readCSVFile(filename, delimiter = ',') {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseCSV(content, delimiter);
}

async function seedDatabase() {
  console.log('Starting Firebase database seeding...');
  console.log('Data directory:', DATA_DIR);
  
  try {
    await seedUsers();
    await seedProducts();
    await seedStorageLocations();
    await seedCustomerOrders();
    await seedPickingWaves();
    await seedInventory();
    
    console.log('\nDatabase seeding completed!');
  } catch (error) {
    console.error('Seeding error:', error.message);
    process.exit(1);
  }
}

async function seedUsers() {
  console.log('\nSeeding users...');
  
  const users = [
    { username: 'admin', email: 'admin@wms.local', password: 'admin123', role: 'admin' },
    { username: 'manager', email: 'manager@wms.local', password: 'manager123', role: 'manager' },
    { username: 'Operator_1', email: 'op1@wms.local', password: 'operator123', role: 'operator' },
    { username: 'Operator_2', email: 'op2@wms.local', password: 'operator123', role: 'operator' },
    { username: 'Operator_3', email: 'op3@wms.local', password: 'operator123', role: 'operator' }
  ];
  
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await FirebaseDB.create(COLLECTIONS.USERS, {
      username: user.username,
      email: user.email,
      password_hash: passwordHash,
      role: user.role,
      status: 'active'
    });
    console.log(`  + ${user.username}`);
  }
}

async function seedProducts() {
  console.log('\nSeeding products from Product.csv...');
  
  const products = readCSVFile('Product.csv', ';');
  console.log(`  Found ${products.length} products`);
  
  let count = 0;
  for (const row of products.slice(0, 500)) {
    const ref = row.Reference || row.reference || `PROD-${count}`;
    const abc = row.ABCCOD || row.ABC_Code || 'C';
    const sector = row.Sector || row.sector || 'PF';
    
    await FirebaseDB.create(COLLECTIONS.PRODUCTS, {
      reference: ref,
      abc_code: abc,
      abc_description: ABC_DESCRIPTION[abc] || 'Standard',
      sector_code: sector,
      sector_name: getSectorName(sector),
      category: 'Footwear',
      description: `${getSectorName(sector)} - SKU ${ref}`,
      unit_price: abc === 'A' ? 89.99 : (abc === 'B' ? 59.99 : 39.99)
    });
    count++;
    if (count % 100 === 0) console.log(`  Processed ${count}...`);
  }
  console.log(`  Total: ${count} products`);
}

async function seedStorageLocations() {
  console.log('\nSeeding storage locations from Storage_Location.csv...');
  
  const locations = readCSVFile('Storage_Location.csv', ',');
  console.log(`  Found ${locations.length} locations`);
  
  let count = 0;
  for (const row of locations.slice(0, 500)) {
    const locationCode = row.originalLocation || row.location || `LOC-${count}`;
    const zone = locationCode.split('-')[0] || 'A';
    
    await FirebaseDB.create(COLLECTIONS.STORAGE_LOCATIONS, {
      location_code: locationCode,
      position: row.position || '',
      x: parseFloat(row.x) || 0,
      y: parseFloat(row.y) || 0,
      z: parseFloat(row.z) || 0,
      zone: zone,
      zone_name: getZoneName(zone),
      aisle: locationCode.split('-')[1] || '',
      level: locationCode.split('-')[2] || '',
      capacity: 100,
      current_occupancy: Math.floor(Math.random() * 80),
      status: 'active'
    });
    count++;
    if (count % 100 === 0) console.log(`  Processed ${count}...`);
  }
  console.log(`  Total: ${count} locations`);
}

async function seedCustomerOrders() {
  console.log('\nSeeding orders from Customer_Order.csv...');
  
  const orders = readCSVFile('Customer_Order.csv', ';');
  console.log(`  Found ${orders.length} order lines`);
  
  const orderMap = new Map();
  orders.slice(0, 2000).forEach(row => {
    const orderNum = row.orderNumber || row.order_number;
    if (!orderMap.has(orderNum)) {
      orderMap.set(orderNum, {
        order_number: orderNum,
        customer_code: row.codCustomer || row.customer_code || 'CUST',
        wave_number: parseInt(row.waveNumber) || null,
        operator: row.operator || null,
        creation_date: row.creationDate || new Date().toISOString(),
        items: []
      });
    }
    orderMap.get(orderNum).items.push({
      reference: row.Reference || row.reference,
      size: row['Size (US)'] || row.size,
      quantity: parseInt(row['quantity (units)'] || row.quantity) || 1
    });
  });
  
  let count = 0;
  for (const [orderNum, orderData] of orderMap) {
    if (count >= 300) break;
    
    await FirebaseDB.create(COLLECTIONS.ORDERS, {
      order_number: orderData.order_number,
      customer_code: orderData.customer_code.trim(),
      wave_number: orderData.wave_number,
      status: 'pending',
      priority: 'normal',
      total_items: orderData.items.length,
      creation_date: orderData.creation_date
    });
    count++;
    if (count % 50 === 0) console.log(`  Processed ${count}...`);
  }
  console.log(`  Total: ${count} orders`);
}


async function seedPickingWaves() {
  console.log('\nSeeding picking waves from Picking_Wave.csv...');
  
  const waves = readCSVFile('Picking_Wave.csv', ';');
  console.log(`  Found ${waves.length} picking records`);
  
  // Get products and locations for mapping
  const products = await FirebaseDB.getAll(COLLECTIONS.PRODUCTS);
  const locations = await FirebaseDB.getAll(COLLECTIONS.STORAGE_LOCATIONS);
  
  const productMap = new Map(products.map(p => [p.reference, p]));
  const locationMap = new Map(locations.map(l => [l.location_code, l]));
  
  const waveMap = new Map();
  waves.slice(0, 3000).forEach(row => {
    const waveNum = parseInt(row.waveNumber) || 0;
    if (!waveMap.has(waveNum)) {
      waveMap.set(waveNum, {
        wave_number: waveNum,
        operator: row.operator || 'Operator_1',
        tasks: []
      });
    }
    
    const product = productMap.get(row.reference);
    const location = locationMap.get((row.locations || '').trim());
    
    if (product && location) {
      waveMap.get(waveNum).tasks.push({
        product_id: product.id,
        location_id: location.id,
        reference: row.reference,
        size: row['Size (US)'] || row.size,
        quantity: parseInt(row['quantityToPick (units)'] || row.quantity) || 1,
        location_code: location.location_code
      });
    }
  });
  
  let count = 0;
  for (const [waveNum, waveData] of waveMap) {
    if (count >= 50 || waveData.tasks.length === 0) break;
    
    const wave = await FirebaseDB.create(COLLECTIONS.PICKING_WAVES, {
      wave_number: waveData.wave_number,
      operator_name: waveData.operator.trim(),
      status: count < 5 ? 'completed' : (count < 15 ? 'in_progress' : 'created'),
      total_items: waveData.tasks.length,
      started_at: count < 15 ? new Date(Date.now() - Math.random() * 86400000).toISOString() : null,
      completed_at: count < 5 ? new Date(Date.now() - Math.random() * 43200000).toISOString() : null
    });
    
    // Create picking tasks with real product and location IDs
    let seq = 1;
    for (const task of waveData.tasks.slice(0, 15)) {
      const pickingTime = count < 5 ? Math.floor(Math.random() * 45) + 15 : null;
      
      await FirebaseDB.create(COLLECTIONS.PICKING_TASKS, {
        wave_id: wave.id,
        product_id: task.product_id,
        location_id: task.location_id,
        product_reference: task.reference,
        size: task.size,
        quantity_to_pick: task.quantity,
        location_code: task.location_code,
        sequence_number: seq++,
        status: count < 5 ? 'completed' : 'pending',
        quantity_picked: count < 5 ? task.quantity : 0,
        picking_time_seconds: pickingTime
      });
    }
    
    count++;
    if (count % 10 === 0) console.log(`  Processed ${count} waves...`);
  }
  console.log(`  Total: ${count} waves with real product/location mapping`);
}

async function seedInventory() {
  console.log('\nCreating inventory records...');
  
  const products = await FirebaseDB.getAll(COLLECTIONS.PRODUCTS);
  const locations = await FirebaseDB.getAll(COLLECTIONS.STORAGE_LOCATIONS);
  
  console.log(`  Products: ${products.length}, Locations: ${locations.length}`);
  
  let count = 0;
  const maxRecords = Math.min(products.length, locations.length, 300);
  
  for (let i = 0; i < maxRecords; i++) {
    const product = products[i];
    const location = locations[i % locations.length];
    
    let quantity;
    switch (product.abc_code) {
      case 'A': quantity = Math.floor(Math.random() * 500) + 100; break;
      case 'B': quantity = Math.floor(Math.random() * 200) + 50; break;
      default: quantity = Math.floor(Math.random() * 100) + 10;
    }
    
    await FirebaseDB.create(COLLECTIONS.INVENTORY, {
      product_id: product.id,
      product_reference: product.reference,
      location_id: location.id,
      location_code: location.location_code,
      zone: location.zone,
      abc_code: product.abc_code,
      quantity: quantity,
      reserved_quantity: 0
    });
    
    count++;
    if (count % 50 === 0) console.log(`  Processed ${count}...`);
  }
  console.log(`  Total: ${count} inventory records`);
}

// Run
seedDatabase().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
