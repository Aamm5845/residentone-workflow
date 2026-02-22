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
  fileNotes?: string | null
}

interface SenderPayload {
  name: string
  email?: string | null
  company?: string | null
  type?: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a drawing number from a filename.
 * Tries to extract a pattern like "A-101" or "E-201" from the name.
 * Falls back to a sequential RF-001 format.
 */
function generateDrawingNumber(filename: string, index: number): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  const match = nameWithoutExt.match(/^([A-Z]{1,4}[\s_.-]?\d{1,4}[A-Z]?)/i)
  if (match) return match[1].replace(/[\s_]/g, '-').toUpperCase()
  return `RF-${String(index + 1).padStart(3, '0')}`
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

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const receivedFiles = await prisma.receivedFile.findMany({
      where: { projectId: id },
      include: {
        section: {
          select: { id: true, name: true, shortName: true, color: true },
        },
        drawing: {
          select: {
            id: true,
            drawingNumber: true,
            title: true,
            currentRevision: true,
            status: true,
            dropboxPath: true,
            dropboxUrl: true,
            fileName: true,
          },
        },
        creator: {
          select: { id: true, name: true },
        },
      },
      orderBy: { receivedDate: 'desc' },
    })

    return NextResponse.json({
      receivedFiles,
      total: receivedFiles.length,
    })
  } catch (error) {
    console.error('[project-files-v2/receive-files] Error fetching received files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch received files' },
      { status: 500 }
    )
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
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { sender, receivedDate, notes, files } = body as {
      sender: SenderPayload
      receivedDate?: string | null
      notes?: string | null
      files: FilePayload[]
    }

    // Validation
    if (!sender?.name?.trim()) {
      return NextResponse.json({ error: 'Sender name is required' }, { status: 400 })
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
    }
    for (const f of files) {
      if (!f.sectionId || !f.title?.trim()) {
        return NextResponse.json({ error: `Section and title are required for "${f.name}"` }, { status: 400 })
      }
    }

    const parsedDate = receivedDate ? new Date(receivedDate) : new Date()

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

    // ── Step 1: Upload files to Dropbox ──
    const fileDropboxPaths: Map<number, string> = new Map()
    const errors: string[] = []
    let filesUploaded = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        if (file.source === 'upload' && file.base64) {
          // Upload to Dropbox: 4- drawings/{SectionName}/{YYYY-MM-DD}/{filename}
          const sectionName = sectionsMap.get(file.sectionId) || 'Unsorted'
          const sanitizedName = file.name.replace(/[<>:"|?*]/g, '_')
          const dateStr = parsedDate.toISOString().split('T')[0]
          const relativePath = `4- drawings/${sectionName}/${dateStr}/${sanitizedName}`

          if (project.dropboxFolder) {
            const absolutePath = `${project.dropboxFolder}/${relativePath}`
            console.log(`[receive-files] Uploading to Dropbox: "${absolutePath}"`)
            const buffer = Buffer.from(file.base64, 'base64')
            await dropboxService.uploadFile(absolutePath, buffer)
            console.log(`[receive-files] ✅ Uploaded: ${sanitizedName}`)
          }

          fileDropboxPaths.set(i, relativePath)
          filesUploaded++
        } else if (file.source === 'dropbox' && file.dropboxPath) {
          // File already in Dropbox — just record the path
          fileDropboxPaths.set(i, file.dropboxPath)
          filesUploaded++
        } else {
          errors.push(`Could not process file: ${file.name}`)
        }
      } catch (err: any) {
        console.error(`[receive-files] Error processing ${file.name}:`, err?.message)
        errors.push(`Failed to process ${file.name}: ${err?.message || 'Unknown error'}`)
      }
    }

    if (filesUploaded === 0) {
      return NextResponse.json(
        { error: 'Failed to process any files', details: errors },
        { status: 500 }
      )
    }

    // ── Step 2: Create drawings + received file records in a transaction ──
    const createdDrawingIds: string[] = []
    const createdReceivedFileIds: string[] = []

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const dropboxPathForDrawing = fileDropboxPaths.get(i) || null
        if (!dropboxPathForDrawing && file.source === 'upload') continue // skip failed uploads

        const baseNumber = generateDrawingNumber(file.name, i)
        const drawingNumber = await ensureUniqueDrawingNumber(id, baseNumber)

        // Create ProjectDrawing
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
            createdBy: session.user!.id,
          },
        })

        // Create DrawingRevision
        await tx.drawingRevision.create({
          data: {
            drawingId: drawing.id,
            revisionNumber: 1,
            description: `Received from ${sender.name.trim()}`,
            dropboxPath: dropboxPathForDrawing,
            fileName: file.name,
            fileSize: file.size,
            issuedBy: session.user!.id,
            issuedDate: parsedDate,
          },
        })

        // Create ReceivedFile record
        const receivedFile = await tx.receivedFile.create({
          data: {
            projectId: id,
            senderName: sender.name.trim(),
            senderEmail: sender.email?.trim() || null,
            senderCompany: sender.company?.trim() || null,
            senderType: sender.type || 'OTHER',
            receivedDate: parsedDate,
            notes: file.fileNotes?.trim() || notes?.trim() || null,
            drawingId: drawing.id,
            fileName: file.name,
            dropboxPath: dropboxPathForDrawing,
            fileSize: file.size,
            sectionId: file.sectionId,
            title: file.title.trim(),
            createdBy: session.user!.id,
          },
        })

        createdDrawingIds.push(drawing.id)
        createdReceivedFileIds.push(receivedFile.id)
      }
    })

    return NextResponse.json({
      success: true,
      drawingsCreated: createdDrawingIds.length,
      receivedFilesCreated: createdReceivedFileIds.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[receive-files] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to log received files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
