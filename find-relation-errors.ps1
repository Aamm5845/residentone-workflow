# Find potential Prisma relation name mismatches
# Common pattern: include: { lowercase: ... } should be include: { Capitalized: ... }

Write-Host "🔍 Searching for potential relation name mismatches..." -ForegroundColor Cyan
Write-Host ""

$patterns = @(
    "include.*\{.*room:",
    "include.*\{.*project:",
    "include.*\{.*user:",
    "include.*\{.*stage:",
    "include.*\{.*client:",
    "include.*\{.*asset:",
    "\.room\.",
    "\.project\.",
    "\.user\.",
    "\.stage\.",
    "\.client\.",
    "\.asset\."
)

foreach ($pattern in $patterns) {
    $results = Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern $pattern | Select-Object -First 5
    if ($results) {
        Write-Host "Found pattern: $pattern" -ForegroundColor Yellow
        $results | ForEach-Object {
            Write-Host "  $($_.Path):$($_.LineNumber)" -ForegroundColor Gray
        }
        Write-Host ""
    }
}

Write-Host "✅ Search complete!" -ForegroundColor Green
