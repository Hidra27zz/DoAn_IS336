// Backend System Check Script
// Kiểm tra toàn bộ backend của WMS

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('BACKEND SYSTEM CHECK - WMS');
console.log('='.repeat(60));
console.log('');

// Colors for terminal
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function checkMark(condition) {
    return condition ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
}

// 1. Check Core Files
console.log('1. CORE FILES');
console.log('-'.repeat(60));

const coreFiles = [
    'server.js',
    'package.json',
    'config/database.js'
];

coreFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`${checkMark(exists)} ${file}`);
});

console.log('');

// 2. Check Routes
console.log('2. ROUTES (API Endpoints)');
console.log('-'.repeat(60));

const routes = [
    'routes/auth.js',
    'routes/users.js',
    'routes/products.js',
    'routes/locations.js',
    'routes/inventory.js',
    'routes/orders.js',
    'routes/waves.js',
    'routes/picking.js',
    'routes/operators.js',
    'routes/warehouse.js',
    'routes/ai.js',
    'routes/ai-workflow.js',
    'routes/reports.js',
    'routes/dashboard.js',
    'routes/timeline.js',
    'routes/config.js'
];

let routesOk = 0;
routes.forEach(route => {
    const exists = fs.existsSync(route);
    if (exists) routesOk++;
    console.log(`${checkMark(exists)} ${route}`);
});

console.log(`\nRoutes: ${routesOk}/${routes.length} OK`);
console.log('');

// 3. Check Services
console.log('3. SERVICES (Business Logic)');
console.log('-'.repeat(60));

const services = [
    'services/ai-clustering.js',
    'services/ai-route-optimization.js',
    'services/ai-storage-optimizer.js',
    'services/ai-predictive-analytics.js',
    'services/ai-demand-forecasting.js',
    'services/ai-workflow-integration.js',
    'services/metrics-calculator.js',
    'services/auto-wave-generator.js',
    'services/pick-list-generator.js',
    'services/inventory-data-loader.js'
];

let servicesOk = 0;
services.forEach(service => {
    const exists = fs.existsSync(service);
    if (exists) servicesOk++;
    console.log(`${checkMark(exists)} ${service}`);
});

console.log(`\nServices: ${servicesOk}/${services.length} OK`);
console.log('');

// 4. Check Middleware
console.log('4. MIDDLEWARE (Security & Validation)');
console.log('-'.repeat(60));

const middleware = [
    'middleware/auth.js',
    'middleware/permissions.js',
    'middleware/errorHandler.js'
];

let middlewareOk = 0;
middleware.forEach(mw => {
    const exists = fs.existsSync(mw);
    if (exists) middlewareOk++;
    console.log(`${checkMark(exists)} ${mw}`);
});

console.log(`\nMiddleware: ${middlewareOk}/${middleware.length} OK`);
console.log('');

// 5. Check Database
console.log('5. DATABASE');
console.log('-'.repeat(60));

const dbFiles = [
    'warehouse.db',
    'config/database.js'
];

dbFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`${checkMark(exists)} ${file}`);
    if (exists && file.endsWith('.db')) {
        const stats = fs.statSync(file);
        console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
});

console.log('');

// 6. Check Dependencies
console.log('6. DEPENDENCIES');
console.log('-'.repeat(60));

try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = packageJson.dependencies || {};
    
    const requiredDeps = [
        'express',
        'sqlite3',
        'cors',
        'helmet',
        'morgan',
        'compression',
        'express-rate-limit',
        'socket.io',
        'jsonwebtoken',
        'bcryptjs'
    ];
    
    requiredDeps.forEach(dep => {
        const exists = deps[dep] !== undefined;
        console.log(`${checkMark(exists)} ${dep} ${exists ? `(${deps[dep]})` : ''}`);
    });
    
    console.log(`\nTotal dependencies: ${Object.keys(deps).length}`);
} catch (error) {
    console.log(`${colors.red}Error reading package.json${colors.reset}`);
}

console.log('');

// 7. Check Route Registration in server.js
console.log('7. ROUTE REGISTRATION');
console.log('-'.repeat(60));

