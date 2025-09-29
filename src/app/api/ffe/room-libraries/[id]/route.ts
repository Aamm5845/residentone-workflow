import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Delete individual item from room library
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, orgId, itemId, categoryName, roomType } = body

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    if (action === 'delete_item') {
      // Delete specific item from room library
      const roomTypeKey = roomType?.toLowerCase().replace('_', '-') || 'bathroom'
      
      await prisma.fFELibraryItem.deleteMany({
        where: {
          orgId,
          itemId,
          roomTypes: {
            has: roomTypeKey
          },
          category: categoryName
        }
      })

      return NextResponse.json({ 
        success: true,
        message: 'Item deleted successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error in room library PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update a room library by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = params
    const { categories, name, roomType, description, orgId } = body

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Get the room type key for database operations
    const roomTypeKey = roomType?.toLowerCase().replace('_', '-') || 'bathroom'

    // First, delete all existing items for this room type and organization
    await prisma.fFELibraryItem.deleteMany({
      where: {
        orgId,
        roomTypes: {
          has: roomTypeKey
        }
      }
    })

    // Now create new items from the categories
    const itemsToCreate = []
    for (const [categoryName, categoryItems] of Object.entries(categories || {})) {
      for (const item of categoryItems as any[]) {
        const itemData = {
          orgId,
          itemId: item.id,
          name: item.name,
          category: categoryName,
          roomTypes: [roomTypeKey],
          isRequired: item.isRequired || false,
          itemType: 'base',
          hasStandardOption: !!item.options,
          hasCustomOption: !!item.specialLogic,
          standardConfig: item.options ? {
            options: item.options,
            description: `Standard ${item.name} options`
          } : null,
          customConfig: null,
          subItems: item.specialLogic ? {
            logicOptions: item.specialLogic.logicOptions || []
          } : null,
          notes: null,
          createdById: session.user.id,
          updatedById: session.user.id
        }
        itemsToCreate.push(itemData)
      }
    }

    // Create all items in database
    if (itemsToCreate.length > 0) {
      await prisma.fFELibraryItem.createMany({
        data: itemsToCreate
      })
    }

    const updatedLibrary = {
      ...body,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: session.user.name || 'Unknown'
    }

    return NextResponse.json({ 
      library: updatedLibrary,
      message: 'Room library updated successfully'
    })

  } catch (error) {
    console.error('Error updating room library:', error)
    return NextResponse.json({ error: 'Failed to update room library' }, { status: 500 })
  }
}

// Delete a room library by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const roomType = searchParams.get('roomType')

    if (!orgId || !roomType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Delete all items for this room type and organization
    const roomTypeKey = roomType.toLowerCase().replace('_', '-')
    await prisma.fFELibraryItem.deleteMany({
      where: {
        orgId,
        roomTypes: {
          has: roomTypeKey
        }
      }
    })

    return NextResponse.json({ 
      message: 'Room library deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting room library:', error)
    return NextResponse.json({ error: 'Failed to delete room library' }, { status: 500 })
  }
}
