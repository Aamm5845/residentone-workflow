import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getBaseUrl } from '@/lib/get-base-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rfq/supplier-quote/preview-email
 *
 * Creates a preview of the email that will be sent to suppliers,
 * with a real working portal link for testing.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, itemIds, supplierId, shippingAddress, message } = body

    if (!projectId || !itemIds?.length) {
      return NextResponse.json(
        { error: 'Project ID and at least one item ID required' },
        { status: 400 }
      )
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Get project details
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: {
        id: true,
        name: true,
        streetAddress: true,
        city: true,
        province: true,
        postalCode: true,
        client: { select: { name: true, email: true, phone: true } }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get items
    const items = await prisma.roomFFEItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        description: true,
        brand: true,
        sku: true,
        quantity: true,
        unitType: true,
        notes: true,
        images: true
      }
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid items found' }, { status: 400 })
    }

    // Get supplier info if specified
    let supplier = null
    if (supplierId) {
      supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, orgId },
        select: { id: true, name: true, email: true, contactName: true }
      })
    }

    // Create or reuse a preview RFQ
    let previewRfq = await prisma.rFQ.findFirst({
      where: {
        projectId,
        orgId,
        title: { startsWith: '[PREVIEW]' }
      },
      orderBy: { createdAt: 'desc' }
    })

    const rfqNumber = previewRfq?.rfqNumber || `PREVIEW-${Date.now()}`

    if (!previewRfq) {
      previewRfq = await prisma.rFQ.create({
        data: {
          orgId,
          projectId,
          rfqNumber,
          title: `[PREVIEW] Quote Request - ${project.name}`,
          description: message || 'This is a preview of what the supplier will see.',
          status: 'DRAFT',
          responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdById: userId,
          updatedById: userId,
          lineItems: {
            create: items.map((item, index) => ({
              roomFFEItemId: item.id,
              itemName: item.name,
              itemDescription: item.description || '',
              quantity: item.quantity || 1,
              unitType: item.unitType || 'units',
              order: index,
              notes: item.notes || null
            }))
          }
        }
      })
    } else {
      await prisma.rFQLineItem.deleteMany({
        where: { rfqId: previewRfq.id }
      })
      await prisma.rFQLineItem.createMany({
        data: items.map((item, index) => ({
          rfqId: previewRfq!.id,
          roomFFEItemId: item.id,
          itemName: item.name,
          itemDescription: item.description || '',
          quantity: item.quantity || 1,
          unitType: item.unitType || 'units',
          order: index,
          notes: item.notes || null
        }))
      })
    }

    // Create or reuse preview SupplierRFQ
    let previewSupplierRfq = await prisma.supplierRFQ.findFirst({
      where: {
        rfqId: previewRfq.id,
        OR: [
          { supplierId: supplier?.id || undefined },
          { vendorName: 'Preview Supplier' }
        ].filter(c => Object.values(c)[0] !== undefined)
      }
    })

    if (!previewSupplierRfq) {
      previewSupplierRfq = await prisma.supplierRFQ.create({
        data: {
          rfqId: previewRfq.id,
          supplierId: supplier?.id || null,
          vendorName: supplier?.name || 'Preview Supplier',
          vendorEmail: supplier?.email || 'preview@example.com',
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          responseStatus: 'PENDING',
          shippingAddress: shippingAddress || null
        }
      })
    } else {
      previewSupplierRfq = await prisma.supplierRFQ.update({
        where: { id: previewSupplierRfq.id },
        data: {
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          responseStatus: 'PENDING',
          viewedAt: null,
          respondedAt: null,
          shippingAddress: shippingAddress || previewSupplierRfq.shippingAddress
        }
      })
    }

    const baseUrl = getBaseUrl()
    const portalUrl = `${baseUrl}/supplier-portal/${previewSupplierRfq.accessToken}`

    // Generate the email HTML
    const emailHtml = generatePreviewEmailHtml({
      rfqNumber,
      projectName: project.name,
      items,
      supplier: supplier || { name: 'Preview Supplier', contactName: 'Supplier Contact' },
      portalUrl,
      message,
      shippingAddress: shippingAddress || (project.streetAddress
        ? `${project.streetAddress}, ${project.city}, ${project.province} ${project.postalCode}`
        : null)
    })

    return NextResponse.json({
      success: true,
      emailHtml,
      portalUrl,
      rfqNumber
    })

  } catch (error) {
    console.error('Error creating email preview:', error)
    return NextResponse.json(
      { error: 'Failed to create email preview' },
      { status: 500 }
    )
  }
}

