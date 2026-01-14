import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getBaseUrl } from '@/lib/get-base-url'

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
    const baseUrl = getBaseUrl()
    const linksWithMeta = shareLinks.map(link => ({
      ...link,
      shareUrl: `${baseUrl}/shared/specs/link/${link.token}`,
      itemCount: link.itemIds.length,
      isAllItems: link.itemIds.length === 0, // Empty array = all items mode
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
      showSpecSheets = false,
      showNotes = true,
      allowApproval = false,
      expiresAt
    } = body

    // Empty itemIds array means "all items" mode - dynamic, includes future items
    // This is a valid use case, not an error
    const isAllItemsMode = !itemIds || !Array.isArray(itemIds) || itemIds.length === 0

    // If specific items are selected, verify they belong to this project
    if (!isAllItemsMode) {
      const validItems = await prisma.roomFFEItem.findMany({
        where: {
          id: { in: itemIds },
          section: {
            instance: {
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
    }

    const shareLink = await prisma.specShareLink.create({
      data: {
        projectId,
        name: name || null,
        itemIds: isAllItemsMode ? [] : itemIds, // Empty array = all items mode
        showSupplier,
        showBrand,
        showPricing,
        showDetails,
        showSpecSheets,
        showNotes,
        allowApproval,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: userId
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({
      shareLink: {
        ...shareLink,
        shareUrl: `${getBaseUrl()}/shared/specs/link/${shareLink.token}`,
        itemCount: shareLink.itemIds.length,
        isAllItems: shareLink.itemIds.length === 0, // Flag for "all items" mode
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
