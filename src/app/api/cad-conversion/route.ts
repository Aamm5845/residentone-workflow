import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { cadConversionService } from '@/lib/cad-conversion'
import { dropboxService } from '@/lib/dropbox-service'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { dropboxPath, dropboxRevision, sectionId } = await request.json()

    if (!dropboxPath || !sectionId) {
      return NextResponse.json(
        { error: 'dropboxPath and sectionId are required' }, 
        { status: 400 }
      )
    }

    // Verify the section exists and user has access
    const section = await prisma.specBookSection.findFirst({
      where: { 
        id: sectionId,
        specBook: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        specBook: {
          include: {
            project: true
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Get file metadata from Dropbox
    const fileMetadata = await dropboxService.getFileMetadata(dropboxPath)
    if (!fileMetadata) {
      return NextResponse.json({ error: 'File not found in Dropbox' }, { status: 404 })
    }

    const currentRevision = dropboxRevision || fileMetadata.revision

    // Check if we already have a cached conversion
    const existingLink = await prisma.dropboxFileLink.findFirst({
      where: {
        sectionId,
        dropboxPath,
        dropboxRevision: currentRevision,
        cadToPdfCacheUrl: { not: null },
        cacheExpiry: { gt: new Date() }
      }
    })

    if (existingLink?.cadToPdfCacheUrl) {
      return NextResponse.json({
        success: true,
        pdfUrl: existingLink.cadToPdfCacheUrl,
        cached: true,
        cost: 0
      })
    }

    // Download file from Dropbox
    const fileBuffer = await dropboxService.downloadFile(dropboxPath)

    // Convert to PDF
    const result = await cadConversionService.convertCADToPDF(
      dropboxPath,
      currentRevision,
      fileBuffer
    )

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Conversion failed' 
      }, { status: 500 })
    }

    // Update or create Dropbox file link record
    const cacheExpiry = new Date()
    cacheExpiry.setMonth(cacheExpiry.getMonth() + 1) // Cache for 1 month

    await prisma.dropboxFileLink.upsert({
      where: {
        sectionId_dropboxPath: {
          sectionId,
          dropboxPath
        }
      },
      update: {
        fileName: fileMetadata.name,
        fileSize: fileMetadata.size,
        lastModified: fileMetadata.lastModified,
        dropboxRevision: currentRevision,
        cadToPdfCacheUrl: result.pdfUrl,
        cacheExpiry,
        updatedAt: new Date()
      },
      create: {
        sectionId,
        dropboxPath,
        fileName: fileMetadata.name,
        fileSize: fileMetadata.size,
        lastModified: fileMetadata.lastModified,
        dropboxRevision: currentRevision,
        cadToPdfCacheUrl: result.pdfUrl,
        cacheExpiry
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('CAD conversion API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Server-Sent Events endpoint for real-time conversion progress
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return new Response('jobId parameter required', { status: 400 })
  }

  // Create readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Mock progress updates - in real implementation, this would track actual CloudConvert job progress
      let progress = 0
      const interval = setInterval(() => {
        progress += 20
        
        if (progress <= 100) {
          const data = JSON.stringify({
            progress,
            status: progress < 100 ? 'processing' : 'completed',
            message: progress < 100 ? 'Converting...' : 'Complete'
          })
          
          controller.enqueue(`data: ${data}\n\n`)
        }
        
        if (progress >= 100) {
          clearInterval(interval)
          controller.close()
        }
      }, 1000)

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}