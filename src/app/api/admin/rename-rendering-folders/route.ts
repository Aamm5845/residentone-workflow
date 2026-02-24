import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large migrations

const OLD_FOLDER_NAME = '3- RENDERING'
const NEW_FOLDER_NAME = '3- Renderings'

/**
 * POST /api/admin/rename-rendering-folders
 * Rename "3- RENDERING" to "3- Renderings" in all existing project Dropbox folders.
 *
 * Body:
 * - dryRun: boolean (optional, default true) - if true, only report what would be renamed
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

    // Get all projects with a dropboxFolder set
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
        summary: { total: 0, renamed: 0, skipped: 0, failed: 0 },
        results: [],
      })
    }

    const results: Array<{
      projectId: string
      projectName: string
      dropboxFolder: string
      status: 'renamed' | 'skipped' | 'failed'
      reason?: string
    }> = []

    for (const project of projects) {
      const dropboxFolder = project.dropboxFolder!
      const oldPath = `${dropboxFolder}/${OLD_FOLDER_NAME}`
      const newPath = `${dropboxFolder}/${NEW_FOLDER_NAME}`

      try {
        if (dryRun) {
          // In dry-run mode, just report that we would attempt the rename
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'renamed',
            reason: `Would rename: ${oldPath} -> ${newPath}`,
          })
          continue
        }

        // Attempt the rename via Dropbox moveFile
        await dropboxService.moveFile(oldPath, newPath)
        console.log(`✅ Renamed: ${oldPath} -> ${newPath}`)
        results.push({
          projectId: project.id,
          projectName: project.name,
          dropboxFolder,
          status: 'renamed',
        })
      } catch (error: any) {
        const errorMsg = error?.message || String(error)

        // If the old folder doesn't exist, it may already be renamed or never created
        if (
          errorMsg.includes('not_found') ||
          errorMsg.includes('path/not_found') ||
          errorMsg.includes('path_lookup')
        ) {
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'skipped',
            reason: 'Old folder not found (may already be renamed or not exist)',
          })
        } else if (errorMsg.includes('conflict')) {
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'skipped',
            reason: 'New folder already exists',
          })
        } else {
          console.error(`❌ Failed to rename for project ${project.name}:`, errorMsg)
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'failed',
            reason: errorMsg,
          })
        }
      }
    }

    const summary = {
      total: results.length,
      renamed: results.filter((r) => r.status === 'renamed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run complete. ${summary.renamed} folders would be renamed.`
        : `Migration complete. ${summary.renamed} folders renamed, ${summary.skipped} skipped, ${summary.failed} failed.`,
      summary,
      results,
    })
  } catch (error: any) {
    console.error('[rename-rendering-folders] Error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}
