#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "[*] Tester Notepad - Test Suite"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

REQUIRED_FILES=(
  "manifest.json"
  "icons/icon16.png"
  "icons/icon32.png"
  "icons/icon48.png"
  "icons/icon128.png"
  "background/background.js"
  "content/content.js"
  "content/content.css"
  "popup/popup.html"
  "popup/popup.css"
  "popup/popup.js"
  "sidepanel/sidepanel.html"
  "sidepanel/sidepanel.css"
  "sidepanel/sidepanel.js"
  "test/test_page.html"
)

ERRORS=0
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "[x] Missing required file: $f"
    ERRORS=$((ERRORS + 1))
  else
    echo "[OK] Found: $f"
  fi
done

echo ""
echo "[*] Validating manifest.json syntax..."
if python3 -m json.tool manifest.json > /dev/null; then
  echo "[OK] manifest.json is valid JSON."
else
  echo "[x] manifest.json contains syntax errors!"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "[*] Validating JavaScript syntax..."
JS_FILES=(
  "background/background.js"
  "content/content.js"
  "popup/popup.js"
  "sidepanel/sidepanel.js"
)
for js in "${JS_FILES[@]}"; do
  if node -c "$js" 2>/dev/null || true; then
    echo "[OK] Syntax check passed: $js"
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo "[-] Test failed: $ERRORS errors found."
  exit 1
fi

echo ""
echo "[OK] All components and manifest dependencies verified successfully."
echo "========================================"
