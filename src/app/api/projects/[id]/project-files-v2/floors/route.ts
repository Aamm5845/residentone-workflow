import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - List floors for a project, ordered by `order`
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const floors = await prisma.projectFloor.findMany({
      where: { projectId: id },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(floors)
  } catch (error) {
    console.error('[project-files-v2/floors] Error fetching floors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch floors' },
      { status: 500 }
    )
  }
}

// POST - Create a new floor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, shortName, order } = body

    if (!name || !shortName) {
      return NextResponse.json(
        { error: 'name and shortName are required' },
        { status: 400 }
      )
    }

    // Auto-set order to max+1 if not provided
    let floorOrder = order
    if (floorOrder === undefined || floorOrder === null) {
      const maxFloor = await prisma.projectFloor.findFirst({
        where: { projectId: id },
        orderBy: { order: 'desc' },
        select: { order: true }
      })
      floorOrder = (maxFloor?.order ?? -1) + 1
    }

    const floor = await prisma.projectFloor.create({
      data: {
        projectId: id,
        name,
        shortName,
        order: floorOrder
      }
    })

    return NextResponse.json(floor, { status: 201 })
  } catch (error) {
    console.error('[project-files-v2/floors] Error creating floor:', error)
    return NextResponse.json(
      { error: 'Failed to create floor' },
      { status: 500 }
    )
  }
}
