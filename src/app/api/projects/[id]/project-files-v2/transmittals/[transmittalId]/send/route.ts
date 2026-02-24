import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'
import { getBaseUrl } from '@/lib/get-base-url'
import { stampAndMergePdfs, StampableAttachment } from '@/lib/pdf-merge'

export const runtime = 'nodejs'

// POST - Send transmittal via email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transmittalId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, transmittalId } = await params

    // Verify project access and get project + org info
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: {
        id: true,
        name: true,
        dropboxFolder: true,
        organization: {
          select: {
            name: true,
            businessName: true,
            businessPhone: true,
            businessEmail: true,
            businessAddress: true,
            businessCity: true,
            businessProvince: true,
            businessPostal: true,
            logoUrl: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get the full transmittal with items
    const transmittal = await prisma.transmittal.findFirst({
      where: { id: transmittalId, projectId: id },
      include: {
        items: {
          include: {
            drawing: {
              select: {
                id: true,
                drawingNumber: true,
                title: true,
                section: { select: { id: true, name: true, shortName: true, color: true } },
                dropboxPath: true,
                dropboxUrl: true,
                reviewNo: true,
                pageNo: true,
              }
            },
            revision: {
              select: {
                id: true,
                revisionNumber: true,
                description: true,
                issuedDate: true,
                dropboxPath: true,
                dropboxUrl: true
              }
            }
          }
        },
        creator: {
          select: { id: true, name: true }
        }
      }
    })

    if (!transmittal) {
      return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 })
    }

    if (!transmittal.recipientEmail) {
      return NextResponse.json(
        { error: 'Recipient email address is required to send' },
        { status: 400 }
      )
    }

    if (transmittal.status === 'SENT') {
      return NextResponse.json(
        { error: 'Already sent' },
        { status: 400 }
      )
    }

    // Build absolute Dropbox paths (same pattern as pdf-thumbnail route)
    // drawing.dropboxPath is RELATIVE (e.g. "4- drawings/file.pdf")
    // We need: project.dropboxFolder + "/" + relativePath (absolute path for Dropbox API)
    const dropboxFolder = project.dropboxFolder
    console.log(`[transmittal/send] Project dropboxFolder: ${JSON.stringify(dropboxFolder)}`)
    console.log(`[transmittal/send] Transmittal has ${transmittal.items.length} items`)

    // Download PDF attachments from Dropbox and convert to base64 (same format as floorplan approval emails)
    const attachments: Array<{ filename: string; content: string; contentType: string }> = []
    const itemForAttachment: Array<typeof transmittal.items[number]> = []
    const attachmentErrors: string[] = []

    for (const item of transmittal.items) {
      // Get relative path from revision first, then from drawing
      const relativePath = item.revision?.dropboxPath || item.drawing.dropboxPath

      if (relativePath && dropboxFolder) {
        // Build absolute path exactly like pdf-thumbnail does
        const absolutePath = dropboxFolder + '/' + relativePath
        try {
          console.log(`[transmittal/send] Downloading: ${item.drawing.drawingNumber} → "${absolutePath}"`)
          const pdfBuffer = await dropboxService.downloadFile(absolutePath)

          const base64Content = Buffer.from(pdfBuffer).toString('base64')
          const filename = item.drawing.drawingNumber
            ? `${item.drawing.drawingNumber} - ${item.drawing.title}.pdf`
            : `${item.drawing.title}.pdf`
          attachments.push({
            filename,
            content: base64Content,
            contentType: 'application/pdf'
          })
          itemForAttachment.push(item)
          console.log(`[transmittal/send] ✅ Attached: ${filename} (${pdfBuffer.length} bytes)`)
        } catch (err: any) {
          const errMsg = `Failed to download ${item.drawing.drawingNumber} from "${absolutePath}": ${err?.message || err}`
          console.error(`[transmittal/send] ❌ ${errMsg}`)
          attachmentErrors.push(errMsg)
        }
      } else if (!relativePath) {
        const msg = `Drawing ${item.drawing.drawingNumber} has no dropboxPath`
        console.warn(`[transmittal/send] ⚠️ ${msg}`)
        attachmentErrors.push(msg)
      } else if (!dropboxFolder) {
        const msg = `Project has no dropboxFolder configured — cannot resolve Dropbox path`
        console.warn(`[transmittal/send] ⚠️ ${msg}`)
        attachmentErrors.push(msg)
      }
    }

    console.log(`[transmittal/send] Result: ${attachments.length} attachments ready, ${attachmentErrors.length} errors`)

    // ── Stamp & merge PDFs into a single combined attachment ──
    const stampableAttachments: StampableAttachment[] = attachments.map((att, i) => {
      const item = itemForAttachment[i]
      const rev = item?.revision?.revisionNumber ?? item?.revisionNumber
      return {
        ...att,
        drawingNumber: item?.drawing.drawingNumber,
        revisionNumber: rev ?? undefined,
        title: item?.drawing.title,
      }
    })

    const mergeDateStr = new Date().toISOString().split('T')[0]
    const combinedFilename = `${project.name} - ${transmittal.transmittalNumber} - ${mergeDateStr}.pdf`

    const { pdfAttachment, nonPdfAttachments } = await stampAndMergePdfs(
      stampableAttachments,
      combinedFilename
    )

    // Upload combined PDF to Dropbox
    let combinedPdfRelPath: string | null = null
    if (pdfAttachment && project.dropboxFolder) {
      try {
        const pdfBuffer = Buffer.from(pdfAttachment.content, 'base64')
        const dropboxAbsPath = `${project.dropboxFolder}/5- transmittals/${combinedFilename}`
        console.log(`[transmittal/send] Uploading combined PDF to Dropbox: "${dropboxAbsPath}"`)
        await dropboxService.uploadFile(dropboxAbsPath, pdfBuffer)
        combinedPdfRelPath = `5- transmittals/${combinedFilename}`
        console.log(`[transmittal/send] ✅ Combined PDF saved to Dropbox`)
      } catch (err: any) {
        console.error(`[transmittal/send] ⚠️ Failed to upload combined PDF to Dropbox:`, err?.message)
      }
    }

    const finalAttachments: Array<{ filename: string; content: string; contentType: string }> = []
    if (pdfAttachment) finalAttachments.push(pdfAttachment)
    finalAttachments.push(...nonPdfAttachments)

    // Build org info
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const companyLogo = org?.logoUrl || 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png'
    const companyEmail = org?.businessEmail || ''
    const companyPhone = org?.businessPhone || ''
    const firstName = transmittal.recipientName.split(' ')[0]
    const itemCount = transmittal.items.length
    const sentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    // Tracking pixel URL
    const baseUrl = getBaseUrl()
    const trackingPixelUrl = `${baseUrl}/api/email-tracking/transmittal_${transmittalId}/pixel.png`

    // Subject line
    const emailSubject = transmittal.subject && transmittal.subject.trim() !== ''
      ? `${project.name} — ${transmittal.subject}`
      : `${project.name} — Drawing Transmittal ${transmittal.transmittalNumber}`

    // Drawing list rows
    const drawingRows = transmittal.items
      .map((item) => {
        const rev = item.revision?.revisionNumber ?? item.revisionNumber ?? ''
        return `
          <tr>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 500;">${item.drawing.title}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 500;">${item.drawing.section?.name || item.drawing.section?.shortName || ''}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: center;">${item.drawing.reviewNo || rev || ''}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: center;">${item.drawing.pageNo || '—'}</td>
          </tr>`
      })
      .join('')

    // Notes section
    const notesHtml = transmittal.notes
      ? `<div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px 16px; margin: 0 0 20px;">
           <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">${transmittal.notes}</p>
         </div>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Drawing Transmittal - ${companyName}</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 16px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

        <!-- Header with Logo -->
        <div style="background: #ffffff; padding: 28px 32px 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
            <img src="${companyLogo}"
                 alt="${companyName}"
                 style="max-width: 180px; height: auto; margin-bottom: 8px;" />
            <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase;">Drawing Transmittal</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
            <p style="font-size: 16px; color: #1e293b; margin: 0 0 6px; font-weight: 600;">Hi ${firstName},</p>
            <p style="font-size: 15px; color: #475569; margin: 0 0 4px; line-height: 1.6;">
                Please find attached ${itemCount === 1 ? 'a drawing' : `${itemCount} drawings`} for <strong style="color: #1e293b;">${project.name}</strong>. The drawings are included as a combined PDF attachment to this email.
            </p>

            <!-- Transmittal Details Card -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 110px; vertical-align: top;">Transmittal</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${transmittal.transmittalNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">Date</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${sentDate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">Project</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${project.name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">To</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${transmittal.recipientName}${transmittal.recipientCompany ? ` <span style="color: #64748b; font-weight: 400;">— ${transmittal.recipientCompany}</span>` : ''}</td>
                    </tr>
                </table>
            </div>

            ${notesHtml}

            <!-- Drawings List -->
            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                Drawings · ${itemCount}
            </p>
            <div style="background: white; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 8px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Title</th>
                            <th style="padding: 8px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Section</th>
                            <th style="padding: 8px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Review</th>
                            <th style="padding: 8px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Page</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${drawingRows}
                    </tbody>
                </table>
            </div>

            <p style="font-size: 13px; color: #94a3b8; margin: 16px 0 0; line-height: 1.5; text-align: center;">
                If you have any questions, please don't hesitate to reach out.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 8px;">${companyName}</div>
            <div style="margin-bottom: 8px;">
                ${companyEmail ? `<a href="mailto:${companyEmail}" style="color: #2563eb; text-decoration: none; font-size: 12px;">${companyEmail}</a>` : ''}
                ${companyEmail && companyPhone ? `<span style="color: #cbd5e1; margin: 0 6px;">·</span>` : ''}
                ${companyPhone ? `<a href="tel:${companyPhone.replace(/[^+\d]/g, '')}" style="color: #2563eb; text-decoration: none; font-size: 12px;">${companyPhone}</a>` : ''}
            </div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
        </div>
    </div>
    <!-- Tracking pixel -->
    <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />
</body>
</html>`

    // Send the email
    const emailResult = await sendEmail({
      to: transmittal.recipientEmail,
      subject: emailSubject,
      html,
      attachments: finalAttachments.length > 0 ? finalAttachments : undefined
    })

    // Update transmittal status
    const updatedTransmittal = await prisma.transmittal.update({
      where: { id: transmittalId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentBy: session.user.id,
        emailId: emailResult.messageId || null,
        combinedPdfPath: combinedPdfRelPath,
      },
      include: {
        items: {
          include: {
            drawing: {
              select: {
                id: true,
                drawingNumber: true,
                title: true,
                section: { select: { id: true, name: true, shortName: true, color: true } }
              }
            }
          }
        },
        creator: {
          select: { id: true, name: true }
        },
        sentByUser: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      transmittal: updatedTransmittal,
      emailId: emailResult.messageId,
      attachedFiles: attachments.length,
      attachmentErrors: attachmentErrors.length > 0 ? attachmentErrors : undefined
    })
  } catch (error) {
    console.error('[project-files-v2/transmittals/send] Error sending transmittal:', error)
    return NextResponse.json(
      {
        error: 'Failed to send',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
