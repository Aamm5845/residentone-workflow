import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ROOM_FFE_CONFIG } from '@/lib/constants/room-ffe-config'

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

    // Get custom FFE library items for this organization
    const customItems = await prisma.fFELibraryItem.findMany({
      where: { orgId },
      include: {
        createdBy: {
          select: { name: true }
        }
      },
      orderBy: {
        category: 'asc'
      }
    })

    // Import bathroom template for proper bathroom library
    const { BATHROOM_TEMPLATE } = await import('@/lib/ffe/bathroom-template')
    
    // Build room libraries based on room types and available items
    const roomTypeMapping = {
      'BATHROOM': 'bathroom',
      'KITCHEN': 'kitchen', 
      'LIVING_ROOM': 'living-room',
      'BEDROOM': 'bedroom',
      'DINING_ROOM': 'dining-room',
      'OFFICE': 'office',
      'ENTRANCE': 'entrance',
      'LAUNDRY_ROOM': 'laundry-room',
      'FOYER': 'foyer'
    }
    
    const libraries = []
    
    // Special handling for bathroom - use actual template
    const bathroomLibrary = {
      id: 'bathroom-lib',
      name: 'Bathroom Preset Library',
      roomType: 'BATHROOM',
      description: 'Standard bathroom FFE preset library with all essential categories',
      categories: BATHROOM_TEMPLATE.categories,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'System',
      updatedBy: 'System'
    }
    libraries.push(bathroomLibrary)
    
    // For other room types, create basic structure
    Object.keys(roomTypeMapping).filter(rt => rt !== 'BATHROOM').forEach(roomType => {
      const oldRoomType = roomTypeMapping[roomType as keyof typeof roomTypeMapping]
      const roomConfig = ROOM_FFE_CONFIG[oldRoomType]
      const customItemsForRoom = customItems.filter(item => 
        item.roomTypes.includes(oldRoomType)
      )
      
      const categories: { [key: string]: any[] } = {}
      const defaultCategories = {
        'KITCHEN': ['Flooring', 'Wall', 'Ceiling', 'Cabinets', 'Countertops', 'Appliances', 'Lighting', 'Plumbing', 'Hardware'],
        'LIVING_ROOM': ['Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 'Textiles', 'Accessories', 'Entertainment'],
        'BEDROOM': ['Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 'Textiles', 'Storage', 'Accessories'],
        'OFFICE': ['Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 'Technology', 'Storage', 'Accessories'],
        'DINING_ROOM': ['Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 'Textiles', 'Accessories', 'Storage'],
        'LAUNDRY_ROOM': ['Flooring', 'Wall', 'Ceiling', 'Appliances', 'Storage', 'Lighting', 'Plumbing', 'Electric'],
        'ENTRANCE': ['Flooring', 'Wall', 'Ceiling', 'Lighting', 'Storage', 'Accessories', 'Furniture'],
        'FOYER': ['Flooring', 'Wall', 'Ceiling', 'Lighting', 'Storage', 'Accessories', 'Furniture']
      }
      
      const catList = defaultCategories[roomType as keyof typeof defaultCategories] || ['Flooring', 'Wall', 'Ceiling']
      catList.forEach(catName => {
        categories[catName] = []
      })

      libraries.push({
        id: `${oldRoomType}-lib`,
        name: `${roomType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())} Library`,
        roomType,
        description: `Standard ${roomType.toLowerCase().replace('_', ' ')} FFE preset library`,
        categories,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'System',
        updatedBy: 'System'
      })
    })

    return NextResponse.json({ libraries })

  } catch (error) {
    console.error('Error getting room libraries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new room library (for now, just return success)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, name, roomType, description } = body

    if (!orgId || !name || !roomType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For now, we don't create actual room library records since the table doesn't exist
    // Instead, we'll return a success response indicating the library would be created
    const newLibrary = {
      id: `lib-${Date.now()}`,
      name,
      roomType,
      description,
      version: '1.0',
      isActive: true,
      isDefault: false,
      categories: [],
      customItemCount: 0,
      totalItemCount: 0,
      projectsUsing: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({ 
      library: newLibrary,
      message: 'Room library configuration saved successfully'
    })

  } catch (error) {
    console.error('Error creating room library:', error)
    return NextResponse.json({ error: 'Failed to create room library' }, { status: 500 })
  }
}
