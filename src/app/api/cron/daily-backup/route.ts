import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
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
  const prisma = new PrismaClient({
    log: ['error'], // Only log errors to reduce console noise
  })
  
  try {
    console.log('📊 Starting database export...')
    
    // Get all data from your tables
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        description: 'Meisner Interiors Workflow daily backup'
      },
      data: {
        organizations: await prisma.organization.findMany(),
        users: await prisma.user.findMany(),
        projects: await prisma.project.findMany(),
        rooms: await prisma.room.findMany(),
        stages: await prisma.stage.findMany(),
        renderingVersions: await prisma.renderingVersion.findMany(),
        assets: await prisma.asset.findMany(),
        activities: await prisma.activity.findMany(),
        notifications: await prisma.notification.findMany(),
        comments: await prisma.comment.findMany(),
        messages: await prisma.message.findMany()
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

// Note: Dropbox keeps all backups, one per day (overwritten if run multiple times same day)
// Old backups can be manually deleted from Dropbox if needed

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
    const filename = `database-backup-${date}.json.gz`
    const dropboxPath = `/DATABASE-BACKUPS/${filename}`
    
    // 4. Ensure backup folder exists in Dropbox
    try {
      await dropboxService.createFolder('/DATABASE-BACKUPS')
    } catch (error) {
      console.log('Backup folder may already exist')
    }
    
    // 5. Upload to Dropbox (overwrite if same day backup exists)
    await dropboxService.uploadFile(dropboxPath, compressed, { mode: 'overwrite' })
    
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
      recordCount
    })
    
  } catch (error) {
    console.error('❌ Backup failed:', error)
    return NextResponse.json({ 
      error: 'Backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
