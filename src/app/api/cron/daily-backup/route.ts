import { NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service'
import { buildFullBackup, BackupLogger } from '@/lib/backup/buildBackup'
import { gzip } from 'zlib'
import { promisify } from 'util'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for backup

const gzipAsync = promisify(gzip)

// Helper function to download files and convert to base64
async function downloadFile(url: string, assetId: string): Promise<string | null> {
  try {
    let buffer: Buffer
    let mimeType = 'application/octet-stream'
    
    // Check if this is a Dropbox path or an HTTP URL
    const isDropboxPath = url.startsWith('/') || url.toLowerCase().includes('dropbox')
    
    if (isDropboxPath) {
      // Download from Dropbox using dropboxService
      console.log(`📥 Downloading from Dropbox: ${url.substring(0, 50)}...`)
      
      try {
        buffer = await dropboxService.downloadFile(url)
        
        // Infer MIME type from file extension
        const extension = url.split('.').pop()?.toLowerCase()
        const mimeTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'pdf': 'application/pdf',
          'svg': 'image/svg+xml'
        }
        mimeType = mimeTypes[extension || ''] || 'application/octet-stream'
      } catch (dropboxError) {
        console.error(`Failed to download from Dropbox ${url}:`, dropboxError)
        throw dropboxError
      }
    } else {
      // Download from HTTP URL using fetch
      console.log(`📥 Downloading from URL: ${url.substring(0, 50)}...`)
      
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
      buffer = Buffer.from(arrayBuffer)
      mimeType = response.headers.get('content-type') || 'application/octet-stream'
    }
    
    // Check buffer size (limit to 50MB)
    if (buffer.length > 50 * 1024 * 1024) {
      throw new Error('File too large (>50MB)')
    }
    
    // Convert to base64
    const base64 = buffer.toString('base64')
    
    // Store with metadata for easier restoration
    const fileData = {
      content: base64,
      originalUrl: url,
      mimeType,
      size: buffer.length,
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
  // Allow Vercel Cron - check for the header in multiple ways
  const vercelCronHeader = req.headers.get('x-vercel-cron')
  const vercelIdHeader = req.headers.get('x-vercel-id')
  
  // Vercel sets x-vercel-cron header when running scheduled jobs
  // Accept if header exists and is truthy (could be '1', 'true', or just present)
  if (vercelCronHeader) {
    console.log('[Auth] Vercel cron header detected:', vercelCronHeader)
    return true
  }
  
  // Also check for x-vercel-id as backup (Vercel always sets this for their requests)
  if (vercelIdHeader) {
    console.log('[Auth] Vercel ID header detected (fallback auth):', vercelIdHeader.substring(0, 20))
    return true
  }
  
  // Allow manual trigger with secret
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret && process.env.CRON_SECRET && secret === process.env.CRON_SECRET) {
    console.log('[Auth] Authenticated with CRON_SECRET')
    return true
  }
  
  console.warn('[Auth] Authorization failed - no valid credentials found')
  return false
}

// Use the shared backup builder for consistency and robustness
async function buildBackupForCron() {
  const logger: BackupLogger = {
    log: (m) => console.log(m),
    onStart: ({ totalAssets, totalTables }) => console.log(`📋 Models: ${totalTables}, Assets: ${totalAssets}`),
    onFileStart: ({ path }) => console.log(`⬇️  ${path.substring(0, 80)}`),
    onFileSuccess: ({ path, size, attempt, durationMs }) => console.log(`✅ ${path.substring(0, 60)}... ${Math.round(size/1024)}KB (attempt ${attempt}, ${durationMs}ms)`),
    onFileFail: ({ path, attempt, error }) => console.warn(`⚠️ ${path.substring(0, 60)}... (attempt ${attempt}) ${error}`),
    onFileSkip: ({ path, reason }) => console.warn(`⏭️  ${path.substring(0, 60)}... skipped: ${reason}`),
    onProgress: ({ completed, total, percentage }) => {
      if (completed % 10 === 0 || completed === total) console.log(`Progress: ${completed}/${total} (${percentage}%)`)
    },
    onComplete: (summary) => console.log(`Summary: ${summary.successCount}/${summary.totalAssets} ok, failed=${summary.failedCount}, skipped=${summary.skippedCount}`)
  }

  const result = await buildFullBackup({ mode: 'cron', logger, concurrency: 20 })
  return result
}

// Cleanup old backups - keep only last 20
async function cleanupOldBackups() {
  try {
    // Use full team folder path
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
    
    // 1. Build backup using shared builder (includes DB and files)
    const backupResult = await buildBackupForCron()

    // 2. Compress backup
    const jsonData = JSON.stringify(backupResult, null, 0)
    const compressed = await gzipAsync(Buffer.from(jsonData))
    
    // 3. Generate filename with date and time for unique backups
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // YYYY-MM-DDTHH-MM-SS
    const filename = `database-backup-${timestamp}.json.gz`
    // Use full team folder path for write operations
    const dropboxPath = `/Meisner Interiors Team Folder/Software Backups/${filename}`
    
    // 4. Ensure backup folder exists in Dropbox
    try {
      await dropboxService.createFolder('/Meisner Interiors Team Folder/Software Backups')
    } catch (error) {
      console.log('Backup folder may already exist')
    }
    
    // 5. Upload to Dropbox (add mode - don't overwrite)
    await dropboxService.uploadFile(dropboxPath, compressed, { mode: 'add' })
    
    // 6. Cleanup disabled for now (can manually delete old backups from Dropbox if needed)
    // await cleanupOldBackups()
    
    const duration = Date.now() - startTime
    const sizeMB = (compressed.length / 1024 / 1024).toFixed(2)
    const recordCount = Object.values(backupResult.data).reduce((total: number, table: any) => 
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
      tables: Object.keys(backupResult.data).length
    })
    
  } catch (error) {
    console.error('❌ Backup failed:', error)
    return NextResponse.json({ 
      error: 'Backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
