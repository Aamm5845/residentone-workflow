import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'

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
                discipline: true,
                drawingType: true,
                dropboxPath: true,
                dropboxUrl: true
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

    // Build org info
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const companyLogo = org?.logoUrl || 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png'
    const firstName = transmittal.recipientName.split(' ')[0]
    const itemCount = transmittal.items.length

    // Subject line - clean, no "Transmittal" word
    const emailSubject = transmittal.subject && transmittal.subject.trim() !== ''
      ? `${project.name} — ${transmittal.subject}`
      : `${project.name} — Drawing${itemCount !== 1 ? 's' : ''}`

    // Purpose text
    const purposeText = transmittal.items[0]?.purpose
      ? transmittal.items[0].purpose.replace(/_/g, ' ').toLowerCase()
      : ''

    // Drawing list rows
    const drawingRows = transmittal.items
      .map((item) => {
        const rev = item.revision
          ? `Rev ${item.revisionNumber ?? item.revision.revisionNumber}`
          : ''
        const num = item.drawing.drawingNumber || ''
        return `
          <tr>
            <td style="padding: 10px 16px; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6;">${num}</td>
            <td style="padding: 10px 16px; color: #374151; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${item.drawing.title}</td>
            <td style="padding: 10px 16px; color: #6b7280; font-size: 13px; text-align: center; border-bottom: 1px solid #f3f4f6;">${rev}</td>
          </tr>`
      })
      .join('')

    // Notes section
    const notesHtml = transmittal.notes
      ? `<div style="background: #fefce8; border-left: 3px solid #eab308; padding: 12px 16px; margin-bottom: 32px; border-radius: 0 6px 6px 0;">
           <p style="margin: 0; color: #713f12; font-size: 14px;">${transmittal.notes}</p>
         </div>`
      : ''

    // Intro text
    const introText = itemCount === 1
      ? `Here's a drawing${purposeText ? ' ' + purposeText : ''} for <strong>${project.name}</strong>.`
      : `Here are ${itemCount} drawings${purposeText ? ' ' + purposeText : ''} for <strong>${project.name}</strong>.`

    // Attachment info
    const attachmentText = attachments.length > 0
      ? `${attachments.length} PDF${attachments.length !== 1 ? 's' : ''} attached`
      : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
    <div style="max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="padding: 40px 40px 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            <img src="${companyLogo}"
                 alt="${companyName}"
                 style="max-width: 220px; max-height: 80px; height: auto; margin-bottom: 24px;" />
            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${project.name}</p>
            ${attachmentText ? `<p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">${attachmentText}</p>` : ''}
        </div>

        <!-- Content -->
        <div style="padding: 32px 40px;">
            <p style="margin: 0 0 32px 0; color: #4b5563; font-size: 15px;">
                Hi ${firstName}, ${introText}
            </p>

            ${notesHtml}

            <!-- Drawings Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
                <thead>
                    <tr style="border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 8px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">No.</th>
                        <th style="padding: 8px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Drawing</th>
                        <th style="padding: 8px 16px; text-align: center; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Rev</th>
                    </tr>
                </thead>
                <tbody>
                    ${drawingRows}
                </tbody>
            </table>

            <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Drawings are included as PDF attachments to this email.
            </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
            <p style="margin: 0 0 4px 0; color: #374151; font-size: 14px; font-weight: 500;">${companyName}</p>
            ${org?.businessEmail ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">${org.businessEmail}</p>` : ''}
            ${org?.businessPhone ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">${org.businessPhone}</p>` : ''}
        </div>
    </div>

    <!-- Bottom note -->
    <div style="max-width: 560px; margin: 16px auto 40px auto; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
        </p>
    </div>
</body>
</html>`

    // Send the email
    const emailResult = await sendEmail({
      to: transmittal.recipientEmail,
      subject: emailSubject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined
    })

    // Update transmittal status
    const updatedTransmittal = await prisma.transmittal.update({
      where: { id: transmittalId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentBy: session.user.id,
        emailId: emailResult.messageId || null
      },
      include: {
        items: {
          include: {
            drawing: {
              select: {
                id: true,
                drawingNumber: true,
                title: true,
                discipline: true
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
