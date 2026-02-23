import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET - List all renderings pushed to client for a project
// Returns rendering assets grouped by room, only for versions with status PUSHED_TO_CLIENT
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
      select: { id: true, name: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Debug: check how many rendering versions exist for this project at all
    const debugAll = await prisma.renderingVersion.findMany({
      where: { room: { projectId: id } },
      select: { id: true, status: true, version: true, roomId: true },
    })
    console.log(`[renderings] Project ${id}: found ${debugAll.length} total rendering versions`, debugAll.map(v => ({ id: v.id, status: v.status, version: v.version })))

    // Also check asset types for these versions
    if (debugAll.length > 0) {
      const debugAssets = await prisma.asset.findMany({
        where: { renderingVersionId: { in: debugAll.map(v => v.id) } },
        select: { id: true, type: true, renderingVersionId: true, provider: true, url: true },
      })
      console.log(`[renderings] Found ${debugAssets.length} assets for these versions`, debugAssets.map(a => ({ id: a.id, type: a.type, versionId: a.renderingVersionId, provider: a.provider })))
    }

    // Fetch all rendering versions pushed to client for this project's rooms
    const renderingVersions = await prisma.renderingVersion.findMany({
      where: {
        room: { projectId: id },
        status: 'PUSHED_TO_CLIENT',
      },
      include: {
        room: {
          select: { id: true, name: true, type: true },
        },
        assets: {
          where: { type: { in: ['RENDER', 'IMAGE'] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            filename: true,
            url: true,
            size: true,
            mimeType: true,
            provider: true,
            metadata: true,
            createdAt: true,
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { room: { name: 'asc' } },
        { createdAt: 'desc' },
      ],
    })

    console.log(`[renderings] After filter: ${renderingVersions.length} PUSHED_TO_CLIENT versions, ${renderingVersions.reduce((sum, v) => sum + v.assets.length, 0)} total assets`)

    // Build asset URLs — prefer Blob for speed
    const renderings = renderingVersions.map((version) => {
      const assetsWithUrls = version.assets.map((asset) => {
        let metadata: Record<string, any> = {}
        try {
          if (typeof asset.metadata === 'string') {
            metadata = JSON.parse(asset.metadata || '{}')
          } else if (asset.metadata && typeof asset.metadata === 'object') {
            metadata = asset.metadata as Record<string, any>
          }
        } catch {
          metadata = {}
        }

        // Priority 1: blobUrl from metadata
        if (metadata.blobUrl && metadata.blobUrl.startsWith('http')) {
          return { ...asset, displayUrl: metadata.blobUrl }
        }

        // Priority 2: provider is blob with http url
        if (asset.provider === 'blob' && asset.url?.startsWith('http')) {
          return { ...asset, displayUrl: asset.url }
        }

        // Priority 3: any http url
        if (asset.url?.startsWith('http')) {
          return { ...asset, displayUrl: asset.url }
        }

        return { ...asset, displayUrl: null }
      })

      return {
        id: version.id,
        version: version.version,
        customName: version.customName,
        roomId: version.room.id,
        roomName: version.room.name,
        roomType: version.room.type,
        pushedToClientAt: version.pushedToClientAt,
        createdBy: version.createdBy,
        assets: assetsWithUrls.filter((a) => a.displayUrl !== null),
      }
    })

    // Build room groups
    const roomMap = new Map<string, {
      roomId: string
      roomName: string | null
      versions: typeof renderings
    }>()

    for (const r of renderings) {
      if (!roomMap.has(r.roomId)) {
        roomMap.set(r.roomId, {
          roomId: r.roomId,
          roomName: r.roomName,
          versions: [],
        })
      }
      roomMap.get(r.roomId)!.versions.push(r)
    }

    const rooms = Array.from(roomMap.values()).sort((a, b) => {
      const nameA = a.roomName || ''
      const nameB = b.roomName || ''
      return nameA.localeCompare(nameB)
    })

    // Flatten all assets for the gallery (with room/version context)
    const allAssets = renderings.flatMap((r) =>
      r.assets.map((a) => ({
        id: a.id,
        title: a.title,
        filename: a.filename,
        url: a.displayUrl,
        size: a.size,
        mimeType: a.mimeType,
        createdAt: a.createdAt,
        roomName: r.roomName,
        version: r.version,
        customName: r.customName,
        pushedToClientAt: r.pushedToClientAt,
      }))
    )

    return NextResponse.json({
      success: true,
      rooms,
      allAssets,
      total: allAssets.length,
    })
  } catch (error) {
    console.error('Error fetching project renderings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
