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

    // Download PDF attachments from Dropbox using the API
    const attachments: Array<{ filename: string; content: Buffer }> = []
    for (const item of transmittal.items) {
      // Try dropboxPath from revision first, then from drawing
      const dbxPath = item.revision?.dropboxPath || item.drawing.dropboxPath

      if (dbxPath) {
        try {
          console.log(`[transmittal/send] Downloading via Dropbox API: ${item.drawing.drawingNumber} → "${dbxPath}"`)
          const pdfBuffer = await dropboxService.downloadFile(dbxPath)
          const filename = item.drawing.drawingNumber
            ? `${item.drawing.drawingNumber} - ${item.drawing.title}.pdf`
            : `${item.drawing.title}.pdf`
          attachments.push({ filename, content: pdfBuffer })
          console.log(`[transmittal/send] Attached: ${filename} (${pdfBuffer.length} bytes)`)
        } catch (err) {
          console.error(`[transmittal/send] Failed to download ${item.drawing.drawingNumber} from "${dbxPath}":`, err)
        }
      } else {
        console.warn(`[transmittal/send] Drawing ${item.drawing.drawingNumber} has no dropboxPath`)
      }
    }

    console.log(`[transmittal/send] Total attachments: ${attachments.length}/${transmittal.items.length}`)

    // Build org info
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const senderName = session.user.name || 'Project Team'
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

    // Logo header - matches invoice email style (dark bg + white logo box)
    const logoHeaderHtml = org?.logoUrl
      ? `<td style="background-color: #334155; padding: 32px 40px; text-align: center; border-radius: 12px 12px 0 0;">
           <div style="background-color: #ffffff; display: inline-block; padding: 12px 20px; border-radius: 8px;">
             <img src="${org.logoUrl}" alt="${companyName}" style="height: 44px; max-width: 200px; display: block;" />
           </div>
         </td>`
      : (companyName
        ? `<td style="background-color: #334155; padding: 32px 40px; text-align: center; border-radius: 12px 12px 0 0;">
             <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">${companyName}</h1>
           </td>`
        : '')

    // Intro text
    const introText = itemCount === 1
      ? `Here's a drawing${purposeText ? ' ' + purposeText : ''} for <strong>${project.name}</strong>.`
      : `Here are ${itemCount} drawings${purposeText ? ' ' + purposeText : ''} for <strong>${project.name}</strong>.`

    // Attachment info
    const attachmentText = attachments.length > 0
      ? `${attachments.length} PDF${attachments.length !== 1 ? 's' : ''} attached`
      : 'See drawing details below'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
    <div style="max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
        <!-- Logo Header -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${logoHeaderHtml}
          </tr>
        </table>

        <!-- Project Info -->
        <div style="padding: 28px 40px 24px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${project.name}</p>
            <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">${attachmentText}</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 40px;">
            <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px;">
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

            <p style="margin: 0; color: #374151; font-size: 15px;">
                Thanks,<br/>
                <strong>${senderName}</strong>
            </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
            ${companyName ? `<p style="margin: 0 0 4px 0; color: #374151; font-size: 14px; font-weight: 500;">${companyName}</p>` : ''}
            ${org?.businessAddress ? `<p style="margin: 0 0 2px 0; color: #9ca3af; font-size: 12px;">${org.businessAddress}${org.businessCity ? `, ${org.businessCity}` : ''}${org.businessProvince ? `, ${org.businessProvince}` : ''} ${org.businessPostal || ''}</p>` : ''}
            ${org?.businessEmail || org?.businessPhone ? `<p style="margin: 0; color: #9ca3af; font-size: 12px;">${org.businessEmail || ''}${org.businessEmail && org.businessPhone ? ' · ' : ''}${org.businessPhone || ''}</p>` : ''}
        </div>
    </div>

    <!-- Bottom note -->
    <div style="max-width: 560px; margin: 16px auto 40px auto; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${companyName || 'All rights reserved'}.
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
      attachedFiles: attachments.length
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
