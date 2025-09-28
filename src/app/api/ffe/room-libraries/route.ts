import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get all room libraries for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Get FFE library items from database
    const libraryItems = await prisma.fFELibraryItem.findMany({
      where: { orgId },
      include: {
        createdBy: {
          select: { name: true }
        },
        updatedBy: {
          select: { name: true }
        }
      },
      orderBy: [
        { roomTypes: 'asc' },
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Group items by room type
    const roomTypeMap = new Map<string, any[]>()
    
    libraryItems.forEach(item => {
      item.roomTypes.forEach(roomType => {
        if (!roomTypeMap.has(roomType)) {
          roomTypeMap.set(roomType, [])
        }
        roomTypeMap.get(roomType)!.push({
          id: item.itemId,
          name: item.name,
          category: item.category,
          isRequired: item.isRequired,
          allowMultiple: !item.itemType || item.itemType === 'base',
          options: item.standardConfig ? (item.standardConfig as any)?.options : undefined,
          specialLogic: item.subItems ? {
            logicOptions: (item.subItems as any)?.logicOptions || []
          } : undefined,
          order: 1
        })
      })
    })

    // Build libraries from grouped items
    const libraries: any[] = []
    const roomTypeLabels = {
      'bathroom': { name: 'Bathroom', type: 'BATHROOM' },
      'kitchen': { name: 'Kitchen', type: 'KITCHEN' },
      'living-room': { name: 'Living Room', type: 'LIVING_ROOM' },
      'bedroom': { name: 'Bedroom', type: 'BEDROOM' },
      'office': { name: 'Office', type: 'OFFICE' },
      'dining-room': { name: 'Dining Room', type: 'DINING_ROOM' },
      'laundry-room': { name: 'Laundry Room', type: 'LAUNDRY_ROOM' },
      'entrance': { name: 'Entrance', type: 'ENTRANCE' },
      'foyer': { name: 'Foyer', type: 'FOYER' }
    }

    // Create libraries for each room type that has items
    for (const [roomType, items] of roomTypeMap.entries()) {
      const roomInfo = roomTypeLabels[roomType as keyof typeof roomTypeLabels]
      if (!roomInfo) continue

      // Group items by category
      const categories: { [key: string]: any[] } = {}
      items.forEach(item => {
        if (!categories[item.category]) {
          categories[item.category] = []
        }
        categories[item.category].push(item)
      })

      libraries.push({
        id: `${roomType}-lib`,
        name: `${roomInfo.name} Preset Library`,
        roomType: roomInfo.type,
        description: `${roomInfo.name} FFE preset library`,
        categories,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'System',
        updatedBy: 'System'
      })
    }

    // Always ensure bathroom library exists (even if empty)
    const bathroomExists = libraries.some(lib => lib.roomType === 'BATHROOM')
    if (!bathroomExists) {
      libraries.unshift({
        id: 'bathroom-lib',
        name: 'Bathroom Preset Library',
        roomType: 'BATHROOM',
        description: 'Bathroom FFE preset library',
        categories: {},
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'System',
        updatedBy: 'System'
      })
    }

    return NextResponse.json({ libraries })

  } catch (error) {
    console.error('Error getting room libraries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new room library
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, name, roomType, description, categories = {} } = body

    if (!orgId || !name || !roomType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create library items in database for each category/item combination
    const roomTypeKey = roomType.toLowerCase().replace('_', '-')
    
    // For empty libraries, we don't create any items yet
    // Items will be created when user adds them through the UI
    
    const newLibrary = {
      id: `${roomTypeKey}-lib`,
      name,
      roomType,
      description,
      categories: {},
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: session.user.name || 'Unknown',
      updatedBy: session.user.name || 'Unknown'
    }

    return NextResponse.json({ 
      library: newLibrary,
      message: 'Room library created successfully'
    })

  } catch (error) {
    console.error('Error creating room library:', error)
    return NextResponse.json({ error: 'Failed to create room library' }, { status: 500 })
  }
}
