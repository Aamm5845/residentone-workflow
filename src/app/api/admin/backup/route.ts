import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/backup - Create and download database backup
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only allow OWNER or ADMIN to create backups
    if (!session?.user || !['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    // Extract all production data
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'production',
      environment: 'vercel',
      created_by: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role
      },
      data: {
        organizations: await prisma.organization.findMany(),
        users: await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orgId: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true
            // Exclude password hash for security
          }
        }),
        clients: await prisma.client.findMany(),
        contractors: await prisma.contractor.findMany(),
        projects: await prisma.project.findMany(),
        rooms: await prisma.room.findMany(),
        stages: await prisma.stage.findMany(),
        designSections: await prisma.designSection.findMany(),
        ffeItems: await prisma.fFEItem.findMany(),
        assets: await prisma.asset.findMany({
          select: {
            id: true,
            title: true,
            filename: true,
            url: true,
            type: true,
            size: true,
            mimeType: true,
            provider: true,
            description: true,
            userDescription: true,
            uploadedBy: true,
            orgId: true,
            projectId: true,
            roomId: true,
            stageId: true,
            sectionId: true,
            ffeItemId: true,
            createdAt: true,
            updatedAt: true
            // Include metadata but not sensitive file content
          }
        }),
        clientAccessTokens: await prisma.clientAccessToken.findMany({
          select: {
            id: true,
            projectId: true,
            name: true,
            active: true,
            expiresAt: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
            lastAccessedAt: true,
            accessCount: true
            // Exclude actual token for security
          }
        }),
        clientAccessLogs: await prisma.clientAccessLog.findMany(),
        // Add other important tables
        approvals: await prisma.approval.findMany(),
        comments: await prisma.comment.findMany(),
        notifications: await prisma.notification.findMany(),
        tasks: await prisma.task.findMany(),
        projectContractors: await prisma.projectContractor.findMany(),
      }
    }

    // Calculate statistics
    const stats = Object.entries(backup.data).map(([table, records]) => ({
      table,
      count: Array.isArray(records) ? records.length : 0
    }))
    
    const totalRecords = stats.reduce((sum, stat) => sum + stat.count, 0)

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
    const filename = `residentone-backup-${timestamp}.json`
    
    // Add metadata to backup
    backup.statistics = {
      total_records: totalRecords,
      tables: stats,
      backup_size_estimate: `${Math.round(JSON.stringify(backup).length / 1024)} KB`
    }
    
    // Return backup as downloadable file
    const backupJson = JSON.stringify(backup, null, 2)
    
    return new NextResponse(backupJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('❌ Backup failed:', error)
    return NextResponse.json({ 
      error: 'Backup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/admin/backup - Get backup info without downloading
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get database statistics without creating full backup
    const stats = {
      organizations: await prisma.organization.count(),
      users: await prisma.user.count(),
      clients: await prisma.client.count(),
      contractors: await prisma.contractor.count(),
      projects: await prisma.project.count(),
      rooms: await prisma.room.count(),
      stages: await prisma.stage.count(),
      ffeItems: await prisma.fFEItem.count(),
      assets: await prisma.asset.count(),
      clientAccessTokens: await prisma.clientAccessToken.count(),
      clientAccessLogs: await prisma.clientAccessLog.count(),
    }

    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0)

    return NextResponse.json({
      success: true,
      statistics: {
        total_records: totalRecords,
        tables: Object.entries(stats).map(([table, count]) => ({ table, count })),
        last_checked: new Date().toISOString(),
        estimated_backup_size: `${Math.round(totalRecords * 0.5)} KB` // Rough estimate
      }
    })

  } catch (error) {
    console.error('❌ Stats failed:', error)
    return NextResponse.json({ 
      error: 'Failed to get backup statistics' 
    }, { status: 500 })
  }
}
