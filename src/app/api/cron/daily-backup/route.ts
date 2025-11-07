import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { gzip } from 'zlib'
import { promisify } from 'util'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for backup

const gzipAsync = promisify(gzip)

// Check if request is authorized (Vercel Cron or secret)
function isAuthorized(req: Request) {
  // Allow Vercel Cron (adds x-vercel-cron: 1)
  if (req.headers.get('x-vercel-cron') === '1') return true
  
  // Allow manual trigger with secret
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET) return true
  
  return false
}

// Export all database tables to JSON
async function exportDatabase() {
  try {
    console.log('📊 Starting database export...')
    
    // Explicitly list all tables based on your actual schema
    // This ensures complete backup coverage
    const data = {
      organizations: await prisma.organization.findMany(),
      users: await prisma.user.findMany(),
      clients: await prisma.client.findMany(),
      contractors: await prisma.contractor.findMany(),
      projects: await prisma.project.findMany(),
      rooms: await prisma.room.findMany(),
      stages: await prisma.stage.findMany(),
      designSections: await prisma.designSection.findMany(),
      ffeItems: await prisma.fFEItem.findMany(),
      assets: await prisma.asset.findMany(),
      clientAccessTokens: await prisma.clientAccessToken.findMany(),
      clientAccessLogs: await prisma.clientAccessLog.findMany(),
      phaseAccessTokens: await prisma.phaseAccessToken.findMany(),
      phaseAccessLogs: await prisma.phaseAccessLog.findMany(),
      approvals: await prisma.approval.findMany(),
      comments: await prisma.comment.findMany(),
      chatMessages: await prisma.chatMessage.findMany(),
      chatMentions: await prisma.chatMention.findMany(),
      chatMessageReactions: await prisma.chatMessageReaction.findMany(),
      smsConversations: await prisma.smsConversation.findMany(),
      notifications: await prisma.notification.findMany(),
      notificationSends: await prisma.notificationSend.findMany(),
      activityLogs: await prisma.activityLog.findMany(),
      activities: await prisma.activity.findMany(),
      ffeAuditLogs: await prisma.fFEAuditLog.findMany(),
      ffeChangeLogs: await prisma.fFEChangeLog.findMany(),
      tasks: await prisma.task.findMany(),
      projectContractors: await prisma.projectContractor.findMany(),
      projectUpdates: await prisma.projectUpdate.findMany(),
      projectUpdateTasks: await prisma.projectUpdateTask.findMany(),
      projectUpdatePhotos: await prisma.projectUpdatePhoto.findMany(),
      projectUpdateDocuments: await prisma.projectUpdateDocument.findMany(),
      projectUpdateMessages: await prisma.projectUpdateMessage.findMany(),
      projectUpdateActivities: await prisma.projectUpdateActivity.findMany(),
      projectMilestones: await prisma.projectMilestone.findMany(),
      contractorAssignments: await prisma.contractorAssignment.findMany(),
      issues: await prisma.issue.findMany(),
      issueComments: await prisma.issueComment.findMany(),
      emailLogs: await prisma.emailLog.findMany(),
      clientApprovalEmailLogs: await prisma.clientApprovalEmailLog.findMany(),
      floorplanApprovalEmailLogs: await prisma.floorplanApprovalEmailLog.findMany(),
      tags: await prisma.tag.findMany(),
      assetTags: await prisma.assetTag.findMany(),
      commentTags: await prisma.commentTag.findMany(),
      assetPins: await prisma.assetPin.findMany(),
      commentPins: await prisma.commentPin.findMany(),
      commentLikes: await prisma.commentLike.findMany(),
      checklistItems: await prisma.checklistItem.findMany(),
      drawingChecklistItems: await prisma.drawingChecklistItem.findMany(),
      clientApprovals: await prisma.clientApproval.findMany(),
      clientApprovalActivities: await prisma.clientApprovalActivity.findMany(),
      clientApprovalAssets: await prisma.clientApprovalAsset.findMany(),
      clientApprovalVersions: await prisma.clientApprovalVersion.findMany(),
      floorplanApprovalActivities: await prisma.floorplanApprovalActivity.findMany(),
      floorplanApprovalAssets: await prisma.floorplanApprovalAsset.findMany(),
      floorplanApprovalVersions: await prisma.floorplanApprovalVersion.findMany(),
      ffeLibraryItems: await prisma.fFELibraryItem.findMany(),
      ffeGeneralSettings: await prisma.fFEGeneralSettings.findMany(),
      ffeBathroomStates: await prisma.fFEBathroomState.findMany(),
      ffeTemplates: await prisma.fFETemplate.findMany(),
      ffeTemplateSections: await prisma.fFETemplateSection.findMany(),
      ffeTemplateItems: await prisma.fFETemplateItem.findMany(),
      ffeItemStatuses: await prisma.fFEItemStatus.findMany(),
      roomFfeInstances: await prisma.roomFFEInstance.findMany(),
      roomFfeSections: await prisma.roomFFESection.findMany(),
      roomFfeItems: await prisma.roomFFEItem.findMany(),
      ffeSectionLibrary: await prisma.fFESectionLibrary.findMany(),
      renderingVersions: await prisma.renderingVersion.findMany(),
      renderingNotes: await prisma.renderingNote.findMany(),
      specBooks: await prisma.specBook.findMany(),
      specBookSections: await prisma.specBookSection.findMany(),
      specBookGenerations: await prisma.specBookGeneration.findMany(),
      dropboxFileLinks: await prisma.dropboxFileLink.findMany(),
      cadPreferences: await prisma.cadPreferences.findMany(),
      projectCadDefaults: await prisma.projectCadDefaults.findMany(),
      cadLayoutCache: await prisma.cadLayoutCache.findMany(),
      roomSections: await prisma.roomSection.findMany(),
      roomPresets: await prisma.roomPreset.findMany(),
      accounts: await prisma.account.findMany(),
      sessions: await prisma.session.findMany(),
      verificationTokens: await prisma.verificationToken.findMany(),
      passwordResetTokens: await prisma.passwordResetToken.findMany(),
      userSessions: await prisma.userSession.findMany(),
    }
    
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0',
        description: 'Meisner Interiors Workflow daily backup (complete)',
        tables: Object.keys(data).length
      },
      data
    }

    // Count total records
    const totalRecords = Object.values(backup.data).reduce((total, table) => {
      return total + (Array.isArray(table) ? table.length : 0)
    }, 0)
    
    console.log(`📊 Exported ${totalRecords} records from ${Object.keys(backup.data).length} tables`)
    
    return backup
    
  } catch (error) {
    console.error('❌ Database export failed:', error)
    throw error
  }
}

