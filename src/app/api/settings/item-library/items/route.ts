import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await prisma.designConceptItemLibrary.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { order: 'asc' },
      ],
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = createItemSchema.parse(body)

    // Get max order for this category
    const maxOrder = await prisma.designConceptItemLibrary.aggregate({
      where: { category: data.category },
      _max: { order: true }
    })

    const item = await prisma.designConceptItemLibrary.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description,
        icon: data.icon,
        order: (maxOrder._max.order || 0) + 1,
      }
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error creating item:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}

