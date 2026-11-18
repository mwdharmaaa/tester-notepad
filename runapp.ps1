# Tester Notepad - Chrome Runner (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[*] Tester Notepad - Chrome Runner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$chromeCandidates = @(
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:LocalAppData}\Google\Chrome\Application\chrome.exe"
)

$chromeBin = $null
foreach ($path in $chromeCandidates) {
  if (Test-Path $path) {
    $chromeBin = $path
    break
  }
}

if (-not $chromeBin) {
  try {
    $chromeBin = (Get-Command chrome -ErrorAction SilentlyContinue).Source
  } catch {}
}

if (-not $chromeBin) {
  Write-Host "[x] Google Chrome executable not found on Windows path." -ForegroundColor Red
  exit 1
}

$tempProfile = Join-Path $env:TEMP "chrome-tester-notepad-dev"
if (-not (Test-Path $tempProfile)) {
  New-Item -ItemType Directory -Path $tempProfile | Out-Null
}

$testPage = "file:///$($scriptDir.Replace('\', '/'))/test/test_page.html"
$dashPage = "chrome://newtab"

Write-Host "[*] Launching Chrome with unpacked extension..." -ForegroundColor Yellow
Start-Process -FilePath $chromeBin -ArgumentList "--load-extension=`"$scriptDir`"", "--user-data-dir=`"$tempProfile`"", "--no-first-run", "--no-default-browser-check", "`"$dashPage`"", "`"$testPage`""

Write-Host "[OK] Chrome launched successfully." -ForegroundColor Green
