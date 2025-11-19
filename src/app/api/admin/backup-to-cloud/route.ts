import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { buildFullBackup, BackupLogger } from '@/lib/backup/buildBackup'
import { dropboxService } from '@/lib/dropbox-service'
import { gzip } from 'zlib'
import { promisify } from 'util'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const gzipAsync = promisify(gzip)

// GET /api/admin/backup-to-cloud - Create backup and save directly to Dropbox
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Only allow OWNER to create cloud backups
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Unauthorized - OWNER access required' 
      }, { status: 401 })
    }

    console.log(`🔄 Starting cloud backup for user: ${session.user.email}`)
    const startTime = Date.now()

    // Create logger for progress tracking
    const logger: BackupLogger = {
      log: (m) => console.log(m),
      onStart: ({ totalAssets, totalTables }) => console.log(`📋 Models: ${totalTables}, Assets: ${totalAssets}`),
      onProgress: ({ completed, total, percentage }) => {
        if (completed % 10 === 0 || completed === total) {
          console.log(`Progress: ${completed}/${total} (${percentage}%)`)
        }
      },
      onComplete: (summary) => console.log(`Summary: ${summary.successCount}/${summary.totalAssets} ok, failed=${summary.failedCount}, skipped=${summary.skippedCount}`)
    }

    // Build the backup
    const backupResult = await buildFullBackup({ 
      mode: 'preferences', 
      logger, 
      concurrency: 20 
    })

    // Compress the backup
    const jsonData = JSON.stringify(backupResult, null, 0)
    const compressed = await gzipAsync(Buffer.from(jsonData))

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `database-backup-${timestamp}.json.gz`
    const dropboxPath = `/Software Backups/${filename}`

    // Ensure backup folder exists
    try {
      await dropboxService.createFolder('/Software Backups')
    } catch (error) {
      console.log('Backup folder may already exist')
    }

    // Upload to Dropbox
    await dropboxService.uploadFile(dropboxPath, compressed, { mode: 'add' })

    const duration = Date.now() - startTime
    const sizeMB = (compressed.length / 1024 / 1024).toFixed(2)
    const recordCount = Object.values(backupResult.data).reduce((total: number, table: any) => 
      total + (Array.isArray(table) ? table.length : 0), 0
    )

    console.log(`✅ Cloud backup completed in ${duration}ms`)
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
      tables: Object.keys(backupResult.data).length,
      filesDownloaded: backupResult.summary.successCount,
      filesFailed: backupResult.summary.failedCount,
      message: `Backup saved to Dropbox successfully`
    })

  } catch (error) {
    console.error('❌ Cloud backup failed:', error)
    return NextResponse.json({ 
      error: 'Cloud backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
