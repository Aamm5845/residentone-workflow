import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { gzip } from 'zlib'
import { promisify } from 'util'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for backup

const gzipAsync = promisify(gzip)

// Helper function to download files and convert to base64
async function downloadFile(url: string, assetId: string): Promise<string | null> {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ResidentOne-Backup-System/3.0'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Check file size (limit to 50MB per file)
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
      throw new Error('File too large (>50MB)')
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    
    // Store with metadata for easier restoration
    const fileData = {
      content: base64,
      originalUrl: url,
      mimeType: response.headers.get('content-type') || 'application/octet-stream',
      size: arrayBuffer.byteLength,
      downloadedAt: new Date().toISOString()
    }

    return JSON.stringify(fileData)
  } catch (error) {
    console.error(`Failed to download file ${assetId}:`, error)
    return null
  }
}

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

// Dynamically export ALL database tables from Prisma
// This automatically includes any new tables added to schema.prisma
async function exportDatabase() {
  try {
    console.log('📊 Starting database export...')
    
    // Get all Prisma model names dynamically
    const modelNames = Object.keys(prisma).filter(
      key => !key.startsWith('_') && !key.startsWith('$') && typeof (prisma as any)[key] === 'object'
    )
    
    console.log(`📋 Discovered ${modelNames.length} Prisma models`)
    
    // Dynamically fetch all tables - includes passwords, tokens, and ALL data
    const data: Record<string, any[]> = {}
    
    for (const modelName of modelNames) {
      try {
        // Use findMany to get all records from each table
        data[modelName] = await (prisma as any)[modelName].findMany()
        console.log(`✅ ${modelName}: ${data[modelName].length} records`)
      } catch (error) {
        console.warn(`⚠️ Could not backup ${modelName}:`, error)
        data[modelName] = []
      }
    }
    
    // Download file content from assets (same as complete backup)
    const assets = data.asset || []
    const files: Record<string, string> = {}
    let downloadedCount = 0
    let failedCount = 0
    
    console.log(`💾 Starting file downloads for ${assets.length} assets...`)
    
    for (const asset of assets) {
      if (asset.url && asset.filename) {
        try {
          const fileData = await downloadFile(asset.url, asset.id)
          if (fileData) {
            files[asset.id] = fileData
            downloadedCount++
            if (downloadedCount % 10 === 0) {
              console.log(`💾 Downloaded ${downloadedCount}/${assets.length} files`)
            }
          } else {
            failedCount++
          }
        } catch (error) {
          console.error(`❌ Failed to download ${asset.filename}:`, error)
          failedCount++
        }
      }
    }
    
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '3.0',
        description: 'Meisner Interiors Workflow daily backup (COMPLETE with passwords and files)',
        tables: Object.keys(data).length,
        includes_passwords: true,
        includes_files: true,
        includes_tokens: true,
        auto_discovered: true
      },
      data,
      files
    }

    // Count total records
    const totalRecords = Object.values(backup.data).reduce((total, table) => {
      return total + (Array.isArray(table) ? table.length : 0)
    }, 0)
    
    console.log(`📊 Exported ${totalRecords} records from ${Object.keys(backup.data).length} tables`)
    console.log(`💾 Downloaded ${downloadedCount} files (${failedCount} failed)`)
    
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
