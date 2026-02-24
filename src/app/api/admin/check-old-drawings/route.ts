import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

/**
 * POST /api/admin/check-old-drawings
 * Check each project's Dropbox for files under the old "8- DRAWINGS" folder.
 * Reports which projects have files there and how many.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

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
        results: [],
      })
    }

    const results: Array<{
      projectId: string
      projectName: string
      dropboxFolder: string
      status: 'has_files' | 'empty' | 'not_found' | 'error'
      fileCount?: number
      folderCount?: number
      files?: Array<{ name: string; path: string; size: number }>
      reason?: string
    }> = []

    for (const project of projects) {
      const dropboxFolder = project.dropboxFolder!
      const oldDrawingsPath = `${dropboxFolder}/8- DRAWINGS`

      try {
        const listing = await dropboxService.listFolder(oldDrawingsPath)

        const totalFiles = listing.files.length
        const totalFolders = listing.folders.length

        if (totalFiles === 0 && totalFolders === 0) {
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'empty',
            fileCount: 0,
            folderCount: 0,
          })
        } else {
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'has_files',
            fileCount: totalFiles,
            folderCount: totalFolders,
            files: listing.files.map((f) => ({
              name: f.name,
              path: f.path,
              size: f.size,
            })),
          })
        }
      } catch (error: any) {
        const msg = String(error?.message || error || '')
        if (msg.includes('not_found') || msg.includes('not found')) {
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'not_found',
            reason: '8- DRAWINGS folder does not exist',
          })
        } else {
          results.push({
            projectId: project.id,
            projectName: project.name,
            dropboxFolder,
            status: 'error',
            reason: msg,
          })
        }
      }
    }

    const summary = {
      totalProjects: results.length,
      withFiles: results.filter((r) => r.status === 'has_files').length,
      empty: results.filter((r) => r.status === 'empty').length,
      notFound: results.filter((r) => r.status === 'not_found').length,
      errors: results.filter((r) => r.status === 'error').length,
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${summary.totalProjects} projects. ${summary.withFiles} have files in 8- DRAWINGS, ${summary.empty} are empty, ${summary.notFound} don't have the folder.`,
      summary,
      results,
    })
  } catch (error: any) {
    console.error('[check-old-drawings] Error:', error)
    return NextResponse.json(
      { error: 'Check failed', details: error.message },
      { status: 500 }
    )
  }
}
