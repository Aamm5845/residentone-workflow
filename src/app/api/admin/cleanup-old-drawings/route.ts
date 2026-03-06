import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * POST /api/admin/cleanup-old-drawings
 * Check each project's Dropbox for a specified folder.
 * If empty, delete it. If it has files, report it.
 *
 * Body:
 * - folderName: string (optional, default "8- DRAWINGS") - the folder to check/delete
 * - dryRun: boolean (optional, default true) - if true, only report what would happen
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { dryRun = true, folderName = '8- DRAWINGS' } = body

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
        summary: { total: 0, deleted: 0, hasFiles: 0, notFound: 0, errors: 0 },
        results: [],
      })
    }

    const results: Array<{
      projectId: string
      projectName: string
      status: 'deleted' | 'has_files' | 'not_found' | 'error'
      fileCount?: number
      folderCount?: number
      reason?: string
    }> = []

    for (const project of projects) {
      const dropboxFolder = project.dropboxFolder!
      const oldDrawingsPath = `${dropboxFolder}/${folderName}`

      try {
        const listing = await dropboxService.listFolder(oldDrawingsPath)
        const totalFiles = listing.files.length
        const totalFolders = listing.folders.length

        if (totalFiles === 0 && totalFolders === 0) {
          // Empty folder — delete it
          if (dryRun) {
            results.push({
              projectId: project.id,
              projectName: project.name,
              status: 'deleted',
              reason: `Would delete empty folder: ${oldDrawingsPath}`,
            })
          } else {
            await dropboxService.deleteFile(oldDrawingsPath)
            console.log(`✅ Deleted empty ${folderName}: ${oldDrawingsPath}`)
            results.push({
              projectId: project.id,
              projectName: project.name,
              status: 'deleted',
            })
          }
        } else {
          // Has contents — skip
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'has_files',
            fileCount: totalFiles,
            folderCount: totalFolders,
            reason: `Still has ${totalFiles} files and ${totalFolders} folders`,
          })
        }
      } catch (error: any) {
        const msg = String(error?.message || error || '')
        if (msg.includes('not_found') || msg.includes('not found')) {
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'not_found',
            reason: `${folderName} folder does not exist`,
          })
        } else {
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'error',
            reason: msg,
          })
        }
      }
    }

    const summary = {
      total: results.length,
      deleted: results.filter((r) => r.status === 'deleted').length,
      hasFiles: results.filter((r) => r.status === 'has_files').length,
      notFound: results.filter((r) => r.status === 'not_found').length,
      errors: results.filter((r) => r.status === 'error').length,
    }

    return NextResponse.json({
      success: true,
      dryRun,
      folderName,
      message: dryRun
        ? `Dry run complete. ${summary.deleted} empty folders would be deleted, ${summary.hasFiles} still have files.`
        : `Cleanup complete. ${summary.deleted} deleted, ${summary.hasFiles} still have files, ${summary.notFound} not found, ${summary.errors} errors.`,
      summary,
      results,
    })
  } catch (error: any) {
    console.error('[cleanup-old-drawings] Error:', error)
    return NextResponse.json(
      { error: 'Cleanup failed', details: error.message },
      { status: 500 }
    )
  }
}
