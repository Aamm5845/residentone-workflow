import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

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

    // Verify project access and get project name
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true, name: true }
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
                drawingType: true
              }
            },
            revision: {
              select: {
                id: true,
                revisionNumber: true,
                description: true,
                issuedDate: true,
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
        { error: 'Transmittal has already been sent' },
        { status: 400 }
      )
    }

    // Build professional HTML email
    const drawingRows = transmittal.items
      .map((item) => {
        const rev = item.revision
          ? 'Rev ' + (item.revisionNumber ?? item.revision.revisionNumber)
          : 'N/A'
        const linkCell = item.revision?.dropboxUrl
          ? '<a href="' + item.revision.dropboxUrl + '" style="color: #2563eb; text-decoration: underline;">View File</a>'
          : '-'
        return '<tr>' +
          '<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">' + item.drawing.drawingNumber + '</td>' +
          '<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">' + item.drawing.title + '</td>' +
          '<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">' + (item.drawing.discipline ? item.drawing.discipline.replace(/_/g, ' ') : '-') + '</td>' +
          '<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: center;">' + rev + '</td>' +
          '<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">' + (item.purpose || '-') + '</td>' +
          '<td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: center;">' + linkCell + '</td>' +
          '</tr>'
      })
      .join('')

    const emailSubject = transmittal.subject
      ? 'Transmittal ' + transmittal.transmittalNumber + ': ' + transmittal.subject
      : 'Transmittal ' + transmittal.transmittalNumber + ' - ' + project.name

    const notesSection = transmittal.notes
      ? '<div style="margin: 20px 0; padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">' +
        '<p style="margin: 0 0 4px; font-weight: 600; font-size: 14px; color: #374151;">Notes:</p>' +
        '<p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">' + transmittal.notes + '</p>' +
        '</div>'
      : ''

    const senderName = session.user.name || 'Project Team'
    const itemCount = transmittal.items.length
    const itemLabel = itemCount !== 1 ? 'drawings' : 'drawing'
    const recipientLine = transmittal.recipientCompany
      ? transmittal.recipientName + ' - ' + transmittal.recipientCompany
      : transmittal.recipientName
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const html = '<!DOCTYPE html>' +
      '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
      '<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; background-color: #f3f4f6;">' +
      '<div style="max-width: 700px; margin: 0 auto; padding: 32px 16px;">' +
      '<div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">' +
      '<div style="background-color: #1e293b; padding: 24px 32px;">' +
      '<h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Drawing Transmittal</h1>' +
      '<p style="margin: 4px 0 0; color: #94a3b8; font-size: 14px;">' + project.name + '</p>' +
      '</div>' +
      '<div style="padding: 32px;">' +
      '<table style="width: 100%; margin-bottom: 24px; font-size: 14px;">' +
      '<tr><td style="padding: 6px 0; color: #6b7280; width: 160px;">Transmittal No:</td><td style="padding: 6px 0; color: #111827; font-weight: 600;">' + transmittal.transmittalNumber + '</td></tr>' +
      '<tr><td style="padding: 6px 0; color: #6b7280;">Date:</td><td style="padding: 6px 0; color: #111827;">' + dateStr + '</td></tr>' +
      '<tr><td style="padding: 6px 0; color: #6b7280;">To:</td><td style="padding: 6px 0; color: #111827;">' + recipientLine + '</td></tr>' +
      '<tr><td style="padding: 6px 0; color: #6b7280;">From:</td><td style="padding: 6px 0; color: #111827;">' + senderName + '</td></tr>' +
      '<tr><td style="padding: 6px 0; color: #6b7280;">Items Included:</td><td style="padding: 6px 0; color: #111827;">' + itemCount + ' ' + itemLabel + '</td></tr>' +
      '</table>' +
      notesSection +
      '<div style="overflow-x: auto;">' +
      '<table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">' +
      '<thead><tr style="background-color: #f8fafc;">' +
      '<th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.05em;">Drawing No.</th>' +
      '<th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.05em;">Title</th>' +
      '<th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.05em;">Discipline</th>' +
      '<th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.05em;">Rev</th>' +
      '<th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.05em;">Purpose</th>' +
      '<th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.05em;">File</th>' +
      '</tr></thead>' +
      '<tbody>' + drawingRows + '</tbody>' +
      '</table></div>' +
      '<p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">This transmittal was generated automatically. Please contact the sender if you have any questions.</p>' +
      '</div></div></div></body></html>'

    // Send the email
    const emailResult = await sendEmail({
      to: transmittal.recipientEmail,
      subject: emailSubject,
      html
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
      emailId: emailResult.messageId
    })
  } catch (error) {
    console.error('[project-files-v2/transmittals/send] Error sending transmittal:', error)
    return NextResponse.json(
      {
        error: 'Failed to send transmittal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
