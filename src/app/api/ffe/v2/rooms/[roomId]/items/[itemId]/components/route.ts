import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all components for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId } = await params

    const components = await prisma.itemComponent.findMany({
      where: { itemId },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json({ components })
  } catch (error) {
    console.error('Error fetching components:', error)
    return NextResponse.json(
      { error: 'Failed to fetch components' },
      { status: 500 }
    )
  }
}

// POST - Create a new component
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = session.user.orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { roomId, itemId } = await params
    const body = await request.json()
    const { name, modelNumber, image, price, quantity, notes } = body

    if (!name) {
      return NextResponse.json({ error: 'Component name is required' }, { status: 400 })
    }

    // Verify item exists and belongs to user's org
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: { project: { orgId } }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Get highest order for new component
    const lastComponent = await prisma.itemComponent.findFirst({
      where: { itemId },
      orderBy: { order: 'desc' }
    })
    const nextOrder = (lastComponent?.order ?? -1) + 1

    // Ensure quantity is a proper integer (handle string or number input)
    const parsedQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : (quantity || 1)

    const component = await prisma.itemComponent.create({
      data: {
        itemId,
        name,
        modelNumber: modelNumber || null,
        image: image || null,
        price: price ? parseFloat(String(price)) : null,
        quantity: parsedQuantity > 0 ? parsedQuantity : 1,
        order: nextOrder,
        notes: notes || null
      }
    })

    return NextResponse.json({ component })
  } catch (error) {
    console.error('Error creating component:', error)
    return NextResponse.json(
      { error: 'Failed to create component' },
      { status: 500 }
    )
  }
}

// PATCH - Update a component (expects componentId in body)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = session.user.orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { roomId, itemId } = await params
    const body = await request.json()
    const { componentId, name, modelNumber, image, price, quantity, notes, order } = body

    if (!componentId) {
      return NextResponse.json({ error: 'Component ID is required' }, { status: 400 })
    }

    // Verify item exists and belongs to user's org
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: { project: { orgId } }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify component belongs to this item
    const existing = await prisma.itemComponent.findFirst({
      where: { id: componentId, itemId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (modelNumber !== undefined) updateData.modelNumber = modelNumber || null
    if (image !== undefined) updateData.image = image || null
    if (price !== undefined) updateData.price = price ? parseFloat(String(price)) : null
    if (quantity !== undefined) {
      // Ensure quantity is a proper integer (handle string or number input)
      const parsedQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : (quantity || 1)
      updateData.quantity = parsedQuantity > 0 ? parsedQuantity : 1
    }
    if (notes !== undefined) updateData.notes = notes || null
    if (order !== undefined) updateData.order = order

    const component = await prisma.itemComponent.update({
      where: { id: componentId },
      data: updateData
    })

    return NextResponse.json({ component })
  } catch (error) {
    console.error('Error updating component:', error)
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a component (expects componentId in query or body)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = session.user.orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { roomId, itemId } = await params

    // Get componentId from query params or body
    const url = new URL(request.url)
    let componentId = url.searchParams.get('componentId')

    if (!componentId) {
      try {
        const body = await request.json()
        componentId = body.componentId
      } catch {
        // No body
      }
    }

    if (!componentId) {
      return NextResponse.json({ error: 'Component ID is required' }, { status: 400 })
    }

    // Verify item exists and belongs to user's org
    const item = await prisma.roomFFEItem.findFirst({
      where: {
        id: itemId,
        section: {
          instance: {
            roomId,
            room: { project: { orgId } }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify component belongs to this item
    const existing = await prisma.itemComponent.findFirst({
      where: { id: componentId, itemId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 })
    }

    await prisma.itemComponent.delete({
      where: { id: componentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting component:', error)
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    )
  }
}
