import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'

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

/**
 * Generate a drawing number from a filename.
 * Tries to extract a pattern like "A-101" or "E-201" from the name.
 * Falls back to a sequential SF-001 format.
 */
function generateDrawingNumber(filename: string, index: number): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  // Try to match common drawing number patterns: A-101, E201, FP-01, etc.
  const match = nameWithoutExt.match(/^([A-Z]{1,4}[\s_.-]?\d{1,4}[A-Z]?)/i)
  if (match) return match[1].replace(/[\s_]/g, '-').toUpperCase()
  return `SF-${String(index + 1).padStart(3, '0')}`
}

/**
 * Ensure drawing number is unique within project, appending suffix if needed.
 */
async function ensureUniqueDrawingNumber(projectId: string, baseNumber: string): Promise<string> {
  let candidate = baseNumber
  let attempt = 0
  while (true) {
    const exists = await prisma.projectDrawing.findUnique({
      where: { projectId_drawingNumber: { projectId, drawingNumber: candidate } },
      select: { id: true },
    })
    if (!exists) return candidate
    attempt++
    candidate = `${baseNumber}-${attempt}`
    if (attempt > 50) return `${baseNumber}-${Date.now()}`
  }
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
          // Upload to Dropbox in section subfolder: 4- drawings/{SectionName}/{filename}
          const sectionName = sectionsMap.get(file.sectionId) || 'Unsorted'
          const sanitizedName = file.name.replace(/[<>:"|?*]/g, '_')
          const relativePath = `4- drawings/${sectionName}/${sanitizedName}`

          if (project.dropboxFolder) {
            const absolutePath = `${project.dropboxFolder}/${relativePath}`
            console.log(`[send-files] Uploading to Dropbox: "${absolutePath}"`)
            const buffer = Buffer.from(file.base64, 'base64')
            await dropboxService.uploadFile(absolutePath, buffer)
            console.log(`[send-files] ✅ Uploaded: ${sanitizedName}`)
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
          console.log(`[send-files] ✅ Attached Dropbox file: ${file.name} (${buffer.length} bytes)`)
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

    // ── Step 2: Create drawings + transmittals in a transaction ──
    const createdDrawingIds: string[] = []
    const createdTransmittalIds: string[] = []

    await prisma.$transaction(async (tx) => {
      // 2a. Create ProjectDrawing + DrawingRevision for each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dropboxPathForDrawing = fileDropboxPaths.get(i) || null

        const baseNumber = generateDrawingNumber(file.name, i)
        const drawingNumber = await ensureUniqueDrawingNumber(id, baseNumber)

        const drawing = await tx.projectDrawing.create({
          data: {
            projectId: id,
            drawingNumber,
            title: file.title.trim(),
            sectionId: file.sectionId,
            status: 'ACTIVE',
            currentRevision: 1,
            dropboxPath: dropboxPathForDrawing,
            fileName: file.name,
            fileSize: file.size,
            drawnBy: file.drawnBy || null,
            reviewNo: file.reviewNo || null,
            pageNo: file.pageNo || null,
            createdBy: session.user!.id,
          },
        })

        await tx.drawingRevision.create({
          data: {
            drawingId: drawing.id,
            revisionNumber: 1,
            description: 'Initial revision',
            dropboxPath: dropboxPathForDrawing,
            fileName: file.name,
            fileSize: file.size,
            issuedBy: session.user!.id,
            issuedDate: new Date(),
          },
        })

        createdDrawingIds.push(drawing.id)
      }

      // 2b. Create one Transmittal per recipient
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

        // Create TransmittalItem for each drawing
        for (let d = 0; d < createdDrawingIds.length; d++) {
          await tx.transmittalItem.create({
            data: {
              transmittalId: transmittal.id,
              drawingId: createdDrawingIds[d],
              revisionNumber: 1,
              purpose: 'FOR_INFORMATION',
              notes: files[d].fileNotes || null,
            },
          })
        }

        createdTransmittalIds.push(transmittal.id)
      }
    })

    // ── Step 3: Send emails and update transmittals ──
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const companyLogo = org?.logoUrl || 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png'
    const companyEmail = org?.businessEmail || ''
    const companyPhone = org?.businessPhone || ''
    const itemCount = files.length

    // Fetch created drawings for email table
    const createdDrawings = await prisma.projectDrawing.findMany({
      where: { id: { in: createdDrawingIds } },
      include: { section: { select: { name: true, shortName: true } } },
      orderBy: { drawingNumber: 'asc' },
    })

    // Build drawing rows for email
    const drawingRows = createdDrawings
      .map((d) => `
        <tr>
          <td style="padding: 10px 16px; color: #111827; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6;">${d.drawingNumber}</td>
          <td style="padding: 10px 16px; color: #374151; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${d.title}</td>
          <td style="padding: 10px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">${d.section?.shortName || d.section?.name || ''}</td>
          <td style="padding: 10px 16px; color: #6b7280; font-size: 13px; text-align: center; border-bottom: 1px solid #f3f4f6;">Rev 1</td>
        </tr>`)
      .join('')

    const notesHtml = notes
      ? `<div style="background: #fefce8; border-left: 3px solid #eab308; padding: 12px 16px; margin-bottom: 32px; border-radius: 0 6px 6px 0;">
           <p style="margin: 0; color: #713f12; font-size: 14px;">${notes}</p>
         </div>`
      : ''

    const attachmentText = `${attachments.length} file${attachments.length !== 1 ? 's' : ''} attached`

    let emailsSent = 0

    for (let r = 0; r < recipients.length; r++) {
      const recipient = recipients[r]
      const transmittalId = createdTransmittalIds[r]
      const firstName = recipient.name.split(' ')[0]

      const emailSubject = subject
        ? `${project.name} — ${subject}`
        : `${project.name} — Drawing${itemCount !== 1 ? 's' : ''}`

      const introText = itemCount === 1
        ? `Here's a drawing for <strong>${project.name}</strong>.`
        : `Here are ${itemCount} drawings for <strong>${project.name}</strong>.`

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; line-height: 1.6;">
    <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="padding: 40px 40px 32px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            <img src="${companyLogo}"
                 alt="${companyName}"
                 style="max-width: 220px; max-height: 80px; height: auto; margin-bottom: 24px;" />
            <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${project.name}</p>
            <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">${attachmentText}</p>
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
                        <th style="padding: 8px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Title</th>
                        <th style="padding: 8px 16px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Section</th>
                        <th style="padding: 8px 16px; text-align: center; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Rev</th>
                    </tr>
                </thead>
                <tbody>
                    ${drawingRows}
                </tbody>
            </table>

            <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center;">
                Files are included as attachments to this email.
            </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center;">
            <p style="margin: 0 0 4px 0; color: #374151; font-size: 14px; font-weight: 500;">${companyName}</p>
            ${companyEmail ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">${companyEmail}</p>` : ''}
            ${companyPhone ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">${companyPhone}</p>` : ''}
        </div>
    </div>

    <!-- Bottom note -->
    <div style="max-width: 600px; margin: 16px auto 40px auto; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
        </p>
    </div>
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
        console.log(`[send-files] ✅ Email sent to ${recipient.email} (${attachments.length} attachments)`)
      } catch (err: any) {
        console.error(`[send-files] ❌ Failed to send to ${recipient.email}:`, err?.message)
        errors.push(`Failed to send to ${recipient.email}: ${err?.message || 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      drawingsCreated: createdDrawingIds.length,
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
