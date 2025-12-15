# Meisner FFE Clipper - Build Release Script
# This script packages the Chrome extension into a distributable ZIP file

param(
    [switch]$Production = $false
)

$ErrorActionPreference = "Stop"

# Get version from manifest
$manifestPath = Join-Path $PSScriptRoot "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

Write-Host "Building Meisner FFE Clipper v$version..." -ForegroundColor Cyan

# Set environment in popup.js based on flag
$popupJsPath = Join-Path $PSScriptRoot "popup.js"
$popupJs = Get-Content $popupJsPath -Raw

if ($Production) {
    Write-Host "Setting environment to PRODUCTION..." -ForegroundColor Yellow
    $popupJs = $popupJs -replace "const ENVIRONMENT = 'local';", "const ENVIRONMENT = 'production';"
    Set-Content $popupJsPath $popupJs
    Write-Host "Environment set to production" -ForegroundColor Green
} else {
    Write-Host "Environment: LOCAL (use -Production flag for production build)" -ForegroundColor Yellow
}

# Create output filename
$outputPath = Join-Path (Split-Path $PSScriptRoot -Parent) "meisner-ffe-clipper-v$version.zip"

# Remove existing zip if present
if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
    Write-Host "Removed existing ZIP file" -ForegroundColor Gray
}

# Files to include in the release
$filesToInclude = @(
    "manifest.json",
    "popup.html",
    "popup.js",
    "background.js",
    "content.js",
    "styles.css",
    "content-styles.css",
    "README.md",
    "icons"
)

# Create a temporary directory for clean packaging
$tempDir = Join-Path $env:TEMP "meisner-ffe-clipper-build"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy files to temp directory
foreach ($file in $filesToInclude) {
    $sourcePath = Join-Path $PSScriptRoot $file
    $destPath = Join-Path $tempDir $file
    
    if (Test-Path $sourcePath) {
        if ((Get-Item $sourcePath).PSIsContainer) {
            Copy-Item $sourcePath $destPath -Recurse
        } else {
            Copy-Item $sourcePath $destPath
        }
        Write-Host "  Added: $file" -ForegroundColor Gray
    } else {
        Write-Host "  Warning: $file not found" -ForegroundColor Yellow
    }
}

# Create ZIP from temp directory contents
Compress-Archive -Path "$tempDir\*" -DestinationPath $outputPath -Force

# Cleanup temp directory
Remove-Item $tempDir -Recurse -Force

# Reset popup.js to local if we changed it
if ($Production) {
    $popupJs = $popupJs -replace "const ENVIRONMENT = 'production';", "const ENVIRONMENT = 'local';"
    Set-Content $popupJsPath $popupJs
    Write-Host "Reset environment to local" -ForegroundColor Gray
}

# Also copy to public/downloads for web download
$publicDownloadsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "public\downloads\meisner-ffe-clipper.zip"
$publicDownloadsDir = Split-Path $publicDownloadsPath -Parent
if (-not (Test-Path $publicDownloadsDir)) {
    New-Item -ItemType Directory -Path $publicDownloadsDir -Force | Out-Null
}
Copy-Item $outputPath $publicDownloadsPath -Force
Write-Host "Copied to public/downloads for web download" -ForegroundColor Gray

# Output success
Write-Host ""
Write-Host "BUILD COMPLETE!" -ForegroundColor Green
Write-Host "Output: $outputPath" -ForegroundColor White
Write-Host "Web download: $publicDownloadsPath" -ForegroundColor White
Write-Host "Version: $version" -ForegroundColor White
Write-Host ""
Write-Host "DISTRIBUTION:" -ForegroundColor Cyan
Write-Host "1. Share the ZIP file with your team" -ForegroundColor Gray
Write-Host "2. Or they can download from /settings in the app" -ForegroundColor Gray
Write-Host "3. For updates, they replace the folder and refresh" -ForegroundColor Gray
Write-Host ""

# Return the path
return $outputPath
