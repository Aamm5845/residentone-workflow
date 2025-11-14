import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { dropboxService } from '@/lib/dropbox-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Regex to match backup filenames
const BACKUP_FILENAME_REGEX = /^database-backup-.*\.json\.gz$/

interface BackupListItem {
  filename: string
  url: string
  uploadedAt: string
  size: number
  pathname: string
}

export async function GET() {
  try {
    // Check authentication
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user has Admin or Owner role
    const userRole = (session.user as any).role
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      return NextResponse.json({ 
        error: 'Forbidden - Admin or Owner role required' 
      }, { status: 403 })
    }
    
    // Check if Dropbox is configured
    if (!dropboxService.isConfigured()) {
      console.warn('[CloudBackups] Dropbox is not configured')
      return NextResponse.json({ 
        error: 'Cloud storage not configured',
        details: 'Dropbox credentials are not properly configured'
      }, { status: 503 })
    }
    
    // List backup files from Dropbox
    const backupFolderPath = '/Software Backups' // Relative to shared link root
    console.log(`[CloudBackups] Listing backups from: ${backupFolderPath}`)
    
    let folderContents
    try {
      folderContents = await dropboxService.listFolder(backupFolderPath)
    } catch (error: any) {
      // Check if folder doesn't exist
      if (error.message?.includes('not_found') || error.message?.includes('path/not_found')) {
        console.log('[CloudBackups] Backup folder not found in Dropbox')
        return NextResponse.json({
          success: true,
          backups: [],
          count: 0,
          message: 'No backup folder found yet. Backups will appear here after the first scheduled backup runs.'
        })
      }
      throw error
    }
    
    // Filter to only backup files that match our naming pattern
    const backupFiles = folderContents.files.filter(file => 
      BACKUP_FILENAME_REGEX.test(file.name)
    )
    
    console.log(`[CloudBackups] Found ${backupFiles.length} backup files`)
    
    // Get download URLs for each backup file
    const backupsWithUrls: BackupListItem[] = []
    
    for (const file of backupFiles) {
      try {
        // Get temporary download link (expires in 4 hours)
        const downloadUrl = await dropboxService.getTemporaryLink(file.path)
        
        if (downloadUrl) {
          backupsWithUrls.push({
            filename: file.name,
            url: downloadUrl,
            uploadedAt: file.lastModified.toISOString(),
            size: file.size,
            pathname: file.path
          })
        } else {
          console.warn(`[CloudBackups] Failed to get download URL for: ${file.name}`)
        }
      } catch (error) {
        console.error(`[CloudBackups] Error getting download URL for ${file.name}:`, error)
        // Continue with other files
      }
    }
    
    // Sort by uploadedAt descending (newest first)
    backupsWithUrls.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    
    console.log(`[CloudBackups] Successfully prepared ${backupsWithUrls.length} backups`)
    
    return NextResponse.json(
      {
        success: true,
        backups: backupsWithUrls,
        count: backupsWithUrls.length
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    )
    
  } catch (error: any) {
    console.error('[CloudBackups] Failed to list cloud backups:', error)
    
    return NextResponse.json({ 
      error: 'Failed to list cloud backups',
      details: error.message || 'An unexpected error occurred'
    }, { status: 500 })
  }
}
