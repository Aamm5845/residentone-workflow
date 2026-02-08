import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/procurement/items/[itemId]/quote-link
 * Get current quote link and available quotes for an item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, itemId } = await params
    const orgId = (session.user as any).orgId

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get the item with its current quote link and all available quotes
    const item = await prisma.roomFFEItem.findFirst({
      where: { id: itemId },
      include: {
        section: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        },
        acceptedQuoteLineItem: {
          include: {
            supplierQuote: {
              include: {
                supplier: true
              }
            }
          }
        },
        allQuoteLineItems: {
          where: {
            isLatestVersion: true
          },
          include: {
            supplierQuote: {
              include: {
                supplier: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify item belongs to the project
    if (item.section.room.project.id !== projectId) {
      return NextResponse.json({ error: 'Item does not belong to this project' }, { status: 403 })
    }

    return NextResponse.json({
      item: {
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitType: item.unitType,
        images: item.images,
        supplierName: item.supplierName
      },
      currentQuote: item.acceptedQuoteLineItem ? {
        id: item.acceptedQuoteLineItem.id,
        unitPrice: item.acceptedQuoteLineItem.unitPrice,
        totalPrice: item.acceptedQuoteLineItem.totalPrice,
        leadTime: item.acceptedQuoteLineItem.leadTime,
        leadTimeWeeks: item.acceptedQuoteLineItem.leadTimeWeeks,
        availability: item.acceptedQuoteLineItem.availability,
        supplierName: item.acceptedQuoteLineItem.supplierQuote?.supplier?.name,
        supplierId: item.acceptedQuoteLineItem.supplierQuote?.supplierId,
        quoteId: item.acceptedQuoteLineItem.supplierQuoteId,
        quoteStatus: item.acceptedQuoteLineItem.supplierQuote?.status
      } : null,
      availableQuotes: item.allQuoteLineItems.map(q => ({
        id: q.id,
        unitPrice: q.unitPrice,
        totalPrice: q.totalPrice,
        leadTime: q.leadTime,
        leadTimeWeeks: q.leadTimeWeeks,
        availability: q.availability,
        supplierName: q.supplierQuote?.supplier?.name,
        supplierId: q.supplierQuote?.supplierId,
        quoteId: q.supplierQuoteId,
        quoteStatus: q.supplierQuote?.status,
        isAccepted: q.isAccepted,
        isCurrent: item.acceptedQuoteLineItemId === q.id
      }))
    })
  } catch (error) {
    console.error('Error fetching quote link:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote link' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/procurement/items/[itemId]/quote-link
 * Link a quote to an item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, itemId } = await params
    const body = await request.json()
    const { quoteLineItemId } = body
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get the item
    const item = await prisma.roomFFEItem.findFirst({
      where: { id: itemId },
      include: {
        section: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify item belongs to the project
    if (item.section.room.project.id !== projectId) {
      return NextResponse.json({ error: 'Item does not belong to this project' }, { status: 403 })
    }

    // Verify the quote line item exists and belongs to this item
    const quoteLineItem = await prisma.supplierQuoteLineItem.findFirst({
      where: {
        id: quoteLineItemId,
        roomFFEItemId: itemId
      },
      include: {
        supplierQuote: {
          include: {
            supplier: true
          }
        }
      }
    })

    if (!quoteLineItem) {
      return NextResponse.json({ error: 'Quote line item not found or does not belong to this item' }, { status: 404 })
    }

    // Update the item with the new accepted quote
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: {
        acceptedQuoteLineItemId: quoteLineItemId,
        // Update unit cost from quote
        unitCost: quoteLineItem.unitPrice,
        totalCost: quoteLineItem.totalPrice,
        // Update supplier info from quote
        supplierId: quoteLineItem.supplierQuote?.supplierId,
        supplierName: quoteLineItem.supplierQuote?.supplier?.name,
        leadTime: quoteLineItem.leadTime,
        updatedById: userId
      }
    })

    // Mark the quote line item as accepted
    await prisma.supplierQuoteLineItem.update({
      where: { id: quoteLineItemId },
      data: {
        isAccepted: true,
        acceptedAt: new Date(),
        acceptedById: userId
      }
    })

    // Unmark any previously accepted quote line items for this item
    await prisma.supplierQuoteLineItem.updateMany({
      where: {
        roomFFEItemId: itemId,
        id: { not: quoteLineItemId },
        isAccepted: true
      },
      data: {
        isAccepted: false,
        acceptedAt: null,
        acceptedById: null
      }
    })

    return NextResponse.json({
      success: true,
      message: `Quote from ${quoteLineItem.supplierQuote?.supplier?.name || 'supplier'} linked to item`,
      item: {
        id: updatedItem.id,
        name: updatedItem.name,
        acceptedQuoteLineItemId: updatedItem.acceptedQuoteLineItemId
      }
    })
  } catch (error) {
    console.error('Error linking quote:', error)
    return NextResponse.json(
      { error: 'Failed to link quote' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/procurement/items/[itemId]/quote-link
 * Unlink the current quote from an item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, itemId } = await params
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get the item
    const item = await prisma.roomFFEItem.findFirst({
      where: { id: itemId },
      include: {
        section: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify item belongs to the project
    if (item.section.room.project.id !== projectId) {
      return NextResponse.json({ error: 'Item does not belong to this project' }, { status: 403 })
    }

    if (!item.acceptedQuoteLineItemId) {
      return NextResponse.json({ error: 'Item has no linked quote' }, { status: 400 })
    }

    // Unmark the quote line item as accepted
    await prisma.supplierQuoteLineItem.update({
      where: { id: item.acceptedQuoteLineItemId },
      data: {
        isAccepted: false,
        acceptedAt: null,
        acceptedById: null
      }
    })

    // Update the item to remove the quote link and revert status
    const updatedItem = await prisma.roomFFEItem.update({
      where: { id: itemId },
      data: {
        acceptedQuoteLineItemId: null,
        specStatus: 'SELECTED',
        updatedById: userId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Quote unlinked from item',
      item: {
        id: updatedItem.id,
        name: updatedItem.name,
        acceptedQuoteLineItemId: null
      }
    })
  } catch (error) {
    console.error('Error unlinking quote:', error)
    return NextResponse.json(
      { error: 'Failed to unlink quote' },
      { status: 500 }
    )
  }
}
