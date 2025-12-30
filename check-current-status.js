// Quick Status Check
const fs = require('fs');

console.log('\n' + '='.repeat(70));
console.log('  WAREHOUSE MANAGEMENT SYSTEM - STATUS CHECK');
console.log('='.repeat(70) + '\n');

// Check if all fix files exist
const fixes = [
  { name: 'Low Stock Alerts', file: 'public/app.js', search: 'low-stock-alert' },
  { name: 'Order Creation Fix', file: 'public/app.js', search: 'customer_name: customerValue' },
  { name: 'Wave Creation Fix', file: 'public/app.js', search: 'data-items="${o.total_items' },
  { name: 'AI Prominence', file: 'public/app.js', search: 'AI INSIGHTS & RECOMMENDATIONS' },
  { name: 'Alert CSS Styles', file: 'public/styles.css', search: '.low-stock-alert' },
  { name: 'Wave Order Count', file: 'routes/waves.js', search: 'COUNT(DISTINCT o.id) as order_count' },
  { name: 'Warehouse Movements', file: 'routes/warehouse.js', search: 'POST /movements endpoint' }
];

console.log('CHECKING CODE FIXES:\n');

let allPresent = true;
fixes.forEach(fix => {
  try {
    const content = fs.readFileSync(fix.file, 'utf8');
    const found = content.includes(fix.search);
    console.log(`${found ? '✅' : '❌'} ${fix.name}`);
    if (!found) allPresent = false;
  } catch (error) {
    console.log(`❌ ${fix.name} (file not found)`);
    allPresent = false;
  }
});

console.log('\n' + '-'.repeat(70) + '\n');

// Check if shoe size fix is ready
const shoeSizeFixExists = fs.existsSync('fix-shoe-sizes-simple.js');
console.log('PENDING TASKS:\n');
console.log(`${shoeSizeFixExists ? '⏳' : '❌'} Shoe Size Fix Script (ready to run)`);

console.log('\n' + '-'.repeat(70) + '\n');

// Check database
const dbExists = fs.existsSync('warehouse.db');
console.log('DATABASE:\n');
console.log(`${dbExists ? '✅' : '❌'} warehouse.db exists`);

console.log('\n' + '='.repeat(70) + '\n');

if (allPresent && shoeSizeFixExists && dbExists) {
  console.log('STATUS: ✅ ALL SYSTEMS READY\n');
  console.log('NEXT STEPS:');
  console.log('  1. Restart server: npm start');
  console.log('  2. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)');
  console.log('  3. Test the fixes in browser');
  console.log('  4. Run shoe size fix: node fix-shoe-sizes-simple.js');
  console.log('\n' + '='.repeat(70) + '\n');
} else {
  console.log('STATUS: ⚠️  SOME ISSUES DETECTED\n');
  console.log('Please check the items marked with ❌ above.\n');
  console.log('='.repeat(70) + '\n');
}
