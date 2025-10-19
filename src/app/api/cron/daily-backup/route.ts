import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { uploadFile, listFiles, deleteFile } from '@/lib/blob'
import { gzip } from 'zlib'
import { promisify } from 'util'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  const prisma = new PrismaClient()
  
  try {
    console.log('📊 Starting database export...')
    
    // Get all data from your tables
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        description: 'ResidentOne daily backup'
      },
      data: {
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
        clientApprovalVersions: await prisma.clientApprovalVersion.findMany(),
        issues: await prisma.issue.findMany(),
        notifications: await prisma.notification.findMany(),
        activityLogs: await prisma.activityLog.findMany(),
        userSessions: await prisma.userSession.findMany(),
        tasks: await prisma.task.findMany(),
        comments: await prisma.comment.findMany(),
        clientAccessTokens: await prisma.clientAccessToken.findMany(),
        projectContractors: await prisma.projectContractor.findMany(),
        tags: await prisma.tag.findMany()
      }
    }

    // Count total records
    const totalRecords = Object.values(backup.data).reduce((total, table) => {
      return total + (Array.isArray(table) ? table.length : 0)
    }, 0)
    
    console.log(`📊 Exported ${totalRecords} records from ${Object.keys(backup.data).length} tables`)
    
    return backup
    
  } finally {
    await prisma.$disconnect()
  }
}

// Clean up old backups (keep only last 30)
async function cleanupOldBackups() {
  try {
    const files = await listFiles('backups/database/')
    
    // Filter backup files and sort by name (contains date)
    const backupFiles = files
      .filter((file: any) => file.pathname.includes('backup-') && file.pathname.endsWith('.json.gz'))
      .sort((a: any, b: any) => b.pathname.localeCompare(a.pathname)) // newest first
    
    // Keep only last 30 backups
    if (backupFiles.length > 30) {
      const filesToDelete = backupFiles.slice(30)
      
      for (const file of filesToDelete) {
        await deleteFile(file.url)
        console.log(`🗑️  Deleted old backup: ${file.pathname}`)
      }
      
      console.log(`🧹 Cleaned up ${filesToDelete.length} old backups`)
    }
    
  } catch (error) {
    console.error('⚠️  Failed to cleanup old backups:', error)
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
    
    // 3. Generate filename with date
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `backup-${date}.json.gz`
    const path = `backups/database/${filename}`
    
    // 4. Upload to Vercel Blob
    const result = await uploadFile(compressed, path, {
      contentType: 'application/gzip',
      filename
    })
    
    // 5. Cleanup old backups
    await cleanupOldBackups()
    
    const duration = Date.now() - startTime
    const sizeMB = (compressed.length / 1024 / 1024).toFixed(2)
    
    console.log(`✅ Backup completed in ${duration}ms`)
    console.log(`📁 File: ${filename} (${sizeMB} MB)`)
    console.log(`🔗 URL: ${result.url}`)
    
    return NextResponse.json({
      success: true,
      filename,
      url: result.url,
      size: compressed.length,
      duration,
      recordCount: Object.values(backup.data).reduce((total: number, table: any) => 
        total + (Array.isArray(table) ? table.length : 0), 0
      )
    })
    
  } catch (error) {
    console.error('❌ Backup failed:', error)
    return NextResponse.json({ 
      error: 'Backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}