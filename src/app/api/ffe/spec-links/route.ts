import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ffe/spec-links
 * Get all FFE requirements linked to a specific spec item (product)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const specItemId = searchParams.get('specItemId')

    if (!specItemId) {
      return NextResponse.json({ error: 'specItemId is required' }, { status: 400 })
    }

    // Get all links for this spec item
    const links = await prisma.fFESpecLink.findMany({
      where: { specItemId },
      include: {
        ffeRequirement: {
          select: {
            id: true,
            name: true,
            description: true,
            notes: true,
            section: {
              select: {
                id: true,
                name: true,
                instance: {
                  select: {
                    id: true,
                    room: {
                      select: {
                        id: true,
                        name: true,
                        type: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Transform to a more useful format
    const linkedFfeItems = links.map(link => ({
      linkId: link.id,
      ffeItemId: link.ffeRequirementId,
      ffeItemName: link.ffeRequirement.name,
      ffeItemDescription: link.ffeRequirement.description,
      ffeItemNotes: link.ffeRequirement.notes,
      roomId: link.roomId,
      roomName: link.roomName || link.ffeRequirement.section?.instance?.room?.name || 'Unknown Room',
      sectionId: link.ffeRequirement.section?.id,
      sectionName: link.sectionName || link.ffeRequirement.section?.name || 'Unknown Section',
      createdAt: link.createdAt
    }))

    return NextResponse.json({
      success: true,
      specItemId,
      linkedFfeItems,
      count: linkedFfeItems.length
    })

  } catch (error) {
    console.error('Error fetching spec links:', error)
    return NextResponse.json({ error: 'Failed to fetch spec links' }, { status: 500 })
  }
}

/**
 * POST /api/ffe/spec-links
 * Link an FFE requirement to an existing spec item (product)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { specItemId, ffeRequirementId, roomId, roomName, sectionName } = await request.json()

    if (!specItemId || !ffeRequirementId || !roomId) {
      return NextResponse.json({ 
        error: 'specItemId, ffeRequirementId, and roomId are required' 
      }, { status: 400 })
    }

    // Verify both items exist
    const [specItem, ffeRequirement] = await Promise.all([
      prisma.roomFFEItem.findUnique({ where: { id: specItemId } }),
      prisma.roomFFEItem.findUnique({ 
        where: { id: ffeRequirementId },
        include: {
          section: {
            include: {
              instance: {
                include: {
                  room: true
                }
              }
            }
          }
        }
      })
    ])

    if (!specItem) {
      return NextResponse.json({ error: 'Spec item not found' }, { status: 404 })
    }

    if (!ffeRequirement) {
      return NextResponse.json({ error: 'FFE requirement not found' }, { status: 404 })
    }

    // Check if link already exists
    const existingLink = await prisma.fFESpecLink.findUnique({
      where: {
        specItemId_ffeRequirementId: {
          specItemId,
          ffeRequirementId
        }
      }
    })

    if (existingLink) {
      return NextResponse.json({ 
        error: 'This FFE item is already linked to this product' 
      }, { status: 409 })
    }

    // Create the link
    const link = await prisma.fFESpecLink.create({
      data: {
        specItemId,
        ffeRequirementId,
        roomId,
        roomName: roomName || ffeRequirement.section?.instance?.room?.name || null,
        sectionName: sectionName || ffeRequirement.section?.name || null,
        createdById: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      link: {
        id: link.id,
        specItemId: link.specItemId,
        ffeRequirementId: link.ffeRequirementId,
        roomId: link.roomId,
        roomName: link.roomName,
        sectionName: link.sectionName
      }
    })

  } catch (error) {
    console.error('Error creating spec link:', error)
    return NextResponse.json({ error: 'Failed to create spec link' }, { status: 500 })
  }
}

/**
 * DELETE /api/ffe/spec-links
 * Remove a link between an FFE requirement and a spec item
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const linkId = searchParams.get('linkId')
    const specItemId = searchParams.get('specItemId')
    const ffeRequirementId = searchParams.get('ffeRequirementId')

    if (linkId) {
      // Delete by link ID
      await prisma.fFESpecLink.delete({
        where: { id: linkId }
      })
    } else if (specItemId && ffeRequirementId) {
      // Delete by composite key
      await prisma.fFESpecLink.delete({
        where: {
          specItemId_ffeRequirementId: {
            specItemId,
            ffeRequirementId
          }
        }
      })
    } else {
      return NextResponse.json({ 
        error: 'Either linkId or both specItemId and ffeRequirementId are required' 
      }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting spec link:', error)
    return NextResponse.json({ error: 'Failed to delete spec link' }, { status: 500 })
  }
}

