import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

// GET - Get all room types for an organization
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Using FFELibraryItem as temporary storage for room types
    const roomTypeItems = await prisma.fFELibraryItem.findMany({
      where: {
        orgId,
        itemType: 'ROOM_TYPE' // Special marker for room types
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    
    // Convert to room type format
    const roomTypes = roomTypeItems.map(item => ({
      id: item.id,
      name: item.name,
      key: item.itemId, // Use itemId as key
      isActive: item.isStandard, // Use isStandard as isActive
      linkedRooms: item.subItems?.linkedRooms || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      orgId: item.orgId
    }))

    return NextResponse.json({ roomTypes })
  } catch (error) {
    console.error('Error fetching room types:', error)
    return NextResponse.json({ error: 'Failed to fetch room types' }, { status: 500 })
  }
}

// POST - Create a new room type
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
    const { name, key, linkedRooms, orgId } = body

    console.log('📝 Creating room type with data:', { name, key, linkedRooms, orgId })
    console.log('📝 Session user:', session.user)
    console.log('📝 Database user:', { id: user.id, email: user.email })

    if (!name || !key || !orgId) {
      return NextResponse.json({ error: 'Name, key, and orgId are required' }, { status: 400 })
    }

    // Create room type as FFELibraryItem with special type
    const roomTypeItem = await prisma.fFELibraryItem.create({
      data: {
        name,
        itemId: key.toLowerCase(),
        category: 'ROOM_TYPE',
        itemType: 'ROOM_TYPE', // Special marker
        roomTypes: [],
        dependsOn: [], // Required field - empty array for room types
        isStandard: true, // Use instead of isActive
        subItems: { // Use subItems instead of metadata
          linkedRooms: linkedRooms || []
        },
        orgId,
        // Required fields for FFELibraryItem
        createdById: user.id, // Use actual user ID from database
        updatedById: user.id
      }
    })
    
    // Convert to room type format
    const roomType = {
      id: roomTypeItem.id,
      name: roomTypeItem.name,
      key: roomTypeItem.itemId,
      isActive: roomTypeItem.isStandard, // Use isStandard as isActive
      linkedRooms: roomTypeItem.subItems?.linkedRooms || [],
      createdAt: roomTypeItem.createdAt,
      updatedAt: roomTypeItem.updatedAt,
      orgId: roomTypeItem.orgId
    }

    return NextResponse.json({ roomType })
  } catch (error) {
    console.error('Error creating room type:', error)
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    })
    return NextResponse.json({ 
      error: 'Failed to create room type', 
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update a room type
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
    const { id, name, key, linkedRooms, orgId } = body

    if (!id || !orgId) {
      return NextResponse.json({ error: 'ID and orgId are required' }, { status: 400 })
    }

    const roomTypeItem = await prisma.fFELibraryItem.update({
      where: {
        id,
        orgId,
        itemType: 'ROOM_TYPE'
      },
      data: {
        ...(name && { name }),
        ...(key && { itemId: key.toLowerCase() }),
        ...(linkedRooms !== undefined && { 
          subItems: {
            linkedRooms
          }
        }),
        updatedById: user.id,
        updatedAt: new Date()
      }
    })
    
    // Convert to room type format
    const roomType = {
      id: roomTypeItem.id,
      name: roomTypeItem.name,
      key: roomTypeItem.itemId,
      isActive: roomTypeItem.isStandard,
      linkedRooms: roomTypeItem.subItems?.linkedRooms || [],
      createdAt: roomTypeItem.createdAt,
      updatedAt: roomTypeItem.updatedAt,
      orgId: roomTypeItem.orgId
    }

    return NextResponse.json({ roomType })
  } catch (error) {
    console.error('Error updating room type:', error)
    return NextResponse.json({ error: 'Failed to update room type' }, { status: 500 })
  }
}

// DELETE - Delete a room type
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
        itemType: 'ROOM_TYPE'
      },
      data: {
        isStandard: false, // Use isStandard instead of isActive
        updatedById: user.id,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting room type:', error)
    return NextResponse.json({ error: 'Failed to delete room type' }, { status: 500 })
  }
}