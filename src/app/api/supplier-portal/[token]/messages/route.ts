import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'

// Notification email recipient
const NOTIFICATION_EMAIL = 'shaya@meisnerinteriors.com'

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

    // Send notification email
    const supplierName = supplierRFQ.supplier?.name || supplierRFQ.vendorName || 'Supplier'
    const projectName = supplierRFQ.rfq.project.name
    const rfqNumber = supplierRFQ.rfq.rfqNumber

    try {
      await sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: `New Message from ${supplierName} - RFQ ${rfqNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">New Supplier Message</h2>
            <p><strong>Project:</strong> ${projectName}</p>
            <p><strong>RFQ:</strong> ${rfqNumber}</p>
            <p><strong>Supplier:</strong> ${supplierName}</p>
            <p><strong>Message:</strong></p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="white-space: pre-line; margin: 0;">${content}</p>
            </div>
            <p style="margin-top: 24px;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/projects/${projectId}/procurement?tab=rfqs"
                 style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View in Procurement
              </a>
            </p>
          </div>
        `
      })
    } catch (emailErr) {
      console.error('Failed to send notification email:', emailErr)
      // Don't fail the request if email fails
    }

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
