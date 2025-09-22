$body = @{
    to = "aamm5845@gmail.com"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/debug-email" -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "Success!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "Status Code:" $_.Exception.Response.StatusCode -ForegroundColor Red
        
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorResponse = $reader.ReadToEnd()
            Write-Host "Error Response:" -ForegroundColor Red
            $errorResponse | Write-Host
        } catch {
            Write-Host "Could not parse error response" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Check your server console logs for detailed debugging information!" -ForegroundColor Blue