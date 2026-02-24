import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'
import { getBaseUrl } from '@/lib/get-base-url'

export const runtime = 'nodejs'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FilePayload {
  name: string
  size: number
  source: 'upload' | 'dropbox'
  base64?: string | null
  dropboxPath?: string | null
  sectionId: string
  title: string
  drawnBy?: string | null
  reviewNo?: string | null
  pageNo?: string | null
  fileNotes?: string | null
}

interface RecipientPayload {
  name: string
  email: string
  company?: string | null
  type?: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function titleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── POST ───────────────────────────────────────────────────────────────────

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
    const { recipients, subject, notes, files } = body as {
      recipients: RecipientPayload[]
      subject?: string | null
      notes?: string | null
      files: FilePayload[]
    }

    // Validation
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 })
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }
    for (const f of files) {
      if (!f.sectionId || !f.title?.trim()) {
        return NextResponse.json({ error: `Section and title are required for "${f.name}"` }, { status: 400 })
      }
    }

    // ── Look up section names for folder paths ──
    const sectionIds = [...new Set(files.map(f => f.sectionId))]
    const sectionsMap = new Map<string, string>()
    const sectionRecords = await prisma.projectSection.findMany({
      where: { id: { in: sectionIds }, projectId: id },
      select: { id: true, name: true },
    })
    for (const s of sectionRecords) {
      sectionsMap.set(s.id, s.name)
    }

    // ── Step 1: Upload files to Dropbox (for uploaded files) and build attachments ──
    const attachments: Array<{ filename: string; content: string; contentType: string }> = []
    const fileDropboxPaths: Map<number, string> = new Map() // index → relative dropbox path
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        if (file.source === 'upload' && file.base64) {
          // Upload to Dropbox: 4- drawings/{SectionName}/{YYYY-MM-DD}/{filename}
          const sectionName = titleCase(sectionsMap.get(file.sectionId) || 'Unsorted')
          const sanitizedName = file.name.replace(/[<>:"|?*]/g, '_')
          const dateStr = new Date().toISOString().split('T')[0]
          const relativePath = `4- Drawings/${sectionName}/${dateStr}/${sanitizedName}`

          if (project.dropboxFolder) {
            const absolutePath = `${project.dropboxFolder}/${relativePath}`
            console.log(`[send-files] Uploading to Dropbox: "${absolutePath}"`)
            const buffer = Buffer.from(file.base64, 'base64')
            await dropboxService.uploadFile(absolutePath, buffer)
            console.log(`[send-files] Uploaded: ${sanitizedName}`)
          }

          fileDropboxPaths.set(i, relativePath)

          // Use base64 directly for email attachment
          attachments.push({
            filename: file.name,
            content: file.base64,
            contentType: getContentType(file.name),
          })
        } else if (file.source === 'dropbox' && file.dropboxPath && project.dropboxFolder) {
          // Download from Dropbox for email attachment (file stays as-is)
          fileDropboxPaths.set(i, file.dropboxPath)

          const absolutePath = `${project.dropboxFolder}/${file.dropboxPath}`
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
        { error: 'Failed to prepare any files', details: errors },
        { status: 500 }
      )
    }

    // ── Step 2: Create transmittals in a transaction ──
    const createdTransmittalIds: string[] = []
    const createdTransmittalNumbers: string[] = []

    await prisma.$transaction(async (tx) => {
      const existingCount = await tx.transmittal.count({ where: { projectId: id } })

      for (let r = 0; r < recipients.length; r++) {
        const recipient = recipients[r]
        const transmittalNumber = `T-${String(existingCount + r + 1).padStart(3, '0')}`

        const transmittal = await tx.transmittal.create({
          data: {
            projectId: id,
            transmittalNumber,
            subject: subject || null,
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            recipientCompany: recipient.company || null,
            recipientType: recipient.type || 'OTHER',
            method: 'EMAIL',
            notes: notes || null,
            createdBy: session.user!.id,
          },
        })

        // Create TransmittalItem for each file (no drawing link)
        for (let i = 0; i < files.length; i++) {
          await tx.transmittalItem.create({
            data: {
              transmittalId: transmittal.id,
              fileName: files[i].name,
              fileSize: files[i].size,
              dropboxPath: fileDropboxPaths.get(i) || null,
              purpose: 'FOR_INFORMATION',
            },
          })
        }

        createdTransmittalIds.push(transmittal.id)
        createdTransmittalNumbers.push(transmittalNumber)
      }
    })

    // ── Step 3: Send emails and update transmittals ──
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const companyLogo = 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png'
    const companyEmail = org?.businessEmail || ''
    const companyPhone = org?.businessPhone || ''
    const itemCount = files.length

    // Build file rows for email (with metadata)
    const fileRows = files
      .map((f) => {
        const sectionName = sectionsMap.get(f.sectionId) || ''
        return `
          <tr>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 500;">${f.title}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b;">${sectionName}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: center;">${f.reviewNo || '—'}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: center;">${f.pageNo || '—'}</td>
          </tr>`
      })
      .join('')

    const notesHtml = notes
      ? `<div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px 16px; margin: 0 0 20px;">
           <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">${notes}</p>
         </div>`
      : ''

    let emailsSent = 0

    for (let r = 0; r < recipients.length; r++) {
      const recipient = recipients[r]
      const transmittalId = createdTransmittalIds[r]
      const transmittalNumber = createdTransmittalNumbers[r]
      const firstName = recipient.name.split(' ')[0]
      const sentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

      const emailSubject = subject
        ? `${project.name} — ${subject}`
        : `${project.name} — File Transmittal ${transmittalNumber}`

      // Tracking pixel URL
      const baseUrl = getBaseUrl()
      const trackingPixelUrl = `${baseUrl}/api/email-tracking/transmittal_${transmittalId}/pixel.png`

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Transmittal - ${companyName}</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 16px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

        <!-- Header with Logo -->
        <div style="background: #ffffff; padding: 28px 32px 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
            <img src="${companyLogo}"
                 alt="${companyName}"
                 style="max-width: 180px; height: auto; margin-bottom: 8px;" />
            <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase;">File Transmittal</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
            <p style="font-size: 16px; color: #1e293b; margin: 0 0 6px; font-weight: 600;">Hi ${firstName},</p>
            <p style="font-size: 15px; color: #475569; margin: 0 0 4px; line-height: 1.6;">
                Please find attached ${itemCount === 1 ? 'a file' : `${itemCount} files`} for <strong style="color: #1e293b;">${project.name}</strong>.
            </p>

            <!-- Transmittal Details Card -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 110px; vertical-align: top;">Transmittal</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${transmittalNumber}</td>
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
                        <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${recipient.name}${recipient.company ? ` <span style="color: #64748b; font-weight: 400;">— ${recipient.company}</span>` : ''}</td>
                    </tr>
                </table>
            </div>

            ${notesHtml}

            <!-- Files List -->
            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                Files · ${itemCount}
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
                        ${fileRows}
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

      try {
        const emailResult = await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html,
          attachments: attachments.length > 0 ? attachments : undefined,
        })

        // Update transmittal to SENT
        await prisma.transmittal.update({
          where: { id: transmittalId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            sentBy: session.user!.id,
            emailId: emailResult.messageId || null,
          },
        })

        emailsSent++
        console.log(`[send-files] Email sent to ${recipient.email} (${attachments.length} attachments)`)
      } catch (err: any) {
        console.error(`[send-files] Failed to send to ${recipient.email}:`, err?.message)
        errors.push(`Failed to send to ${recipient.email}: ${err?.message || 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      transmittalsCreated: createdTransmittalIds.length,
      emailsSent,
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
