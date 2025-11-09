import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

/**
 * PUT /api/design-concept/library/[id]
 * Update an existing library item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or owner
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { name, category, description, icon, order, isActive } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      )
    }

    // Check if item exists
    const existingItem = await prisma.designConceptItemLibrary.findUnique({
      where: { id }
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name in same category (excluding current item)
    const duplicate = await prisma.designConceptItemLibrary.findFirst({
      where: {
        name,
        category,
        id: { not: id }
      }
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'Item with this name already exists in this category' },
        { status: 409 }
      )
    }

    // Update the item
    const updatedItem = await prisma.designConceptItemLibrary.update({
      where: { id },
      data: {
        name,
        category,
        description: description || null,
        icon: icon || null,
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json(updatedItem)

  } catch (error) {
    console.error('[Design Library] Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/design-concept/library/[id]
 * Delete a library item (soft delete by setting isActive = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or owner
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { id } = params

    // Soft delete by marking as inactive
    const updatedItem = await prisma.designConceptItemLibrary.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Item deactivated successfully',
      item: updatedItem 
    })

  } catch (error) {
    console.error('[Design Library] Error deleting item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
