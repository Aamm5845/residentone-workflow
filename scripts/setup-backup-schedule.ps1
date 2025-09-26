# ResidentOne - Setup Automated Nightly Backup
# This script creates a Windows Task Scheduler job for automated daily backups

param(
    [string]$BackupTime = "2:00 AM"
)

# Configuration
$ProjectDir = "C:\Users\ADMIN\Desktop\residentone-workflow"
$TaskName = "ResidentOne-DailyBackup"
$TaskDescription = "Automated nightly backup for ResidentOne database"
$ScriptPath = "$ProjectDir\scripts\daily-backup.ps1"

Write-Host "🔧 Setting up automated nightly backup schedule..." -ForegroundColor Yellow

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator. Task creation may fail." -ForegroundColor Yellow
}

try {
    # Remove existing task if it exists
    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($ExistingTask) {
        Write-Host "🗑️ Removing existing task '$TaskName'..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    # Create the scheduled task action
    $Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

    # Create the trigger (daily at specified time)
    $Trigger = New-ScheduledTaskTrigger -Daily -At $BackupTime

    # Configure task settings
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

    # Create principal (run as current user with highest privileges)
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

    # Register the scheduled task
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $TaskDescription -Force

    Write-Host "✅ Scheduled task created successfully!" -ForegroundColor Green
    Write-Host "📅 Backup schedule: Every day at $BackupTime" -ForegroundColor Green
    Write-Host "📂 Project location: $ProjectDir" -ForegroundColor Cyan
    Write-Host "📁 Backup location: $ProjectDir\backups" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Tips:" -ForegroundColor Yellow
    Write-Host "   • View/modify the task in Task Scheduler (taskschd.msc)" -ForegroundColor Gray
    Write-Host "   • Backups are kept for 15 days (automatically cleaned up)" -ForegroundColor Gray
    Write-Host "   • Manual backup: npm run backup:full:prisma" -ForegroundColor Gray

    # Test the backup immediately
    Write-Host ""
    Write-Host "🔄 Testing backup now..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName

    Write-Host "✅ Setup completed! Check the backups folder in a few moments." -ForegroundColor Green

} catch {
    Write-Host "❌ Failed to create scheduled task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try running PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}

# Show current backup files
Write-Host ""
Write-Host "📊 Current Backup Files:" -ForegroundColor Cyan
$BackupDir = "$ProjectDir\backups"
if (Test-Path $BackupDir) {
    Get-ChildItem "$BackupDir\full-backup-*.json" -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 5 | 
        ForEach-Object {
            $Size = [math]::Round($_.Length / 1KB, 2)
            $Age = [math]::Round((New-TimeSpan -Start $_.LastWriteTime -End (Get-Date)).TotalHours, 1)
            Write-Host "  📁 $($_.Name) - $Size KB - $Age hours ago" -ForegroundColor Gray
        }
} else {
    Write-Host "  No backup files found yet" -ForegroundColor Gray
}