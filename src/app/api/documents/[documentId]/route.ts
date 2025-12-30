import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/documents/[documentId]
 * Direct delete endpoint for documents - works with any document by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId = (session.user as any).orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    const { documentId } = await params

    console.log('[Documents DELETE] Attempting to delete document:', documentId)
    console.log('[Documents DELETE] User orgId:', orgId)

    // Try RFQDocument first
    const rfqDocument = await prisma.rFQDocument.findFirst({
      where: {
        id: documentId,
        orgId
      }
    })

    if (rfqDocument) {
      console.log('[Documents DELETE] Found RFQDocument:', rfqDocument.id)

      // Delete from Dropbox if path exists
      if (rfqDocument.dropboxPath && dropboxService.isConfigured()) {
        try {
          await dropboxService.deleteFile(rfqDocument.dropboxPath)
          console.log('[Documents DELETE] Deleted from Dropbox:', rfqDocument.dropboxPath)
        } catch (dropboxError) {
          console.warn('[Documents DELETE] Dropbox delete failed:', dropboxError)
        }
      }

      // Delete from Vercel Blob if applicable
      if (rfqDocument.fileUrl && rfqDocument.fileUrl.includes('blob.vercel-storage.com')) {
        try {
          await del(rfqDocument.fileUrl)
          console.log('[Documents DELETE] Deleted from Vercel Blob')
        } catch (blobError) {
          console.warn('[Documents DELETE] Blob delete failed:', blobError)
        }
      }

      // Delete from database
      await prisma.rFQDocument.delete({
        where: { id: documentId }
      })

      console.log('[Documents DELETE] Successfully deleted RFQDocument')
      return NextResponse.json({ success: true, type: 'RFQDocument' })
    }

    // Try DesignConceptItemAttachment
    const attachment = await prisma.designConceptItemAttachment.findUnique({
      where: { id: documentId },
      include: {
        item: {
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: {
                      select: { orgId: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (attachment) {
      // Verify org access
      const attachmentOrgId = attachment.item?.stage?.room?.project?.orgId
      if (attachmentOrgId !== orgId) {
        console.log('[Documents DELETE] Org mismatch for attachment')
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      console.log('[Documents DELETE] Found DesignConceptItemAttachment:', attachment.id)

      // Delete from Vercel Blob if applicable
      if (attachment.url && attachment.url.includes('blob.vercel-storage.com')) {
        try {
          await del(attachment.url)
          console.log('[Documents DELETE] Deleted from Vercel Blob')
        } catch (blobError) {
          console.warn('[Documents DELETE] Blob delete failed:', blobError)
        }
      }

      // Delete from Dropbox if path exists
      if (attachment.dropboxPath && dropboxService.isConfigured()) {
        try {
          await dropboxService.deleteFile(attachment.dropboxPath)
          console.log('[Documents DELETE] Deleted from Dropbox')
        } catch (dropboxError) {
          console.warn('[Documents DELETE] Dropbox delete failed:', dropboxError)
        }
      }

      // Delete from database
      await prisma.designConceptItemAttachment.delete({
        where: { id: documentId }
      })

      console.log('[Documents DELETE] Successfully deleted DesignConceptItemAttachment')
      return NextResponse.json({ success: true, type: 'DesignConceptItemAttachment' })
    }

    console.log('[Documents DELETE] Document not found in any table')
    return NextResponse.json({
      error: 'Document not found',
      searched: ['RFQDocument', 'DesignConceptItemAttachment']
    }, { status: 404 })

  } catch (error) {
    console.error('[Documents DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/documents/[documentId]
 * Get document info for debugging
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params

    // Check RFQDocument
    const rfqDocument = await prisma.rFQDocument.findUnique({
      where: { id: documentId }
    })

    if (rfqDocument) {
      return NextResponse.json({
        found: true,
        type: 'RFQDocument',
        document: rfqDocument
      })
    }

    // Check DesignConceptItemAttachment
    const attachment = await prisma.designConceptItemAttachment.findUnique({
      where: { id: documentId }
    })

    if (attachment) {
      return NextResponse.json({
        found: true,
        type: 'DesignConceptItemAttachment',
        document: attachment
      })
    }

    return NextResponse.json({ found: false })

  } catch (error) {
    console.error('[Documents GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get document' },
      { status: 500 }
    )
  }
}
