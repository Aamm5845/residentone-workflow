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

// GET - Browse Dropbox files scoped to the project's dropboxFolder
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
      return NextResponse.json({ error: 'No Dropbox folder linked to this project' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const relativePath = searchParams.get('path') || ''
    const cursor = searchParams.get('cursor') || undefined
    const thumbnails = searchParams.get('thumbnails') === 'true'

    // Security: reject path traversal
    if (relativePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Build absolute Dropbox path
    const absolutePath = relativePath
      ? project.dropboxFolder + '/' + relativePath
      : project.dropboxFolder

    // Fetch folder contents from Dropbox
    const result = await dropboxService.listFolder(absolutePath, undefined, cursor)

    // At root level, filter out Shopping (8-) and Software Uploads (9-)
    let filteredFolders = result.folders
    if (!relativePath) {
      filteredFolders = result.folders.filter(f => {
        const lower = f.name.toLowerCase()
        return !lower.startsWith('8-') && !lower.startsWith('9-')
      })
    }

    // Strip the project dropboxFolder prefix from all paths to return relative paths
    const prefix = project.dropboxFolder.toLowerCase()
    const stripPrefix = (path: string): string => {
      const lower = path.toLowerCase()
      if (lower.startsWith(prefix)) {
        const stripped = path.substring(prefix.length)
        return stripped.startsWith('/') ? stripped.substring(1) : stripped
      }
      return path
    }

    const folders = filteredFolders.map(f => ({
      ...f,
      path: stripPrefix(f.path),
      lastModified: f.lastModified instanceof Date ? f.lastModified.toISOString() : f.lastModified,
    }))

    let files = result.files.map(f => ({
      ...f,
      path: stripPrefix(f.path),
      lastModified: f.lastModified instanceof Date ? f.lastModified.toISOString() : f.lastModified,
      thumbnailUrl: undefined as string | undefined,
    }))

    // If thumbnails requested, get temporary links for image files
    if (thumbnails) {
      const imageFiles = files.filter(f => isImageFile(f.name))
      if (imageFiles.length > 0) {
        // Batch get temp links (max 10 concurrent)
        const batchSize = 10
        for (let i = 0; i < imageFiles.length; i += batchSize) {
          const batch = imageFiles.slice(i, i + batchSize)
          const results = await Promise.allSettled(
            batch.map(async f => {
              // Reconstruct absolute path for API call
              const absPath = relativePath
                ? project.dropboxFolder + '/' + f.path
                : project.dropboxFolder + '/' + f.path
              const link = await dropboxService.getTemporaryLink(absPath)
              return { path: f.path, link }
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled' && r.value.link) {
              const file = files.find(f => f.path === r.value.path)
              if (file) {
                file.thumbnailUrl = r.value.link
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      files,
      folders,
      hasMore: result.hasMore,
      cursor: result.cursor,
      currentPath: relativePath,
    })
  } catch (error: any) {
    console.error('[project-files-v2/browse] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to browse Dropbox folder' },
      { status: 500 }
    )
  }
}
