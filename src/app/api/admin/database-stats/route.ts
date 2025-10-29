import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow OWNER and ADMIN to access database statistics
    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient privileges' }, { status: 403 })
    }

    // Get organization-specific statistics
    const orgId = session.user.orgId

    // Run all queries in parallel for better performance
    const [
      projectCount,
      roomCount,
      stageCount,
      assetCount,
      userCount,
      orgCount
    ] = await Promise.all([
      prisma.project.count({
        where: { orgId }
      }),
      prisma.room.count({
        where: {
          project: { orgId }
        }
      }),
      prisma.stage.count({
        where: {
          room: {
            project: { orgId }
          }
        }
      }),
      prisma.asset.count({
        where: { orgId }
      }),
      prisma.user.count({
        where: { orgId }
      }),
      prisma.organization.count()
    ])

    const totalRecords = projectCount + roomCount + stageCount + assetCount + userCount

    // Estimate database size based on record counts
    // This is a rough estimation - in production you might want to query actual database size
    const estimatedSizeKB = Math.round(
      (projectCount * 2) + 
      (roomCount * 1.5) + 
      (stageCount * 1) + 
      (assetCount * 0.5) + 
      (userCount * 3) + 
      100 // Base overhead
    )
    
    const databaseSize = estimatedSizeKB > 1024 
      ? `${(estimatedSizeKB / 1024).toFixed(1)} MB`
      : `${estimatedSizeKB} KB`

    const statistics = {
      projects: projectCount,
      rooms: roomCount,
      stages: stageCount,
      assets: assetCount,
      users: userCount,
      organizations: orgCount,
      totalRecords,
      databaseSize,
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json(statistics)
  } catch (error) {
    console.error('Error fetching database statistics:', error)
    
    // Return fallback data if database query fails
    return NextResponse.json({
      projects: 0,
      rooms: 0,
      stages: 0,
      assets: 0,
      users: 0,
      organizations: 1,
      totalRecords: 0,
      databaseSize: 'Unknown',
      lastUpdated: new Date().toISOString(),
      error: 'Failed to fetch statistics from database'
    }, { status: 500 })
  }
}
