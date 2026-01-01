// Script để xem dữ liệu trong database
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./warehouse.db');

console.log('=== DATABASE OVERVIEW ===\n');

// Xem tất cả bảng
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('📊 TABLES IN DATABASE:');
  tables.forEach(table => console.log(`  - ${table.name}`));
  console.log('');
  
  // Đếm số dòng trong mỗi bảng
  let completed = 0;
  tables.forEach(table => {
    db.get(`SELECT COUNT(*) as count FROM ${table.name}`, [], (err, result) => {
      if (!err) {
        console.log(`${table.name}: ${result.count} rows`);
      }
      completed++;
      if (completed === tables.length) {
        console.log('\n=== SAMPLE DATA ===\n');
        showSampleData();
      }
    });
  });
});

function showSampleData() {
  // Xem mẫu dữ liệu từ các bảng quan trọng
  
  console.log('📦 PRODUCTS (first 5):');
  db.all('SELECT * FROM products LIMIT 5', [], (err, rows) => {
    if (!err) console.table(rows);
    
    console.log('\n📋 ORDERS (first 5):');
    db.all('SELECT * FROM orders LIMIT 5', [], (err, rows) => {
      if (!err) console.table(rows);
      
      console.log('\n📍 INVENTORY (first 5):');
      db.all('SELECT * FROM inventory LIMIT 5', [], (err, rows) => {
        if (!err) console.table(rows);
        
        console.log('\n🌊 WAVES (first 5):');
        db.all('SELECT * FROM waves LIMIT 5', [], (err, rows) => {
          if (!err) console.table(rows);
          
          db.close();
        });
      });
    });
  });
}
