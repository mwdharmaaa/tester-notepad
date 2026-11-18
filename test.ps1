# Tester Notepad - PowerShell Test Suite
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[*] Tester Notepad - Test Suite (PowerShell)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$requiredFiles = @(
  "manifest.json",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "background/background.js",
  "content/content.js",
  "content/content.css",
  "dashboard/dashboard.html",
  "dashboard/dashboard.css",
  "dashboard/dashboard.js",
  "sidepanel/sidepanel.html",
  "sidepanel/sidepanel.css",
  "sidepanel/sidepanel.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "test/test_page.html"
)

$errors = 0
foreach ($f in $requiredFiles) {
  if (Test-Path $f) {
    Write-Host "[OK] Found: $f" -ForegroundColor Green
  } else {
    Write-Host "[x] Missing required file: $f" -ForegroundColor Red
    $errors++
  }
}

try {
  $null = Get-Content "manifest.json" -Raw | ConvertFrom-Json
  Write-Host "[OK] manifest.json is valid JSON." -ForegroundColor Green
} catch {
  Write-Host "[x] manifest.json contains syntax errors: $_" -ForegroundColor Red
  $errors++
}

if ($errors -gt 0) {
  Write-Host "[-] Test failed: $errors error(s) found." -ForegroundColor Red
  exit 1
}

Write-Host "[OK] All components verified successfully." -ForegroundColor Green
