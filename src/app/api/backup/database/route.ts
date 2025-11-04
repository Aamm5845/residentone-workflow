import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { isValidAuthSession } from '@/lib/attribution'

export const maxDuration = 300 // 5 minutes for backup

// POST /api/backup/database - Create and upload database backup to Dropbox
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admins to backup database
    if (session.user.role !== 'ADMIN' && session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    console.log('🔄 Starting database backup...')

    // Export all data from database
    const [
      organizations,
      users,
      projects,
      rooms,
      stages,
      renderingVersions,
      assets,
      activities,
      notifications,
      comments,
      messages
    ] = await Promise.all([
      prisma.organization.findMany({ include: { members: true } }),
      prisma.user.findMany(),
      prisma.project.findMany(),
      prisma.room.findMany(),
      prisma.stage.findMany(),
      prisma.renderingVersion.findMany(),
      prisma.asset.findMany(),
      prisma.activity.findMany(),
      prisma.notification.findMany(),
      prisma.comment.findMany(),
      prisma.message.findMany()
    ])

    const backupData = {
      metadata: {
        backupDate: new Date().toISOString(),
        version: '1.0',
        source: 'Meisner Interiors Workflow',
        totalRecords: {
          organizations: organizations.length,
          users: users.length,
          projects: projects.length,
          rooms: rooms.length,
          stages: stages.length,
          renderingVersions: renderingVersions.length,
          assets: assets.length,
          activities: activities.length,
          notifications: notifications.length,
          comments: comments.length,
          messages: messages.length
        }
      },
      data: {
        organizations,
        users,
        projects,
        rooms,
        stages,
        renderingVersions,
        assets,
        activities,
        notifications,
        comments,
        messages
      }
    }

    // Convert to JSON
    const jsonData = JSON.stringify(backupData, null, 2)
    const buffer = Buffer.from(jsonData, 'utf-8')

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `database-backup-${timestamp}.json`
    const dropboxPath = `/Meisner Interiors Team Folder/Software Backups/${filename}`

    // Ensure backup folder exists
    try {
      await dropboxService.createFolder('/Meisner Interiors Team Folder/Software Backups')
    } catch (error) {
      console.log('Backup folder may already exist')
    }

    // Upload to Dropbox (overwrite if same day backup exists)
    await dropboxService.uploadFile(dropboxPath, buffer, { mode: 'overwrite' })

    console.log(`✅ Database backup completed: ${dropboxPath}`)

    return NextResponse.json({
      success: true,
      message: 'Database backup completed successfully',
      filename,
      path: dropboxPath,
      size: buffer.length,
      records: backupData.metadata.totalRecords
    })

  } catch (error) {
    console.error('❌ Database backup failed:', error)
    return NextResponse.json({
      error: `Database backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}
