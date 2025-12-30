// Verify All Fixes Are Applied
const fs = require('fs');

console.log('🔍 Verifying All Fixes...\n');

const checks = [];

// Check 1: Low Stock Alert in app.js
const appJs = fs.readFileSync('public/app.js', 'utf8');
if (appJs.includes('low-stock-alert') && appJs.includes('very-low-stock')) {
  checks.push({ name: 'Low Stock Alerts', status: '✅ FOUND' });
} else {
  checks.push({ name: 'Low Stock Alerts', status: '❌ MISSING' });
}

// Check 2: Customer Name Fix
if (appJs.includes('customer_name: customerValue')) {
  checks.push({ name: 'Order Creation Fix', status: '✅ FOUND' });
} else {
  checks.push({ name: 'Order Creation Fix', status: '❌ MISSING' });
}

// Check 3: Wave Orders Fix
if (appJs.includes('data-items="${o.total_items')) {
  checks.push({ name: 'Wave Creation Fix', status: '✅ FOUND' });
} else {
  checks.push({ name: 'Wave Creation Fix', status: '❌ MISSING' });
}

// Check 4: AI Insights in Reports
if (appJs.includes('AI INSIGHTS & RECOMMENDATIONS')) {
  checks.push({ name: 'AI Prominence', status: '✅ FOUND' });
} else {
  checks.push({ name: 'AI Prominence', status: '❌ MISSING' });
}

// Check 5: CSS Styles
const stylesCSS = fs.readFileSync('public/styles.css', 'utf8');
if (stylesCSS.includes('.low-stock-alert')) {
  checks.push({ name: 'Alert CSS Styles', status: '✅ FOUND' });
} else {
  checks.push({ name: 'Alert CSS Styles', status: '❌ MISSING' });
}

// Display Results
console.log('Verification Results:');
console.log('='.repeat(60));
checks.forEach(check => {
  console.log(`${check.status} ${check.name}`);
});
console.log('='.repeat(60));

const allPassed = checks.every(c => c.status.includes('✅'));

if (allPassed) {
  console.log('\n✅ All fixes are in place!');
  console.log('\n⚠️  IMPORTANT: You must restart the server and refresh browser:');
  console.log('   1. Stop server (Ctrl+C)');
  console.log('   2. Start server: npm start');
  console.log('   3. Refresh browser (Ctrl+Shift+R or Cmd+Shift+R)');
  console.log('   4. Clear browser cache if needed\n');
} else {
  console.log('\n❌ Some fixes are missing. Re-applying...\n');
}

process.exit(allPassed ? 0 : 1);
