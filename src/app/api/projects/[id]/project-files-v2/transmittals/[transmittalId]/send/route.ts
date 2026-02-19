import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

export const runtime = 'nodejs'

// Download PDF from Dropbox URL and return as Buffer
async function downloadPdfFromDropbox(dropboxUrl: string): Promise<Buffer | null> {
  try {
    // Convert sharing URL to direct download URL
    let downloadUrl = dropboxUrl
    if (downloadUrl.includes('dropbox.com')) {
      downloadUrl = downloadUrl.replace('dl=0', 'dl=1').replace('raw=1', 'dl=1')
      if (!downloadUrl.includes('dl=1')) {
        downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'dl=1'
      }
    }

    const response = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'ResidentOne/1.0' }
    })

    if (!response.ok) {
      console.error(`[transmittal/send] Failed to download PDF: ${response.status} ${response.statusText}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('[transmittal/send] Error downloading PDF:', error)
    return null
  }
}

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

    // Download PDF attachments from Dropbox
    const attachments: Array<{ filename: string; content: Buffer }> = []
    for (const item of transmittal.items) {
      if (item.revision?.dropboxUrl) {
        const pdfBuffer = await downloadPdfFromDropbox(item.revision.dropboxUrl)
        if (pdfBuffer) {
          const filename = item.drawing.drawingNumber
            ? `${item.drawing.drawingNumber} - ${item.drawing.title}.pdf`
            : `${item.drawing.title}.pdf`
          attachments.push({ filename, content: pdfBuffer })
        }
      }
    }

    // Build org info
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const senderName = session.user.name || 'Project Team'
    const firstName = transmittal.recipientName.split(' ')[0]
    const itemCount = transmittal.items.length

    // Build company contact parts for footer
    const addressParts = [org?.businessAddress, org?.businessCity, org?.businessProvince, org?.businessPostal].filter(Boolean)
    const companyAddress = addressParts.join(', ')
    const contactParts: string[] = []
    if (org?.businessPhone) contactParts.push(org.businessPhone)
    if (org?.businessEmail) contactParts.push(org.businessEmail)
    const companyContact = contactParts.join(' &middot; ')

    // Build drawing list for the email body
    const drawingList = transmittal.items
      .map((item) => {
        const rev = item.revision
          ? ' (Rev ' + (item.revisionNumber ?? item.revision.revisionNumber) + ')'
          : ''
        const num = item.drawing.drawingNumber ? item.drawing.drawingNumber + ' - ' : ''
        return '<li style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151;">' +
          num + item.drawing.title + rev +
          '</li>'
      })
      .join('')

    // Subject line - simple and clear
    const emailSubject = transmittal.subject
      ? project.name + ' - ' + transmittal.subject
      : project.name + ' - Drawing' + (itemCount !== 1 ? 's' : '')

    // Notes
    const notesSection = transmittal.notes
      ? '<p style="margin: 0 0 24px; font-size: 14px; color: #4b5563; white-space: pre-wrap;">' + transmittal.notes + '</p>'
      : ''

    // Logo or company name in header
    const logoSection = org?.logoUrl
      ? '<img src="' + org.logoUrl + '" alt="' + companyName + '" style="max-height: 44px; max-width: 180px; display: block;" />'
      : (companyName ? '<span style="font-size: 16px; font-weight: 600; color: #ffffff; letter-spacing: 0.02em;">' + companyName + '</span>' : '')

    // Footer
    const footerLines: string[] = []
    if (companyName) footerLines.push(companyName)
    if (companyAddress) footerLines.push(companyAddress)
    if (companyContact) footerLines.push(companyContact)

    // Intro text
    const purposeText = transmittal.items[0]?.purpose
      ? ' ' + transmittal.items[0].purpose.replace(/_/g, ' ').toLowerCase()
      : ''
    const introText = itemCount === 1
      ? 'Please find the attached drawing' + purposeText + ' for ' + project.name + '.'
      : 'Please find the ' + itemCount + ' attached drawings' + purposeText + ' for ' + project.name + '.'

    const html = '<!DOCTYPE html>' +
      '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
      '<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; background-color: #f3f4f6;">' +
      '<div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">' +
      '<div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">' +

      // Header
      (logoSection
        ? '<div style="background-color: #1e293b; padding: 20px 32px;">' + logoSection + '</div>'
        : '') +

      // Body
      '<div style="padding: 32px;">' +

      // Greeting and intro
      '<p style="margin: 0 0 16px; font-size: 15px; color: #111827;">Hi ' + firstName + ',</p>' +
      '<p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">' + introText + '</p>' +

      notesSection +

      // Drawing list
      '<ul style="margin: 0 0 24px; padding: 0; list-style: none;">' +
      drawingList +
      '</ul>' +

      // Attachments note
      (attachments.length > 0
        ? '<p style="margin: 0 0 24px; font-size: 13px; color: #6b7280;">' + attachments.length + ' PDF' + (attachments.length !== 1 ? 's' : '') + ' attached to this email.</p>'
        : '') +

      // Sign off
      '<p style="margin: 0; font-size: 15px; color: #374151;">Thanks,<br/>' + senderName + '</p>' +

      '</div>' +

      // Footer
      (footerLines.length > 0
        ? '<div style="padding: 16px 32px; border-top: 1px solid #e5e7eb;">' +
          '<p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">' + footerLines.join(' &middot; ') + '</p>' +
          '</div>'
        : '') +

      '</div></div></body></html>'

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
        error: 'Failed to send transmittal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
