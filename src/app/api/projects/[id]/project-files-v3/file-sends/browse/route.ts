import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// GET - Browse Dropbox files within project folder
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
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true, dropboxFolder: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.dropboxFolder) {
      return NextResponse.json({ error: 'No Dropbox folder configured' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const relativePath = searchParams.get('path') || ''

    // Prevent path traversal
    if (relativePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const absolutePath = relativePath
      ? `${project.dropboxFolder}/${relativePath}`
      : project.dropboxFolder

    const result = await dropboxService.listFolder(absolutePath)

    // The DropboxFolder interface has { files, folders, hasMore, cursor }
    // Map them into a unified entries list with relative paths
    const projectFolder = project.dropboxFolder!

    const entries: Array<{ name: string; path: string; type: string; size: number | null; modified: string | null }> = []

    for (const folder of (result.folders || [])) {
      const fullPath = folder.path || ''
      const relPath = fullPath.startsWith(projectFolder)
        ? fullPath.slice(projectFolder.length + 1)
        : fullPath
      entries.push({
        name: folder.name,
        path: relPath,
        type: 'folder',
        size: null,
        modified: null,
      })
    }

    for (const file of (result.files || [])) {
      const fullPath = file.path || ''
      const relPath = fullPath.startsWith(projectFolder)
        ? fullPath.slice(projectFolder.length + 1)
        : fullPath
      entries.push({
        name: file.name,
        path: relPath,
        type: 'file',
        size: file.size || null,
        modified: file.lastModified?.toISOString() || null,
      })
    }

    // Sort: folders first, then files alphabetically
    entries.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1
      if (a.type !== 'folder' && b.type === 'folder') return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      entries,
      currentPath: relativePath,
      hasMore: result.hasMore || false,
      cursor: result.cursor || null,
    })
  } catch (error) {
    console.error('[project-files-v3/file-sends/browse] Error:', error)
    return NextResponse.json({ error: 'Failed to browse files' }, { status: 500 })
  }
}
