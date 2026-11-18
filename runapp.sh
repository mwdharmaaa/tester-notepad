#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "[*] Tester Notepad - Chrome Runner"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CHROME_BIN=""
if command -v google-chrome &>/dev/null; then
    CHROME_BIN="$(command -v google-chrome)"
elif command -v google-chrome-stable &>/dev/null; then
    CHROME_BIN="$(command -v google-chrome-stable)"
elif command -v chromium-browser &>/dev/null; then
    CHROME_BIN="$(command -v chromium-browser)"
elif command -v chromium &>/dev/null; then
    CHROME_BIN="$(command -v chromium)"
elif [[ -f "/c/Program Files/Google/Chrome/Application/chrome.exe" ]]; then
    CHROME_BIN="/c/Program Files/Google/Chrome/Application/chrome.exe"
elif [[ -f "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" ]]; then
    CHROME_BIN="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
fi

if [[ -z "$CHROME_BIN" ]]; then
  echo "[x] Google Chrome executable not found."
  exit 1
fi

DEV_PROFILE="${TEMP:-/tmp}/chrome-tester-notepad-dev"
mkdir -p "$DEV_PROFILE"

TEST_PAGE="file:///${SCRIPT_DIR}/test/test_page.html"

echo "[*] Launching Chrome with extension: ${SCRIPT_DIR}"
echo "[*] Test page: ${TEST_PAGE}"
"$CHROME_BIN" --load-extension="${SCRIPT_DIR}" --user-data-dir="${DEV_PROFILE}" --no-first-run --no-default-browser-check "${TEST_PAGE}" &

echo "[OK] Chrome dispatched successfully in background."
