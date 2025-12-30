// Test API URL Construction
// Verify that apiCall constructs URLs correctly

console.log('='.repeat(60));
console.log('API URL CONSTRUCTION TEST');
console.log('='.repeat(60));
console.log('');

const API_BASE = '/api';

function cleanEndpoint(endpoint) {
  return endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
}

function constructURL(endpoint) {
  const clean = cleanEndpoint(endpoint);
  return `${API_BASE}${clean}`;
}

// Test cases
const testCases = [
  { input: '/orders', expected: '/api/orders' },
  { input: '/api/orders', expected: '/api/orders' },
  { input: '/inventory', expected: '/api/inventory' },
  { input: '/api/inventory', expected: '/api/inventory' },
  { input: '/waves', expected: '/api/waves' },
  { input: '/api/waves', expected: '/api/waves' },
  { input: '/ai/clustering/kmeans', expected: '/api/ai/clustering/kmeans' },
  { input: '/api/ai/clustering/kmeans', expected: '/api/ai/clustering/kmeans' },
  { input: '/picking/tasks', expected: '/api/picking/tasks' },
  { input: '/api/picking/tasks', expected: '/api/picking/tasks' }
];

let passed = 0;
let failed = 0;

console.log('Running tests...\n');

testCases.forEach((test, index) => {
  const result = constructURL(test.input);
  const success = result === test.expected;
  
  if (success) {
    passed++;
    console.log(`✓ Test ${index + 1}: PASS`);
  } else {
    failed++;
    console.log(`✗ Test ${index + 1}: FAIL`);
    console.log(`  Input:    ${test.input}`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Got:      ${result}`);
  }
});

console.log('');
console.log('='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

// Test for common mistakes
console.log('');
console.log('Common Mistake Tests:');
console.log('-'.repeat(60));

const mistakes = [
  { input: 'orders', note: 'Missing leading slash' },
  { input: '/api/api/orders', note: 'Double /api prefix' },
  { input: 'api/orders', note: 'Missing leading slash' }
];

mistakes.forEach(mistake => {
  const result = constructURL(mistake.input);
  console.log(`Input: "${mistake.input}" (${mistake.note})`);
  console.log(`Result: "${result}"`);
  console.log('');
});

process.exit(failed > 0 ? 1 : 0);
