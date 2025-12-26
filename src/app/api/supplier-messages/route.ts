import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/supplier-messages
 * Get messages for a supplier, project, or order
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)

    const supplierId = searchParams.get('supplierId')
    const projectId = searchParams.get('projectId')
    const orderId = searchParams.get('orderId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // For pagination

    const where: any = {
      orgId,
      isDeleted: false
    }

    if (supplierId) where.supplierId = supplierId
    if (projectId) where.projectId = projectId
    if (orderId) where.orderId = orderId
    if (before) where.createdAt = { lt: new Date(before) }

    const messages = await prisma.supplierMessage.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        },
        senderUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Get unread count
    const unreadCount = await prisma.supplierMessage.count({
      where: {
        ...where,
        direction: 'INBOUND',
        readAt: null
      }
    })

    return NextResponse.json({
      messages: messages.reverse(), // Return oldest first for chat display
      unreadCount,
      hasMore: messages.length === limit
    })
  } catch (error) {
    console.error('[SupplierMessages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-messages
 * Send a message to a supplier
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const userName = session.user.name || 'Team Member'

    const body = await request.json()
    const {
      supplierId,
      projectId,
      orderId,
      content,
      attachments,
      sendEmail: shouldSendEmail = true
    } = body

    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Verify supplier belongs to org
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, orgId }
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Create message
    const message = await prisma.supplierMessage.create({
      data: {
        orgId,
        supplierId,
        projectId: projectId || null,
        orderId: orderId || null,
        content,
        attachments: attachments || null,
        direction: 'OUTBOUND',
        senderType: 'TEAM',
        senderUserId: userId,
        senderName: userName
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        },
        senderUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    // Send email notification if requested
    if (shouldSendEmail && supplier.email) {
      try {
        const project = projectId
          ? await prisma.project.findUnique({
              where: { id: projectId },
              select: { name: true }
            })
          : null

        const order = orderId
          ? await prisma.order.findUnique({
              where: { id: orderId },
              select: { orderNumber: true }
            })
          : null

        const subject = order
          ? `New Message - Order ${order.orderNumber}`
          : project
          ? `New Message - ${project.name}`
          : 'New Message from Meisner Interiors'

        await sendEmail({
          to: supplier.email,
          subject,
          html: generateMessageEmail(content, userName, project?.name, order?.orderNumber)
        })
      } catch (emailError) {
        console.error('[SupplierMessages] Email failed:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error('[SupplierMessages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/supplier-messages
 * Mark messages as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const body = await request.json()
    const { messageIds, action } = body

    if (action === 'mark_read' && messageIds?.length) {
      await prisma.supplierMessage.updateMany({
        where: {
          id: { in: messageIds },
          orgId,
          direction: 'INBOUND',
          readAt: null
        },
        data: {
          readAt: new Date(),
          readByUserId: userId
        }
      })

      return NextResponse.json({ success: true, markedRead: messageIds.length })
    }

    if (action === 'mark_all_read') {
      const { supplierId, projectId, orderId } = body
      const where: any = {
        orgId,
        direction: 'INBOUND',
        readAt: null
      }

      if (supplierId) where.supplierId = supplierId
      if (projectId) where.projectId = projectId
      if (orderId) where.orderId = orderId

      const result = await prisma.supplierMessage.updateMany({
        where,
        data: {
          readAt: new Date(),
          readByUserId: userId
        }
      })

      return NextResponse.json({ success: true, markedRead: result.count })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[SupplierMessages] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update messages' },
      { status: 500 }
    )
  }
}

function generateMessageEmail(
  content: string,
  senderName: string,
  projectName?: string,
  orderNumber?: string
): string {
  const contextInfo = orderNumber
    ? `Regarding Order: ${orderNumber}`
    : projectName
    ? `Regarding Project: ${projectName}`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Message</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Message</h1>
        ${contextInfo ? `<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${contextInfo}</p>` : ''}
      </div>

      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0 0 10px 0; color: #6b7280;">From: <strong>${senderName}</strong></p>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          ${content.replace(/\n/g, '<br>')}
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          To reply, please log in to your supplier portal or contact us directly.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>Meisner Interiors - Interior Design</p>
      </div>
    </body>
    </html>
  `
}
