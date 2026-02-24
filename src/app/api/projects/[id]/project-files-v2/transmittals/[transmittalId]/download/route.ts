import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// GET - Download the combined PDF for a transmittal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transmittalId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, transmittalId } = await params

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id },
      select: { id: true, dropboxFolder: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get transmittal with combinedPdfPath
    const transmittal = await prisma.transmittal.findFirst({
      where: { id: transmittalId, projectId: id },
      select: { id: true, combinedPdfPath: true, transmittalNumber: true },
    })

    if (!transmittal) {
      return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 })
    }

    if (!transmittal.combinedPdfPath) {
      return NextResponse.json({ error: 'No combined PDF available for this transmittal' }, { status: 404 })
    }

    if (!project.dropboxFolder) {
      return NextResponse.json({ error: 'Project has no Dropbox folder configured' }, { status: 400 })
    }

    // Build absolute Dropbox path and download
    const absolutePath = `${project.dropboxFolder}/${transmittal.combinedPdfPath}`
    console.log(`[transmittal/download] Downloading combined PDF: "${absolutePath}"`)

    const fileBuffer = await dropboxService.downloadFile(absolutePath)

    // Extract filename from the path
    const filename = transmittal.combinedPdfPath.split('/').pop() || `${transmittal.transmittalNumber}.pdf`

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    })
  } catch (error) {
    console.error('[transmittal/download] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to download combined PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
