import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/supplier-portal/[token]/messages
 * Get messages for the supplier (via portal)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Get supplier RFQ to validate token and get supplier/project info
    const supplierRFQ = await prisma.supplierRFQ.findUnique({
      where: { accessToken: token },
      include: {
        supplier: true,
        rfq: {
          include: {
            project: true
          }
        }
      }
    })

    if (!supplierRFQ) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    if (supplierRFQ.tokenExpiresAt && new Date() > supplierRFQ.tokenExpiresAt) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    const supplierId = supplierRFQ.supplierId
    const projectId = supplierRFQ.rfq.projectId

    // Get messages for this supplier and project
    const messages = await prisma.supplierMessage.findMany({
      where: {
        supplierId,
        projectId,
        isDeleted: false
      },
      include: {
        senderUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        attachments: msg.attachments,
        direction: msg.direction,
        senderType: msg.senderType,
        senderName: msg.senderName || msg.senderUser?.name || 'Team',
        createdAt: msg.createdAt,
        readAt: msg.readAt
      })),
      project: {
        id: projectId,
        name: supplierRFQ.rfq.project.name
      }
    })
  } catch (error) {
    console.error('[SupplierPortalMessages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-portal/[token]/messages
 * Send a message from the supplier portal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { content, attachments } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Get supplier RFQ to validate token
    const supplierRFQ = await prisma.supplierRFQ.findUnique({
      where: { accessToken: token },
      include: {
        supplier: true,
        rfq: {
          include: {
            project: true
          }
        }
      }
    })

    if (!supplierRFQ) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    if (supplierRFQ.tokenExpiresAt && new Date() > supplierRFQ.tokenExpiresAt) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    const supplierId = supplierRFQ.supplierId
    const projectId = supplierRFQ.rfq.projectId
    const orgId = supplierRFQ.rfq.project.orgId

    // Create inbound message from supplier
    const message = await prisma.supplierMessage.create({
      data: {
        orgId,
        supplierId,
        projectId,
        content,
        attachments: attachments || null,
        direction: 'INBOUND',
        senderType: 'SUPPLIER',
        senderName: supplierRFQ.supplier?.name || supplierRFQ.vendorName || 'Supplier'
      }
    })

    // TODO: Send notification to team members

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        direction: message.direction,
        senderType: message.senderType,
        senderName: supplierRFQ.supplier?.name,
        createdAt: message.createdAt
      }
    })
  } catch (error) {
    console.error('[SupplierPortalMessages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
