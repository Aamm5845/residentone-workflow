import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const runtime = 'nodejs'
export const maxDuration = 30

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
      where: { id },
      select: { id: true, name: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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
            // Include ClientApprovalAsset to get blob URLs (copied during push-to-client)
            clientApprovalAssets: {
              select: { blobUrl: true },
              take: 1,
            },
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

    // ── Step 1: Filter to latest version per room BEFORE resolving URLs ──
    // This avoids wasting Dropbox API calls on versions we'd discard
    const latestVersionByRoom = new Map<string, typeof renderingVersions[number]>()
    for (const v of renderingVersions) {
      const roomId = v.room.id
      if (v.assets.length === 0) continue
      const existing = latestVersionByRoom.get(roomId)
      if (!existing) {
        latestVersionByRoom.set(roomId, v)
      } else {
        const existingDate = existing.pushedToClientAt ? new Date(existing.pushedToClientAt).getTime() : 0
        const currentDate = v.pushedToClientAt ? new Date(v.pushedToClientAt).getTime() : 0
        if (currentDate > existingDate) {
          latestVersionByRoom.set(roomId, v)
        }
      }
    }

    const latestVersions = Array.from(latestVersionByRoom.values())

    // ── Step 2: Resolve display URLs only for latest versions ──
    // Priority: ClientApprovalAsset blobUrl → Asset metadata blobUrl → blob provider → http url → Dropbox temp link
    const latestRenderings = await Promise.all(
      latestVersions.map(async (version) => {
        const assetsWithUrls = await Promise.all(
          version.assets.map(async (asset) => {
            // Priority 0: blobUrl from ClientApprovalAsset (fastest — copied to Blob during push-to-client)
            const approvalBlobUrl = asset.clientApprovalAssets?.[0]?.blobUrl
            if (approvalBlobUrl && approvalBlobUrl.startsWith('http')) {
              return { ...asset, displayUrl: approvalBlobUrl }
            }

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

            // Priority 1: blobUrl from asset metadata
            if (metadata.blobUrl && metadata.blobUrl.startsWith('http')) {
              return { ...asset, displayUrl: metadata.blobUrl }
            }

            // Priority 2: provider is blob with http url
            if (asset.provider === 'blob' && asset.url?.startsWith('http')) {
              return { ...asset, displayUrl: asset.url }
            }

            // Priority 3: any http url already
            if (asset.url?.startsWith('http')) {
              return { ...asset, displayUrl: asset.url }
            }

            // Priority 4: Dropbox path — generate temporary link
            if (asset.provider === 'dropbox' && asset.url) {
              try {
                const temporaryLink = await dropboxService.getTemporaryLink(asset.url)
                return { ...asset, displayUrl: temporaryLink || null }
              } catch (error) {
                console.error(`Failed to get Dropbox link for asset ${asset.id}:`, error)
                return { ...asset, displayUrl: null }
              }
            }

            // Priority 5: try url as dropbox path even without provider tag
            if (asset.url && !asset.url.startsWith('http')) {
              try {
                const temporaryLink = await dropboxService.getTemporaryLink(asset.url)
                return { ...asset, displayUrl: temporaryLink || null }
              } catch (error) {
                console.error(`Failed to get Dropbox link for asset ${asset.id}:`, error)
                return { ...asset, displayUrl: null }
              }
            }

            return { ...asset, displayUrl: null }
          })
        )

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
    )

    // Build room groups
    const rooms = latestRenderings
      .map((r) => ({
        roomId: r.roomId,
        roomName: r.roomName,
      }))
      .sort((a, b) => (a.roomName || '').localeCompare(b.roomName || ''))

    // Flatten all assets for the gallery (with room/version context)
    const allAssets = latestRenderings.flatMap((r) =>
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
