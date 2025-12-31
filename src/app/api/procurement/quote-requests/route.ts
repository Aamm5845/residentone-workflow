import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/procurement/quote-requests
 * Get all quote requests sent to suppliers (simplified view)
 * Combines RFQ data with supplier responses into a flat list
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get orgId from session
    let orgId = (session.user as any).orgId
    
    if (!orgId && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      orgId = user?.orgId
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    // Get all supplier RFQs (quote requests sent to suppliers)
    const supplierRFQs = await prisma.supplierRFQ.findMany({
      where: {
        rfq: {
          orgId
        }
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            logo: true
          }
        },
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        quotes: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            totalAmount: true,
            subtotal: true,
            quoteDocumentUrl: true,
            submittedAt: true,
            lineItems: {
              select: { id: true }
            }
          }
        },
        _count: {
          select: {
            lineItems: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // Show SUBMITTED first
        { sentAt: 'desc' }
      ]
    })

    // Transform to flat list of quote requests
    const requests = supplierRFQs.map(sr => {
      const latestQuote = sr.quotes[0]
      
      // Determine the effective status
      let effectiveStatus = sr.status
      if (latestQuote) {
        effectiveStatus = latestQuote.status
      }
      
      return {
        id: sr.id,
        rfqId: sr.rfq.id,
        rfqNumber: sr.rfq.rfqNumber,
        title: sr.rfq.title,
        projectName: sr.rfq.project.name,
        projectId: sr.rfq.project.id,
        supplierName: sr.supplier?.name || sr.vendorName || 'Unknown',
        supplierId: sr.supplier?.id || null,
        supplierLogo: sr.supplier?.logo || null,
        vendorEmail: sr.vendorEmail,
        status: effectiveStatus,
        sentAt: sr.sentAt?.toISOString() || sr.createdAt.toISOString(),
        submittedAt: latestQuote?.submittedAt?.toISOString() || null,
        totalAmount: latestQuote?.totalAmount || latestQuote?.subtotal || null,
        lineItemsCount: latestQuote?.lineItems?.length || sr._count.lineItems,
        quoteDocumentUrl: latestQuote?.quoteDocumentUrl || null,
        hasQuote: !!latestQuote,
        quoteId: latestQuote?.id || null
      }
    })

    // Sort: Quoted items first, then by date
    requests.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        'SUBMITTED': 1,
        'QUOTED': 1,
        'SENT': 2,
        'PENDING': 2,
        'ACCEPTED': 3,
        'REJECTED': 4,
        'DECLINED': 4
      }
      
      const aOrder = statusOrder[a.status] || 5
      const bOrder = statusOrder[b.status] || 5
      
      if (aOrder !== bOrder) return aOrder - bOrder
      
      // Within same status, sort by date (newest first)
      return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching quote requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote requests' },
      { status: 500 }
    )
  }
}

