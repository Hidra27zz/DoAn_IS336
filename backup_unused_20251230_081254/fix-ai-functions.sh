#!/bin/bash

# Add fallback functions to all HTML files that use navigation.js

FILES=(
  "public/ai-comparison-dashboard.html"
  "public/analytics-dashboard.html"
  "public/inventory-management.html"
  "public/location-management.html"
  "public/order-management.html"
  "public/picking-operations.html"
  "public/product-management.html"
  "public/wave-planning.html"
)

FALLBACK='  <script>
    \/\/ Global fallback functions for AI widget
    window.toggleAI = window.toggleAI || function() {
      const widget = document.getElementById('\''ai-assistant-widget'\'');
      if (widget) widget.classList.toggle('\''minimized'\'');
    };
    window.refreshAI = window.refreshAI || function() {
      console.log('\''refreshAI called'\'');
    };
  <\/script>'

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if fallback already exists
    if ! grep -q "window.toggleAI = window.toggleAI" "$file"; then
      # Add fallback after navigation.js script tag
      sed -i '' "/<script src=\"\/navigation.js\"><\/script>/a\\
$FALLBACK
" "$file"
      echo "Added fallback to $file"
    else
      echo "Fallback already exists in $file"
    fi
  fi
done

echo "Done!"
