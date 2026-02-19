import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// GET - Check freshness of all CAD-linked drawings in a project
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
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Find all CadSourceLinks for drawings in this project
    const links = await prisma.cadSourceLink.findMany({
      where: {
        drawing: { projectId: id }
      },
      include: {
        drawing: {
          select: {
            id: true,
            drawingNumber: true,
            title: true,
            discipline: true,
            status: true,
            currentRevision: true
          }
        }
      }
    })

    if (links.length === 0) {
      return NextResponse.json({
        checkedAt: new Date().toISOString(),
        cadFiles: [],
        summary: {
          total: 0,
          upToDate: 0,
          cadModified: 0,
          dismissed: 0,
          needsReplot: 0,
          unknown: 0
        }
      })
    }

    // Group links by cadDropboxPath so we only check each CAD file once
    const grouped: Record<string, typeof links> = {}
    for (const link of links) {
      if (!grouped[link.cadDropboxPath]) {
        grouped[link.cadDropboxPath] = []
      }
      grouped[link.cadDropboxPath].push(link)
    }

    // Check each unique CAD file against Dropbox
    const cadFiles = []
    const updatePromises: Promise<any>[] = []

    for (const [cadPath, pathLinks] of Object.entries(grouped)) {
      let currentRevision: string | null = null
      let fileError: string | null = null

      try {
        const metadata = await dropboxService.getFileMetadata(cadPath)
        if (metadata) {
          currentRevision = metadata.revision
        } else {
          fileError = 'File not found'
        }
      } catch (err) {
        fileError = 'Could not check file'
        console.error(`[cad-freshness] Error checking ${cadPath}:`, err)
      }

      const drawings = []

      for (const link of pathLinks) {
        let newStatus = link.cadFreshnessStatus

        if (currentRevision && !fileError) {
          if (!link.plottedFromRevision) {
            // Never plotted — stay UNKNOWN
            newStatus = 'UNKNOWN'
          } else if (currentRevision === link.plottedFromRevision) {
            // Same revision — up to date
            newStatus = 'UP_TO_DATE'
          } else {
            // Revision changed
            if (link.cadFreshnessStatus === 'DISMISSED') {
              // If dismissed at a different revision, re-flag
              if (link.dismissedAtCadRevision && link.dismissedAtCadRevision !== currentRevision) {
                newStatus = 'CAD_MODIFIED'
              }
              // Otherwise keep dismissed
            } else if (link.cadFreshnessStatus === 'NEEDS_REPLOT') {
              // Keep as needs replot
            } else {
              newStatus = 'CAD_MODIFIED'
            }
          }

          // Update in DB if status changed
          if (newStatus !== link.cadFreshnessStatus) {
            updatePromises.push(
              prisma.cadSourceLink.update({
                where: { id: link.id },
                data: {
                  cadFreshnessStatus: newStatus,
                  // Clear dismiss info if going back to CAD_MODIFIED
                  ...(newStatus === 'CAD_MODIFIED' ? {
                    statusDismissedAt: null,
                    statusDismissedBy: null,
                    dismissedAtCadRevision: null
                  } : {})
                }
              })
            )
          }
        }

        drawings.push({
          drawingId: link.drawing.id,
          drawingNumber: link.drawing.drawingNumber,
          title: link.drawing.title,
          discipline: link.drawing.discipline,
          cadLayoutName: link.cadLayoutName,
          plottedFromRevision: link.plottedFromRevision,
          cadFreshnessStatus: newStatus,
          plottedAt: link.plottedAt?.toISOString() || null
        })
      }

      cadFiles.push({
        cadDropboxPath: cadPath,
        currentRevision,
        fileError,
        drawings
      })
    }

    // Execute all status updates
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises)
    }

    // Build summary
    const allStatuses = cadFiles.flatMap(f => f.drawings.map(d => d.cadFreshnessStatus))
    const summary = {
      total: allStatuses.length,
      upToDate: allStatuses.filter(s => s === 'UP_TO_DATE').length,
      cadModified: allStatuses.filter(s => s === 'CAD_MODIFIED').length,
      dismissed: allStatuses.filter(s => s === 'DISMISSED').length,
      needsReplot: allStatuses.filter(s => s === 'NEEDS_REPLOT').length,
      unknown: allStatuses.filter(s => s === 'UNKNOWN').length
    }

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      cadFiles,
      summary
    })
  } catch (error) {
    console.error('[cad-freshness] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check CAD freshness' },
      { status: 500 }
    )
  }
}
