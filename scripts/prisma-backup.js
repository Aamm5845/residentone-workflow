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

async function createFullBackup() {
  try {
    
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
    
    backup.data.organizations = await prisma.organization.findMany()
    
    // Users
    
    backup.data.users = await prisma.user.findMany()
    
    // Clients
    
    backup.data.clients = await prisma.client.findMany()
    
    // Contractors
    
    backup.data.contractors = await prisma.contractor.findMany()
    
    // Projects
    
    backup.data.projects = await prisma.project.findMany()
    
    // Stages
    
    backup.data.stages = await prisma.stage.findMany()
    
    // Design Sections
    
    backup.data.designSections = await prisma.designSection.findMany()
    
    // FFE Items
    
    backup.data.ffeItems = await prisma.fFEItem.findMany()
    
    // Assets
    
    backup.data.assets = await prisma.asset.findMany()
    
    // Client Approval Versions
    
    backup.data.clientApprovalVersions = await prisma.clientApprovalVersion.findMany()
    
    // Issues
    
    backup.data.issues = await prisma.issue.findMany()
    
    // Notifications
    
    backup.data.notifications = await prisma.notification.findMany()
    
    // Activity Logs
    
    backup.data.activityLogs = await prisma.activityLog.findMany()
    
    // User Sessions
    
    backup.data.userSessions = await prisma.userSession.findMany()
    
    // Additional important tables
    
    backup.data.rooms = await prisma.room.findMany()
    
    backup.data.tasks = await prisma.task.findMany()
    
    backup.data.comments = await prisma.comment.findMany()
    
    backup.data.clientAccessTokens = await prisma.clientAccessToken.findMany()
    
    backup.data.projectContractors = await prisma.projectContractor.findMany()
    
    backup.data.tags = await prisma.tag.findMany()
    
    // Write backup to file
    
    fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2))
    
    // Check file size
    const fileSize = (fs.statSync(backupFilePath).size / 1024).toFixed(2)

    // Count total records
    const totalRecords = Object.values(backup.data).reduce((total, table) => {
      return total + (Array.isArray(table) ? table.length : 0)
    }, 0)
    
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
        
      })
      
    }
  } catch (error) {
    console.error('⚠️ Could not clean up old backups:', error.message)
  }
}

// Run the backup
createFullBackup()