const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

// Initialize Prisma Client
const prisma = new PrismaClient()

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups')
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

// Generate timestamp for backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
const backupFileName = `full-backup-${timestamp}.json`
const backupFilePath = path.join(backupsDir, backupFileName)

console.log('🔄 Starting full database backup using Prisma...')
console.log(`📁 Backup location: ${backupFilePath}`)
console.log(`🕒 Timestamp: ${new Date().toISOString()}`)

async function createFullBackup() {
  try {
    console.log('📊 Exporting database tables...')
    
    // Export all main tables
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        description: 'Full ResidentOne database backup'
      },
      data: {}
    }

    // Organizations (basic export)
    console.log('  📋 Exporting Organizations...')
    backup.data.organizations = await prisma.organization.findMany()
    console.log(`     ✓ ${backup.data.organizations.length} organizations exported`)

    // Users
    console.log('  👤 Exporting Users...')
    backup.data.users = await prisma.user.findMany()
    console.log(`     ✓ ${backup.data.users.length} users exported`)

    // Clients
    console.log('  🏢 Exporting Clients...')
    backup.data.clients = await prisma.client.findMany()
    console.log(`     ✓ ${backup.data.clients.length} clients exported`)

    // Contractors
    console.log('  🔨 Exporting Contractors...')
    backup.data.contractors = await prisma.contractor.findMany()
    console.log(`     ✓ ${backup.data.contractors.length} contractors exported`)

    // Projects
    console.log('  📁 Exporting Projects...')
    backup.data.projects = await prisma.project.findMany()
    console.log(`     ✓ ${backup.data.projects.length} projects exported`)

    // Stages
    console.log('  🎯 Exporting Stages...')
    backup.data.stages = await prisma.stage.findMany()
    console.log(`     ✓ ${backup.data.stages.length} stages exported`)

    // Design Sections
    console.log('  🎨 Exporting Design Sections...')
    backup.data.designSections = await prisma.designSection.findMany()
    console.log(`     ✓ ${backup.data.designSections.length} design sections exported`)

    // FFE Items
    console.log('  🛜️ Exporting FFE Items...')
    backup.data.ffeItems = await prisma.fFEItem.findMany()
    console.log(`     ✓ ${backup.data.ffeItems.length} FFE items exported`)

    // Assets
    console.log('  🖼️ Exporting Assets...')
    backup.data.assets = await prisma.asset.findMany()
    console.log(`     ✓ ${backup.data.assets.length} assets exported`)

    // Client Approval Versions
    console.log('  ✅ Exporting Client Approval Versions...')
    backup.data.clientApprovalVersions = await prisma.clientApprovalVersion.findMany()
    console.log(`     ✓ ${backup.data.clientApprovalVersions.length} approval versions exported`)

    // Issues
    console.log('  ⚠️ Exporting Issues...')
    backup.data.issues = await prisma.issue.findMany()
    console.log(`     ✓ ${backup.data.issues.length} issues exported`)

    // Notifications
    console.log('  🔔 Exporting Notifications...')
    backup.data.notifications = await prisma.notification.findMany()
    console.log(`     ✓ ${backup.data.notifications.length} notifications exported`)

    // Activity Logs
    console.log('  📋 Exporting Activity Logs...')
    backup.data.activityLogs = await prisma.activityLog.findMany()
    console.log(`     ✓ ${backup.data.activityLogs.length} activity logs exported`)

    // User Sessions
    console.log('  🔐 Exporting User Sessions...')
    backup.data.userSessions = await prisma.userSession.findMany()
    console.log(`     ✓ ${backup.data.userSessions.length} user sessions exported`)

    // Additional important tables
    console.log('  🏠 Exporting Rooms...')
    backup.data.rooms = await prisma.room.findMany()
    console.log(`     ✓ ${backup.data.rooms.length} rooms exported`)

    console.log('  📋 Exporting Tasks...')
    backup.data.tasks = await prisma.task.findMany()
    console.log(`     ✓ ${backup.data.tasks.length} tasks exported`)

    console.log('  📝 Exporting Comments...')
    backup.data.comments = await prisma.comment.findMany()
    console.log(`     ✓ ${backup.data.comments.length} comments exported`)

    console.log('  🔑 Exporting Client Access Tokens...')
    backup.data.clientAccessTokens = await prisma.clientAccessToken.findMany()
    console.log(`     ✓ ${backup.data.clientAccessTokens.length} client access tokens exported`)

    console.log('  🔗 Exporting Project Contractors...')
    backup.data.projectContractors = await prisma.projectContractor.findMany()
    console.log(`     ✓ ${backup.data.projectContractors.length} project contractors exported`)

    console.log('  🏷️ Exporting Tags...')
    backup.data.tags = await prisma.tag.findMany()
    console.log(`     ✓ ${backup.data.tags.length} tags exported`)

    // Write backup to file
    console.log('💾 Writing backup to file...')
    fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2))
    
    // Check file size
    const fileSize = (fs.statSync(backupFilePath).size / 1024).toFixed(2)
    console.log(`✅ Database backup completed successfully!`)
    console.log(`📊 Backup size: ${fileSize} KB`)
    console.log(`📁 Location: ${backupFilePath}`)
    
    // Count total records
    const totalRecords = Object.values(backup.data).reduce((total, table) => {
      return total + (Array.isArray(table) ? table.length : 0)
    }, 0)
    console.log(`📈 Total records exported: ${totalRecords}`)
    
    // Clean up old backups
    cleanupOldBackups()
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Clean up old backup files (keep only last 15)
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith('full-backup-') && file.endsWith('.json'))
      .sort()
      .reverse()
    
    if (files.length > 15) {
      const filesToDelete = files.slice(15)
      filesToDelete.forEach(file => {
        const filePath = path.join(backupsDir, file)
        fs.unlinkSync(filePath)
        console.log(`🗑️ Cleaned up old backup: ${file}`)
      })
      console.log(`🧹 Cleaned up ${filesToDelete.length} old backup files`)
    }
  } catch (error) {
    console.error('⚠️ Could not clean up old backups:', error.message)
  }
}

// Run the backup
createFullBackup()