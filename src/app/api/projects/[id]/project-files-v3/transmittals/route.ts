import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// GET - List transmittals for this project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const transmittals = await prisma.transmittal.findMany({
      where: { projectId: id },
      include: {
        items: {
          include: {
            drawing: {
              select: { id: true, drawingNumber: true, title: true, discipline: true },
            },
          },
        },
        sentByUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(transmittals)
  } catch (error) {
    console.error('[project-files-v3/transmittals] GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch transmittals' }, { status: 500 })
  }
}

// POST - Create transmittals (one per recipient) and optionally send immediately
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { recipients, items, subject, notes, sendImmediately } = body

    if (!recipients?.length || !items?.length) {
      return NextResponse.json({ error: 'Recipients and items are required' }, { status: 400 })
    }

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
            logoUrl: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get next transmittal number
    const lastTransmittal = await prisma.transmittal.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      select: { transmittalNumber: true },
    })

    let nextNumber = 1
    if (lastTransmittal?.transmittalNumber) {
      const match = lastTransmittal.transmittalNumber.match(/(\d+)$/)
      if (match) nextNumber = parseInt(match[1]) + 1
    }

    // Get drawing details for items
    const drawingIds = items.map((i: any) => i.drawingId)
    const drawings = await prisma.projectDrawing.findMany({
      where: { id: { in: drawingIds }, projectId: id },
      include: {
        revisions: { orderBy: { revisionNumber: 'desc' } },
      },
    })

    const drawingMap = new Map(drawings.map((d) => [d.id, d]))

    // Create one transmittal per recipient
    const results: any[] = []

    for (const recipient of recipients) {
      const transmittalNumber = `T-${String(nextNumber).padStart(3, '0')}`
      nextNumber++

      const transmittal = await prisma.transmittal.create({
        data: {
          projectId: id,
          transmittalNumber,
          subject: subject || null,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          recipientCompany: recipient.company || null,
          recipientType: recipient.type || null,
          method: 'EMAIL',
          status: 'DRAFT',
          notes: notes || null,
          createdBy: session.user.id!,
        },
      })

      // Create transmittal items
      for (const item of items) {
        const drawing = drawingMap.get(item.drawingId)
        if (!drawing) continue

        // Use specified revision or latest
        const revision = item.revisionId
          ? drawing.revisions.find((r) => r.id === item.revisionId)
          : drawing.revisions[0]

        await prisma.transmittalItem.create({
          data: {
            transmittalId: transmittal.id,
            drawingId: item.drawingId,
            revisionId: revision?.id || null,
            revisionNumber: revision?.revisionNumber ?? drawing.currentRevision,
            purpose: item.purpose || 'FOR_INFORMATION',
          },
        })
      }

      // If sendImmediately, send the email now
      if (sendImmediately && recipient.email) {
        try {
          const sentResult = await sendTransmittalEmail(
            transmittal.id,
            project,
            session.user
          )
          results.push({ ...sentResult, transmittalNumber })
        } catch (err: any) {
          results.push({
            transmittalId: transmittal.id,
            transmittalNumber,
            recipientEmail: recipient.email,
            sent: false,
            error: err.message,
          })
        }
      } else {
        results.push({
          transmittalId: transmittal.id,
          transmittalNumber,
          recipientEmail: recipient.email,
          sent: false,
        })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('[project-files-v3/transmittals] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to create transmittals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Shared send logic
async function sendTransmittalEmail(
  transmittalId: string,
  project: any,
  user: any
) {
  const transmittal = await prisma.transmittal.findUnique({
    where: { id: transmittalId },
    include: {
      items: {
        include: {
          drawing: {
            select: {
              id: true,
              drawingNumber: true,
              title: true,
              discipline: true,
              dropboxPath: true,
            },
          },
          revision: {
            select: {
              revisionNumber: true,
              dropboxPath: true,
            },
          },
        },
      },
    },
  })

  if (!transmittal || !transmittal.recipientEmail) {
    throw new Error('Transmittal or recipient email not found')
  }

  const dropboxFolder = project.dropboxFolder
  const org = project.organization

  // Download PDF attachments
  const attachments: Array<{ filename: string; content: string; contentType: string }> = []

  for (const item of transmittal.items) {
    const relativePath = item.revision?.dropboxPath || item.drawing.dropboxPath
    if (relativePath && dropboxFolder) {
      const absolutePath = dropboxFolder + '/' + relativePath
      try {
        const pdfBuffer = await dropboxService.downloadFile(absolutePath)
        const base64Content = Buffer.from(pdfBuffer).toString('base64')
        const filename = item.drawing.drawingNumber
          ? `${item.drawing.drawingNumber} - ${item.drawing.title}.pdf`
          : `${item.drawing.title}.pdf`
        attachments.push({ filename, content: base64Content, contentType: 'application/pdf' })
      } catch (err: any) {
        console.error(`[v3/send] Failed to download ${item.drawing.drawingNumber}: ${err.message}`)
      }
    }
  }

  // Build email
  const companyName = org?.businessName || org?.name || ''
  const senderName = user.name || 'Project Team'
  const firstName = transmittal.recipientName.split(' ')[0]
  const itemCount = transmittal.items.length

  const emailSubject = transmittal.subject
    ? `${project.name} — ${transmittal.subject}`
    : `${project.name} — Drawing${itemCount !== 1 ? 's' : ''}`

  const drawingRows = transmittal.items
    .map((item) => {
      const rev = item.revision ? `Rev ${item.revision.revisionNumber}` : ''
      return `<tr>
        <td style="padding: 10px 16px; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6;">${item.drawing.drawingNumber || ''}</td>
        <td style="padding: 10px 16px; color: #374151; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${item.drawing.title}</td>
        <td style="padding: 10px 16px; color: #6b7280; font-size: 13px; text-align: center; border-bottom: 1px solid #f3f4f6;">${rev}</td>
      </tr>`
    })
    .join('')

  const notesHtml = transmittal.notes
    ? `<div style="background: #fefce8; border-left: 3px solid #eab308; padding: 12px 16px; margin-bottom: 32px; border-radius: 0 6px 6px 0;">
         <p style="margin: 0; color: #713f12; font-size: 14px;">${transmittal.notes}</p>
       </div>`
    : ''

  const introText = itemCount === 1
    ? `Here's a drawing for <strong>${project.name}</strong>.`
    : `Here are ${itemCount} drawings for <strong>${project.name}</strong>.`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <div style="max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="padding: 40px 40px 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      ${org?.logoUrl ? `<img src="${org.logoUrl}" alt="${companyName}" style="max-width: 220px; max-height: 80px; height: auto; margin-bottom: 24px;" />` : `<div style="color: #111827; font-size: 22px; font-weight: 700; margin-bottom: 24px;">${companyName}</div>`}
      <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${project.name}</p>
      ${attachments.length > 0 ? `<p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">${attachments.length} PDF${attachments.length !== 1 ? 's' : ''} attached</p>` : ''}
    </div>
    <div style="padding: 32px 40px;">
      <p style="margin: 0 0 32px 0; color: #4b5563; font-size: 15px;">Hi ${firstName}, ${introText}</p>
      ${notesHtml}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 8px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">No.</th>
            <th style="padding: 8px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Drawing</th>
            <th style="padding: 8px 16px; text-align: center; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Rev</th>
          </tr>
        </thead>
        <tbody>${drawingRows}</tbody>
      </table>
      <p style="margin: 0; color: #374151; font-size: 15px;">Thanks,<br/><strong>${senderName}</strong></p>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
      <p style="margin: 0 0 4px 0; color: #374151; font-size: 14px; font-weight: 500;">${companyName}</p>
      ${org?.businessEmail ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">${org.businessEmail}</p>` : ''}
      ${org?.businessPhone ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">${org.businessPhone}</p>` : ''}
    </div>
  </div>
</body>
</html>`

  const emailResult = await sendEmail({
    to: transmittal.recipientEmail,
    subject: emailSubject,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  })

  await prisma.transmittal.update({
    where: { id: transmittalId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      sentBy: user.id,
      emailId: emailResult.messageId || null,
    },
  })

  return {
    transmittalId,
    recipientEmail: transmittal.recipientEmail,
    sent: true,
    emailId: emailResult.messageId,
    attachedFiles: attachments.length,
  }
}
