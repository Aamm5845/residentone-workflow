import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

// GET - Get all items for a room type and organization
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const roomTypeKey = searchParams.get('roomTypeKey')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Get management items from FFELibraryItem 
    const whereClause: any = {
      orgId,
      OR: [
        // New format: items created by management system
        { subItems: { path: ['managementItem'], equals: true } },
        // Legacy format: items with itemType marker
        { itemType: 'ITEM' }
      ]
    }

    // Filter by room type if provided
    if (roomTypeKey) {
      whereClause.AND = [
        whereClause.OR ? { OR: whereClause.OR } : {},
        {
          OR: [
            // New format: check originalRoomTypeKeys in subItems
            { subItems: { path: ['originalRoomTypeKeys'], array_contains: [roomTypeKey] } },
            // Legacy format: room type stored in category field
            { category: roomTypeKey }
          ]
        }
      ]
      delete whereClause.OR // Move OR to AND structure
    }

    const itemItems = await prisma.fFELibraryItem.findMany({
      where: whereClause,
      orderBy: [
        { subItems: 'asc' }, // Order by category order stored in subItems
        { createdAt: 'asc' }
      ]
    })
    
    // Convert to item format, handling both old and new formats
    const items = itemItems.map(item => {
      const isNewFormat = item.subItems?.managementItem === true
      
      return {
        id: item.id,
        name: item.name,
        categoryKey: isNewFormat ? item.category : (item.subItems?.categoryKey || ''),
        roomTypeKeys: isNewFormat ? (item.subItems?.originalRoomTypeKeys || []) : [item.category],
        isRequired: item.isRequired,
        order: item.subItems?.order || 1,
        logicRules: item.subItems?.logicRules || [],
        isActive: item.isStandard,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        orgId: item.orgId
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

// POST - Create a new item
export async function POST(request: Request) {
  try {
    // Get session for user ID
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the actual user from database to ensure valid foreign key
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const body = await request.json()
    const { name, categoryKey, roomTypeKeys, isRequired, order, logicRules, orgId } = body

    console.log('📝 Creating item with data:', { name, categoryKey, roomTypeKeys, isRequired, order, orgId })

    if (!name || !categoryKey || !roomTypeKeys || roomTypeKeys.length === 0 || !orgId) {
      return NextResponse.json({ error: 'Name, categoryKey, roomTypeKeys, and orgId are required' }, { status: 400 })
    }

    // Map room type keys to workspace format for compatibility
    const roomTypeMapping: { [key: string]: string } = {
      'bedroom': 'bedroom',
      'bathroom': 'bathroom', 
      'kitchen': 'kitchen',
      'living-room': 'living-room',
      'dining-room': 'dining-room',
      'office': 'office',
      'entrance': 'entrance',
      'foyer': 'foyer',
      'laundry-room': 'laundry-room',
      'playroom': 'playroom'
    }
    
    // Convert room type keys to workspace compatible format
    const workspaceRoomTypes = roomTypeKeys.map(key => roomTypeMapping[key] || key)
    console.log(`📝 Creating item for room types:`, roomTypeKeys, '→', workspaceRoomTypes)
    
    // Create item as FFELibraryItem compatible with workspace system
    const itemItem = await prisma.fFELibraryItem.create({
      data: {
        name,
        itemId: `mgmt-${Date.now()}`, // Generate unique item ID with management prefix
        category: categoryKey, // Use actual category, not room type
        roomTypes: workspaceRoomTypes, // Store in roomTypes array for workspace compatibility
        dependsOn: [], // Required field
        isRequired: isRequired || false,
        isStandard: true,
        subItems: { // Store management-specific metadata
          managementItem: true,
          order: order || 1,
          logicRules: logicRules || [],
          originalRoomTypeKeys: roomTypeKeys // Keep original for management reference
        },
        notes: `Created via FFE Management for ${categoryKey}`,
        orgId,
        // Required fields for FFELibraryItem
        createdById: user.id,
        updatedById: user.id
      }
    })
    
    // Convert to management item format
    const item = {
      id: itemItem.id,
      name: itemItem.name,
      categoryKey: itemItem.category, // Now stored directly in category field
      roomTypeKeys: itemItem.subItems?.originalRoomTypeKeys || [],
      isRequired: itemItem.isRequired,
      order: itemItem.subItems?.order || 1,
      logicRules: itemItem.subItems?.logicRules || [],
      isActive: itemItem.isStandard,
      createdAt: itemItem.createdAt,
      updatedAt: itemItem.updatedAt,
      orgId: itemItem.orgId
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error creating item:', error)
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    })
    return NextResponse.json({ 
      error: 'Failed to create item', 
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update an item
export async function PUT(request: Request) {
  try {
    // Get session for user ID
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the actual user from database to ensure valid foreign key
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, categoryKey, roomTypeKeys, isRequired, order, logicRules, orgId } = body

    if (!id || !orgId) {
      return NextResponse.json({ error: 'ID and orgId are required' }, { status: 400 })
    }

    // First check if this is a new format item
    const existingItem = await prisma.fFELibraryItem.findUnique({
      where: { id }
    })
    
    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    
    const isNewFormat = existingItem.subItems?.managementItem === true
    
    // Map room type keys if provided
    let workspaceRoomTypes: string[] | undefined
    if (roomTypeKeys && roomTypeKeys.length > 0) {
      const roomTypeMapping: { [key: string]: string } = {
        'bedroom': 'bedroom',
        'bathroom': 'bathroom', 
        'kitchen': 'kitchen',
        'living-room': 'living-room',
        'dining-room': 'dining-room',
        'office': 'office',
        'entrance': 'entrance',
        'foyer': 'foyer',
        'laundry-room': 'laundry-room',
        'playroom': 'playroom'
      }
      workspaceRoomTypes = roomTypeKeys.map(key => roomTypeMapping[key] || key)
    }
    
    const itemItem = await prisma.fFELibraryItem.update({
      where: {
        id,
        orgId
      },
      data: {
        ...(name && { name }),
        ...(categoryKey && isNewFormat && { category: categoryKey }),
        ...(workspaceRoomTypes && isNewFormat && { roomTypes: workspaceRoomTypes }),
        ...(isRequired !== undefined && { isRequired }),
        // Update subItems based on format
        ...(isNewFormat ? {
          subItems: {
            managementItem: true,
            order: order || existingItem.subItems?.order || 1,
            logicRules: logicRules || existingItem.subItems?.logicRules || [],
            originalRoomTypeKeys: roomTypeKeys || existingItem.subItems?.originalRoomTypeKeys || []
          }
        } : {
          // Legacy format
          ...(roomTypeKeys && roomTypeKeys.length > 0 && { category: roomTypeKeys[0] }),
          subItems: {
            categoryKey: categoryKey || existingItem.subItems?.categoryKey || '',
            order: order || existingItem.subItems?.order || 1,
            logicRules: logicRules || existingItem.subItems?.logicRules || []
          }
        }),
        updatedById: user.id,
        updatedAt: new Date()
      }
    })
    
    // Convert to management item format, handling both old and new formats
    const isNewFormat = itemItem.subItems?.managementItem === true
    const item = {
      id: itemItem.id,
      name: itemItem.name,
      categoryKey: isNewFormat ? itemItem.category : (itemItem.subItems?.categoryKey || ''),
      roomTypeKeys: isNewFormat ? (itemItem.subItems?.originalRoomTypeKeys || []) : [itemItem.category],
      isRequired: itemItem.isRequired,
      order: itemItem.subItems?.order || 1,
      logicRules: itemItem.subItems?.logicRules || [],
      isActive: itemItem.isStandard,
      createdAt: itemItem.createdAt,
      updatedAt: itemItem.updatedAt,
      orgId: itemItem.orgId
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

// DELETE - Delete an item
export async function DELETE(request: Request) {
  try {
    // Get session for user ID
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the actual user from database to ensure valid foreign key
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const orgId = searchParams.get('orgId')

    if (!id || !orgId) {
      return NextResponse.json({ error: 'ID and orgId are required' }, { status: 400 })
    }

    // Soft delete - handle both new and legacy formats
    await prisma.fFELibraryItem.update({
      where: {
        id,
        orgId
      },
      data: {
        isStandard: false, // Use isStandard instead of isActive
        updatedById: user.id,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}