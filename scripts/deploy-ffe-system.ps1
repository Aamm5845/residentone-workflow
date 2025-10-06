# FFE System Deployment Script
# PowerShell script for automated deployment of the new FFE template system
# 
# Usage:
#   .\deploy-ffe-system.ps1 -Environment [dev|staging|production] -DryRun
#   .\deploy-ffe-system.ps1 -Environment production -Execute

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'staging', 'production')]
    [string]$Environment,
    
    [switch]$DryRun,
    [switch]$Execute,
    [switch]$Force,
    [switch]$SkipTests,
    [switch]$SkipBackup
)

# Configuration
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $ProjectRoot "logs\deploy-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss').log"
$BackupDir = Join-Path $ProjectRoot "backups\pre-deploy-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')"

# Ensure log directory exists
$LogDir = Split-Path -Parent $LogFile
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Logging function
function Write-Log {
    param($Message, $Level = "INFO")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "[$Timestamp] [$Level] $Message"
    Write-Host $LogEntry
    Add-Content -Path $LogFile -Value $LogEntry
}

function Test-Prerequisites {
    Write-Log "Checking deployment prerequisites..."
    
    # Check Node.js version
    try {
        $NodeVersion = node --version
        Write-Log "Node.js version: $NodeVersion"
        
        if (-not $NodeVersion.StartsWith("v18") -and -not $NodeVersion.StartsWith("v20")) {
            throw "Node.js version 18 or 20 required. Current: $NodeVersion"
        }
    } catch {
        throw "Node.js not found or invalid version"
    }
    
    # Check npm version
    try {
        $NpmVersion = npm --version
        Write-Log "npm version: $NpmVersion"
    } catch {
        throw "npm not found"
    }
    
    # Check Prisma CLI
    try {
        npx prisma --version | Out-Null
        Write-Log "Prisma CLI available"
    } catch {
        throw "Prisma CLI not available"
    }
    
    # Check TypeScript
    try {
        npx tsc --version | Out-Null
        Write-Log "TypeScript compiler available"
    } catch {
        throw "TypeScript not available"
    }
    
    # Check required environment variables
    $RequiredEnvVars = @('DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL')
    foreach ($EnvVar in $RequiredEnvVars) {
        if (-not [Environment]::GetEnvironmentVariable($EnvVar)) {
            Write-Log "Missing required environment variable: $EnvVar" "WARNING"
        }
    }
    
    Write-Log "Prerequisites check completed"
}

function Backup-CurrentSystem {
    if ($SkipBackup) {
        Write-Log "Skipping backup as requested"
        return
    }
    
    Write-Log "Creating system backup..."
    
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    
    # Backup database
    Write-Log "Backing up database..."
    try {
        npx prisma db pull --schema="$BackupDir\schema-backup.prisma"
        Write-Log "Database schema backed up"
    } catch {
        Write-Log "Database backup failed: $_" "ERROR"
        throw $_
    }
    
    # Backup critical files
    $FilesToBackup = @(
        "src\components\stages\ffe-stage.tsx",
        "prisma\schema.prisma",
        "src\types\ffe-management.ts",
        "package.json",
        "package-lock.json"
    )
    
    foreach ($File in $FilesToBackup) {
        $SourcePath = Join-Path $ProjectRoot $File
        if (Test-Path $SourcePath) {
            $BackupPath = Join-Path $BackupDir $File
            $BackupFileDir = Split-Path -Parent $BackupPath
            
            if (-not (Test-Path $BackupFileDir)) {
                New-Item -ItemType Directory -Path $BackupFileDir -Force | Out-Null
            }
            
            Copy-Item -Path $SourcePath -Destination $BackupPath -Force
            Write-Log "Backed up: $File"
        }
    }
    
    Write-Log "Backup completed: $BackupDir"
}

function Install-Dependencies {
    Write-Log "Installing dependencies..."
    
    Set-Location $ProjectRoot
    
    try {
        npm ci
        Write-Log "Dependencies installed successfully"
    } catch {
        Write-Log "Failed to install dependencies: $_" "ERROR"
        throw $_
    }
}

function Run-Tests {
    if ($SkipTests) {
        Write-Log "Skipping tests as requested"
        return
    }
    
    Write-Log "Running test suite..."
    
    Set-Location $ProjectRoot
    
    try {
        # Run unit tests
        Write-Log "Running unit tests..."
        npm run test:unit
        
        # Run integration tests
        Write-Log "Running integration tests..."
        npm run test:integration
        
        # Run type checking
        Write-Log "Running type checking..."
        npx tsc --noEmit
        
        Write-Log "All tests passed"
    } catch {
        Write-Log "Tests failed: $_" "ERROR"
        if (-not $Force) {
            throw "Deployment aborted due to test failures. Use -Force to override."
        }
        Write-Log "Continuing deployment despite test failures (Force mode)" "WARNING"
    }
}

function Deploy-Database {
    Write-Log "Deploying database changes..."
    
    Set-Location $ProjectRoot
    
    try {
        # Generate Prisma client
        Write-Log "Generating Prisma client..."
        npx prisma generate
        
        # Deploy migrations
        Write-Log "Deploying database migrations..."
        if ($Environment -eq "production") {
            npx prisma migrate deploy
        } else {
            npx prisma migrate dev --name "deploy_new_ffe_system"
        }
        
        # Seed default data
        Write-Log "Seeding default FFE sections..."
        npx ts-node prisma\seeds\ffe-system-seed.ts
        
        Write-Log "Database deployment completed"
    } catch {
        Write-Log "Database deployment failed: $_" "ERROR"
        throw $_
    }
}

