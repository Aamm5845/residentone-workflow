import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large migrations

const OLD_FOLDER_NAME = '7- SOURCES'
const NEW_FOLDER_NAME = '7- Reference'

/**
 * POST /api/admin/add-reference-folders
 * Rename "7- SOURCES" to "7- Reference" in all existing project Dropbox folders.
 * If the old folder doesn't exist, create "7- Reference" instead.
 *
 * Body:
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
        summary: { total: 0, renamed: 0, created: 0, existed: 0, failed: 0 },
        results: [],
      })
    }

    const results: Array<{
      projectId: string
      projectName: string
      dropboxFolder: string
      status: 'renamed' | 'created' | 'existed' | 'failed'
      reason?: string
    }> = []

    for (const project of projects) {
      const dropboxFolder = project.dropboxFolder!
      const oldPath = `${dropboxFolder}/${OLD_FOLDER_NAME}`
      const newPath = `${dropboxFolder}/${NEW_FOLDER_NAME}`

      if (dryRun) {
        results.push({
          projectId: project.id,
          projectName: project.name,
          dropboxFolder,
          status: 'renamed',
          reason: `Would attempt rename: ${oldPath} -> ${newPath}, or create ${newPath} if old folder not found`,
        })
        continue
      }

      try {
        // First, try to rename old folder to new name
        await dropboxService.moveFile(oldPath, newPath)
        console.log(`✅ Renamed: ${oldPath} -> ${newPath}`)
        results.push({
          projectId: project.id,
          projectName: project.name,
          dropboxFolder,
          status: 'renamed',
        })
      } catch (renameError: any) {
        const renameMsg = renameError?.message || String(renameError)

        if (
          renameMsg.includes('not_found') ||
          renameMsg.includes('path/not_found') ||
          renameMsg.includes('path_lookup')
        ) {
          // Old folder doesn't exist — try to create the new one
          try {
            await dropboxService.createFolder(newPath)
            console.log(`✅ Created: ${newPath}`)
            results.push({
              projectId: project.id,
              projectName: project.name,
              dropboxFolder,
              status: 'created',
            })
          } catch (createError: any) {
            const createMsg = createError?.message || String(createError)
            if (createMsg.includes('conflict') || createMsg.includes('already exists')) {
              results.push({
                projectId: project.id,
                projectName: project.name,
                dropboxFolder,
                status: 'existed',
                reason: '7- Reference folder already exists',
              })
            } else {
              console.error(`❌ Failed to create for project ${project.name}:`, createMsg)
              results.push({
                projectId: project.id,
                projectName: project.name,
                dropboxFolder,
                status: 'failed',
                reason: createMsg,
              })
            }
          }
        } else if (renameMsg.includes('conflict')) {
          // New folder already exists (rename conflict)
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'existed',
            reason: '7- Reference folder already exists',
          })
        } else {
          console.error(`❌ Failed to rename for project ${project.name}:`, renameMsg)
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'failed',
            reason: renameMsg,
          })
        }
      }
    }

    const summary = {
      total: results.length,
      renamed: results.filter((r) => r.status === 'renamed').length,
      created: results.filter((r) => r.status === 'created').length,
      existed: results.filter((r) => r.status === 'existed').length,
      failed: results.filter((r) => r.status === 'failed').length,
    }

    return NextResponse.json({
      success: true,
      dryRun,
      oldFolderName: OLD_FOLDER_NAME,
      newFolderName: NEW_FOLDER_NAME,
      message: dryRun
        ? `Dry run complete. ${summary.total} projects would be processed.`
        : `Migration complete. ${summary.renamed} renamed, ${summary.created} created, ${summary.existed} already existed, ${summary.failed} failed.`,
      summary,
      results,
    })
  } catch (error: any) {
    console.error('[add-reference-folders] Error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}
