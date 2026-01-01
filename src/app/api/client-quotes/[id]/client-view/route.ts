import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-quotes/[id]/client-view
 * Get client-facing invoice data (no internal pricing/profit info)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      console.error('[Client Invoice View] Invalid ID received:', id)
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    console.log('[Client Invoice View] Fetching invoice with ID:', id)

    // Get the client quote - this is a public endpoint for clients
    const quote = await prisma.clientQuote.findFirst({
      where: { id },
      include: {
        project: {
          select: {
            name: true,
            client: {
              select: {
                name: true,
                email: true,
                phone: true
              }
            }
          }
        },
        lineItems: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                images: true,
                description: true,
                brand: true,
                modelNumber: true,
                finish: true,
                width: true,
                height: true,
                depth: true,
                length: true,
                leadTime: true,
                notes: true,
                section: {
                  select: {
                    name: true
                  }
                },
                room: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!quote) {
      console.error('[Client Invoice View] Invoice not found for ID:', id)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    console.log('[Client Invoice View] Found invoice:', quote.quoteNumber)

    // Get organization info separately
    const organization = await prisma.organization.findUnique({
      where: { id: quote.orgId },
      select: {
        name: true,
        businessName: true,
        businessEmail: true,
        businessPhone: true,
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
        logoUrl: true,
        gstNumber: true,
        qstNumber: true,
        wireInstructions: true
      }
    })

    // Return only client-facing data (no cost, markup, or profit info)
    return NextResponse.json({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      description: quote.description,
      validUntil: quote.validUntil,
      paymentTerms: quote.paymentTerms,
      subtotal: parseFloat(quote.subtotal?.toString() || '0'),
      // Tax breakdown
      gstRate: quote.gstRate ? parseFloat(quote.gstRate.toString()) : undefined,
      gstAmount: quote.gstAmount ? parseFloat(quote.gstAmount.toString()) : undefined,
      qstRate: quote.qstRate ? parseFloat(quote.qstRate.toString()) : undefined,
      qstAmount: quote.qstAmount ? parseFloat(quote.qstAmount.toString()) : undefined,
      taxRate: quote.taxRate ? parseFloat(quote.taxRate.toString()) : undefined,
      taxAmount: quote.taxAmount ? parseFloat(quote.taxAmount.toString()) : undefined,
      totalAmount: parseFloat(quote.totalAmount?.toString() || quote.subtotal?.toString() || '0'),
      // CC processing fee rate (3%)
      ccFeeRate: 3,
      lineItems: quote.lineItems.map(item => {
        // Get first image from roomFFEItem if available
        const images = item.roomFFEItem?.images as string[] | null
        const imageUrl = images && images.length > 0 ? images[0] : null

        return {
          id: item.id,
          displayName: item.displayName,
          displayDescription: item.displayDescription,
          quantity: item.quantity,
          unitType: item.unitType,
          clientUnitPrice: parseFloat(item.clientUnitPrice?.toString() || '0'),
          clientTotalPrice: parseFloat(item.clientTotalPrice?.toString() || '0'),
          categoryName: item.categoryName || item.roomName,
          imageUrl,
          // Spec details for client viewing
          specDetails: item.roomFFEItem ? {
            brand: item.roomFFEItem.brand,
            model: item.roomFFEItem.modelNumber,
            finish: item.roomFFEItem.finish,
            dimensions: [
              item.roomFFEItem.width ? `W: ${item.roomFFEItem.width}` : null,
              item.roomFFEItem.height ? `H: ${item.roomFFEItem.height}` : null,
              item.roomFFEItem.depth ? `D: ${item.roomFFEItem.depth}` : null,
              item.roomFFEItem.length ? `L: ${item.roomFFEItem.length}` : null
            ].filter(Boolean).join(' x ') || null,
            leadTime: item.roomFFEItem.leadTime,
            notes: item.roomFFEItem.notes,
            room: item.roomFFEItem.room?.name,
            section: item.roomFFEItem.section?.name,
            allImages: images
          } : null
        }
      }),
      project: quote.project,
      organization
    })
  } catch (error) {
    console.error('Error fetching client invoice:', error)
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
  }
}
