// Generate PDF for invoice
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId

    const { id: projectId, invoiceId } = await params

    // Fetch invoice with all details
    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId: orgId
      },
      include: {
        lineItems: {
          include: {
            roomFFEItem: {
              select: {
                name: true,
                images: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        payments: {
          where: {
            status: { in: ['PAID', 'PARTIAL'] }
          }
        },
        project: {
          include: {
            client: true,
            organization: {
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
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Calculate totals
    const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = Number(invoice.totalAmount) - paidAmount

    // Generate HTML for PDF
    const org = invoice.project.organization
    const companyName = org?.businessName || org?.name || 'Your Company'

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 12px;
              color: #333;
              line-height: 1.4;
            }
            .invoice {
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #1a1a1a;
            }
            .company-info {
              text-align: right;
            }
            .company-name {
              font-size: 24px;
              font-weight: 700;
              color: #1a1a1a;
              margin-bottom: 8px;
            }
            .company-details {
              color: #666;
              font-size: 11px;
            }
            .invoice-title {
              font-size: 32px;
              font-weight: 300;
              color: #1a1a1a;
              letter-spacing: 2px;
            }
            .invoice-meta {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
            }
            .bill-to {
              flex: 1;
            }
            .invoice-details {
              text-align: right;
            }
            .label {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #999;
              margin-bottom: 4px;
            }
            .value {
              font-size: 14px;
              color: #333;
            }
            .invoice-number {
              font-size: 16px;
              font-weight: 600;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              text-align: left;
              padding: 12px 8px;
              border-bottom: 2px solid #1a1a1a;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #666;
            }
            th:last-child, td:last-child {
              text-align: right;
            }
            td {
              padding: 12px 8px;
              border-bottom: 1px solid #eee;
            }
            .item-name {
              font-weight: 500;
            }
            .item-desc {
              font-size: 11px;
              color: #666;
              margin-top: 2px;
            }
            .totals {
              float: right;
              width: 280px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
            }
            .totals-row.subtotal {
              border-top: 1px solid #eee;
              padding-top: 12px;
            }
            .totals-row.total {
              border-top: 2px solid #1a1a1a;
              font-size: 16px;
              font-weight: 600;
              padding-top: 12px;
              margin-top: 8px;
            }
            .totals-row.balance {
              background: #f5f5f5;
              padding: 12px;
              margin-top: 8px;
              font-size: 18px;
              font-weight: 700;
              color: ${balance > 0 ? '#d97706' : '#16a34a'};
            }
            .payment-section {
              clear: both;
              margin-top: 60px;
              padding-top: 30px;
              border-top: 1px solid #eee;
            }
            .payment-title {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 16px;
            }
            .payment-info {
              background: #f9f9f9;
              padding: 20px;
              border-radius: 4px;
              font-size: 12px;
            }
            .payment-info pre {
              white-space: pre-wrap;
              font-family: inherit;
              margin: 0;
            }
            .footer {
              margin-top: 60px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              text-align: center;
              color: #999;
              font-size: 10px;
            }
            .tax-numbers {
              margin-top: 8px;
            }
            .notes {
              margin-top: 30px;
              padding: 16px;
              background: #fffbeb;
              border-left: 4px solid #f59e0b;
              font-size: 11px;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <div>
                <div class="invoice-title">INVOICE</div>
              </div>
              <div class="company-info">
                <div class="company-name">${companyName}</div>
                <div class="company-details">
                  ${org?.businessAddress || ''}<br>
                  ${org?.businessCity || ''}${org?.businessProvince ? `, ${org.businessProvince}` : ''} ${org?.businessPostal || ''}<br>
                  ${org?.businessEmail || ''}<br>
                  ${org?.businessPhone || ''}
                </div>
              </div>
            </div>

            <div class="invoice-meta">
              <div class="bill-to">
                <div class="label">Bill To</div>
                <div class="value" style="font-weight: 600">${invoice.clientName || invoice.project.client?.name || ''}</div>
                <div class="value">${invoice.clientEmail || invoice.project.client?.email || ''}</div>
                ${invoice.clientPhone ? `<div class="value">${invoice.clientPhone}</div>` : ''}
                ${invoice.clientAddress ? `<div class="value" style="margin-top: 4px; white-space: pre-line">${invoice.clientAddress}</div>` : ''}
              </div>
              <div class="invoice-details">
                <div style="margin-bottom: 16px">
                  <div class="label">Invoice Number</div>
                  <div class="invoice-number">${invoice.quoteNumber}</div>
                </div>
                <div style="margin-bottom: 16px">
                  <div class="label">Date</div>
                  <div class="value">${new Date(invoice.createdAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
                ${invoice.validUntil ? `
                <div>
                  <div class="label">Due Date</div>
                  <div class="value">${new Date(invoice.validUntil).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
                ` : ''}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50%">Item</th>
                  <th style="width: 15%">Qty</th>
                  <th style="width: 17%">Price</th>
                  <th style="width: 18%">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.lineItems.map(item => `
                  <tr>
                    <td>
                      <div class="item-name">${item.displayName}</div>
                      ${item.displayDescription ? `<div class="item-desc">${item.displayDescription}</div>` : ''}
                      ${item.roomName ? `<div class="item-desc">${item.roomName}</div>` : ''}
                    </td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.clientUnitPrice).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                    <td>$${Number(item.clientTotalPrice).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals">
              <div class="totals-row subtotal">
                <span>Subtotal</span>
                <span>$${Number(invoice.subtotal).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
              ${invoice.gstAmount ? `
              <div class="totals-row">
                <span>GST (${invoice.gstRate || 5}%)</span>
                <span>$${Number(invoice.gstAmount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
              ` : ''}
              ${invoice.qstAmount ? `
              <div class="totals-row">
                <span>QST (${invoice.qstRate || 9.975}%)</span>
                <span>$${Number(invoice.qstAmount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
              ` : ''}
              <div class="totals-row total">
                <span>Total</span>
                <span>$${Number(invoice.totalAmount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
              ${paidAmount > 0 ? `
              <div class="totals-row" style="color: #16a34a">
                <span>Paid</span>
                <span>-$${paidAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
              ` : ''}
              <div class="totals-row balance">
                <span>Amount Due</span>
                <span>$${balance.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            ${org?.wireInstructions ? `
            <div class="payment-section">
              <div class="payment-title">Payment Instructions</div>
              <div class="payment-info">
                <pre>${org.wireInstructions}</pre>
              </div>
            </div>
            ` : ''}

            <div class="notes">
              Items will be ordered upon payment confirmation. Please reference invoice number <strong>${invoice.quoteNumber}</strong> with your payment.
            </div>

            <div class="footer">
              <div>${companyName}</div>
              ${(org?.gstNumber || org?.qstNumber) ? `
              <div class="tax-numbers">
                ${org.gstNumber ? `GST: ${org.gstNumber}` : ''}
                ${org.gstNumber && org.qstNumber ? ' | ' : ''}
                ${org.qstNumber ? `QST: ${org.qstNumber}` : ''}
              </div>
              ` : ''}
            </div>
          </div>
        </body>
      </html>
    `

    // Return HTML as PDF preview (actual PDF generation would require puppeteer or similar)
    // For now, return HTML that can be printed to PDF
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${invoice.quoteNumber}.html"`
      }
    })
  } catch (error) {
    console.error('Error generating invoice PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