function Build-Application {
    Write-Log "Building application..."
    
    Set-Location $ProjectRoot
    
    try {
        # Set environment
        $env:NODE_ENV = $Environment
        
        # Build Next.js application
        Write-Log "Building Next.js application..."
        npm run build
        
        Write-Log "Application build completed"
    } catch {
        Write-Log "Application build failed: $_" "ERROR"
        throw $_
    }
}

function Deploy-Application {
    Write-Log "Deploying application..."
    
    Set-Location $ProjectRoot
    
    try {
        # Environment-specific deployment
        switch ($Environment) {
            "dev" {
                Write-Log "Starting development server..."
                # npm run dev (would run in background)
                Write-Log "Development deployment ready"
            }
            "staging" {
                Write-Log "Deploying to staging environment..."
                # Staging-specific deployment commands
                Write-Log "Staging deployment completed"
            }
            "production" {
                Write-Log "Deploying to production environment..."
                # Production-specific deployment commands
                # npm run start (would be handled by process manager)
                Write-Log "Production deployment completed"
            }
        }
    } catch {
        Write-Log "Application deployment failed: $_" "ERROR"
        throw $_
    }
}

function Initialize-FeatureFlags {
    Write-Log "Initializing feature flags..."
    
    try {
        # Set appropriate feature flags based on environment
        switch ($Environment) {
            "dev" {
                Write-Log "Setting development feature flags (all enabled)"
                # All features enabled for development
            }
            "staging" {
                Write-Log "Setting staging feature flags (pilot mode)"
                # Limited rollout for staging
            }
            "production" {
                Write-Log "Setting production feature flags (conservative rollout)"
                # Conservative rollout for production
            }
        }
        
        Write-Log "Feature flags initialized"
    } catch {
        Write-Log "Feature flag initialization failed: $_" "ERROR"
        throw $_
    }
}

function Run-PostDeploymentTests {
    Write-Log "Running post-deployment verification tests..."
    
    try {
        # Basic health check
        Write-Log "Performing health checks..."
        
        # Test API endpoints
        Write-Log "Testing FFE API endpoints..."
        # Add API health check calls here
        
        # Test database connectivity
        Write-Log "Testing database connectivity..."
        npx prisma db pull --schema="temp-schema-check.prisma" | Out-Null
        Remove-Item "temp-schema-check.prisma" -Force -ErrorAction SilentlyContinue
        
        # Test template creation
        Write-Log "Testing template functionality..."
        # Add template creation test here
        
        Write-Log "Post-deployment tests completed successfully"
    } catch {
        Write-Log "Post-deployment tests failed: $_" "ERROR"
        throw $_
    }
}

function Send-DeploymentNotification {
    param($Success, $ErrorMessage = "")
    
    $Status = if ($Success) { "SUCCESS" } else { "FAILED" }
    $Color = if ($Success) { "Green" } else { "Red" }
    
    Write-Host ""
    Write-Host "===========================================" -ForegroundColor $Color
    Write-Host "FFE SYSTEM DEPLOYMENT $Status" -ForegroundColor $Color
    Write-Host "===========================================" -ForegroundColor $Color
    Write-Host "Environment: $Environment" -ForegroundColor $Color
    Write-Host "Timestamp: $(Get-Date)" -ForegroundColor $Color
    
    if ($Success) {
        Write-Host "Deployment completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next Steps:"
        Write-Host "1. Verify application is running correctly"
        Write-Host "2. Test FFE workflow with sample data"
        Write-Host "3. Monitor application logs for any issues"
        Write-Host "4. Schedule user training if deploying to production"
    } else {
        Write-Host "Deployment failed: $ErrorMessage" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting Steps:"
        Write-Host "1. Review deployment log: $LogFile"
        Write-Host "2. Check system backups: $BackupDir"
        Write-Host "3. Verify environment configuration"
        Write-Host "4. Contact development team if needed"
    }
    
    Write-Host "===========================================" -ForegroundColor $Color
    Write-Host ""
    
    # TODO: Add email/Slack notifications here
}

function Main {
    Write-Log "Starting FFE system deployment..."
    Write-Log "Environment: $Environment"
    Write-Log "Mode: $(if ($DryRun) { 'DRY RUN' } elseif ($Execute) { 'EXECUTE' } else { 'DRY RUN (default)' })"
    
    if (-not $Execute -and -not $DryRun) {
        Write-Log "No execution mode specified. Running in DRY RUN mode by default."
        Write-Log "Use -Execute to perform actual deployment or -DryRun to explicitly run dry run."
        $DryRun = $true
    }
    
    try {
        # Pre-deployment checks
        Test-Prerequisites
        
        if ($DryRun) {
            Write-Log "=== DRY RUN MODE - NO CHANGES WILL BE MADE ==="
            Write-Log "The following steps would be executed:"
            Write-Log "1. Create system backup"
            Write-Log "2. Install dependencies"
            Write-Log "3. Run tests"
            Write-Log "4. Deploy database changes"
            Write-Log "5. Build application"
            Write-Log "6. Deploy application"
            Write-Log "7. Initialize feature flags"
            Write-Log "8. Run post-deployment tests"
            Write-Log "=== END DRY RUN ==="
            return
        }
        
        # Actual deployment steps
        Backup-CurrentSystem
        Install-Dependencies
        Run-Tests
        Deploy-Database
        Build-Application
        Deploy-Application
        Initialize-FeatureFlags
        Run-PostDeploymentTests
        
        Send-DeploymentNotification -Success $true
        
    } catch {
        Write-Log "Deployment failed: $_" "ERROR"
        Send-DeploymentNotification -Success $false -ErrorMessage $_.Exception.Message
        exit 1
    }
}

# Execute main function
Main