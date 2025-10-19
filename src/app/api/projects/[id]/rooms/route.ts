import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { autoAssignPhasesToTeam } from '@/lib/utils/auto-assignment'
import { RoomType, StageType, StageStatus } from '@prisma/client'
import type { Session } from 'next-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { type, name, customName, floorId } = data

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Note: Floor functionality temporarily disabled as Floor model doesn't exist in schema
    // TODO: Add Floor model to Prisma schema if floor organization is needed
    if (floorId) {
      // Skip floor validation for now since Floor model doesn't exist
      console.warn('Floor assignment skipped - Floor model not implemented in schema')
    }

    // Create new room (floorId set to null since Floor model doesn't exist)
    const room = await prisma.room.create({
      data: {
        projectId: project.id,
        type: type as RoomType,
        name: customName || name,
        status: 'NOT_STARTED'
      }
    })

    // Create workflow stages (without assignments - auto-assignment will handle this)
    const stages = [
      {
        roomId: room.id,
        type: 'DESIGN' as StageType,
        status: 'NOT_STARTED' as StageStatus,
        assignedTo: null
      },
      {
        roomId: room.id,
        type: 'THREE_D' as StageType,
        status: 'NOT_STARTED' as StageStatus, 
        assignedTo: null
      },
      {
        roomId: room.id,
        type: 'CLIENT_APPROVAL' as StageType,
        status: 'NOT_STARTED' as StageStatus,
        assignedTo: null
      },
      {
        roomId: room.id,
        type: 'DRAWINGS' as StageType,
        status: 'NOT_STARTED' as StageStatus,
        assignedTo: null
      },
      {
        roomId: room.id,
        type: 'FFE' as StageType,
        status: 'NOT_STARTED' as StageStatus,
        assignedTo: null
      }
    ]

    await prisma.stage.createMany({
      data: stages
    })

    // Auto-assign stages to team members based on their roles
    try {
      // Get shared organization
      const sharedOrg = await prisma.organization.findFirst()
      if (sharedOrg) {
        const assignmentResult = await autoAssignPhasesToTeam(room.id, sharedOrg.id)
        
      }
    } catch (assignmentError) {
      console.error('Failed to auto-assign phases to team:', assignmentError)
      // Don't fail room creation if assignment fails
    }

    // Create design sections for the design stage
    const designStage = await prisma.stage.findFirst({
      where: { roomId: room.id, type: 'DESIGN' }
    })

    if (designStage) {
      await prisma.designSection.createMany({
        data: [
          { stageId: designStage.id, type: 'GENERAL' },
          { stageId: designStage.id, type: 'WALL_COVERING' },
          { stageId: designStage.id, type: 'CEILING' },
          { stageId: designStage.id, type: 'FLOOR' }
        ]
      })
    }

    // Create default FFE items based on room type
    const defaultFFEItems = await getDefaultFFEItems(type as RoomType)
    if (defaultFFEItems.length > 0) {
      await prisma.fFEItem.createMany({
        data: defaultFFEItems.map(item => ({
          roomId: room.id,
          name: item.name,
          category: item.category,
          status: 'NOT_STARTED'
        }))
      })
    }

    // Return the created room with all relations
    const fullRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        stages: {
          include: {
            assignedUser: {
              select: { name: true }
            },
            designSections: true
          }
        },
        ffeItems: true
      }
    })

    return NextResponse.json(fullRoom, { status: 201 })
  } catch (error) {
    console.error('Error adding room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to get default FFE items for room types
// REMOVED ALL HARDCODED DEFAULTS - Users now manage all FFE items themselves
async function getDefaultFFEItems(roomType: RoomType) {
  // Return empty array - no hardcoded defaults
  return []
}
