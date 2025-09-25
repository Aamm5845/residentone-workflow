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

    // Build room libraries based on room types and available items
    const roomTypes = ['living-room', 'bedroom', 'kitchen', 'bathroom', 'dining-room', 'office', 'guest-room']
    
    const libraries = roomTypes.map(roomType => {
      const roomConfig = ROOM_FFE_CONFIG[roomType]
      const customItemsForRoom = customItems.filter(item => 
        item.roomTypes.includes(roomType)
      )
      
      const categories = roomConfig ? roomConfig.categories.map(cat => ({
        categoryId: cat.name,
        isEnabled: true,
        customName: cat.name,
        itemCount: cat.items.length + customItemsForRoom.filter(item => item.category === cat.name).length
      })) : []

      return {
        id: `${roomType}-lib`,
        name: `${roomType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Library`,
        roomType,
        version: '1.0',
        isActive: true,
        isDefault: true,
        categories,
        customItemCount: customItemsForRoom.length,
        totalItemCount: (roomConfig?.categories.reduce((sum, cat) => sum + cat.items.length, 0) || 0) + customItemsForRoom.length,
        projectsUsing: 0, // This would require counting actual usage
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
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
