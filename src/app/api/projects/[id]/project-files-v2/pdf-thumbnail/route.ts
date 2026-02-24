import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service-v2'

export const runtime = 'nodejs'

// Increase timeout for PDF rendering (Vercel default is 10s, we might need more)
export const maxDuration = 30

// GET - Generate a PNG thumbnail for a PDF file
// Query params: path (relative path within project dropbox folder)
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
    const { searchParams } = new URL(request.url)
    const relativePath = searchParams.get('path')

    if (!relativePath) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 })
    }

    // Security: reject path traversal
    if (relativePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id, orgId: session.user.orgId || undefined },
      select: { id: true, dropboxFolder: true }
    })

    if (!project || !project.dropboxFolder) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build absolute Dropbox path
    const absolutePath = project.dropboxFolder + '/' + relativePath

    // Download the PDF from Dropbox
    const pdfBuffer = await dropboxService.downloadFile(absolutePath)

    // Render page 1 as PNG using unpdf + @napi-rs/canvas
    const { renderPageAsImage } = await import('unpdf')
    const pdfData = new Uint8Array(pdfBuffer)

    const imageBuffer = await renderPageAsImage(pdfData, 1, {
      canvasImport: () => import('@napi-rs/canvas'),
      scale: 1.5, // Good quality for thumbnails
    })

    // Return the PNG with caching headers (cache for 1 hour)
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error: any) {
    console.error('[pdf-thumbnail] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF thumbnail' },
      { status: 500 }
    )
  }
}
