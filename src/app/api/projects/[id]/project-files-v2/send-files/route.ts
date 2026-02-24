import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service-v2'
import { getBaseUrl } from '@/lib/get-base-url'
import { stampAndMergePdfs, StampableAttachment } from '@/lib/pdf-merge'

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
  action?: 'create_new' | 'add_revision'
  existingDrawingId?: string | null
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
          // Upload to Dropbox: 4- drawings/{SectionName}/{YYYY-MM-DD}/{filename}
          const sectionName = sectionsMap.get(file.sectionId) || 'Unsorted'
          const sanitizedName = file.name.replace(/[<>:"|?*]/g, '_')
          const dateStr = new Date().toISOString().split('T')[0]
          const relativePath = `4- drawings/${sectionName}/${dateStr}/${sanitizedName}`

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
    const createdRevisionIds: string[] = []
    const createdRevisionNumbers: number[] = []
    const createdTransmittalIds: string[] = []
    const createdTransmittalNumbers: string[] = []

    await prisma.$transaction(async (tx) => {
      // 2a. Create or update ProjectDrawing + DrawingRevision for each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dropboxPathForDrawing = fileDropboxPaths.get(i) || null

        // ── Add revision to existing drawing ──
        if (file.action === 'add_revision' && file.existingDrawingId) {
          const existing = await tx.projectDrawing.findUnique({
            where: { id: file.existingDrawingId },
            select: { id: true, currentRevision: true },
          })

          if (existing) {
            const nextRev = existing.currentRevision + 1

            await tx.projectDrawing.update({
              where: { id: existing.id },
              data: {
                currentRevision: nextRev,
                status: 'ACTIVE',
                dropboxPath: dropboxPathForDrawing,
                fileName: file.name,
                fileSize: file.size,
                // Update metadata if provided
                ...(file.drawnBy ? { drawnBy: file.drawnBy } : {}),
                ...(file.reviewNo ? { reviewNo: file.reviewNo } : {}),
                ...(file.pageNo ? { pageNo: file.pageNo } : {}),
              },
            })

            const revision = await tx.drawingRevision.create({
              data: {
                drawingId: existing.id,
                revisionNumber: nextRev,
                description: `Revision ${nextRev}`,
                dropboxPath: dropboxPathForDrawing,
                fileName: file.name,
                fileSize: file.size,
                issuedBy: session.user!.id,
                issuedDate: new Date(),
              },
            })

            createdDrawingIds.push(existing.id)
            createdRevisionIds.push(revision.id)
            createdRevisionNumbers.push(nextRev)
            continue
          }
        }

        // ── Create new drawing (default) ──
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

        const revision = await tx.drawingRevision.create({
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
        createdRevisionIds.push(revision.id)
        createdRevisionNumbers.push(1)
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
              revisionId: createdRevisionIds[d],
              revisionNumber: createdRevisionNumbers[d],
              purpose: files[d]?.fileNotes ? 'FOR_INFORMATION' : 'FOR_INFORMATION',
              notes: files[d].fileNotes || null,
            },
          })
        }

        createdTransmittalIds.push(transmittal.id)
        createdTransmittalNumbers.push(transmittalNumber)
      }
    })

    // ── Step 2.5: Stamp & merge PDFs into a single combined attachment ──

    // Fetch created drawings for enrichment + email table
    const createdDrawings = await prisma.projectDrawing.findMany({
      where: { id: { in: createdDrawingIds } },
      include: { section: { select: { name: true, shortName: true } } },
      orderBy: { drawingNumber: 'asc' },
    })

    // Build a map from drawing ID → drawing record for quick lookup
    const drawingById = new Map(createdDrawings.map(d => [d.id, d]))

    // Build stampable attachments enriched with drawing metadata, sorted by page number
    const stampableAttachments: StampableAttachment[] = attachments.map((att, i) => {
      const drawingId = createdDrawingIds[i]
      const drawing = drawingById.get(drawingId)
      return {
        ...att,
        drawingNumber: drawing?.drawingNumber,
        revisionNumber: createdRevisionNumbers[i],
        title: drawing?.title,
        _pageNo: drawing?.pageNo || '',
      }
    })
    stampableAttachments.sort((a, b) =>
      (a as any)._pageNo.localeCompare((b as any)._pageNo, undefined, { numeric: true })
    )

    // Generate combined filename: "ProjectName - T-001 - 2026-02-23.pdf"
    const dateStr = new Date().toISOString().split('T')[0]
    const firstTransmittalNumber = createdTransmittalNumbers[0] || 'T-001'
    const combinedFilename = `${project.name} - ${firstTransmittalNumber} - ${dateStr}.pdf`

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
        console.log(`[send-files] Uploading combined PDF to Dropbox: "${dropboxAbsPath}"`)
        await dropboxService.uploadFile(dropboxAbsPath, pdfBuffer)
        combinedPdfRelPath = `5- transmittals/${combinedFilename}`
        console.log(`[send-files] ✅ Combined PDF saved to Dropbox`)
      } catch (err: any) {
        console.error(`[send-files] ⚠️ Failed to upload combined PDF to Dropbox:`, err?.message)
      }
    }

    // Build final attachments list for email
    const finalAttachments: Array<{ filename: string; content: string; contentType: string }> = []
    if (pdfAttachment) finalAttachments.push(pdfAttachment)
    finalAttachments.push(...nonPdfAttachments)

    // ── Step 3: Send emails and update transmittals ──
    const org = project.organization
    const companyName = org?.businessName || org?.name || ''
    const companyLogo = (org?.logoUrl && org.logoUrl.startsWith('http')) ? org.logoUrl : 'https://app.meisnerinteriors.com/meisnerinteriorlogo.png'
    const companyEmail = org?.businessEmail || ''
    const companyPhone = org?.businessPhone || ''
    const itemCount = files.length

    // Build a map from drawing ID to original file payload for reliable lookup
    const drawingIdToFile = new Map<string, FilePayload>()
    for (let i = 0; i < createdDrawingIds.length; i++) {
      drawingIdToFile.set(createdDrawingIds[i], files[i])
    }

    // Build drawing rows for email (sorted by page number)
    const sortedDrawings = [...createdDrawings].sort((a, b) =>
      (a.pageNo || '').localeCompare(b.pageNo || '', undefined, { numeric: true })
    )
    const drawingRows = sortedDrawings
      .map((d) => {
        return `
          <tr>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 500;">${d.title}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 500;">${d.section?.name || d.section?.shortName || ''}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: center;">${d.reviewNo || d.currentRevision}</td>
            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; text-align: center;">${d.pageNo || '—'}</td>
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
        : `${project.name} — Drawing Transmittal ${transmittalNumber}`

      // Tracking pixel URL
      const baseUrl = getBaseUrl()
      const trackingPixelUrl = `${baseUrl}/api/email-tracking/transmittal_${transmittalId}/pixel.png`

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

      try {
        const emailResult = await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html,
          attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
        })

        // Update transmittal to SENT
        await prisma.transmittal.update({
          where: { id: transmittalId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            sentBy: session.user!.id,
            emailId: emailResult.messageId || null,
            combinedPdfPath: combinedPdfRelPath,
          },
        })

        emailsSent++
        console.log(`[send-files] ✅ Email sent to ${recipient.email} (${finalAttachments.length} attachments)`)
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
