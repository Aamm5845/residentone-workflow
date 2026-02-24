import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - Fetch all photo tag metadata for a project
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

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const metas = await prisma.projectPhotoMeta.findMany({
      where: { projectId: id },
      select: { dropboxPath: true, tags: true }
    })

    // Build a map keyed by dropboxPath for O(1) lookup
    const meta: Record<string, { tags: string[] }> = {}
    for (const m of metas) {
      meta[m.dropboxPath] = { tags: m.tags }
    }

    return NextResponse.json({ success: true, meta })
  } catch (error: any) {
    console.error('[project-files-v2/photos/tags] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch photo tags' },
      { status: 500 }
    )
  }
}

// PUT - Upsert tags for a specific photo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { dropboxPath, tags } = body

    if (!dropboxPath || typeof dropboxPath !== 'string') {
      return NextResponse.json({ error: 'dropboxPath is required' }, { status: 400 })
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
    }

    // Security: reject path traversal
    if (dropboxPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Normalize tags: trim, lowercase, deduplicate, remove empties
    const normalizedTags = [...new Set(
      tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean)
    )]

    // Upsert the metadata
    const meta = await prisma.projectPhotoMeta.upsert({
      where: {
        projectId_dropboxPath: { projectId: id, dropboxPath }
      },
      create: {
        projectId: id,
        dropboxPath,
        tags: normalizedTags,
      },
      update: {
        tags: normalizedTags,
      }
    })

    return NextResponse.json({ success: true, meta })
  } catch (error: any) {
    console.error('[project-files-v2/photos/tags] PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update photo tags' },
      { status: 500 }
    )
  }
}