// Cleanup old backups - keep only last 20
async function cleanupOldBackups() {
  try {
    const backupFolderPath = '/Meisner Interiors Team Folder/Software Backups'
    
    // List all files in backup folder
    const folderContents = await dropboxService.listFolder(backupFolderPath)
    
    // Filter backup files and sort by name (contains date YYYY-MM-DD)
    const backupFiles = folderContents.files
      .filter(file => file.name.startsWith('database-backup-') && file.name.endsWith('.json.gz'))
      .sort((a, b) => b.name.localeCompare(a.name)) // Newest first (YYYY-MM-DD sorts correctly)
    
    console.log(`Found ${backupFiles.length} backup files`)
    
    // Keep only last 20 backups
    if (backupFiles.length > 20) {
      const filesToDelete = backupFiles.slice(20) // Delete everything after the first 20
      
      console.log(`Deleting ${filesToDelete.length} old backups...`)
      
      for (const file of filesToDelete) {
        try {
          await dropboxService.deleteFile(file.path)
          console.log(`🗑️ Deleted old backup: ${file.name}`)
        } catch (error) {
          console.error(`⚠️ Failed to delete ${file.name}:`, error)
        }
      }
      
      console.log(`🧹 Cleaned up ${filesToDelete.length} old backups`)
    } else {
      console.log('No cleanup needed - less than 20 backups exist')
    }
  } catch (error) {
    console.error('⚠️ Failed to cleanup old backups:', error)
    // Don't fail the backup if cleanup fails
  }
}

export async function GET(req: Request) {
  // Check authorization
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🔄 Starting daily backup...')
    const startTime = Date.now()
    
    // 1. Export database
    const backup = await exportDatabase()
    
    // 2. Compress backup
    const jsonData = JSON.stringify(backup, null, 0)
    const compressed = await gzipAsync(Buffer.from(jsonData))
    
    // 3. Generate filename with date and time for unique backups
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // YYYY-MM-DDTHH-MM-SS
    const filename = `database-backup-${timestamp}.json.gz`
    const dropboxPath = `/Meisner Interiors Team Folder/Software Backups/${filename}`
    
    // 4. Ensure backup folder exists in Dropbox
    try {
      await dropboxService.createFolder('/Meisner Interiors Team Folder/Software Backups')
    } catch (error) {
      console.log('Backup folder may already exist')
    }
    
    // 5. Upload to Dropbox (add mode - don't overwrite)
    await dropboxService.uploadFile(dropboxPath, compressed, { mode: 'add' })
    
    // 6. Cleanup old backups (keep only last 20)
    await cleanupOldBackups()
    
    const duration = Date.now() - startTime
    const sizeMB = (compressed.length / 1024 / 1024).toFixed(2)
    const recordCount = Object.values(backup.data).reduce((total: number, table: any) => 
      total + (Array.isArray(table) ? table.length : 0), 0
    )
    
    console.log(`✅ Backup completed in ${duration}ms`)
    console.log(`📁 File: ${filename} (${sizeMB} MB)`)
    console.log(`📂 Path: ${dropboxPath}`)
    console.log(`📊 Records: ${recordCount}`)
    
    return NextResponse.json({
      success: true,
      filename,
      path: dropboxPath,
      size: compressed.length,
      duration,
      recordCount,
      tables: Object.keys(backup.data).length
    })
    
  } catch (error) {
    console.error('❌ Backup failed:', error)
    return NextResponse.json({ 
      error: 'Backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
