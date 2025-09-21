import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { RoomType, ProjectType, StageType, StageStatus } from '@prisma/client'
import type { Session } from 'next-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { orgId: session.user.orgId },
      include: {
        client: true,
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: true
              }
            }
          }
        },
        _count: {
          select: { 
            rooms: true,
            assets: true,
            approvals: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = session.user
    
    const data = await request.json()
    const {
      name,
      description,
      type,
      clientId,
      clientName,
      clientEmail,
      clientPhone,
      budget,
      dueDate,
      selectedRooms
    } = data

    // Create or find client
    let client
    if (clientId && clientId !== 'new') {
      // Find existing client
      client = await prisma.client.findUnique({
        where: { id: clientId }
      })
    } else {
      // Create new client
      const existingClient = await prisma.client.findFirst({
        where: {
          orgId: session.user.orgId,
          email: clientEmail
        }
      })

      if (existingClient) {
        client = existingClient
      } else {
        client = await prisma.client.create({
          data: {
            name: clientName,
            email: clientEmail,
            phone: clientPhone || null,
            orgId: session.user.orgId
          }
        })
      }
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found or created' }, { status: 400 })
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        type: type as ProjectType,
        clientId: client.id,
        budget: budget || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        orgId: session.user.orgId,
        createdById: session.user.id,
        status: 'IN_PROGRESS'
      }
    })

    // Get team members for stage assignments
    const teamMembers = await prisma.user.findMany({
      where: { orgId: session.user.orgId }
    })

    const designer = teamMembers.find(u => u.role === 'DESIGNER')
    const renderer = teamMembers.find(u => u.role === 'RENDERER') 
    const drafter = teamMembers.find(u => u.role === 'DRAFTER')
    const ffe = teamMembers.find(u => u.role === 'FFE')

    // Create rooms and stages
    for (const roomData of selectedRooms) {
      // Handle both old format (string) and new format (object)
      const roomType = typeof roomData === 'string' ? roomData : roomData.type
      const roomName = typeof roomData === 'string' ? null : (roomData.customName || roomData.name)
      
      const room = await prisma.room.create({
        data: {
          projectId: project.id,
          type: roomType as RoomType,
          name: roomName,
          status: 'NOT_STARTED'
        }
      })

      // Create all 6 workflow stages for each room
      const stages = [
        {
          roomId: room.id,
          type: 'DESIGN' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: designer?.id || null
        },
        {
          roomId: room.id,
          type: 'DESIGN_CONCEPT' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: designer?.id || null
        },
        {
          roomId: room.id,
          type: 'THREE_D' as StageType,
          status: 'NOT_STARTED' as StageStatus, 
          assignedTo: renderer?.id || null
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
          assignedTo: drafter?.id || null
        },
        {
          roomId: room.id,
          type: 'FFE' as StageType,
          status: 'NOT_STARTED' as StageStatus,
          assignedTo: ffe?.id || null
        }
      ]

      await prisma.stage.createMany({
        data: stages
      })

      // TODO: Create design sections for the design stage (temporarily disabled due to schema sync issues)
      // const designStage = await projectPrisma.stage.findFirst({
      //   where: { roomId: room.id, type: 'DESIGN' }
      // })

      // if (designStage) {
      //   await projectPrisma.designSection.createMany({
      //     data: [
      //       { stageId: designStage.id, type: 'WALLS' },
      //       { stageId: designStage.id, type: 'FURNITURE' },
      //       { stageId: designStage.id, type: 'LIGHTING' },
      //       { stageId: designStage.id, type: 'GENERAL' }
      //     ]
      //   })
      // }

      // Create default FFE items based on room type
      const defaultFFEItems = await getDefaultFFEItems(roomType as RoomType)
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
    }

    // Return the created project with full details
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        client: true,
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: true
              }
            },
            ffeItems: true
          }
        }
      }
    })

    return NextResponse.json(fullProject, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to get default FFE items for room types
async function getDefaultFFEItems(roomType: RoomType) {
  const presets: Record<RoomType, Array<{ name: string, category: string }>> = {
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
    BEDROOM: [
      { name: 'Bed Frame', category: 'Furniture' },
      { name: 'Headboard', category: 'Furniture' },
      { name: 'Nightstand', category: 'Furniture' },
      { name: 'Table Lamp', category: 'Lighting' },
      { name: 'Area Rug', category: 'Accessories' },
      { name: 'Window Treatments', category: 'Textiles' }
    ],
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
    BATHROOM: [
      { name: 'Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Tile', category: 'Finishes' },
      { name: 'Hardware', category: 'Hardware' },
      { name: 'Shower Fixtures', category: 'Plumbing' }
    ],
    POWDER_ROOM: [
      { name: 'Powder Room Vanity', category: 'Furniture' },
      { name: 'Mirror', category: 'Accessories' },
      { name: 'Sconces', category: 'Lighting' },
      { name: 'Wallcovering', category: 'Finishes' }
    ],
    OFFICE: [
      { name: 'Desk', category: 'Furniture' },
      { name: 'Office Chair', category: 'Furniture' },
      { name: 'Desk Lamp', category: 'Lighting' },
      { name: 'Storage Units', category: 'Furniture' },
      { name: 'Area Rug', category: 'Accessories' }
    ],
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
    STUDY_ROOM: [
      { name: 'Study Desk', category: 'Furniture' },
      { name: 'Desk Chair', category: 'Furniture' },
      { name: 'Bookshelves', category: 'Furniture' },
      { name: 'Desk Lamp', category: 'Lighting' },
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
