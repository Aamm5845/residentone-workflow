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
        console.log(`Auto-assigned ${assignmentResult.assignedCount} stages for new room ${room.id}`)
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
async function getDefaultFFEItems(roomType: RoomType) {
  const presets: Record<RoomType, Array<{ name: string, category: string }>> = {
    // Entry & Circulation
    ENTRANCE: [
      { name: 'Entry Console Table', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Entry Mirror', category: 'Accessories' },
      { name: 'Entry Rug', category: 'Accessories' }
    ],
    FOYER: [
      { name: 'Chandelier', category: 'Lighting' },
      { name: 'Console Table', category: 'Furniture' },
      { name: 'Decorative Objects', category: 'Accessories' },
      { name: 'Area Rug', category: 'Accessories' }
    ],
    STAIRCASE: [
      { name: 'Stair Runner', category: 'Textiles' },
      { name: 'Wall Sconces', category: 'Lighting' },
      { name: 'Handrail Finishes', category: 'Hardware' }
    ],
    
    // Living Spaces
    LIVING_ROOM: [
      { name: 'Sofa', category: 'Furniture' },
      { name: 'Lounge Chairs', category: 'Furniture' },
      { name: 'Coffee Table', category: 'Furniture' },
      { name: 'Side Tables', category: 'Furniture' },
      { name: 'Floor Lamps', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' },
      { name: 'Artwork', category: 'Accessories' }
    ],
    DINING_ROOM: [
      { name: 'Dining Table', category: 'Furniture' },
      { name: 'Dining Chairs', category: 'Furniture' },
      { name: 'Chandelier', category: 'Lighting' },
      { name: 'Sideboard', category: 'Furniture' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    KITCHEN: [
      { name: 'Cabinet Hardware', category: 'Hardware' },
      { name: 'Countertops', category: 'Finishes' },
      { name: 'Backsplash Tile', category: 'Finishes' },
      { name: 'Light Fixtures', category: 'Lighting' },
      { name: 'Bar Stools', category: 'Furniture' }
    ],
    STUDY_ROOM: [
      { name: 'Study Desk', category: 'Furniture' },
      { name: 'Desk Chair', category: 'Furniture' },
      { name: 'Bookshelves', category: 'Furniture' },
      { name: 'Desk Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' }
    ],
    OFFICE: [
      { name: 'Desk', category: 'Furniture' },
      { name: 'Office Chair', category: 'Furniture' },
      { name: 'Desk Lamp', category: 'Lighting' },
      { name: 'Storage Units', category: 'Furniture' },
      { name: 'Area Rug', category: 'Accessories' }
    ],
    PLAYROOM: [
      { name: 'Storage Cubes', category: 'Furniture' },
      { name: 'Play Table & Chairs', category: 'Furniture' },
      { name: 'Toy Storage', category: 'Furniture' },
      { name: 'Ceiling Light', category: 'Lighting' },
      { name: 'Soft Play Rug', category: 'Accessories' }
    ],
    
    // Bedrooms
    MASTER_BEDROOM: [
      { name: 'King Size Bed Frame', category: 'Furniture' },
      { name: 'Upholstered Headboard', category: 'Furniture' },
      { name: 'Nightstands (Set of 2)', category: 'Furniture' },
      { name: 'Table Lamps (Set of 2)', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' },
      { name: 'Dresser', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' }
    ],
    GIRLS_ROOM: [
      { name: 'Twin/Full Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstand', category: 'Furniture' },
      { name: 'Dresser', category: 'Furniture' },
      { name: 'Desk & Chair', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    BOYS_ROOM: [
      { name: 'Twin/Full Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstand', category: 'Furniture' },
      { name: 'Dresser', category: 'Furniture' },
      { name: 'Desk & Chair', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    GUEST_BEDROOM: [
      { name: 'Queen Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstands (Set of 2)', category: 'Furniture' },
      { name: 'Table Lamps', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    
    // Bathrooms
    POWDER_ROOM: [
      { name: 'Powder Room Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Wallcovering', category: 'Finishes' }
    ],
    MASTER_BATHROOM: [
      { name: 'Double Vanity', category: 'Furniture' },
      { name: 'Vanity Mirrors (Set of 2)', category: 'Accessories' },
      { name: 'Vanity Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware Package', category: 'Hardware' },
      { name: 'Shower Fixtures', category: 'Plumbing' },
      { name: 'Bathtub', category: 'Plumbing' }
    ],
    FAMILY_BATHROOM: [
      { name: 'Single Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Vanity Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware Package', category: 'Hardware' },
      { name: 'Tub/Shower Combo', category: 'Plumbing' }
    ],
    GIRLS_BATHROOM: [
      { name: 'Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Fun Tile Selection', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' }
    ],
    BOYS_BATHROOM: [
      { name: 'Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' }
    ],
    GUEST_BATHROOM: [
      { name: 'Powder Room Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Tile Selection', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' }
    ],
    BATHROOM: [
      { name: 'Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Tile', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' },
      { name: 'Shower Fixtures', category: 'Plumbing' }
    ],
    
    // Utility
    LAUNDRY_ROOM: [
      { name: 'Utility Sink', category: 'Plumbing' },
      { name: 'Countertop', category: 'Finishes' },
      { name: 'Upper Cabinets', category: 'Furniture' },
      { name: 'Hardware', category: 'Hardware' },
      { name: 'Task Lighting', category: 'Lighting' }
    ],
    
    // Special
    SUKKAH: [
      { name: 'Structural Elements', category: 'Construction' },
      { name: 'Schach Materials', category: 'Construction' },
      { name: 'Decorations', category: 'Accessories' },
      { name: 'Seating', category: 'Furniture' },
      { name: 'Table', category: 'Furniture' }
    ],
    
    // Legacy room types (keep for compatibility)
    BEDROOM: [
      { name: 'Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstand', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
    FAMILY_ROOM: [],
    HALLWAY: [],
    PANTRY: [],
    LAUNDRY: [],
    MUDROOM: [],
    CLOSET: [],
    OUTDOOR: [],
    OTHER: []
  }

  return presets[roomType] || []
}
