# ResidentOne Daily Backup Script
# This script creates automated backups and can be scheduled via Windows Task Scheduler

param(
    [switch]$SetupSchedule
)

# Configuration
$ProjectDir = "C:\Users\ADMIN\OneDrive\Desktop\residentone-workflow"
$BackupDir = "$ProjectDir\backups"
$LogFile = "$BackupDir\backup-log.txt"

# Ensure backup directory exists
if (!(Test-Path $BackupDir)) {
    New-Item -Path $BackupDir -ItemType Directory -Force | Out-Null
    Write-Host "📁 Created backup directory: $BackupDir"
}

# Function to write log entries
function Write-Log {
    param($Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "$Timestamp - $Message"
    Add-Content -Path $LogFile -Value $LogEntry
    Write-Host $LogEntry
}

# Function to perform backup
function Perform-Backup {
    Write-Log "🔄 Starting scheduled backup..."
    
    try {
        # Change to project directory
        Set-Location $ProjectDir
        
        # Run the new Prisma backup script
        $Result = & node "scripts\prisma-backup.js" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ Backup completed successfully"
            Write-Log "Output: $Result"
        } else {
            Write-Log "❌ Backup failed with exit code $LASTEXITCODE"
            Write-Log "Error: $Result"
            
            # Send notification (optional - requires Windows 10/11)
            try {
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
                $Template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
                $Template.SelectSingleNode('//text[@id="1"]').AppendChild($Template.CreateTextNode("ResidentOne Backup Failed"))
                $Template.SelectSingleNode('//text[@id="2"]').AppendChild($Template.CreateTextNode("Check backup log for details"))
                $Toast = [Windows.UI.Notifications.ToastNotification]::new($Template)
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("ResidentOne").Show($Toast)
            } catch {
                # Fallback notification method
                Write-EventLog -LogName Application -Source "ResidentOne" -EventId 1001 -EntryType Warning -Message "Database backup failed: $Result" -ErrorAction SilentlyContinue
            }
        }
    } catch {
        Write-Log "❌ Backup script execution failed: $($_.Exception.Message)"
    }
    
    Write-Log "📝 Backup process completed"
}

# Function to setup Windows Task Scheduler
function Setup-Schedule {
    Write-Host "🔧 Setting up automated daily backup schedule..."
    
    $TaskName = "ResidentOne-DailyBackup"
    $TaskDescription = "Daily backup for ResidentOne project database"
    $ScriptPath = "$ProjectDir\scripts\daily-backup.ps1"
    
    # Check if task already exists
    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($ExistingTask) {
        Write-Host "⚠️ Task '$TaskName' already exists. Updating..."
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    
    # Create action
    $Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$ScriptPath`""
    
    # Create trigger (daily at 2 AM)
    $Trigger = New-ScheduledTaskTrigger -Daily -At "2:00 AM"
    
    # Create settings
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    # Create principal (run as current user)
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
    
    # Register the task
    try {
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description $TaskDescription
        Write-Host "✅ Scheduled task created successfully!"
        Write-Host "📅 Backups will run daily at 2:00 AM"
        Write-Host "💡 You can modify the schedule in Task Scheduler (taskschd.msc)"
        
        # Test the task immediately
        Write-Host "🔄 Testing backup task..."
        Start-ScheduledTask -TaskName $TaskName
        
    } catch {
        Write-Host "❌ Failed to create scheduled task: $($_.Exception.Message)"
        Write-Host "💡 Try running as Administrator"
    }
}

# Main execution
if ($SetupSchedule) {
    Setup-Schedule
} else {
    Perform-Backup
}

# Display recent backup info
Write-Host "`n📊 Recent Backups:"
if (Test-Path $BackupDir) {
    Get-ChildItem "$BackupDir\full-backup-*.json", "$BackupDir\database-backup-*.sql", "$BackupDir\database-backup-*.json" -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 10 | 
        ForEach-Object {
            $Size = [math]::Round($_.Length / 1KB, 2)
            Write-Host "  📁 $($_.Name) - $Size KB - $($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))"
        }
} else {
    Write-Host "  No backups found yet"
}
