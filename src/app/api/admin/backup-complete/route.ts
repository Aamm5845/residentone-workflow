import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Helper function to fetch all assets in batches to avoid 5MB Prisma limit
async function fetchAllAssetsPaginated() {
  try {
    const allAssets = []
    let skip = 0
    let take = 10 // Start with very small batches
    
    while (true) {
      
      try {
        const assets = await prisma.asset.findMany({
          select: {
            id: true,
            filename: true,
            url: true,
            mimeType: true,
            size: true,
            projectId: true,
            createdAt: true
          },
          skip,
          take,
          orderBy: { createdAt: 'asc' }
        })
        
        if (assets.length === 0) break
        
        allAssets.push(...assets)
        skip += take
        
        // Increase batch size if successful (up to 50)
        if (take < 50) take = Math.min(take * 2, 50)
        
        if (assets.length < take) break
        
      } catch (batchError) {
        console.warn(`⚠️ Batch failed at ${skip}, reducing batch size`)
        // Reduce batch size and try again
        take = Math.max(1, Math.floor(take / 2))
        if (take === 1 && skip > 0) {
          console.warn('⚠️ Cannot reduce batch size further, stopping at', skip, 'records')
          break
        }
        continue
      }
    }

    return allAssets
  } catch (error) {
    console.warn('⚠️ Full assets fetch failed, falling back to ultra-minimal data only')
    // Ultra-minimal fallback: fetch only IDs and URLs (essential for file download)
    try {
      return await prisma.asset.findMany({
        select: {
          id: true,
          filename: true,
          url: true
        },
        take: 200, // Very limited number
        orderBy: { createdAt: 'desc' } // Get most recent
      })
    } catch (fallbackError) {
      console.error('⚠️ Even minimal asset fetch failed, using count-only approach:', fallbackError)
      // Last resort: just get asset count and create placeholder records
      try {
        const assetCount = await prisma.asset.count()
        
        return [{
          id: 'METADATA_ONLY',
          filename: `${assetCount}_assets_metadata_only.txt`,
          url: null,
          note: `This backup contains ${assetCount} assets but data exceeded query limits. Use database export for full recovery.`
        }]
      } catch (countError) {
        console.error('❌ Cannot even count assets:', countError)
        return []
      }
    }
  }
}

// Helper function for paginated fetching of large tables
async function fetchPaginated(model: any, modelName: string, batchSize = 100) {
  const allRecords = []
  let skip = 0
  
  while (true) {
    
    const records = await model.findMany({
      skip,
      take: batchSize,
      orderBy: { createdAt: 'asc' }
    })
    
    if (records.length === 0) break
    
    allRecords.push(...records)
    skip += batchSize
    
    if (records.length < batchSize) break
  }

  return allRecords
}

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

    // Dynamically discover all Prisma models for future-proof backup
    console.log('🔍 Discovering Prisma models...')
    const modelNames = Object.keys(prisma).filter(
      key => !key.startsWith('_') && !key.startsWith('$') && typeof (prisma as any)[key] === 'object'
    )
    
    console.log(`📋 Found ${modelNames.length} models to backup`)
    
    // Extract all production data INCLUDING sensitive information
    const data: Record<string, any[]> = {}
    
    for (const modelName of modelNames) {
      try {
        console.log(`⏳ Backing up ${modelName}...`)
        // Use findMany to get all records with ALL fields (including passwords, tokens, etc.)
        data[modelName] = await (prisma as any)[modelName].findMany()
        console.log(`✅ ${modelName}: ${data[modelName].length} records`)
      } catch (error) {
        console.warn(`⚠️ Could not backup ${modelName}:`, error)
        data[modelName] = []
      }
    }
    
    const backup = {
      timestamp: new Date().toISOString(),
      version: '3.0', // Updated version for auto-discovery
      type: 'complete',
      environment: 'vercel',
      includes_files: true,
      includes_passwords: true,
      auto_discovered: true,
      created_by: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role
      },
      data,
      
      // File downloads will be added here
      files: {} as Record<string, string>
    }

    // Download actual files from URLs
    const assets = backup.data.asset || [] // Dynamic key name
    const fileDownloadPromises: Promise<void>[] = []
    let downloadedCount = 0
    let failedCount = 0
    
    console.log(`💾 Starting file downloads for ${assets.length} assets...`)

    for (const asset of assets) {
      if (asset.url && asset.filename) {
        const downloadPromise = downloadFile(asset.url, asset.id)
          .then((base64Content) => {
            if (base64Content) {
              backup.files[asset.id] = base64Content
              downloadedCount++
              if (downloadedCount % 10 === 0) {
                
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

    // Calculate statistics
    const stats = Object.entries(backup.data).map(([table, records]) => ({
      table,
      count: Array.isArray(records) ? records.length : 0
    }))
    
    const totalRecords = stats.reduce((sum, stat) => sum + stat.count, 0)
    const totalFiles = Object.keys(backup.files).length

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
    
    // Log specific error details
    if (error instanceof Error) {
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
    }
    
    return NextResponse.json({ 
      error: 'Complete backup failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.name : 'UnknownError'
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
