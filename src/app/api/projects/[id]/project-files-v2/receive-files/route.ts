import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FilePayload {
  name: string
  size: number
  source: 'upload' | 'dropbox'
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

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true },
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

    // ── Create received file records in a transaction ──
    // Files are already uploaded to Dropbox by the client before calling this API.
    const createdReceivedFileIds: string[] = []

    await prisma.$transaction(async (tx) => {
      for (const file of files) {
        const receivedFile = await tx.receivedFile.create({
          data: {
            projectId: id,
            senderName: sender.name.trim(),
            senderEmail: sender.email?.trim() || null,
            senderCompany: sender.company?.trim() || null,
            senderType: sender.type || 'OTHER',
            receivedDate: parsedDate,
            notes: file.fileNotes?.trim() || notes?.trim() || null,
            drawingId: null,
            fileName: file.name,
            dropboxPath: file.dropboxPath || null,
            fileSize: file.size,
            sectionId: file.sectionId,
            title: file.title.trim(),
            createdBy: session.user!.id,
          },
        })

        createdReceivedFileIds.push(receivedFile.id)
      }
    })

    return NextResponse.json({
      success: true,
      receivedFilesCreated: createdReceivedFileIds.length,
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
