import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/spec-share-links
 * Get all share links for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const shareLinks = await prisma.specShareLink.findMany({
      where: { projectId, active: true },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Build share URLs and add item count summary
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const linksWithMeta = shareLinks.map(link => ({
      ...link,
      shareUrl: `${baseUrl}/shared/specs/link/${link.token}`,
      itemCount: link.itemIds.length,
      isExpired: link.expiresAt ? new Date() > link.expiresAt : false
    }))

    return NextResponse.json({ shareLinks: linksWithMeta })
  } catch (error) {
    console.error('Error fetching spec share links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch share links' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/spec-share-links
 * Create a new share link
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      itemIds,
      showSupplier = false,
      showBrand = true,
      showPricing = false,
      showDetails = true,
      expiresAt
    } = body

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one item must be selected' },
        { status: 400 }
      )
    }

    // Verify items belong to this project
    // RoomFFEItem -> section -> ffeInstance -> room -> project
    const validItems = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: itemIds },
        section: {
          ffeInstance: {
            room: { projectId }
          }
        }
      },
      select: { id: true }
    })

    if (validItems.length !== itemIds.length) {
      return NextResponse.json(
        { error: 'Some items do not belong to this project' },
        { status: 400 }
      )
    }

    const shareLink = await prisma.specShareLink.create({
      data: {
        projectId,
        name: name || null,
        itemIds,
        showSupplier,
        showBrand,
        showPricing,
        showDetails,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: userId
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      shareLink: {
        ...shareLink,
        shareUrl: `${baseUrl}/shared/specs/link/${shareLink.token}`,
        itemCount: shareLink.itemIds.length,
        isExpired: false
      }
    })
  } catch (error) {
    console.error('Error creating spec share link:', error)
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    )
  }
}
