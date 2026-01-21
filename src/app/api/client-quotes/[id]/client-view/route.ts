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

    // Validate token
    if (!id || id === 'undefined' || id === 'null') {
      console.error('[Client Invoice View] Invalid token received:', id)
      return NextResponse.json({ error: 'Invalid access token' }, { status: 400 })
    }

    console.log('[Client Invoice View] Fetching invoice with ID/token:', id)

    // Get the client quote - try accessToken first (client access), then by ID (internal preview)
    let quote = await prisma.clientQuote.findFirst({
      where: {
        accessToken: id
      },
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
                    name: true,
                    instance: {
                      select: {
                        room: {
                          select: {
                            name: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    // If not found by accessToken, try by ID (internal preview)
    if (!quote) {
      quote = await prisma.clientQuote.findFirst({
        where: {
          id: id
        },
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
                      name: true,
                      instance: {
                        select: {
                          room: {
                            select: {
                              name: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      })
    }

    if (!quote) {
      console.error('[Client Invoice View] Invoice not found for ID/token:', id)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    console.log('[Client Invoice View] Found invoice:', quote.quoteNumber)

    // Track client view (only on first view)
    if (!quote.emailOpenedAt) {
      await prisma.clientQuote.update({
        where: { id: quote.id },
        data: {
          emailOpenedAt: new Date(),
          // Update status to CLIENT_REVIEWING on first view (if still SENT_TO_CLIENT)
          ...(quote.status === 'SENT_TO_CLIENT' && {
            status: 'CLIENT_REVIEWING'
          })
        }
      })

      // Create activity for view
      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quote.id,
          type: 'VIEWED_BY_CLIENT',
          message: 'Client viewed the invoice'
        }
      })
    }

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
        neqNumber: true,
        gstNumber: true,
        qstNumber: true,
        wireInstructions: true,
        etransferEmail: true
      }
    })

    // Get payment status
    const payments = await prisma.payment.findMany({
      where: {
        clientQuoteId: quote.id,
        status: 'PAID'
      },
      select: {
        amount: true,
        paidAt: true,
        metadata: true
      }
    })

    // Calculate total paid using original amount (before CC surcharge) when available
    // This ensures balance calculations match the invoice total, not the charged amount with fees
    const totalPaidTowardInvoice = payments.reduce((sum, p) => {
      const metadata = p.metadata as Record<string, unknown> | null
      // Use originalAmount from metadata if available (for CC payments), otherwise use full amount
      const originalAmount = metadata?.originalAmount as number | undefined
      return sum + (originalAmount ?? parseFloat(p.amount.toString()))
    }, 0)

    // Total actually charged (including surcharges) - for display purposes
    const totalCharged = payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)

    const quoteTotal = parseFloat(quote.totalAmount?.toString() || quote.subtotal?.toString() || '0')
    const isPaid = totalPaidTowardInvoice >= quoteTotal
    const remainingBalance = Math.max(0, quoteTotal - totalPaidTowardInvoice)

    // Return only client-facing data (no cost, markup, or profit info)
    return NextResponse.json({
      id: quote.id,
      projectId: quote.projectId,
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      description: quote.description,
      validUntil: quote.validUntil,
      paymentTerms: quote.paymentTerms,
      subtotal: parseFloat(quote.subtotal?.toString() || '0'),
      // Additional fees
      shippingCost: quote.shippingCost ? parseFloat(quote.shippingCost.toString()) : undefined,
      customFees: quote.customFees as { name: string; amount: number }[] | undefined,
      // Tax breakdown
      gstRate: quote.gstRate ? parseFloat(quote.gstRate.toString()) : undefined,
      gstAmount: quote.gstAmount ? parseFloat(quote.gstAmount.toString()) : undefined,
      qstRate: quote.qstRate ? parseFloat(quote.qstRate.toString()) : undefined,
      qstAmount: quote.qstAmount ? parseFloat(quote.qstAmount.toString()) : undefined,
      taxRate: quote.taxRate ? parseFloat(quote.taxRate.toString()) : undefined,
      taxAmount: quote.taxAmount ? parseFloat(quote.taxAmount.toString()) : undefined,
      totalAmount: parseFloat(quote.totalAmount?.toString() || quote.subtotal?.toString() || '0'),
      currency: quote.currency || 'CAD',
      // CC processing fee rate (3%)
      ccFeeRate: 3,
      // Payment options
      allowCreditCard: quote.allowCreditCard !== false, // Show CC unless explicitly disabled
      lineItems: quote.lineItems.map(item => {
        // Get image: prefer stored imageUrl (for components), fall back to roomFFEItem.images
        const roomFFEImages = item.roomFFEItem?.images as string[] | null
        const imageUrl = (item as any).imageUrl || (roomFFEImages && roomFFEImages.length > 0 ? roomFFEImages[0] : null)
        const isComponent = (item as any).isComponent || false

        return {
          id: item.id,
          roomFFEItemId: item.roomFFEItem?.id || null,
          displayName: item.displayName,
          displayDescription: item.displayDescription,
          quantity: item.quantity,
          unitType: item.unitType,
          clientUnitPrice: parseFloat(item.clientUnitPrice?.toString() || '0'),
          clientTotalPrice: parseFloat(item.clientTotalPrice?.toString() || '0'),
          categoryName: item.categoryName || item.roomName,
          imageUrl,
          isComponent,
          // Spec details for client viewing (not shown for components)
          specDetails: item.roomFFEItem && !isComponent ? {
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
            room: (item.roomFFEItem.section as any)?.instance?.room?.name,
            section: item.roomFFEItem.section?.name,
            allImages: roomFFEImages
          } : null
        }
      }),
      project: quote.project,
      organization,
      // Payment status
      isPaid,
      totalPaid: totalPaidTowardInvoice, // Amount applied to invoice (without CC surcharge)
      totalCharged, // Actual amount charged (includes CC surcharge if applicable)
      remainingBalance,
      lastPaymentDate: payments.length > 0 ? payments[payments.length - 1].paidAt : null
    })
  } catch (error) {
    console.error('Error fetching client invoice:', error)
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 })
  }
}
