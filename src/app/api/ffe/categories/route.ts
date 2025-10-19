import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

// GET - Get all categories for an organization
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Get categories from FFELibraryItem with special type marker
    const categoryItems = await prisma.fFELibraryItem.findMany({
      where: {
        orgId,
        itemType: 'CATEGORY' // Special marker for categories
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    
    // Convert to category format
    const categories = categoryItems.map(item => ({
      id: item.id,
      name: item.name,
      key: item.itemId,
      order: item.subItems?.order || 1,
      isActive: item.isStandard,
      roomTypeKeys: item.subItems?.roomTypeKeys || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      orgId: item.orgId
    }))

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST - Create a new category
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
    const { name, key, order, roomTypeKeys, orgId } = body

    if (!name || !key || !orgId) {
      return NextResponse.json({ error: 'Name, key, and orgId are required' }, { status: 400 })
    }

    // Create category as FFELibraryItem with special type
    const categoryItem = await prisma.fFELibraryItem.create({
      data: {
        name,
        itemId: key.toUpperCase(),
        category: 'CATEGORY',
        itemType: 'CATEGORY', // Special marker
        roomTypes: [],
        dependsOn: [], // Required field
        isStandard: true, // Use as isActive
        subItems: { // Store category-specific data
          order: order || 1,
          roomTypeKeys: roomTypeKeys || []
        },
        orgId,
        // Required fields for FFELibraryItem
        createdById: user.id,
        updatedById: user.id
      }
    })
    
    // Convert to category format
    const category = {
      id: categoryItem.id,
      name: categoryItem.name,
      key: categoryItem.itemId,
      order: categoryItem.subItems?.order || 1,
      isActive: categoryItem.isStandard,
      roomTypeKeys: categoryItem.subItems?.roomTypeKeys || [],
      createdAt: categoryItem.createdAt,
      updatedAt: categoryItem.updatedAt,
      orgId: categoryItem.orgId
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error creating category:', error)
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    })
    return NextResponse.json({ 
      error: 'Failed to create category', 
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update a category
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
    const { id, name, key, order, roomTypeKeys, orgId } = body

    if (!id || !orgId) {
      return NextResponse.json({ error: 'ID and orgId are required' }, { status: 400 })
    }

    const categoryItem = await prisma.fFELibraryItem.update({
      where: {
        id,
        orgId,
        itemType: 'CATEGORY'
      },
      data: {
        ...(name && { name }),
        ...(key && { itemId: key.toUpperCase() }),
        ...(order !== undefined || roomTypeKeys !== undefined ? { 
          subItems: {
            order: order || 1,
            roomTypeKeys: roomTypeKeys || []
          }
        } : {}),
        updatedById: user.id,
        updatedAt: new Date()
      }
    })
    
    // Convert to category format
    const category = {
      id: categoryItem.id,
      name: categoryItem.name,
      key: categoryItem.itemId,
      order: categoryItem.subItems?.order || 1,
      isActive: categoryItem.isStandard,
      roomTypeKeys: categoryItem.subItems?.roomTypeKeys || [],
      createdAt: categoryItem.createdAt,
      updatedAt: categoryItem.updatedAt,
      orgId: categoryItem.orgId
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE - Delete a category
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
        itemType: 'CATEGORY'
      },
      data: {
        isStandard: false, // Use isStandard instead of isActive
        updatedById: user.id,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
