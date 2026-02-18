import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST - Upload file(s) directly to a Dropbox subfolder within the project
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

    if (!dropboxService.isConfigured()) {
      return NextResponse.json({ error: 'Dropbox is not configured' }, { status: 500 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const targetPath = formData.get('path') as string || ''

    if (!file || !file.name) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Security: reject path traversal
    if (targetPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_')

    // Build the full Dropbox path
    const dropboxPath = targetPath
      ? project.dropboxFolder + '/' + targetPath + '/' + sanitizedName
      : project.dropboxFolder + '/' + sanitizedName

    // Ensure the target folder exists
    const targetFolder = targetPath
      ? project.dropboxFolder + '/' + targetPath
      : project.dropboxFolder
    try {
      await dropboxService.createFolder(targetFolder)
    } catch (e) {
      // Folder likely already exists, ignore
    }

    // Upload to Dropbox
    const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer, { mode: 'add' })

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
