import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// GET - List file sends for this project
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

    const { searchParams } = new URL(request.url)
    const recipientEmail = searchParams.get('recipientEmail')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { projectId: id }
    if (recipientEmail) where.recipientEmail = recipientEmail

    const [fileSends, total] = await Promise.all([
      prisma.fileSend.findMany({
        where,
        include: { sentByUser: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fileSend.count({ where }),
    ])

    return NextResponse.json({ fileSends, total })
  } catch (error) {
    console.error('[project-files-v3/file-sends] GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch file sends' }, { status: 500 })
  }
}

// POST - Send a file to one or more recipients
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
    const { filePath, fileName, fileSize, mimeType, recipients, subject, notes } = body

    if (!filePath || !fileName || !recipients?.length) {
      return NextResponse.json({ error: 'File path, file name, and recipients are required' }, { status: 400 })
    }

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

    // Download file from Dropbox
    const dropboxFolder = project.dropboxFolder
    let fileBuffer: Buffer | null = null
    let base64Content: string | null = null

    if (dropboxFolder) {
      const absolutePath = dropboxFolder + '/' + filePath
      try {
        fileBuffer = Buffer.from(await dropboxService.downloadFile(absolutePath))
        base64Content = fileBuffer.toString('base64')
      } catch (err: any) {
        console.error(`[v3/file-sends] Failed to download "${absolutePath}": ${err.message}`)
      }
    }

    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const senderName = session.user.name || 'Project Team'
    const results: any[] = []

    for (const recipient of recipients) {
      const firstName = recipient.name.split(' ')[0]
      const emailSubject = subject
        ? `${project.name} — ${subject}`
        : `${project.name} — ${fileName}`

      const notesHtml = notes
        ? `<div style="background: #fefce8; border-left: 3px solid #eab308; padding: 12px 16px; margin-bottom: 32px; border-radius: 0 6px 6px 0;"><p style="margin: 0; color: #713f12; font-size: 14px;">${notes}</p></div>`
        : ''

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
  <div style="max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="padding: 40px 40px 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      ${org?.logoUrl ? `<img src="${org.logoUrl}" alt="${companyName}" style="max-width: 220px; max-height: 80px; height: auto; margin-bottom: 24px;" />` : `<div style="color: #111827; font-size: 22px; font-weight: 700; margin-bottom: 24px;">${companyName}</div>`}
      <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${project.name}</p>
      <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">1 file attached</p>
    </div>
    <div style="padding: 32px 40px;">
      <p style="margin: 0 0 32px 0; color: #4b5563; font-size: 15px;">Hi ${firstName}, here's a file for <strong>${project.name}</strong>.</p>
      ${notesHtml}
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 32px; display: flex; align-items: center; gap: 12px;">
        <div style="width: 40px; height: 40px; background: #dbeafe; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📎</div>
        <div>
          <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 500;">${fileName}</p>
          ${fileSize ? `<p style="margin: 2px 0 0 0; color: #6b7280; font-size: 12px;">${formatBytes(fileSize)}</p>` : ''}
        </div>
      </div>
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

      let emailId: string | null = null
      let sent = false

      try {
        const contentType = mimeType || 'application/octet-stream'
        const emailResult = await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html,
          attachments: base64Content ? [{ filename: fileName, content: base64Content, contentType }] : undefined,
        })
        emailId = emailResult.messageId || null
        sent = true
      } catch (err: any) {
        console.error(`[v3/file-sends] Email failed for ${recipient.email}: ${err.message}`)
      }

      const fileSend = await prisma.fileSend.create({
        data: {
          projectId: id,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          recipientCompany: recipient.company || null,
          subject: subject || null,
          notes: notes || null,
          fileName,
          filePath,
          fileSize: fileSize || null,
          mimeType: mimeType || null,
          sentAt: sent ? new Date() : null,
          sentBy: session.user.id,
          emailId,
          orgId: session.user.orgId!,
        },
      })

      results.push({ id: fileSend.id, recipientEmail: recipient.email, sent, emailId })
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('[project-files-v3/file-sends] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to send file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
