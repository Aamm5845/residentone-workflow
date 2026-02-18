import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

interface ImageEntry {
  id: string
  name: string
  path: string
  relativePath: string
  url: string
  size: number
  lastModified: string
  folder: string
  tags: string[]
}

// GET - List all photos from {dropboxFolder}/5- Photos/ recursively
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

    // Verify project access and get dropboxFolder
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true, dropboxFolder: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.dropboxFolder) {
      return NextResponse.json({ error: 'No Dropbox folder linked' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const subfolder = searchParams.get('subfolder') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Security: reject path traversal
    if (subfolder.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Build the photos folder path
    const photosBase = project.dropboxFolder + '/5- Photos'
    const targetPath = subfolder ? photosBase + '/' + subfolder : photosBase

    // Recursively list all image files
    const allImages = await listImagesRecursive(targetPath)

    // Sort by lastModified descending (newest first)
    allImages.sort((a, b) => {
      const dateA = a.lastModified instanceof Date ? a.lastModified.getTime() : new Date(a.lastModified).getTime()
      const dateB = b.lastModified instanceof Date ? b.lastModified.getTime() : new Date(b.lastModified).getTime()
      return dateB - dateA
    })

    // Collect unique subfolder names
    const folderSet = new Set<string>()
    for (const img of allImages) {
      const pathParts = img.path.split('/')
      // Find the parent folder name relative to the photos base
      const photosBaseLower = photosBase.toLowerCase()
      const imgPathLower = img.path.toLowerCase()
      if (imgPathLower.startsWith(photosBaseLower)) {
        const relative = img.path.substring(photosBase.length + 1)
        const parts = relative.split('/')
        if (parts.length > 1) {
          folderSet.add(parts[0])
        }
      }
    }

    const total = allImages.length

    // Paginate
    const paginatedImages = allImages.slice(offset, offset + limit)

    // Get temporary links for the paginated images (batch, max 10 concurrent)
    const photos: ImageEntry[] = []
    const batchSize = 10

    for (let i = 0; i < paginatedImages.length; i += batchSize) {
      const batch = paginatedImages.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (img) => {
          const link = await dropboxService.getTemporaryLink(img.path)
          if (!link) return null

          // Determine the folder name this image is in
          const photosBaseLower = photosBase.toLowerCase()
          const imgLower = img.path.toLowerCase()
          let folder = ''
          if (imgLower.startsWith(photosBaseLower)) {
            const relative = img.path.substring(photosBase.length + 1)
            const parts = relative.split('/')
            folder = parts.length > 1 ? parts[0] : ''
          }

          return {
            id: 'dbx-' + Buffer.from(img.path).toString('base64url'),
            name: img.name,
            path: img.path,
            relativePath: img.path.substring(photosBase.length + 1),
            url: link,
            size: img.size,
            lastModified: img.lastModified instanceof Date
              ? img.lastModified.toISOString()
              : String(img.lastModified),
            folder,
            tags: [],
          } as ImageEntry
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          photos.push(r.value)
        }
      }
    }

    // Merge tags from database
    const relativePaths = photos.map(p => p.relativePath)
    const metas = await prisma.projectPhotoMeta.findMany({
      where: {
        projectId: id,
        dropboxPath: { in: relativePaths }
      },
      select: { dropboxPath: true, tags: true }
    })
    const metaMap = new Map(metas.map(m => [m.dropboxPath, m.tags]))

    for (const photo of photos) {
      photo.tags = metaMap.get(photo.relativePath) || []
    }

    // Get all tags used in this project for filter chips
    const allProjectMetas = await prisma.projectPhotoMeta.findMany({
      where: { projectId: id },
      select: { tags: true }
    })
    const allTags = [...new Set(allProjectMetas.flatMap(m => m.tags))].sort()

    return NextResponse.json({
      success: true,
      photos,
      folders: Array.from(folderSet).sort(),
      total,
      allTags,
    })
  } catch (error: any) {
    console.error('[project-files-v2/photos] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list photos' },
      { status: 500 }
    )
  }
}

// Recursively list all image files in a folder (BFS)
async function listImagesRecursive(folderPath: string): Promise<any[]> {
  const images: any[] = []
  const foldersToProcess = [folderPath]

  while (foldersToProcess.length > 0) {
    const currentPath = foldersToProcess.pop()!
    let cursor: string | undefined

    try {
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
    } catch (err) {
      console.error('[photos] Error listing folder', currentPath, err)
      // Continue with other folders
    }
  }

  return images
}
