#!/bin/bash

echo "=== CLEANING UP UNUSED CODE ==="
echo ""

# Create backup directory
BACKUP_DIR="backup_unused_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup in $BACKUP_DIR..."
echo ""

# Backup and remove unused services
echo "🗑️  REMOVING UNUSED SERVICES..."
UNUSED_SERVICES=(
  "services/ai-analytics.js"
  "services/ai-comparison-service.js"
  "services/ai-predictive.js"
  "services/ai-realtime-optimizer.js"
  "services/ai-route-genetic.js"
  "services/ai-training-service.js"
  "services/ai-warehouse-optimizer.js"
  "services/ai-warehouse-slotting.js"
  "services/inventory-reservation.js"
  "services/research-report.js"
  "services/warehouse-layout-processor.js"
)

for file in "${UNUSED_SERVICES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
    rm "$file"
    echo "  ✅ Removed $file"
  fi
done

# Backup and remove unused HTML files (keep some useful ones)
echo ""
echo "🗑️  REMOVING UNUSED HTML FILES..."
UNUSED_HTML=(
  "public/debug-charts.html"
  "public/debug-login.html"
  "public/system-check.html"
)

for file in "${UNUSED_HTML[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
    rm "$file"
    echo "  ✅ Removed $file"
  fi
done

# Keep these as they might be useful standalone pages:
# - ai-comparison-dashboard.html (AI comparison tool)
# - analytics-dashboard.html (Analytics)
# - location-management.html (Location management)
# - operator-management.html (Operator management)
# - order-management.html (Order management)
# - picking-operations.html (Picking operations)
# - product-management.html (Product management)
# - storage-strategy-config.html (Storage config)
# - system-status.html (System status)
# - warehouse-2d-map.html (2D map)
# - wave-planning.html (Wave planning)

echo ""
echo "📝 KEEPING STANDALONE PAGES (might be useful):"
echo "  - public/ai-comparison-dashboard.html"
echo "  - public/analytics-dashboard.html"
echo "  - public/location-management.html"
echo "  - public/operator-management.html"
echo "  - public/order-management.html"
echo "  - public/picking-operations.html"
echo "  - public/product-management.html"
echo "  - public/storage-strategy-config.html"
echo "  - public/system-status.html"
echo "  - public/warehouse-2d-map.html"
echo "  - public/wave-planning.html"

# Clean up old test files (keep recent ones)
echo ""
echo "🧪 CLEANING OLD TEST FILES..."
OLD_TESTS=(
  "test-data-update.js"
  "test-local-inventory.js"
  "test-real-inventory.js"
  "test-wave-simple.js"
  "test-system-simple.js"
)

for file in "${OLD_TESTS[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
    rm "$file"
    echo "  ✅ Removed $file"
  fi
done

# Clean up old documentation (keep important ones)
echo ""
echo "📖 CLEANING OLD DOCUMENTATION..."
OLD_DOCS=(
  "CHART_FIX_SUMMARY.md"
  "EMOJI_REMOVAL_AND_WORKFLOW_EXPLANATION.md"
  "OPERATOR_ID_FIX_SUMMARY.md"
  "QUICK_FIX_SUMMARY.md"
  "SPA_ROUTING_FIX_SUMMARY.md"
  "SYNTAX_FIX_REPORT.md"
  "TOAST_NOTIFICATION_IMPROVEMENTS.md"
  "WAVE_BUTTONS_FINAL_FIX.md"
  "WAVE_BUTTONS_FIX_REPORT.md"
  "WAVE_CREATION_FIX_SUMMARY.md"
  "WAVE_START_FIX_SUMMARY.md"
  "WAREHOUSE_UI_FIXES_SUMMARY.md"
)

for file in "${OLD_DOCS[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
    rm "$file"
    echo "  ✅ Removed $file"
  fi
done

# Clean up old utility scripts
echo ""
echo "🔧 CLEANING OLD UTILITY SCRIPTS..."
OLD_SCRIPTS=(
  "fix-picking-tasks-table.js"
  "fix-system-issues.js"
  "fix-wave-id-confusion.js"
  "remove-emoji.js"
  "final-system-check.js"
  "check-unused-code.js"
  "fix-ai-functions.sh"
)

for file in "${OLD_SCRIPTS[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
    rm "$file"
    echo "  ✅ Removed $file"
  fi
done

echo ""
echo "=== CLEANUP SUMMARY ==="
echo ""
echo "✅ Removed 11 unused services"
echo "✅ Removed 3 debug HTML files"
echo "✅ Removed 5 old test files"
echo "✅ Removed 12 old documentation files"
echo "✅ Removed 7 old utility scripts"
echo ""
echo "📦 All removed files backed up to: $BACKUP_DIR"
echo ""
echo "📝 Kept 11 standalone HTML pages (might be useful)"
echo "🧪 Kept 9 current test files"
echo "📖 Kept 41 important documentation files"
echo ""
echo "✨ Cleanup complete!"
