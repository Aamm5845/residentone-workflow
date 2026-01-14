import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/spec-share-links/[linkId]
 * Get a specific share link
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, linkId } = await params
    const orgId = (session.user as any).orgId

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const shareLink = await prisma.specShareLink.findFirst({
      where: { id: linkId, projectId },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    })

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      shareLink: {
        ...shareLink,
        shareUrl: `${baseUrl}/shared/specs/link/${shareLink.token}`,
        itemCount: shareLink.itemIds.length,
        isExpired: shareLink.expiresAt ? new Date() > shareLink.expiresAt : false
      }
    })
  } catch (error) {
    console.error('Error fetching spec share link:', error)
    return NextResponse.json(
      { error: 'Failed to fetch share link' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/projects/[id]/spec-share-links/[linkId]
 * Update a share link
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, linkId } = await params
    const orgId = (session.user as any).orgId

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify link exists
    const existingLink = await prisma.specShareLink.findFirst({
      where: { id: linkId, projectId }
    })

    if (!existingLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      itemIds,
      showSupplier,
      showBrand,
      showPricing,
      showDetails,
      showSpecSheets,
      showNotes,
      allowApproval,
      expiresAt,
      active
    } = body

    // If updating itemIds, validate them (empty array is allowed for "all items" mode)
    if (itemIds !== undefined && Array.isArray(itemIds) && itemIds.length > 0) {
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

    const shareLink = await prisma.specShareLink.update({
      where: { id: linkId },
      data: {
        ...(name !== undefined && { name }),
        ...(itemIds !== undefined && { itemIds }),
        ...(showSupplier !== undefined && { showSupplier }),
        ...(showBrand !== undefined && { showBrand }),
        ...(showPricing !== undefined && { showPricing }),
        ...(showDetails !== undefined && { showDetails }),
        ...(showSpecSheets !== undefined && { showSpecSheets }),
        ...(showNotes !== undefined && { showNotes }),
        ...(allowApproval !== undefined && { allowApproval }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(active !== undefined && { active })
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
        isExpired: shareLink.expiresAt ? new Date() > shareLink.expiresAt : false
      }
    })
  } catch (error) {
    console.error('Error updating spec share link:', error)
    return NextResponse.json(
      { error: 'Failed to update share link' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/spec-share-links/[linkId]
 * Deactivate a share link (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, linkId } = await params
    const orgId = (session.user as any).orgId

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify link exists
    const existingLink = await prisma.specShareLink.findFirst({
      where: { id: linkId, projectId }
    })

    if (!existingLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    // Soft delete by setting active to false
    await prisma.specShareLink.update({
      where: { id: linkId },
      data: { active: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting spec share link:', error)
    return NextResponse.json(
      { error: 'Failed to delete share link' },
      { status: 500 }
    )
  }
}
