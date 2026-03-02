import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]

function isMediaFile(name: string): boolean {
  const lower = name.toLowerCase()
  return MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/**
 * POST /api/admin/migrate-sources-photos
 * Copy media files from 7- SOURCES to 5- Photos for all projects.
 * Preserves subfolder structure. Skips files that already exist.
 *
 * Body: { dryRun: boolean } (default true)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { dryRun = true } = body

    const projects = await prisma.project.findMany({
      where: { orgId, dropboxFolder: { not: null } },
      select: { id: true, name: true, dropboxFolder: true }
    })

    const results: Array<{
      project: string
      copied: number
      skipped: number
      failed: number
      files: string[]
    }> = []

    for (const project of projects) {
      const folder = project.dropboxFolder!
      const sourcesPath = `${folder}/7- SOURCES`
      const photosPath = `${folder}/5- Photos`

      // First, get all existing files in 5- Photos to avoid doubles
      const existingFiles = new Set<string>()
      try {
        const existing = await listAllMediaRecursive(photosPath)
        for (const f of existing) {
          // Store lowercase filename for comparison
          existingFiles.add(f.name.toLowerCase())
        }
      } catch {
        // 5- Photos folder may not exist yet
      }

      // Get all media from 7- SOURCES
      let sourceMedia: Array<{ name: string; path: string; relativePath: string }> = []
      try {
        sourceMedia = await listAllMediaRecursive(sourcesPath)
      } catch {
        continue // No 7- SOURCES folder
      }

      if (sourceMedia.length === 0) continue

      let copied = 0
      let skipped = 0
      let failed = 0
      const fileLog: string[] = []

      for (const file of sourceMedia) {
        // Check if file already exists in 5- Photos (by filename)
        if (existingFiles.has(file.name.toLowerCase())) {
          skipped++
          fileLog.push(`SKIP: ${file.name} (already exists)`)
          continue
        }

        // Build destination path preserving relative structure from 7- SOURCES
        // e.g. 7- SOURCES/2025.10.29/PHOTOS/img.jpg -> 5- Photos/Sources Migration/2025.10.29/PHOTOS/img.jpg
        const destPath = `${photosPath}/Sources Migration/${file.relativePath}`

        if (dryRun) {
          copied++
          fileLog.push(`COPY: ${file.path} -> ${destPath}`)
          existingFiles.add(file.name.toLowerCase())
          continue
        }

        try {
          // Ensure destination folder exists
          const destFolder = destPath.substring(0, destPath.lastIndexOf('/'))
          try {
            await dropboxService.createFolder(destFolder)
          } catch {
            // Folder may already exist
          }

          await dropboxService.copyFile(file.path, destPath)
          copied++
          existingFiles.add(file.name.toLowerCase())
          fileLog.push(`COPIED: ${file.name}`)
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

      if (copied > 0 || skipped > 0 || failed > 0) {
        results.push({
          project: project.name,
          copied,
          skipped,
          failed,
          files: fileLog,
        })
      }
    }

    const totals = {
      copied: results.reduce((s, r) => s + r.copied, 0),
      skipped: results.reduce((s, r) => s + r.skipped, 0),
      failed: results.reduce((s, r) => s + r.failed, 0),
    }

    return NextResponse.json({
      dryRun,
      message: dryRun
        ? `Dry run: would copy ${totals.copied} files, skip ${totals.skipped} duplicates`
        : `Done: copied ${totals.copied}, skipped ${totals.skipped}, failed ${totals.failed}`,
      totals,
      results,
    })
  } catch (error: any) {
    console.error('[migrate-sources-photos] Error:', error)
    return NextResponse.json({
      error: error.message || 'Unknown error',
    }, { status: 500 })
  }
}

// List all media files recursively, returning name + full path + relative path
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
            // Compute relative path from basePath
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
