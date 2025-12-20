#!/usr/bin/env node

/**
 * Quick Start Script for WMS System
 * Automatically starts server and opens auto test dashboard
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 WMS SYSTEM QUICK START\n');

// Check if port 3000 is available
const net = require('net');
const server = net.createServer();

server.listen(3000, () => {
  server.close();
  startSystem();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('⚠️ Port 3000 is already in use');
    console.log('🔄 Trying to kill existing process...');
    
    // Kill existing process on port 3000
    const killProcess = spawn('lsof', ['-ti:3000']);
    killProcess.stdout.on('data', (data) => {
      const pid = data.toString().trim();
      if (pid) {
        spawn('kill', ['-9', pid]);
        console.log(`✅ Killed process ${pid}`);
        setTimeout(startSystem, 2000);
      }
    });
    
    killProcess.on('error', () => {
      console.log('❌ Could not kill existing process');
      console.log('💡 Please manually stop the process on port 3000 and try again');
      process.exit(1);
    });
  } else {
    startSystem();
  }
});

function startSystem() {
  console.log('📦 Starting WMS System...\n');
  
  // Start the server
  const serverProcess = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
  // Wait for server to start
  setTimeout(() => {
    console.log('\n🌐 Server started on http://localhost:3000');
    console.log('🧪 Opening Auto Test Dashboard...\n');
    
    // Open browser to auto test dashboard
    const open = require('child_process').spawn;
    const url = 'http://localhost:3000/test';
    
    // Detect OS and open browser
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin') {
      command = 'open';
    } else if (platform === 'win32') {
      command = 'start';
    } else {
      command = 'xdg-open';
    }
    
    try {
      open(command, [url], { stdio: 'ignore' });
      console.log(`🎯 Auto Test Dashboard opened: ${url}`);
    } catch (error) {
      console.log(`💡 Please manually open: ${url}`);
    }
    
    console.log('\n📋 QUICK ACTIONS:');
    console.log('  🏠 Dashboard: http://localhost:3000/dashboard');
    console.log('  🧪 Auto Test: http://localhost:3000/test');
    console.log('  🤖 AI System: http://localhost:3000/ai');
    console.log('  🗺️ 2D Map: http://localhost:3000/warehouse/2d');
    console.log('  🏢 3D View: http://localhost:3000/warehouse/3d');
    
    console.log('\n🔑 DEFAULT LOGIN:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    
    console.log('\n⌨️ KEYBOARD SHORTCUTS (in Auto Test):');
    console.log('  Ctrl+Enter: Start Auto Test');
    console.log('  Esc: Stop Test');
    console.log('  Ctrl+R: Reset Tests');
    
    console.log('\n🛑 To stop the server: Ctrl+C');
    
  }, 3000);
  
  // Handle server process exit
  serverProcess.on('exit', (code) => {
    console.log(`\n🛑 Server process exited with code ${code}`);
    process.exit(code);
  });
  
  // Handle script termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down WMS System...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
}

// Show help if needed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('WMS System Quick Start Script\n');
  console.log('Usage: node scripts/quick-start.js [options]\n');
  console.log('Options:');
  console.log('  --help, -h    Show this help message');
  console.log('  --no-browser  Don\'t open browser automatically');
  console.log('\nThis script will:');
  console.log('  1. Check and kill any existing process on port 3000');
  console.log('  2. Start the WMS server');
  console.log('  3. Open the Auto Test Dashboard in your browser');
  console.log('  4. Display quick access URLs and shortcuts');
  process.exit(0);
}