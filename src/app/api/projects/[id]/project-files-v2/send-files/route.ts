import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// POST - Send files via email
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

    // Verify project access and get project info
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

    const body = await request.json()
    const { recipientName, recipientEmail, subject, notes, files } = body

    if (!recipientName || !recipientEmail) {
      return NextResponse.json({ error: 'Recipient name and email are required' }, { status: 400 })
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }

    // Build attachments
    const attachments: Array<{ filename: string; content: string; contentType: string }> = []
    const errors: string[] = []

    for (const file of files) {
      try {
        if (file.source === 'upload' && file.base64) {
          // Direct upload — already base64
          attachments.push({
            filename: file.name,
            content: file.base64,
            contentType: getContentType(file.name),
          })
          console.log(`[send-files] Attached upload: ${file.name}`)
        } else if (file.source === 'dropbox' && file.dropboxPath && project.dropboxFolder) {
          // Download from Dropbox using absolute path
          const absolutePath = project.dropboxFolder + '/' + file.dropboxPath
          console.log(`[send-files] Downloading from Dropbox: "${absolutePath}"`)
          const buffer = await dropboxService.downloadFile(absolutePath)
          const base64 = Buffer.from(buffer).toString('base64')
          attachments.push({
            filename: file.name,
            content: base64,
            contentType: getContentType(file.name),
          })
          console.log(`[send-files] Attached Dropbox file: ${file.name} (${buffer.length} bytes)`)
        } else {
          errors.push(`Could not process file: ${file.name}`)
        }
      } catch (err: any) {
        console.error(`[send-files] Error processing ${file.name}:`, err?.message)
        errors.push(`Failed to process ${file.name}: ${err?.message || 'Unknown error'}`)
      }
    }

    if (attachments.length === 0) {
      return NextResponse.json(
        { error: 'Failed to prepare any attachments', details: errors },
        { status: 500 }
      )
    }

    // Build email
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const senderName = session.user.name || 'Project Team'
    const firstName = recipientName.split(' ')[0]

    const emailSubject = subject
      ? `${project.name} — ${subject}`
      : `${project.name} — Files`

    const fileListHtml = attachments
      .map(
        (a) => `
      <tr>
        <td style="padding: 10px 16px; color: #111827; font-size: 14px; border-bottom: 1px solid #f3f4f6;">
          <span style="font-weight: 500;">${a.filename}</span>
        </td>
      </tr>`
      )
      .join('')

    const notesHtml = notes
      ? `<div style="background: #fefce8; border-left: 3px solid #eab308; padding: 12px 16px; margin-bottom: 32px; border-radius: 0 6px 6px 0;">
           <p style="margin: 0; color: #713f12; font-size: 14px;">${notes}</p>
         </div>`
      : ''

    const attachmentText = `${attachments.length} file${attachments.length !== 1 ? 's' : ''} attached`

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
            ${org?.logoUrl ? `
            <img src="${org.logoUrl}"
                 alt="${companyName}"
                 style="max-width: 220px; max-height: 80px; height: auto; margin-bottom: 24px;" />
            ` : `
            <div style="color: #111827; font-size: 22px; font-weight: 700; margin-bottom: 24px;">${companyName}</div>
            `}
            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${project.name}</p>
            <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">${attachmentText}</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 40px;">
            <p style="margin: 0 0 32px 0; color: #4b5563; font-size: 15px;">
                Hi ${firstName}, here are the files for <strong>${project.name}</strong>.
            </p>

            ${notesHtml}

            <!-- Files Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
                <thead>
                    <tr style="border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 8px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Attached Files</th>
                    </tr>
                </thead>
                <tbody>
                    ${fileListHtml}
                </tbody>
            </table>

            <p style="margin: 0; color: #374151; font-size: 15px;">
                Thanks,<br/>
                <strong>${senderName}</strong>
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

    // Send
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html,
      attachments,
    })

    console.log(`[send-files] Email sent to ${recipientEmail} with ${attachments.length} attachments`)

    return NextResponse.json({
      success: true,
      emailId: emailResult.messageId,
      attachedFiles: attachments.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[send-files] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Helper: get content type from filename
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    zip: 'application/zip',
    dwg: 'application/acad',
    dxf: 'application/dxf',
  }
  return types[ext || ''] || 'application/octet-stream'
}
