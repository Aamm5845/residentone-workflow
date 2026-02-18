import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { del } from '@vercel/blob'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST - Transfer a file from Vercel Blob to Dropbox, then delete the blob
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
    const { blobUrl, fileName, targetPath } = body

    if (!blobUrl || !fileName) {
      return NextResponse.json({ error: 'blobUrl and fileName are required' }, { status: 400 })
    }

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

    // Security: reject path traversal
    if (targetPath && targetPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Sanitize filename
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._\-() ]/g, '_')

    // Download file from Vercel Blob
    const blobResponse = await fetch(blobUrl)
    if (!blobResponse.ok) {
      return NextResponse.json({ error: 'Failed to download from blob storage' }, { status: 500 })
    }
    const arrayBuffer = await blobResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

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

    // Delete the blob now that it's in Dropbox
    try {
      await del(blobUrl)
    } catch (e) {
      // Not critical if blob cleanup fails
      console.warn('[upload-from-blob] Failed to delete blob:', e)
    }

    return NextResponse.json({
      success: true,
      file: {
        name: sanitizedName,
        path: uploadResult.path_display || dropboxPath,
        size: buffer.length,
      }
    })
  } catch (error: any) {
    console.error('[project-files-v2/upload-from-blob] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to transfer file to Dropbox' },
      { status: 500 }
    )
  }
}
