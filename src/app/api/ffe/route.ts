import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ffeItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.number().min(0).optional(),
  supplierLink: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  leadTime: z.string().optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'SOURCING', 'PROPOSED', 'APPROVED', 'ORDERED', 'DELIVERED', 'COMPLETED']).optional()
})

// Get FFE items for a room
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // Get room info to know the room type
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: session.user.orgId
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get room-specific FFE items (created directly in this room)
    const ffeItems = await prisma.fFEItem.findMany({
      where: {
        roomId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        createdBy: {
          select: { name: true }
        },
        updatedBy: {
          select: { name: true }
        }
      },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Convert room type to library format
    const roomTypeMapping: { [key: string]: string } = {
      'BATHROOM': 'bathroom',
      'MASTER_BATHROOM': 'bathroom',
      'FAMILY_BATHROOM': 'bathroom',
      'GUEST_BATHROOM': 'bathroom',
      'GIRLS_BATHROOM': 'bathroom',
      'BOYS_BATHROOM': 'bathroom',
      'POWDER_ROOM': 'bathroom',
      'KITCHEN': 'kitchen',
      'LIVING_ROOM': 'living-room',
      'BEDROOM': 'bedroom',
      'MASTER_BEDROOM': 'bedroom',
      'GUEST_BEDROOM': 'bedroom',
      'GIRLS_ROOM': 'bedroom',
      'BOYS_ROOM': 'bedroom',
      'DINING_ROOM': 'dining-room',
      'OFFICE': 'office',
      'STUDY_ROOM': 'office',
      'ENTRANCE': 'entrance',
      'FOYER': 'foyer',
      'LAUNDRY_ROOM': 'laundry-room',
      'PLAYROOM': 'playroom'
    }
    
    const libraryRoomType = roomTypeMapping[room.type] || room.type.toLowerCase().replace('_', '-')
    console.log('🔍 Room type mapping:', room.type, '→', libraryRoomType)
    
    // First get custom room types that link to this room type
    const customRoomTypes = await prisma.fFELibraryItem.findMany({
      where: {
        orgId: session.user.orgId,
        itemType: 'ROOM_TYPE', // Special marker for room types
        subItems: {
          path: ['linkedRooms'],
          array_contains: [room.type] // Find room types that include this room in linkedRooms
        }
      }
    })
    
    console.log(`🔍 Found ${customRoomTypes.length} custom room types linked to room type '${room.type}':`, 
      customRoomTypes.map(rt => rt.name))
    
    // Get organization library items that apply to this room type OR any linked custom room type
    const libraryItems = await prisma.fFELibraryItem.findMany({
      where: {
        orgId: session.user.orgId,
        OR: [
          { roomTypes: { has: libraryRoomType } },
          ...customRoomTypes.map(rt => ({ roomTypes: { has: rt.itemId.toLowerCase() } }))
        ],
        // Skip room types themselves but include management items
        NOT: {
          itemType: 'ROOM_TYPE'
        },
        // Only include active items
        isStandard: true
      },
      include: {
        createdBy: {
          select: { name: true }
        },
        updatedBy: {
          select: { name: true }
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })
    
    console.log(`🔍 Found ${libraryItems.length} library items for room type '${libraryRoomType}' (original: '${room.type}')`, {
      orgId: session.user.orgId,
      roomType: room.type,
      mappedRoomType: libraryRoomType,
      itemIds: libraryItems.map(item => ({ id: item.itemId, name: item.name, category: item.category }))
    })

    // Convert library items to FFE item format and combine with room items
    const libraryItemsAsFFE = libraryItems.map(libItem => ({
      id: `lib-${libItem.id}`,
      name: libItem.name,
      category: libItem.category,
      status: 'NOT_STARTED', // Default status for library items
      price: null,
      supplierLink: null,
      notes: libItem.notes,
      leadTime: null,
      isFromLibrary: true,
      libraryItemId: libItem.itemId,
      createdBy: libItem.createdBy,
      updatedBy: libItem.updatedBy,
      createdAt: libItem.createdAt,
      updatedAt: libItem.updatedAt,
      // Add info about custom room type if applicable
      fromCustomRoomType: customRoomTypes.some(rt => 
        libItem.roomTypes.includes(rt.itemId.toLowerCase())) ? 
        customRoomTypes.find(rt => 
          libItem.roomTypes.includes(rt.itemId.toLowerCase()))?.name : null
    }))

    // Combine all items
    const allItems = [...ffeItems, ...libraryItemsAsFFE]

    // Group by category
    const categories = allItems.reduce((acc: any, item) => {
      const category = item.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(item)
      return acc
    }, {})

    // Calculate summary stats
    const stats = {
      totalItems: allItems.length,
      totalBudget: allItems.reduce((sum, item) => sum + (item.price || 0), 0),
      approvedItems: allItems.filter(item => item.status === 'APPROVED').length,
      completedItems: allItems.filter(item => item.status === 'COMPLETED').length,
      suppliers: [...new Set(allItems.filter(item => item.supplierLink).map(item => item.supplierLink))].length
    }

    return NextResponse.json({
      success: true,
      categories,
      items: allItems,
      stats,
      // Include information about linked room types for debugging
      linkedRoomTypes: customRoomTypes.length > 0 ? customRoomTypes.map(rt => ({
        id: rt.id,
        name: rt.name,
        key: rt.itemId
      })) : []
    })

  } catch (error) {
    console.error('FFE GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create new FFE item
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { roomId, ...itemData } = body

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // Validate input
    const validatedData = ffeItemSchema.parse(itemData)

    // Verify room belongs to user's org
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: session.user.orgId
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const ffeItem = await prisma.fFEItem.create({
      data: {
        ...validatedData,
        roomId,
        createdById: session.user.id,
        status: validatedData.status || 'NOT_STARTED'
      },
      include: {
        createdBy: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      item: ffeItem,
      message: 'FFE item created successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation error', 
        details: error.errors 
      }, { status: 400 })
    }
    
    console.error('FFE POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
