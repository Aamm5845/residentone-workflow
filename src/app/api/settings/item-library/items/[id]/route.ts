import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = updateItemSchema.parse(body)

    // If moving to a new category, update order to be at the end
    let updateData: Record<string, unknown> = { ...data }
    if (data.category) {
      const maxOrder = await prisma.designConceptItemLibrary.aggregate({
        where: { category: data.category },
        _max: { order: true }
      })
      updateData.order = (maxOrder._max.order || 0) + 1
    }

    const item = await prisma.designConceptItemLibrary.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating item:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete - set isActive to false
    await prisma.designConceptItemLibrary.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}