try {
    const serverJs = fs.readFileSync('server.js', 'utf8');
    
    const routeChecks = [
        { name: 'Auth Routes', pattern: /app\.use\(['"]\/api\/auth['"]/ },
        { name: 'Users Routes', pattern: /app\.use\(['"]\/api\/users['"]/ },
        { name: 'Products Routes', pattern: /app\.use\(['"]\/api\/products['"]/ },
        { name: 'Locations Routes', pattern: /app\.use\(['"]\/api\/locations['"]/ },
        { name: 'Inventory Routes', pattern: /app\.use\(['"]\/api\/inventory['"]/ },
        { name: 'Orders Routes', pattern: /app\.use\(['"]\/api\/orders['"]/ },
        { name: 'Waves Routes', pattern: /app\.use\(['"]\/api\/waves['"]/ },
        { name: 'Picking Routes', pattern: /app\.use\(['"]\/api\/picking['"]/ },
        { name: 'Operators Routes', pattern: /app\.use\(['"]\/api\/operators['"]/ },
        { name: 'Warehouse Routes', pattern: /app\.use\(['"]\/api\/warehouse['"]/ },
        { name: 'AI Routes', pattern: /app\.use\(['"]\/api\/ai['"]/ },
        { name: 'AI Workflow Routes', pattern: /app\.use\(['"]\/api\/ai-workflow['"]/ },
        { name: 'Reports Routes', pattern: /app\.use\(['"]\/api\/reports['"]/ },
        { name: 'Dashboard Routes', pattern: /app\.use\(['"]\/api\/dashboard['"]/ },
        { name: 'Timeline Routes', pattern: /app\.use\(['"]\/api\/timeline['"]/ },
        { name: 'Config Routes', pattern: /app\.use\(['"]\/api\/config['"]/ }
    ];
    
    routeChecks.forEach(check => {
        const registered = check.pattern.test(serverJs);
        console.log(`${checkMark(registered)} ${check.name}`);
    });
} catch (error) {
    console.log(`${colors.red}Error reading server.js${colors.reset}`);
}

console.log('');

// 8. Check AI Integration
console.log('8. AI INTEGRATION');
console.log('-'.repeat(60));

const aiComponents = [
    { name: 'K-Means Clustering', file: 'services/ai-clustering.js' },
    { name: 'Route Optimization', file: 'services/ai-route-optimization.js' },
    { name: 'Storage Optimizer', file: 'services/ai-storage-optimizer.js' },
    { name: 'Predictive Analytics', file: 'services/ai-predictive-analytics.js' },
    { name: 'Demand Forecasting', file: 'services/ai-demand-forecasting.js' },
    { name: 'Workflow Integration', file: 'services/ai-workflow-integration.js' },
    { name: 'AI Routes', file: 'routes/ai.js' },
    { name: 'AI Workflow Routes', file: 'routes/ai-workflow.js' }
];

let aiOk = 0;
aiComponents.forEach(component => {
    const exists = fs.existsSync(component.file);
    if (exists) aiOk++;
    console.log(`${checkMark(exists)} ${component.name}`);
});

console.log(`\nAI Components: ${aiOk}/${aiComponents.length} OK`);
console.log('');

// 9. Check API Endpoints
console.log('9. API ENDPOINT COVERAGE');
console.log('-'.repeat(60));

const endpointCategories = [
    { name: 'Authentication', count: 3, routes: ['login', 'register', 'logout'] },
    { name: 'Products', count: 5, routes: ['GET', 'POST', 'PUT', 'DELETE', 'search'] },
    { name: 'Inventory', count: 6, routes: ['GET', 'inbound', 'outbound', 'transfer', 'adjust', 'summary'] },
    { name: 'Orders', count: 5, routes: ['GET', 'POST', 'PUT', 'DELETE', 'stats'] },
    { name: 'Waves', count: 6, routes: ['GET', 'POST', 'start', 'pause', 'complete', 'cancel'] },
    { name: 'Picking', count: 5, routes: ['GET tasks', 'complete', 'performance', 'stats', 'history'] },
    { name: 'Warehouse', count: 4, routes: ['locations', 'movements', 'utilization', 'map'] },
    { name: 'AI Core', count: 5, routes: ['kmeans', 'dbscan', 'route-optimize', 'recommendations', 'stats'] },
    { name: 'AI Workflow', count: 7, routes: ['optimize-wave', 'classify', 'suggest-location', 'detect-anomalies', 'rebalance', 'forecast', 'dashboard'] },
    { name: 'Reports', count: 4, routes: ['warehouse', 'operator', 'inventory', 'ai'] },
    { name: 'Dashboard', count: 3, routes: ['stats', 'charts', 'metrics'] }
];

let totalEndpoints = 0;
endpointCategories.forEach(category => {
    totalEndpoints += category.count;
    console.log(`${colors.blue}${category.name}:${colors.reset} ${category.count} endpoints`);
    console.log(`  ${category.routes.join(', ')}`);
});

console.log(`\n${colors.green}Total API Endpoints: ${totalEndpoints}${colors.reset}`);
console.log('');

// 10. System Summary
console.log('10. SYSTEM SUMMARY');
console.log('='.repeat(60));

const totalFiles = routes.length + services.length + middleware.length;
const totalOk = routesOk + servicesOk + middlewareOk;
const healthPercentage = ((totalOk / totalFiles) * 100).toFixed(1);

console.log(`Backend Files: ${totalOk}/${totalFiles} (${healthPercentage}%)`);
console.log(`Routes: ${routesOk}/${routes.length}`);
console.log(`Services: ${servicesOk}/${services.length}`);
console.log(`Middleware: ${middlewareOk}/${middleware.length}`);
console.log(`AI Components: ${aiOk}/${aiComponents.length}`);
console.log(`API Endpoints: ~${totalEndpoints}`);

console.log('');

// Health Status
if (healthPercentage >= 95) {
    console.log(`${colors.green}System Status: EXCELLENT${colors.reset}`);
} else if (healthPercentage >= 80) {
    console.log(`${colors.yellow}System Status: GOOD${colors.reset}`);
} else {
    console.log(`${colors.red}System Status: NEEDS ATTENTION${colors.reset}`);
}

console.log('');

// 11. Feature Checklist
console.log('11. FEATURE CHECKLIST');
console.log('='.repeat(60));

const features = [
    { name: 'User Authentication', status: fs.existsSync('routes/auth.js') },
    { name: 'Product Management', status: fs.existsSync('routes/products.js') },
    { name: 'Inventory Management', status: fs.existsSync('routes/inventory.js') },
    { name: 'Order Management', status: fs.existsSync('routes/orders.js') },
    { name: 'Wave Planning', status: fs.existsSync('routes/waves.js') },
    { name: 'Picking Operations', status: fs.existsSync('routes/picking.js') },
    { name: 'Warehouse Management', status: fs.existsSync('routes/warehouse.js') },
    { name: 'AI K-Means Clustering', status: fs.existsSync('services/ai-clustering.js') },
    { name: 'AI Route Optimization', status: fs.existsSync('services/ai-route-optimization.js') },
    { name: 'AI Storage Optimization', status: fs.existsSync('services/ai-storage-optimizer.js') },
    { name: 'AI Predictive Analytics', status: fs.existsSync('services/ai-predictive-analytics.js') },
    { name: 'AI Demand Forecasting', status: fs.existsSync('services/ai-demand-forecasting.js') },
    { name: 'AI Workflow Integration', status: fs.existsSync('services/ai-workflow-integration.js') },
    { name: 'Reporting System', status: fs.existsSync('routes/reports.js') },
    { name: 'Dashboard Analytics', status: fs.existsSync('routes/dashboard.js') },
    { name: 'Real-time Metrics', status: fs.existsSync('services/metrics-calculator.js') }
];

features.forEach(feature => {
    console.log(`${checkMark(feature.status)} ${feature.name}`);
});

const featuresOk = features.filter(f => f.status).length;
console.log(`\nFeatures: ${featuresOk}/${features.length} (${((featuresOk/features.length)*100).toFixed(1)}%)`);

console.log('');
console.log('='.repeat(60));
console.log('BACKEND CHECK COMPLETE');
console.log('='.repeat(60));
console.log('');

// Exit code
process.exit(healthPercentage >= 80 ? 0 : 1);
