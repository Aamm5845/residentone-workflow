import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
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

function titleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
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
      where: { id },
      select: {
        id: true,
        name: true,
        dropboxFolder: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { recipients, subject, notes, files, sentAt } = body as {
      recipients: RecipientPayload[]
      subject?: string | null
      notes?: string | null
      files: FilePayload[]
      sentAt?: string | null
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

    // ── Step 1: Upload files to Dropbox (for uploaded files), record paths for dropbox files ──
    const fileDropboxPaths: Map<number, string> = new Map()
    const errors: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        if (file.source === 'upload' && file.base64) {
          // Upload to Dropbox: 4- Drawings/{SectionName}/{YYYY-MM-DD}/{filename}
          const sectionName = titleCase(sectionsMap.get(file.sectionId) || 'Unsorted')
          const sanitizedName = file.name.replace(/[<>:"|?*]/g, '_')
          const dateStr = sentAt || new Date().toISOString().split('T')[0]
          const relativePath = `4- Drawings/${sectionName}/${dateStr}/${sanitizedName}`

          if (project.dropboxFolder) {
            const absolutePath = `${project.dropboxFolder}/${relativePath}`
            console.log(`[log-transmittal] Uploading to Dropbox: "${absolutePath}"`)
            const buffer = Buffer.from(file.base64, 'base64')
            await dropboxService.uploadFile(absolutePath, buffer)
            console.log(`[log-transmittal] Uploaded: ${sanitizedName}`)
          }

          fileDropboxPaths.set(i, relativePath)
        } else if (file.source === 'dropbox' && file.dropboxPath) {
          // Just record the path — no download needed since no email
          fileDropboxPaths.set(i, file.dropboxPath)
        } else {
          errors.push(`Could not process file: ${file.name}`)
        }
      } catch (err: any) {
        console.error(`[log-transmittal] Error processing ${file.name}:`, err?.message)
        errors.push(`Failed to process ${file.name}: ${err?.message || 'Unknown error'}`)
      }
    }

    // ── Step 2: Create transmittals in a transaction ──
    const createdTransmittalIds: string[] = []
    const sentAtDate = sentAt ? new Date(sentAt + 'T00:00:00Z') : new Date()

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
            recipientEmail: recipient.email || null,
            recipientCompany: recipient.company || null,
            recipientType: recipient.type || 'OTHER',
            method: 'HAND_DELIVERY',
            status: 'SENT',
            sentAt: sentAtDate,
            sentBy: session.user!.id,
            notes: notes || null,
            createdBy: session.user!.id,
          },
        })

        // Create TransmittalItem for each file
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          await tx.transmittalItem.create({
            data: {
              transmittalId: transmittal.id,
              fileName: file.name,
              fileSize: file.size,
              dropboxPath: fileDropboxPaths.get(i) || null,
              title: file.title?.trim() || null,
              sectionId: file.sectionId || null,
              reviewNo: file.reviewNo?.trim() || null,
              pageNo: file.pageNo?.trim() || null,
              purpose: 'FOR_INFORMATION',
            },
          })
        }

        createdTransmittalIds.push(transmittal.id)
      }
    })

    console.log(`[log-transmittal] Created ${createdTransmittalIds.length} transmittal(s) for ${files.length} file(s)`)

    return NextResponse.json({
      success: true,
      transmittalsCreated: createdTransmittalIds.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[log-transmittal] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to log transmittal',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
