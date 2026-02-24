import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - List sections for a project, ordered by `order`
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

    const sections = await prisma.projectSection.findMany({
      where: { projectId: id },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(sections)
  } catch (error) {
    console.error('[project-files-v2/sections] Error fetching sections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    )
  }
}

// POST - Create a new section
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
    const { name, shortName, color, order } = body

    if (!name || !shortName) {
      return NextResponse.json(
        { error: 'name and shortName are required' },
        { status: 400 }
      )
    }

    // Auto-set order to max+1 if not provided
    let sectionOrder = order
    if (sectionOrder === undefined || sectionOrder === null) {
      const maxSection = await prisma.projectSection.findFirst({
        where: { projectId: id },
        orderBy: { order: 'desc' },
        select: { order: true }
      })
      sectionOrder = (maxSection?.order ?? -1) + 1
    }

    const section = await prisma.projectSection.create({
      data: {
        projectId: id,
        name,
        shortName,
        color: color || 'bg-gray-500',
        order: sectionOrder
      }
    })

    return NextResponse.json(section, { status: 201 })
  } catch (error) {
    console.error('[project-files-v2/sections] Error creating section:', error)
    return NextResponse.json(
      { error: 'Failed to create section' },
      { status: 500 }
    )
  }
}
