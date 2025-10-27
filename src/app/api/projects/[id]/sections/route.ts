import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

// GET all sections for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: { id: string; orgId: string; role: string }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sections = await prisma.roomSection.findMany({
      where: { projectId: resolvedParams.id },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { rooms: true }
        }
      }
    })

    return NextResponse.json(sections)
  } catch (error) {
    console.error('Error fetching sections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create a new section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: { id: string; orgId: string; role: string }
    } | null
    const resolvedParams = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name } = data

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Section name is required' }, { status: 400 })
    }

    // Get the max order for this project
    const maxOrder = await prisma.roomSection.findFirst({
      where: { projectId: resolvedParams.id },
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const section = await prisma.roomSection.create({
      data: {
        projectId: resolvedParams.id,
        name: name.trim(),
        order: (maxOrder?.order ?? -1) + 1
      },
      include: {
        _count: {
          select: { rooms: true }
        }
      }
    })

    return NextResponse.json(section, { status: 201 })
  } catch (error) {
    console.error('Error creating section:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
