import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

const FOLDERS_TO_ADD = ['4- Drawings', '5- Photos', '6- Documents']

/**
 * POST /api/admin/add-project-folders
 * Add missing folders (4- Drawings, 5- Photos, 6- Documents) to every existing project's Dropbox folder.
 *
 * Body:
 * - dryRun: boolean (optional, default true) - if true, only report what would be created
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
      where: {
        orgId,
        dropboxFolder: { not: null },
      },
      select: {
        id: true,
        name: true,
        dropboxFolder: true,
      },
    })

    if (projects.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No projects with Dropbox folders found',
        summary: { total: 0, created: 0, existed: 0, failed: 0 },
        results: [],
      })
    }

    const results: Array<{
      projectId: string
      projectName: string
      dropboxFolder: string
      folders: Array<{
        folder: string
        status: 'created' | 'existed' | 'failed'
        reason?: string
      }>
    }> = []

    for (const project of projects) {
      const dropboxFolder = project.dropboxFolder!
      const folderResults: typeof results[0]['folders'] = []

      for (const folderName of FOLDERS_TO_ADD) {
        const folderPath = `${dropboxFolder}/${folderName}`

        if (dryRun) {
          folderResults.push({
            folder: folderName,
            status: 'created',
            reason: `Would create: ${folderPath}`,
          })
          continue
        }

        try {
          await dropboxService.createFolder(folderPath)
          console.log(`✅ Created: ${folderPath}`)
          folderResults.push({ folder: folderName, status: 'created' })
        } catch (error: any) {
          const msg = String(error?.message || error || '')
          if (msg.includes('conflict') || msg.includes('already exists')) {
            folderResults.push({
              folder: folderName,
              status: 'existed',
              reason: 'Folder already exists',
            })
          } else {
            console.error(`❌ Failed: ${folderPath}:`, msg)
            folderResults.push({
              folder: folderName,
              status: 'failed',
              reason: msg,
            })
          }
        }
      }

      results.push({
        projectId: project.id,
        projectName: project.name,
        dropboxFolder,
        folders: folderResults,
      })
    }

    const allFolders = results.flatMap((r) => r.folders)
    const summary = {
      totalProjects: results.length,
      created: allFolders.filter((f) => f.status === 'created').length,
      existed: allFolders.filter((f) => f.status === 'existed').length,
      failed: allFolders.filter((f) => f.status === 'failed').length,
    }

    return NextResponse.json({
      success: true,
      dryRun,
      foldersToAdd: FOLDERS_TO_ADD,
      message: dryRun
        ? `Dry run complete. Would create up to ${summary.created} folders across ${summary.totalProjects} projects.`
        : `Migration complete. ${summary.created} folders created, ${summary.existed} already existed, ${summary.failed} failed.`,
      summary,
      results,
    })
  } catch (error: any) {
    console.error('[add-project-folders] Error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}
