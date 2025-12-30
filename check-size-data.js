// Check Size Data in Database
const { getDatabase } = require('./config/database');

async function checkSizeData() {
  console.log('\n' + '='.repeat(70));
  console.log('  KIỂM TRA DỮ LIỆU SIZE TRONG DATABASE');
  console.log('='.repeat(70) + '\n');
  
  try {
    const db = await getDatabase();
    
    // Check order_items sizes
    console.log('1. SIZES TRONG ORDER_ITEMS:');
    console.log('-'.repeat(70));
    const orderSizes = await db.all(`
      SELECT DISTINCT size, COUNT(*) as count
      FROM order_items 
      WHERE size IS NOT NULL
      GROUP BY size
      ORDER BY CAST(size AS REAL)
    `);
    
    console.log('Size | Số lượng records');
    console.log('-'.repeat(30));
    orderSizes.forEach(s => {
      const num = parseFloat(s.size);
      const isSuspicious = num >= 35 && num % 10 === 5; // 85, 95, 105, 115, etc.
      const marker = isSuspicious ? ' ⚠️  (CẦN CHUYỂN ĐỔI)' : '';
      console.log(`${s.size.padEnd(6)} | ${s.count}${marker}`);
    });
    
    // Check picking_tasks sizes
    console.log('\n2. SIZES TRONG PICKING_TASKS:');
    console.log('-'.repeat(70));
    const pickingSizes = await db.all(`
      SELECT DISTINCT size, COUNT(*) as count
      FROM picking_tasks 
      WHERE size IS NOT NULL
      GROUP BY size
      ORDER BY CAST(size AS REAL)
    `);
    
    console.log('Size | Số lượng records');
    console.log('-'.repeat(30));
    pickingSizes.forEach(s => {
      const num = parseFloat(s.size);
      const isSuspicious = num >= 35 && num % 10 === 5;
      const marker = isSuspicious ? ' ⚠️  (CẦN CHUYỂN ĐỔI)' : '';
      console.log(`${s.size.padEnd(6)} | ${s.count}${marker}`);
    });
    
    // Count how many need conversion
    const needConversionOrder = orderSizes.filter(s => {
      const num = parseFloat(s.size);
      return num >= 35 && num % 10 === 5;
    });
    
    const needConversionPicking = pickingSizes.filter(s => {
      const num = parseFloat(s.size);
      return num >= 35 && num % 10 === 5;
    });
    
    const totalNeedConversion = 
      needConversionOrder.reduce((sum, s) => sum + s.count, 0) +
      needConversionPicking.reduce((sum, s) => sum + s.count, 0);
    
    console.log('\n' + '='.repeat(70));
    console.log('TÓM TẮT:');
    console.log('='.repeat(70));
    console.log(`Tổng số size khác nhau trong order_items: ${orderSizes.length}`);
    console.log(`Tổng số size khác nhau trong picking_tasks: ${pickingSizes.length}`);
    console.log(`Số size cần chuyển đổi: ${needConversionOrder.length + needConversionPicking.length}`);
    console.log(`Tổng số records cần cập nhật: ${totalNeedConversion}`);
    
    if (totalNeedConversion > 0) {
      console.log('\n⚠️  CÓ DỮ LIỆU CẦN CHUYỂN ĐỔI!');
      console.log('Chạy lệnh: node fix-shoe-sizes-simple.js');
    } else {
      console.log('\n✅ TẤT CẢ SIZE ĐÃ ĐÚNG FORMAT!');
    }
    
    console.log('\n' + '='.repeat(70) + '\n');
    
    // Sample data
    console.log('MẪU DỮ LIỆU (10 records đầu tiên):');
    console.log('-'.repeat(70));
    const samples = await db.all(`
      SELECT o.order_number, oi.product_reference, oi.size, oi.quantity
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.size IS NOT NULL
      LIMIT 10
    `);
    
    console.log('Order Number | Product | Size | Qty');
    console.log('-'.repeat(50));
    samples.forEach(s => {
      console.log(`${s.order_number.padEnd(12)} | ${s.product_reference.padEnd(7)} | ${s.size.padEnd(4)} | ${s.quantity}`);
    });
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
    throw error;
  }
}

if (require.main === module) {
  checkSizeData()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { checkSizeData };
