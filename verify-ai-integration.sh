#!/bin/bash

# AI Visual Integration Verification Script
# Kiểm tra tích hợp AI visual đã hoàn tất

echo "=================================="
echo "AI Visual Integration Verification"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check files exist
echo "1. Checking AI Visual Files..."
echo "--------------------------------"

files=(
    "public/ai-badge.css"
    "public/ai-widget.js"
    "public/ai-command-center.html"
    "public/ai-command-center.js"
    "public/index.html"
    "public/app.js"
)

all_files_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file missing"
        all_files_exist=false
    fi
done

echo ""

# Check integration in index.html
echo "2. Checking index.html Integration..."
echo "--------------------------------------"

if grep -q "ai-badge.css" public/index.html; then
    echo -e "${GREEN}✓${NC} ai-badge.css linked"
else
    echo -e "${RED}✗${NC} ai-badge.css not linked"
fi

if grep -q "ai-widget.js" public/index.html; then
    echo -e "${GREEN}✓${NC} ai-widget.js included"
else
    echo -e "${RED}✗${NC} ai-widget.js not included"
fi

if grep -q "AI Command Center" public/index.html; then
    echo -e "${GREEN}✓${NC} AI Command Center menu item added"
else
    echo -e "${RED}✗${NC} AI Command Center menu item missing"
fi

if grep -q "data-ai-section" public/index.html; then
    echo -e "${GREEN}✓${NC} data-ai-section attribute added"
else
    echo -e "${RED}✗${NC} data-ai-section attribute missing"
fi

if grep -q "btn-ai" public/index.html; then
    echo -e "${GREEN}✓${NC} btn-ai class used"
else
    echo -e "${RED}✗${NC} btn-ai class not used"
fi

echo ""

# Check app.js enhancements
echo "3. Checking app.js Enhancements..."
echo "-----------------------------------"

if grep -q "window.aiWidget" public/app.js; then
    echo -e "${GREEN}✓${NC} AI widget integration in app.js"
else
    echo -e "${RED}✗${NC} AI widget not integrated in app.js"
fi

if grep -q "showNotification" public/app.js; then
    echo -e "${GREEN}✓${NC} Notifications implemented"
else
    echo -e "${RED}✗${NC} Notifications not implemented"
fi

if grep -q "showThinking" public/app.js; then
    echo -e "${GREEN}✓${NC} Thinking indicators implemented"
else
    echo -e "${RED}✗${NC} Thinking indicators not implemented"
fi

if grep -q "ai-comparison-widget" public/app.js; then
    echo -e "${GREEN}✓${NC} Comparison widgets implemented"
else
    echo -e "${RED}✗${NC} Comparison widgets not implemented"
fi

if grep -q "showConfidence" public/app.js; then
    echo -e "${GREEN}✓${NC} Confidence scores implemented"
else
    echo -e "${RED}✗${NC} Confidence scores not implemented"
fi

echo ""

# Check CSS components
echo "4. Checking AI Badge CSS Components..."
echo "---------------------------------------"

css_components=(
    ".ai-badge"
    ".btn-ai"
    ".ai-thinking-indicator"
    ".ai-confidence"
    ".ai-suggestion"
    ".ai-comparison-widget"
    ".ai-status-indicator"
    ".ai-notification"
)

for component in "${css_components[@]}"; do
    if grep -q "$component" public/ai-badge.css; then
        echo -e "${GREEN}✓${NC} $component defined"
    else
        echo -e "${RED}✗${NC} $component missing"
    fi
done

echo ""

# Check documentation
echo "5. Checking Documentation..."
echo "-----------------------------"

docs=(
    "AI_VISUAL_INTEGRATION_COMPLETE.md"
    "AI_VISUAL_QUICK_START.md"
    "TICH_HOP_AI_HOAN_TAT.md"
    "test-ai-visual-integration.html"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✓${NC} $doc exists"
    else
        echo -e "${RED}✗${NC} $doc missing"
    fi
done

echo ""

# Check server configuration
echo "6. Checking Server Configuration..."
echo "------------------------------------"

if grep -q "express.static.*public" server.js; then
    echo -e "${GREEN}✓${NC} Static files served from public/"
else
    echo -e "${RED}✗${NC} Static files not configured"
fi

if grep -q "/api/public/ai" server.js; then
    echo -e "${GREEN}✓${NC} Public AI endpoints available"
else
    echo -e "${RED}✗${NC} Public AI endpoints missing"
fi

echo ""

# Summary
echo "=================================="
echo "Verification Summary"
echo "=================================="
echo ""

if [ "$all_files_exist" = true ]; then
    echo -e "${GREEN}✓ All required files exist${NC}"
else
    echo -e "${RED}✗ Some files are missing${NC}"
fi

echo ""
echo "Next Steps:"
echo "1. Start server: npm start"
echo "2. Open browser: http://localhost:3000"
echo "3. Login with admin/admin123"
echo "4. Check floating AI widget (bottom-right)"
echo "5. Click 'AI Command Center' in menu"
echo "6. Test AI operations in AI Optimization section"
echo ""
echo "Test Page: http://localhost:3000/test-ai-visual-integration.html"
echo ""
echo "Documentation:"
echo "- AI_VISUAL_INTEGRATION_COMPLETE.md (Technical)"
echo "- AI_VISUAL_QUICK_START.md (User Guide)"
echo "- TICH_HOP_AI_HOAN_TAT.md (Vietnamese)"
echo ""
echo "=================================="