function generatePreviewEmailHtml({
  rfqNumber,
  projectName,
  items,
  supplier,
  portalUrl,
  message,
  shippingAddress
}: {
  rfqNumber: string
  projectName: string
  items: any[]
  supplier: any
  portalUrl: string
  message?: string
  shippingAddress?: string | null
}) {
  const brandColor = '#10B981'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quote Request Preview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
    .preview-banner { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .preview-banner strong { color: #92400e; }
    .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .email-header { background: ${brandColor}; padding: 24px; }
    .email-header h1 { color: white; margin: 0 0 8px 0; font-size: 24px; }
    .email-header p { color: rgba(255,255,255,0.9); margin: 0; }
    .email-body { padding: 24px; }
    .greeting { margin-bottom: 20px; }
    .message-box { background: #fef3c7; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #f59e0b; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table th { background: #f9fafb; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600; }
    .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .items-table .qty { text-align: center; font-weight: 600; }
    .item-image { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; }
    .cta-button { display: block; text-align: center; margin: 24px 0; }
    .cta-button a { display: inline-block; background: ${brandColor}; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .cta-button a:hover { background: #059669; }
    .shipping-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .shipping-box strong { color: #166534; }
    .footer { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 13px; }
    .portal-link { margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 6px; word-break: break-all; }
    .portal-link a { color: ${brandColor}; }
  </style>
</head>
<body>
  <div class="preview-banner">
    <strong>Email Preview</strong> - This is exactly what the supplier will receive. Click the button below to test the portal.
  </div>

  <div class="email-container">
    <div class="email-header">
      <h1>Quote Request ${rfqNumber}</h1>
      <p>${projectName}</p>
    </div>

    <div class="email-body">
      <p class="greeting">Hi ${supplier.contactName || supplier.name},</p>

      <p>We would like to request a quote for the following items:</p>

      ${message ? `<div class="message-box"><em>${message}</em></div>` : ''}

      ${shippingAddress ? `
      <div class="shipping-box">
        <strong>Ship To:</strong><br/>
        ${shippingAddress}
      </div>
      ` : ''}

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 60px;"></th>
            <th>Item</th>
            <th style="width: 80px; text-align: center;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>
              ${item.images?.[0]
                ? `<img src="${item.images[0]}" alt="${item.name}" class="item-image" />`
                : '<span style="color: #9ca3af; font-size: 11px;">[No image]</span>'
              }
            </td>
            <td>
              <strong>${item.name}</strong>
              ${item.brand ? `<br/><span style="color: #6b7280; font-size: 13px;">${item.brand}${item.sku ? ` - ${item.sku}` : ''}</span>` : ''}
            </td>
            <td class="qty">${item.quantity || 1} ${item.unitType || 'units'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="cta-button">
        <a href="${portalUrl}" target="_blank">Submit Your Quote</a>
      </div>

      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        Please respond at your earliest convenience. If you have any questions, simply reply to this email.
      </p>

      <div class="portal-link">
        <strong>Direct link:</strong><br/>
        <a href="${portalUrl}" target="_blank">${portalUrl}</a>
      </div>
    </div>

    <div class="footer">
      Sent by Meisner Interiors<br/>
      <span style="font-size: 11px;">6700 Ave Du Parc #109, Montreal, QC H2V4H9</span>
    </div>
  </div>
</body>
</html>`
}
