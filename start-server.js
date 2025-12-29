// Simple server starter
const { spawn } = require('child_process');

console.log('🚀 Starting warehouse management server...');

// Set environment variables for development
process.env.AUTO_FIX_INVENTORY = 'true';
process.env.NODE_ENV = 'development';

const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env }
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  server.kill('SIGINT');
  process.exit(0);
});

console.log('✅ Server starting... Check http://localhost:3000');
console.log('🔧 AUTO_FIX_INVENTORY enabled for development');
console.log('Press Ctrl+C to stop');