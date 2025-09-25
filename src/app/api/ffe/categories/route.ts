import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get all FFE categories for an organization
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

    const categories = await prisma.fFECategory.findMany({
      where: { orgId, isActive: true },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ categories })

  } catch (error) {
    console.error('Error getting FFE categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new FFE category
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, name, description, icon, roomTypes, isGlobal, isExpandable } = body

    if (!orgId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the next order number
    const lastCategory = await prisma.fFECategory.findFirst({
      where: { orgId },
      orderBy: { order: 'desc' }
    })

    const nextOrder = lastCategory ? lastCategory.order + 1 : 1

    const newCategory = await prisma.fFECategory.create({
      data: {
        orgId,
        name,
        description,
        icon,
        roomTypes: roomTypes || [],
        isGlobal: Boolean(isGlobal),
        isExpandable: isExpandable !== false, // default to true
        order: nextOrder,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    })

    // Log the creation
    await prisma.fFEVersionHistory.create({
      data: {
        orgId,
        entityType: 'category',
        entityId: newCategory.id,
        version: '1.0',
        changeType: 'created',
        changeDescription: `FFE category "${name}" created`,
        changeDetails: [
          { field: 'name', oldValue: null, newValue: name },
          { field: 'isGlobal', oldValue: null, newValue: isGlobal },
          { field: 'roomTypes', oldValue: null, newValue: roomTypes }
        ],
        entitySnapshot: newCategory,
        createdById: session.user.id
      }
    })

    return NextResponse.json({ category: newCategory })

  } catch (error) {
    console.error('Error creating FFE category:', error)
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create FFE category' }, { status: 500 })
  }
}

// Update category order (for drag and drop)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, categoryOrders } = body

    if (!orgId || !categoryOrders) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Update order for all categories
    await Promise.all(
      categoryOrders.map(({ id, order }: { id: string, order: number }) =>
        prisma.fFECategory.update({
          where: { id },
          data: { 
            order,
            updatedById: session.user.id
          }
        })
      )
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating category order:', error)
    return NextResponse.json({ error: 'Failed to update category order' }, { status: 500 })
  }
}