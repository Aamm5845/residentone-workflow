import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * POST /api/admin/move-floorplan-approvals
 * Move "Floorplan Approvals" folder from "8- DRAWINGS" to "4- Drawings" in all projects.
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
        summary: { total: 0, moved: 0, noSource: 0, alreadyExists: 0, failed: 0 },
        results: [],
      })
    }

    const results: Array<{
      projectId: string
      projectName: string
      status: 'moved' | 'no_source' | 'already_exists' | 'failed'
      reason?: string
    }> = []

    for (const project of projects) {
      const dropboxFolder = project.dropboxFolder!
      const oldPath = `${dropboxFolder}/8- DRAWINGS/Floorplan Approvals`
      const newParent = `${dropboxFolder}/4- Drawings`
      const newPath = `${newParent}/Floorplan Approvals`

      if (dryRun) {
        results.push({
          projectId: project.id,
          projectName: project.name,
          status: 'moved',
          reason: `Would move: ${oldPath} -> ${newPath}`,
        })
        continue
      }

      try {
        // Ensure 4- Drawings exists
        try {
          await dropboxService.createFolder(newParent)
        } catch {
          // Already exists, that's fine
        }

        // Try to move the folder
        await dropboxService.moveFile(oldPath, newPath)
        console.log(`✅ Moved: ${oldPath} -> ${newPath}`)
        results.push({
          projectId: project.id,
          projectName: project.name,
          status: 'moved',
        })
      } catch (error: any) {
        const msg = error?.message || String(error)

        if (
          msg.includes('not_found') ||
          msg.includes('path/not_found') ||
          msg.includes('path_lookup')
        ) {
          // Old folder doesn't exist — nothing to move
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'no_source',
            reason: 'No Floorplan Approvals folder in 8- DRAWINGS',
          })
        } else if (msg.includes('conflict') || msg.includes('409')) {
          // Destination already exists
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'already_exists',
            reason: 'Floorplan Approvals already exists in 4- Drawings',
          })
        } else {
          console.error(`❌ Failed for project ${project.name}:`, msg)
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'failed',
            reason: msg,
          })
        }
      }
    }

    const summary = {
      total: results.length,
      moved: results.filter((r) => r.status === 'moved').length,
      noSource: results.filter((r) => r.status === 'no_source').length,
      alreadyExists: results.filter((r) => r.status === 'already_exists').length,
      failed: results.filter((r) => r.status === 'failed').length,
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run complete. ${summary.total} projects would be processed.`
        : `Migration complete. ${summary.moved} moved, ${summary.noSource} had no source, ${summary.alreadyExists} already existed, ${summary.failed} failed.`,
      summary,
      results,
    })
  } catch (error: any) {
    console.error('[move-floorplan-approvals] Error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}
