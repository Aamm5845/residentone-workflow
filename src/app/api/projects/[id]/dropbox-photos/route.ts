import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

interface LinkedFolder {
  path: string
  name: string
  addedAt: string
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

// GET: Fetch all images from linked Dropbox folders
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findFirst({
      where: {
        id,
        organization: { users: { some: { id: session.user.id } } }
      },
      select: {
        id: true,
        linkedDropboxFolders: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const linkedFolders = (project.linkedDropboxFolders as LinkedFolder[] | null) || []

    if (linkedFolders.length === 0) {
      return NextResponse.json({ photos: [], linkedFolders: [] })
    }

    const allPhotos: any[] = []
    const seenPaths = new Set<string>()

    for (const folder of linkedFolders) {
      try {
        // List files in folder (and subfolders recursively)
        const images = await listImagesRecursive(folder.path)

        for (const image of images) {
          // Deduplicate by path
          if (seenPaths.has(image.path)) continue
          seenPaths.add(image.path)

          // Get temporary link for display
          const tempLink = await dropboxService.getTemporaryLink(image.path)
          if (!tempLink) continue

          // Determine parent folder name for caption
          const pathParts = image.path.split('/')
          const parentFolder = pathParts.length > 2 ? pathParts[pathParts.length - 2] : folder.name

          allPhotos.push({
            id: `dbx-${Buffer.from(image.path).toString('base64url')}`,
            path: image.path,
            filename: image.name,
            url: tempLink,
            folderName: parentFolder,
            linkedFolderPath: folder.path,
            linkedFolderName: folder.name,
            lastModified: image.lastModified.toISOString(),
            size: image.size,
            source: 'dropbox'
          })
        }
      } catch (err) {
        console.error(`[dropbox-photos] Error listing folder ${folder.path}:`, err)
      }
    }

    return NextResponse.json({ photos: allPhotos, linkedFolders })
  } catch (error: any) {
    console.error('[dropbox-photos] GET error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}

// POST: Link a new Dropbox folder
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
    const { path, name } = body

    if (!path) {
      return NextResponse.json({ error: 'Folder path is required' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        organization: { users: { some: { id: session.user.id } } }
      },
      select: {
        id: true,
        linkedDropboxFolders: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const linkedFolders = (project.linkedDropboxFolders as LinkedFolder[] | null) || []

    // Check for duplicate
    if (linkedFolders.some(f => f.path === path)) {
      return NextResponse.json({ error: 'Folder already linked' }, { status: 409 })
    }

    const folderName = name || path.split('/').filter(Boolean).pop() || 'Root'
    const newFolder: LinkedFolder = {
      path,
      name: folderName,
      addedAt: new Date().toISOString()
    }

    const updatedFolders = [...linkedFolders, newFolder]

    await prisma.project.update({
      where: { id },
      data: { linkedDropboxFolders: updatedFolders as any }
    })

    return NextResponse.json({ linkedFolders: updatedFolders, added: newFolder })
  } catch (error: any) {
    console.error('[dropbox-photos] POST error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}

// DELETE: Unlink a Dropbox folder OR delete a single Dropbox photo
// Use ?type=photo&filePath=... to delete a photo, or ?path=... to unlink a folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id,
        organization: { users: { some: { id: session.user.id } } }
      },
      select: {
        id: true,
        linkedDropboxFolders: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete a single photo from Dropbox
    if (type === 'photo') {
      const filePath = searchParams.get('filePath')
      if (!filePath) {
        return NextResponse.json({ error: 'filePath is required' }, { status: 400 })
      }

      await dropboxService.deleteFile(filePath)
      return NextResponse.json({ success: true, deleted: filePath })
    }

    // Unlink a folder
    const folderPath = searchParams.get('path')
    if (!folderPath) {
      return NextResponse.json({ error: 'Folder path is required' }, { status: 400 })
    }

    const linkedFolders = (project.linkedDropboxFolders as LinkedFolder[] | null) || []
    const updatedFolders = linkedFolders.filter(f => f.path !== folderPath)

    await prisma.project.update({
      where: { id },
      data: { linkedDropboxFolders: updatedFolders as any }
    })

    return NextResponse.json({ linkedFolders: updatedFolders })
  } catch (error: any) {
    console.error('[dropbox-photos] DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}

// Recursively list all image files in a folder
async function listImagesRecursive(folderPath: string): Promise<any[]> {
  const images: any[] = []
  const foldersToProcess = [folderPath]

  while (foldersToProcess.length > 0) {
    const currentPath = foldersToProcess.pop()!
    let cursor: string | undefined

    do {
      const result = await dropboxService.listFolder(currentPath, undefined, cursor)

      // Collect image files
      for (const file of result.files) {
        if (isImageFile(file.name)) {
          images.push(file)
        }
      }

      // Queue subfolders
      for (const subfolder of result.folders) {
        foldersToProcess.push(subfolder.path)
      }

      cursor = result.hasMore ? result.cursor : undefined
    } while (cursor)
  }

  return images
}
