import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]

function isMediaFile(name: string): boolean {
  const lower = name.toLowerCase()
  return MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext))
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    // Get all projects with dropbox folders
    const projects = await prisma.project.findMany({
      where: { orgId, dropboxFolder: { not: null } },
      select: { id: true, name: true, dropboxFolder: true }
    })

    const results: Array<{
      projectName: string
      dropboxFolder: string
      sourcesPhotos: number
      sourcesFolders: string[]
      hasPhotosFolder: boolean
      photosCount: number
    }> = []

    for (const project of projects) {
      const folder = project.dropboxFolder!
      let sourcesPhotos = 0
      const sourcesFolders: string[] = []
      let hasPhotosFolder = false
      let photosCount = 0

      // Check 7- SOURCES for photos/surveys (recursive scan)
      try {
        const sourcesPath = `${folder}/7- SOURCES`
        const mediaFiles = await countMediaRecursive(sourcesPath)
        sourcesPhotos = mediaFiles.count
        sourcesFolders.push(...mediaFiles.folders)
      } catch {
        // Folder may not exist
      }

      // Check if 5- Photos exists and count files
      try {
        const photosPath = `${folder}/5- Photos`
        const mediaFiles = await countMediaRecursive(photosPath)
        hasPhotosFolder = true
        photosCount = mediaFiles.count
      } catch {
        // Folder may not exist
      }

      if (sourcesPhotos > 0 || hasPhotosFolder) {
        results.push({
          projectName: project.name,
          dropboxFolder: folder,
          sourcesPhotos,
          sourcesFolders,
          hasPhotosFolder,
          photosCount,
        })
      }
    }

    return NextResponse.json({
      totalProjects: projects.length,
      projectsWithMediaInSources: results.filter(r => r.sourcesPhotos > 0).length,
      projectsWith5Photos: results.filter(r => r.hasPhotosFolder).length,
      results,
    })
  } catch (error: any) {
    console.error('[check-survey-photos] Error:', error)
    return NextResponse.json({
      error: error.message || 'Unknown error',
      stack: error.stack?.split('\n').slice(0, 5),
    }, { status: 500 })
  }
}

// Recursively count media files and list subfolders
async function countMediaRecursive(folderPath: string): Promise<{ count: number; folders: string[] }> {
  let count = 0
  const folders: string[] = []
  const foldersToProcess = [folderPath]

  while (foldersToProcess.length > 0) {
    const currentPath = foldersToProcess.pop()!
    let cursor: string | undefined

    try {
      do {
        const result = await dropboxService.listFolder(currentPath, undefined, cursor)

        for (const file of result.files) {
          if (isMediaFile(file.name)) {
            count++
          }
        }

        for (const subfolder of result.folders) {
          folders.push(subfolder.name)
          foldersToProcess.push(subfolder.path)
        }

        cursor = result.hasMore ? result.cursor : undefined
      } while (cursor)
    } catch {
      // Skip inaccessible folders
    }
  }

  return { count, folders }
}
