const fs = require('fs');
const path = require('path');

const results = {
  unusedFiles: [],
  duplicateFiles: [],
  unusedRoutes: [],
  unusedServices: [],
  testFiles: [],
  docFiles: []
};

// Check routes
console.log('=== CHECKING ROUTES ===\n');
const routesDir = './routes';
const serverContent = fs.readFileSync('./server.js', 'utf8');

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const routeName = file.replace('.js', '');
    const isUsed = serverContent.includes(`require('./routes/${routeName}')`);
    console.log(`${isUsed ? '✅' : '❌'} routes/${file} - ${isUsed ? 'USED' : 'NOT USED'}`);
    if (!isUsed) results.unusedRoutes.push(`routes/${file}`);
  }
});

// Check services
console.log('\n=== CHECKING SERVICES ===\n');
const servicesDir = './services';
const allJsFiles = [];

function findJsFiles(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory() && !fullPath.includes('node_modules')) {
      findJsFiles(fullPath);
    } else if (file.endsWith('.js')) {
      allJsFiles.push(fullPath);
    }
  });
}

findJsFiles('./routes');
findJsFiles('./');

const allCode = allJsFiles.map(f => {
  try { return fs.readFileSync(f, 'utf8'); } catch(e) { return ''; }
}).join('\n');

fs.readdirSync(servicesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const serviceName = file.replace('.js', '');
    const isUsed = allCode.includes(`require('./services/${serviceName}')`) || 
                   allCode.includes(`require('../services/${serviceName}')`);
    console.log(`${isUsed ? '✅' : '❌'} services/${file} - ${isUsed ? 'USED' : 'NOT USED'}`);
    if (!isUsed) results.unusedServices.push(`services/${file}`);
  }
});

// Check public HTML files
console.log('\n=== CHECKING PUBLIC HTML FILES ===\n');
const publicDir = './public';
const indexContent = fs.readFileSync('./public/index.html', 'utf8');

fs.readdirSync(publicDir).forEach(file => {
  if (file.endsWith('.html') && file !== 'index.html') {
    const isLinked = indexContent.includes(file) || 
                     allCode.includes(file) ||
                     file.includes('demo') ||
                     file.includes('test') ||
                     file.includes('enhanced') ||
                     file.includes('explained');
    
    const status = isLinked ? '✅ LINKED' : 
                   file.includes('demo') ? '🔧 DEMO' :
                   file.includes('test') ? '🧪 TEST' :
                   file.includes('enhanced') ? '📦 ENHANCED' :
                   file.includes('explained') ? '📖 DOC' :
                   '❓ STANDALONE';
    
    console.log(`${status} - public/${file}`);
    
    if (!isLinked && !file.includes('demo') && !file.includes('test') && 
        !file.includes('enhanced') && !file.includes('explained')) {
      results.unusedFiles.push(`public/${file}`);
    }
  }
});

// Check test files
console.log('\n=== TEST FILES ===\n');
fs.readdirSync('.').forEach(file => {
  if ((file.startsWith('test-') || file.includes('test')) && file.endsWith('.js')) {
    console.log(`🧪 ${file}`);
    results.testFiles.push(file);
  }
});

// Check documentation files
console.log('\n=== DOCUMENTATION FILES ===\n');
fs.readdirSync('.').forEach(file => {
  if (file.endsWith('.md') && file !== 'README.md') {
    console.log(`📖 ${file}`);
    results.docFiles.push(file);
  }
});

// Check scripts
console.log('\n=== CHECKING SCRIPTS ===\n');
fs.readdirSync('.').forEach(file => {
  if (file.endsWith('.js') && !file.includes('test') && 
      file !== 'server.js' && file !== 'start-server.js') {
    const isUtility = file.includes('generate') || file.includes('fix') || 
                      file.includes('clear') || file.includes('reset') ||
                      file.includes('verify') || file.includes('remove');
    console.log(`${isUtility ? '🔧' : '❓'} ${file} - ${isUtility ? 'UTILITY' : 'CHECK'}`);
  }
});

// Summary
console.log('\n=== SUMMARY ===\n');
console.log(`Unused Routes: ${results.unusedRoutes.length}`);
console.log(`Unused Services: ${results.unusedServices.length}`);
console.log(`Unused HTML Files: ${results.unusedFiles.length}`);
console.log(`Test Files: ${results.testFiles.length}`);
console.log(`Documentation Files: ${results.docFiles.length}`);

if (results.unusedRoutes.length > 0) {
  console.log('\n⚠️  UNUSED ROUTES:');
  results.unusedRoutes.forEach(r => console.log(`  - ${r}`));
}

if (results.unusedServices.length > 0) {
  console.log('\n⚠️  UNUSED SERVICES:');
  results.unusedServices.forEach(s => console.log(`  - ${s}`));
}

if (results.unusedFiles.length > 0) {
  console.log('\n⚠️  UNUSED HTML FILES:');
  results.unusedFiles.forEach(f => console.log(`  - ${f}`));
}
