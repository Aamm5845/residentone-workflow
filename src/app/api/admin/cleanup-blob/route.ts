import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { list, del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { blobs } = await list()
    
    // Group by folder
    const byFolder: Record<string, any[]> = {}
    let totalSize = 0

    for (const blob of blobs) {
      const folder = blob.pathname.split('/')[0] || 'root'
      if (!byFolder[folder]) {
        byFolder[folder] = []
      }
      byFolder[folder].push({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt
      })
      totalSize += blob.size
    }

    return NextResponse.json({
      success: true,
      totalFiles: blobs.length,
      totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
      folders: Object.entries(byFolder).map(([folder, files]) => ({
        folder,
        fileCount: files.length,
        sizeMB: (files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2),
        files: files.slice(0, 5) // First 5 files as preview
      }))
    })
  } catch (error) {
    console.error('Error listing blob storage:', error)
    return NextResponse.json({ error: 'Failed to list storage' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, patterns } = await request.json()

    if (action === 'delete') {
      const { blobs } = await list()
      
      // Filter files to delete based on patterns
      let filesToDelete = blobs
      
      if (patterns?.includes('backups')) {
        filesToDelete = filesToDelete.filter(b => 
          b.pathname.includes('backup') || 
          b.pathname.includes('Backup') ||
          b.pathname.endsWith('.json') ||
          b.pathname.endsWith('.sql')
        )
      }
      
      if (patterns?.includes('spec-books')) {
        filesToDelete = filesToDelete.filter(b => 
          b.pathname.startsWith('spec-books/') ||
          b.pathname.includes('spec-book') ||
          b.pathname.includes('specbook')
        )
      }
      
      if (patterns?.includes('old-orgs')) {
        filesToDelete = filesToDelete.filter(b => 
          b.pathname.startsWith('orgs/') &&
          new Date(b.uploadedAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Older than 30 days
        )
      }

      let deletedCount = 0
      let freedSpace = 0
      const errors: string[] = []

      for (const file of filesToDelete) {
        try {
          await del(file.url)
          deletedCount++
          freedSpace += file.size
        } catch (error) {
          errors.push(`Failed to delete ${file.pathname}: ${error}`)
        }
      }

      return NextResponse.json({
        success: true,
        deletedCount,
        freedSpaceGB: (freedSpace / 1024 / 1024 / 1024).toFixed(2),
        errors
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error cleaning blob storage:', error)
    return NextResponse.json({ error: 'Failed to clean storage' }, { status: 500 })
  }
}
