const fs = require('fs');
const path = require('path');

// List of files to clean
const filesToClean = [
  'METRICS_CALCULATION_REPORT.md',
  'HUONG_DAN_SU_DUNG_CHI_TIET.md',
  'SYSTEM_EVALUATION_REPORT.md',
  'SYSTEM_WORKFLOWS_GUIDE.md',
  'FINAL_METRICS_REPORT.md',
  'CHART_FIX_SUMMARY.md',
  'WAREHOUSE_REDESIGN_SUMMARY.md'
];

// Common emoji patterns to remove
const emojiPatterns = [
  /📋/g, /📥/g, /📤/g, /🔄/g, /📍/g, /📊/g, /🏢/g, /🎯/g, /📦/g, /⚙️/g,
  /🤖/g, /📱/g, /🔧/g, /🚨/g, /✅/g, /❌/g, /⚠️/g, /ℹ️/g, /🗺️/g, /👤/g,
  /🔑/g, /🚀/g, /🏠/g, /🛒/g, /🚚/g, /🏭/g, /👥/g, /🔍/g, /🎉/g
];

function removeEmojisFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Remove all emoji patterns
    emojiPatterns.forEach(pattern => {
      content = content.replace(pattern, '');
    });

    // Clean up extra spaces
    content = content.replace(/\s+/g, ' ');
    content = content.replace(/^\s+/gm, '');
    content = content.replace(/\s+$/gm, '');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Cleaned emojis from: ${filePath}`);
    } else {
      console.log(`- No emojis found in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

console.log('Removing emojis from markdown files...\n');

filesToClean.forEach(file => {
  removeEmojisFromFile(file);
});

console.log('\nEmoji removal completed!');