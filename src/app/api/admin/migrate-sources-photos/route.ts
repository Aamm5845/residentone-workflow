import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]

function isMediaFile(name: string): boolean {
  const lower = name.toLowerCase()
  return MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/**
 * GET /api/admin/migrate-sources-photos
 * List projects that need migration (have media in 7- Reference)
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const projects = await prisma.project.findMany({
      where: { orgId, dropboxFolder: { not: null } },
      select: { id: true, name: true, dropboxFolder: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      projects: projects.map((p, i) => ({
        index: i,
        id: p.id,
        name: p.name,
        folder: p.dropboxFolder,
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/migrate-sources-photos
 * Migrate ONE project at a time.
 *
 * Body: { projectId: string, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { projectId, dryRun = true } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId, dropboxFolder: { not: null } },
      select: { id: true, name: true, dropboxFolder: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const folder = project.dropboxFolder!
    const sourcesPath = `${folder}/7- Reference`
    const photosPath = `${folder}/5- Photos`

    // Get existing files in 5- Photos to avoid doubles
    const existingFiles = new Set<string>()
    try {
      const existing = await listAllMediaRecursive(photosPath)
      for (const f of existing) {
        existingFiles.add(f.name.toLowerCase())
      }
    } catch {
      // 5- Photos may not exist yet
    }

    // Get media from 7- Reference
    let sourceMedia: Array<{ name: string; path: string; relativePath: string }> = []
    try {
      sourceMedia = await listAllMediaRecursive(sourcesPath)
    } catch {
      return NextResponse.json({
        project: project.name,
        message: 'No 7- Reference folder found',
        copied: 0, skipped: 0, failed: 0
      })
    }

    if (sourceMedia.length === 0) {
      return NextResponse.json({
        project: project.name,
        message: 'No media files in 7- Reference',
        copied: 0, skipped: 0, failed: 0
      })
    }

    let copied = 0
    let skipped = 0
    let failed = 0
    const fileLog: string[] = []

    for (const file of sourceMedia) {
      if (existingFiles.has(file.name.toLowerCase())) {
        skipped++
        fileLog.push(`SKIP: ${file.name}`)
        continue
      }

      const destPath = `${photosPath}/Sources Migration/${file.relativePath}`

      if (dryRun) {
        copied++
        fileLog.push(`WOULD COPY: ${file.name}`)
        existingFiles.add(file.name.toLowerCase())
        continue
      }

      try {
        const destFolder = destPath.substring(0, destPath.lastIndexOf('/'))
        try { await dropboxService.createFolder(destFolder) } catch {}

        await dropboxService.copyFile(file.path, destPath)
        copied++
        existingFiles.add(file.name.toLowerCase())
        fileLog.push(`OK: ${file.name}`)
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes('conflict') || msg.includes('already exists')) {
          skipped++
          fileLog.push(`SKIP: ${file.name} (conflict)`)
        } else {
          failed++
          fileLog.push(`FAIL: ${file.name} - ${msg}`)
        }
      }
    }

    return NextResponse.json({
      project: project.name,
      dryRun,
      copied,
      skipped,
      failed,
      total: sourceMedia.length,
      files: fileLog,
    })
  } catch (error: any) {
    console.error('[migrate-sources-photos] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function listAllMediaRecursive(
  basePath: string
): Promise<Array<{ name: string; path: string; relativePath: string }>> {
  const files: Array<{ name: string; path: string; relativePath: string }> = []
  const foldersToProcess = [basePath]

  while (foldersToProcess.length > 0) {
    const currentPath = foldersToProcess.pop()!
    let cursor: string | undefined

    try {
      do {
        const result = await dropboxService.listFolder(currentPath, undefined, cursor)

        for (const file of result.files) {
          if (isMediaFile(file.name)) {
            const rel = file.path.substring(basePath.length + 1)
            files.push({ name: file.name, path: file.path, relativePath: rel })
          }
        }

        for (const subfolder of result.folders) {
          foldersToProcess.push(subfolder.path)
        }

        cursor = result.hasMore ? result.cursor : undefined
      } while (cursor)
    } catch {
      // Skip inaccessible folders
    }
  }

  return files
}
