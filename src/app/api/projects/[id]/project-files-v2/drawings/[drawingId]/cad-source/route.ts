import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Get the CAD source link for a drawing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, drawingId } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const drawing = await prisma.projectDrawing.findFirst({
      where: { id: drawingId, projectId: id },
      select: { id: true }
    })

    if (!drawing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    const cadSourceLink = await prisma.cadSourceLink.findUnique({
      where: { drawingId }
    })

    return NextResponse.json(cadSourceLink)
  } catch (error) {
    console.error('[cad-source] Error fetching CAD source link:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CAD source link' },
      { status: 500 }
    )
  }
}

// POST - Create or update the CAD source link for a drawing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, drawingId } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const drawing = await prisma.projectDrawing.findFirst({
      where: { id: drawingId, projectId: id },
      select: { id: true }
    })

    if (!drawing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    const body = await request.json()
    const { cadDropboxPath, cadLayoutName } = body

    if (!cadDropboxPath) {
      return NextResponse.json(
        { error: 'cadDropboxPath is required' },
        { status: 400 }
      )
    }

    const cadSourceLink = await prisma.cadSourceLink.upsert({
      where: { drawingId },
      create: {
        drawingId,
        cadDropboxPath,
        cadLayoutName: cadLayoutName || null,
        cadFreshnessStatus: 'UNKNOWN'
      },
      update: {
        cadDropboxPath,
        cadLayoutName: cadLayoutName || null
      }
    })

    return NextResponse.json(cadSourceLink)
  } catch (error) {
    console.error('[cad-source] Error creating/updating CAD source link:', error)
    return NextResponse.json(
      { error: 'Failed to save CAD source link' },
      { status: 500 }
    )
  }
}

// DELETE - Remove the CAD source link for a drawing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, drawingId } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const existing = await prisma.cadSourceLink.findUnique({
      where: { drawingId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'No CAD source link found' }, { status: 404 })
    }

    await prisma.cadSourceLink.delete({ where: { drawingId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[cad-source] Error deleting CAD source link:', error)
    return NextResponse.json(
      { error: 'Failed to delete CAD source link' },
      { status: 500 }
    )
  }
}
