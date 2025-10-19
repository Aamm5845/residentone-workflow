const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups')
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

// Generate timestamp for backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
const backupFileName = `database-backup-${timestamp}.json`
const backupFilePath = path.join(backupsDir, backupFileName)

async function createBackup() {
  try {
    
    // Extract all data using Prisma
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        organizations: await prisma.organization.findMany(),
        users: await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orgId: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true
            // Exclude password and sensitive data
          }
        }),
        clients: await prisma.client.findMany(),
        contractors: await prisma.contractor.findMany(),
        projects: await prisma.project.findMany(),
        floors: await prisma.floor.findMany(),
        rooms: await prisma.room.findMany(),
        stages: await prisma.stage.findMany(),
        designSections: await prisma.designSection.findMany(),
        ffeItems: await prisma.fFEItem.findMany(),
        assets: await prisma.asset.findMany(),
        clientAccessTokens: await prisma.clientAccessToken.findMany(),
        clientAccessLogs: await prisma.clientAccessLog.findMany(),
        // Add other important tables as needed
      }
    }

    // Calculate total records
    const totalRecords = Object.values(backup.data).reduce((sum, table) => sum + table.length, 0)
    
    // Write backup to file
    fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2))
    
    // Verify backup was created
    if (fs.existsSync(backupFilePath)) {
      const fileSize = (fs.statSync(backupFilePath).size / 1024).toFixed(2)

      // Clean up old backups (keep only last 10)
      cleanupOldBackups()
      
      return true
    } else {
      throw new Error('Backup file was not created')
    }
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message)
    return false
  } finally {
    await prisma.$disconnect()
  }
}

// Clean up old backup files (keep only last 10)
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith('database-backup-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(backupsDir, file),
        mtime: fs.statSync(path.join(backupsDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime) // Sort by modification time, newest first
    
    if (files.length > 10) {
      const filesToDelete = files.slice(10)
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path)
        
      })
    }
  } catch (error) {
    console.error('⚠️ Could not clean up old backups:', error.message)
  }
}

// Run backup
createBackup().then(success => {
  process.exit(success ? 0 : 1)
})