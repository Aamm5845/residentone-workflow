#!/usr/bin/env pwsh

Write-Host "🧪 Testing Resend Email Debug Endpoint..." -ForegroundColor Yellow

$body = @{
    to = "test@example.com"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/debug-email" -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "❌ Error occurred:" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    
    # Try to read the error response
    try {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorResponse = $reader.ReadToEnd()
        Write-Host "Error Response:" -ForegroundColor Red
        $errorResponse | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
    } catch {
        Write-Host "Could not parse error response: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n📝 Check your server console logs for detailed debugging information!" -ForegroundColor Blue