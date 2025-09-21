import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[id]/floors - Get all floors for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    const floors = await prisma.floor.findMany({
      where: { projectId },
      include: {
        rooms: {
          include: {
            stages: {
              select: {
                type: true,
                status: true
              }
            }
          }
        }
      },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(floors)
  } catch (error) {
    console.error('Error fetching floors:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/floors - Create a new floor
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { name, order } = body

    if (!name) {
      return NextResponse.json({ error: 'Floor name is required' }, { status: 400 })
    }

    // Get the current maximum order to set as default
    const maxOrderFloor = await prisma.floor.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' }
    })
    const nextOrder = order !== undefined ? order : (maxOrderFloor?.order || 0) + 1

    const floor = await prisma.floor.create({
      data: {
        projectId,
        name,
        order: nextOrder
      },
      include: {
        rooms: true
      }
    })

    return NextResponse.json(floor)
  } catch (error) {
    console.error('Error creating floor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}