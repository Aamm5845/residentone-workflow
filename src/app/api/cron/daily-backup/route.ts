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
    
    // Dynamically get all Prisma models
    const data: Record<string, any[]> = {}
    
    // Get all model names from Prisma client (excludes internal models like _prisma_migrations)
    const modelNames = Object.keys(prisma).filter(key => {
      const model = (prisma as any)[key]
      return model && typeof model.findMany === 'function'
    })
    
    console.log(`📋 Found ${modelNames.length} tables to backup`)
    
    // Fetch all data from each model
    for (const modelName of modelNames) {
      try {
        const model = (prisma as any)[modelName]
        data[modelName] = await model.findMany()
        console.log(`✓ ${modelName}: ${data[modelName].length} records`)
      } catch (error) {
        console.error(`⚠️ Failed to backup ${modelName}:`, error instanceof Error ? error.message : error)
        data[modelName] = [] // Store empty array on failure
      }
    }
    
    // Get all data from your tables
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0',
        description: 'Meisner Interiors Workflow daily backup (dynamic)',
        tables: modelNames.length
      },
      data
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
