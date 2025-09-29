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

    // Get items from FFELibraryItem with special type marker
    const whereClause: any = {
      orgId,
      itemType: 'ITEM' // Special marker for items
    }

    // Filter by room type if provided
    if (roomTypeKey) {
      whereClause.category = roomTypeKey // Store room type key in category field for items
    }

    const itemItems = await prisma.fFELibraryItem.findMany({
      where: whereClause,
      orderBy: [
        { subItems: 'asc' }, // Order by category order stored in subItems
        { createdAt: 'asc' }
      ]
    })
    
    // Convert to item format
    const items = itemItems.map(item => ({
      id: item.id,
      name: item.name,
      categoryKey: item.subItems?.categoryKey || '',
      roomTypeKeys: [item.category], // Room type key stored in category field
      isRequired: item.isRequired,
      order: item.subItems?.order || 1,
      logicRules: item.subItems?.logicRules || [],
      isActive: item.isStandard,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      orgId: item.orgId
    }))

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

    // Create item as FFELibraryItem with special type
    const itemItem = await prisma.fFELibraryItem.create({
      data: {
        name,
        itemId: `item-${Date.now()}`, // Generate unique item ID
        category: roomTypeKeys[0], // Store room type key in category field
        itemType: 'ITEM', // Special marker
        roomTypes: [],
        dependsOn: [], // Required field
        isRequired: isRequired || false,
        isStandard: true, // Use as isActive
        subItems: { // Store item-specific data
          categoryKey,
          order: order || 1,
          logicRules: logicRules || []
        },
        orgId,
        // Required fields for FFELibraryItem
        createdById: user.id,
        updatedById: user.id
      }
    })
    
    // Convert to item format
    const item = {
      id: itemItem.id,
      name: itemItem.name,
      categoryKey: itemItem.subItems?.categoryKey || '',
      roomTypeKeys: [itemItem.category],
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

    const itemItem = await prisma.fFELibraryItem.update({
      where: {
        id,
        orgId,
        itemType: 'ITEM'
      },
      data: {
        ...(name && { name }),
        ...(roomTypeKeys && roomTypeKeys.length > 0 && { category: roomTypeKeys[0] }),
        ...(isRequired !== undefined && { isRequired }),
        ...(categoryKey !== undefined || order !== undefined || logicRules !== undefined ? { 
          subItems: {
            categoryKey: categoryKey || '',
            order: order || 1,
            logicRules: logicRules || []
          }
        } : {}),
        updatedById: user.id,
        updatedAt: new Date()
      }
    })
    
    // Convert to item format
    const item = {
      id: itemItem.id,
      name: itemItem.name,
      categoryKey: itemItem.subItems?.categoryKey || '',
      roomTypeKeys: [itemItem.category],
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

    // Soft delete
    await prisma.fFELibraryItem.update({
      where: {
        id,
        orgId,
        itemType: 'ITEM'
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