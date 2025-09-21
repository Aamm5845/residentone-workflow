import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/backup-complete - Create complete backup with files and users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only allow OWNER to create complete backups (includes passwords)
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Unauthorized - OWNER access required for complete backup' 
      }, { status: 401 })
    }

    console.log('🔄 Starting COMPLETE database backup (includes files and passwords)...')
    
    // Extract all production data INCLUDING sensitive information
    const backup = {
      timestamp: new Date().toISOString(),
      version: '2.0', // Updated version for complete backup
      type: 'complete',
      environment: 'vercel',
      includes_files: true,
      includes_passwords: true,
      created_by: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role
      },
      data: {
        organizations: await prisma.organization.findMany(),
        
        // Include COMPLETE user data with passwords
        users: await prisma.user.findMany({
          // Include ALL fields including password hashes
          include: {
            accounts: true,
            sessions: true,
            userSessions: true
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
        
        // Get assets with full metadata
        assets: await prisma.asset.findMany(),
        
        // Include COMPLETE client access tokens with actual tokens
        clientAccessTokens: await prisma.clientAccessToken.findMany(),
        clientAccessLogs: await prisma.clientAccessLog.findMany(),
        
        // All other data
        approvals: await prisma.approval.findMany(),
        comments: await prisma.comment.findMany(),
        notifications: await prisma.notification.findMany(),
        tasks: await prisma.task.findMany(),
        projectContractors: await prisma.projectContractor.findMany(),
        
        // Auth-related data
        accounts: await prisma.account.findMany(),
        sessions: await prisma.session.findMany(),
        verificationTokens: await prisma.verificationToken.findMany(),
        passwordResetTokens: await prisma.passwordResetToken.findMany(),
        userSessions: await prisma.userSession.findMany(),
        
        // Additional tables
        roomPresets: await prisma.roomPreset.findMany(),
        activityLogs: await prisma.activityLog.findMany(),
      },
      
      // File downloads will be added here
      files: {} as Record<string, string>
    }

    console.log('📁 Downloading actual files from URLs...')
    
    // Download actual files from URLs
    const assets = backup.data.assets
    const fileDownloadPromises: Promise<void>[] = []
    let downloadedCount = 0
    let failedCount = 0

    for (const asset of assets) {
      if (asset.url && asset.filename) {
        const downloadPromise = downloadFile(asset.url, asset.id)
          .then((base64Content) => {
            if (base64Content) {
              backup.files[asset.id] = base64Content
              downloadedCount++
              if (downloadedCount % 10 === 0) {
                console.log(`📥 Downloaded ${downloadedCount} files...`)
              }
            } else {
              failedCount++
            }
          })
          .catch((error) => {
            console.error(`❌ Failed to download ${asset.filename}:`, error.message)
            failedCount++
          })

        fileDownloadPromises.push(downloadPromise)
        
        // Limit concurrent downloads to avoid overwhelming the system
        if (fileDownloadPromises.length >= 5) {
          await Promise.allSettled(fileDownloadPromises.splice(0, 5))
        }
      }
    }

    // Wait for remaining downloads
    if (fileDownloadPromises.length > 0) {
      await Promise.allSettled(fileDownloadPromises)
    }

    console.log(`📊 File download complete: ${downloadedCount} successful, ${failedCount} failed`)

    // Calculate statistics
    const stats = Object.entries(backup.data).map(([table, records]) => ({
      table,
      count: Array.isArray(records) ? records.length : 0
    }))
    
    const totalRecords = stats.reduce((sum, stat) => sum + stat.count, 0)
    const totalFiles = Object.keys(backup.files).length
    
    console.log(`✅ Complete backup finished: ${totalRecords} records, ${totalFiles} files`)
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
    const filename = `residentone-complete-backup-${timestamp}.json`
    
    // Add metadata to backup
    backup.statistics = {
      total_records: totalRecords,
      total_files: totalFiles,
      files_downloaded: downloadedCount,
      files_failed: failedCount,
      tables: stats,
      backup_size_estimate: `${Math.round(JSON.stringify(backup).length / 1024 / 1024)} MB`,
      includes_sensitive_data: true,
      includes_file_contents: true
    }
    
    // Return complete backup as downloadable file
    const backupJson = JSON.stringify(backup, null, 2)
    
    // Add warning headers
    return new NextResponse(backupJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Backup-Type': 'complete-with-files-and-passwords',
        'X-Security-Warning': 'Contains sensitive data - store securely',
      },
    })

  } catch (error) {
    console.error('❌ Complete backup failed:', error)
    return NextResponse.json({ 
      error: 'Complete backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

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
        'User-Agent': 'ResidentOne-Backup-System/2.0'
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

// POST /api/admin/backup-complete - Get complete backup info without downloading
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized - OWNER required' }, { status: 401 })
    }

    // Get comprehensive database and file statistics
    const stats = {
      organizations: await prisma.organization.count(),
      users: await prisma.user.count(),
      clients: await prisma.client.count(),
      contractors: await prisma.contractor.count(),
      projects: await prisma.project.count(),
      floors: await prisma.floor.count(),
      rooms: await prisma.room.count(),
      stages: await prisma.stage.count(),
      ffeItems: await prisma.fFEItem.count(),
      assets: await prisma.asset.count(),
      clientAccessTokens: await prisma.clientAccessToken.count(),
      clientAccessLogs: await prisma.clientAccessLog.count(),
      accounts: await prisma.account.count(),
      sessions: await prisma.session.count(),
    }

    // Get file information
    const assets = await prisma.asset.findMany({
      select: { id: true, size: true, url: true, filename: true }
    })

    const totalFileSize = assets.reduce((sum, asset) => sum + (asset.size || 0), 0)
    const filesWithUrls = assets.filter(asset => asset.url).length

    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0)

    return NextResponse.json({
      success: true,
      statistics: {
        total_records: totalRecords,
        total_files: assets.length,
        files_with_urls: filesWithUrls,
        estimated_file_size_mb: Math.round(totalFileSize / 1024 / 1024),
        tables: Object.entries(stats).map(([table, count]) => ({ table, count })),
        last_checked: new Date().toISOString(),
        estimated_backup_size: `${Math.round(totalRecords * 0.5 + totalFileSize / 1024)} KB`,
        backup_type: 'complete',
        includes_passwords: true,
        includes_files: true,
        security_warning: 'Complete backup includes sensitive data - store securely'
      }
    })

  } catch (error) {
    console.error('❌ Complete stats failed:', error)
    return NextResponse.json({ 
      error: 'Failed to get complete backup statistics' 
    }, { status: 500 })
  }
}