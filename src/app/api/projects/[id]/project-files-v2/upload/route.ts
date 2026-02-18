import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService as dropboxServiceV1 } from '@/lib/dropbox-service'
import { dropboxService as dropboxServiceV2 } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST - Upload file(s) directly to a Dropbox subfolder within the project
// Supports both small files (< 4MB via formData) and chunked uploads via JSON
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

    // Verify project access and get dropboxFolder
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true, dropboxFolder: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.dropboxFolder) {
      return NextResponse.json({ error: 'No Dropbox folder linked to this project' }, { status: 400 })
    }

    const contentType = request.headers.get('content-type') || ''

    // --- CHUNKED UPLOAD (JSON body) ---
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const { action, sessionId, offset, chunk, path, filename } = body

      if (action === 'start') {
        // Start a new upload session with the first chunk
        const chunkBuffer = Buffer.from(chunk, 'base64')
        const sid = await dropboxServiceV2.uploadSessionStart(chunkBuffer)
        return NextResponse.json({ success: true, sessionId: sid, offset: chunkBuffer.length })
      }

      if (action === 'append') {
        // Append chunk to existing session
        const chunkBuffer = Buffer.from(chunk, 'base64')
        await dropboxServiceV2.uploadSessionAppend(sessionId, offset, chunkBuffer)
        return NextResponse.json({ success: true, offset: offset + chunkBuffer.length })
      }

      if (action === 'finish') {
        // Finish the upload session and commit the file
        const targetPath = path || ''
        if (targetPath.includes('..')) {
          return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
        }

        const sanitizedName = (filename || 'upload').replace(/[^a-zA-Z0-9._\-() ]/g, '_')
        const dropboxPath = targetPath
          ? project.dropboxFolder + '/' + targetPath + '/' + sanitizedName
          : project.dropboxFolder + '/' + sanitizedName

        // Ensure folder exists
        const targetFolder = targetPath
          ? project.dropboxFolder + '/' + targetPath
          : project.dropboxFolder
        try { await dropboxServiceV2.createFolder(targetFolder) } catch (e) { /* exists */ }

        const result = await dropboxServiceV2.uploadSessionFinish(sessionId, offset, dropboxPath)
        return NextResponse.json({
          success: true,
          file: { name: sanitizedName, path: result.path_display || dropboxPath, size: offset }
        })
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // --- STANDARD UPLOAD (multipart formData, for small files < 4MB) ---
    if (!dropboxServiceV1.isConfigured()) {
      return NextResponse.json({ error: 'Dropbox is not configured' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const targetPath = formData.get('path') as string || ''

    if (!file || !file.name) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (targetPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_')

    const dropboxPath = targetPath
      ? project.dropboxFolder + '/' + targetPath + '/' + sanitizedName
      : project.dropboxFolder + '/' + sanitizedName

    const targetFolder = targetPath
      ? project.dropboxFolder + '/' + targetPath
      : project.dropboxFolder
    try { await dropboxServiceV1.createFolder(targetFolder) } catch (e) { /* exists */ }

    const uploadResult = await dropboxServiceV1.uploadFile(dropboxPath, buffer, { mode: 'add' })

    return NextResponse.json({
      success: true,
      file: {
        name: sanitizedName,
        path: uploadResult.path_display || dropboxPath,
        size: file.size,
      }
    })
  } catch (error: any) {
    console.error('[project-files-v2/upload] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    )
  }
}
