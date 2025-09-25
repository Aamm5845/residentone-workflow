import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get version history for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    const whereClause: any = { orgId }

    if (entityType) {
      whereClause.entityType = entityType
    }

    if (entityId) {
      whereClause.entityId = entityId
    }

    const [history, total] = await Promise.all([
      prisma.fFEVersionHistory.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.fFEVersionHistory.count({ where: whereClause })
    ])

    return NextResponse.json({ 
      history, 
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit
      }
    })

  } catch (error) {
    console.error('Error getting FFE version history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a version snapshot
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, entityType, entityId, description } = body

    if (!orgId || !entityType || !entityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let entitySnapshot: any = null
    let version = '1.0'

    // Get the current state of the entity
    switch (entityType) {
      case 'room_library':
        entitySnapshot = await prisma.fFERoomLibrary.findUnique({
          where: { id: entityId }
        })
        version = entitySnapshot?.version || '1.0'
        break

      case 'category':
        entitySnapshot = await prisma.fFECategory.findUnique({
          where: { id: entityId }
        })
        break

      case 'item_template':
        entitySnapshot = await prisma.fFEItemTemplate.findUnique({
          where: { id: entityId }
        })
        version = entitySnapshot?.version || '1.0'
        break

      default:
        return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    if (!entitySnapshot) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    // Check if this entity is used in any active projects
    const affectedProjects = await getAffectedProjects(orgId, entityType, entityId)

    // Create version history entry
    const versionHistory = await prisma.fFEVersionHistory.create({
      data: {
        orgId,
        entityType,
        entityId,
        version,
        changeType: 'created',
        changeDescription: description || `Snapshot of ${entityType} created`,
        changeDetails: [],
        entitySnapshot,
        affectedProjects,
        migrationRequired: false,
        autoMigrationPossible: true,
        createdById: session.user.id
      }
    })

    return NextResponse.json({ 
      versionHistory, 
      message: 'Version snapshot created successfully' 
    })

  } catch (error) {
    console.error('Error creating version snapshot:', error)
    return NextResponse.json({ error: 'Failed to create version snapshot' }, { status: 500 })
  }
}

// Helper function to get affected projects
async function getAffectedProjects(orgId: string, entityType: string, entityId: string) {
  try {
    switch (entityType) {
      case 'room_library':
        const libraryUsage = await prisma.fFEProjectConfiguration.findMany({
          where: {
            roomLibraries: {
              path: '$[*].libraryId',
              string_contains: entityId
            }
          },
          include: {
            project: { select: { id: true, name: true } }
          }
        })

        return libraryUsage.map(config => ({
          projectId: config.project.id,
          projectName: config.project.name,
          roomCount: (config.roomLibraries as any[]).filter(
            (rl: any) => rl.libraryId === entityId
          ).length,
          impact: 'major' as const
        }))

      case 'category':
        // Find items in this category and check their usage
        const categoryItems = await prisma.fFEItemTemplate.findMany({
          where: { orgId, category: entityId },
          select: { id: true }
        })

        if (categoryItems.length === 0) return []

        // This is a simplified check - in a real implementation,
        // you'd need to check project-specific FFE usage
        return []

      case 'item_template':
        // Check if this item template is used in any project configurations
        const itemUsage = await prisma.fFEProjectConfiguration.findMany({
          where: {
            customItems: {
              path: '$[*].id',
              string_contains: entityId
            }
          },
          include: {
            project: { select: { id: true, name: true } }
          }
        })

        return itemUsage.map(config => ({
          projectId: config.project.id,
          projectName: config.project.name,
          roomCount: 1, // Simplified
          impact: 'minor' as const
        }))

      default:
        return []
    }
  } catch (error) {
    console.error('Error getting affected projects:', error)
    return []
  }
}

// Restore from a version
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { versionId, orgId } = body

    if (!versionId || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check permissions
    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const version = await prisma.fFEVersionHistory.findUnique({
      where: { id: versionId }
    })

    if (!version || version.orgId !== orgId) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const { entityType, entityId, entitySnapshot } = version

    // Restore the entity to the saved state
    switch (entityType) {
      case 'room_library':
        await prisma.fFERoomLibrary.update({
          where: { id: entityId },
          data: {
            ...entitySnapshot as any,
            id: entityId, // Keep the same ID
            updatedById: session.user.id,
            updatedAt: new Date()
          }
        })
        break

      case 'category':
        await prisma.fFECategory.update({
          where: { id: entityId },
          data: {
            ...entitySnapshot as any,
            id: entityId,
            updatedById: session.user.id,
            updatedAt: new Date()
          }
        })
        break

      case 'item_template':
        await prisma.fFEItemTemplate.update({
          where: { id: entityId },
          data: {
            ...entitySnapshot as any,
            id: entityId,
            updatedById: session.user.id,
            updatedAt: new Date()
          }
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    // Create a new version history entry for the restoration
    await prisma.fFEVersionHistory.create({
      data: {
        orgId,
        entityType,
        entityId,
        version: (version.version + '.restored'),
        changeType: 'restored',
        changeDescription: `Restored ${entityType} from version ${version.version}`,
        changeDetails: [{
          field: 'restored_from',
          oldValue: 'current_state',
          newValue: version.version
        }],
        entitySnapshot,
        createdById: session.user.id
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: `${entityType} restored to version ${version.version}` 
    })

  } catch (error) {
    console.error('Error restoring from version:', error)
    return NextResponse.json({ error: 'Failed to restore from version' }, { status: 500 })
  }
}