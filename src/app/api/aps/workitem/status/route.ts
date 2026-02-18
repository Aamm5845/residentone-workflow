import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

export const runtime = 'nodejs'

/**
 * GET /api/aps/workitem/status?id=<workItemId>&pdfObjectKey=<key>
 * Check Design Automation work item status (for DWG → PDF plotting)
 *
 * When status is 'success', also returns a signed download URL for the PDF.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!apsService.isConfigured()) {
      return NextResponse.json({ error: 'Autodesk APS is not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const workItemId = searchParams.get('id')
    const pdfObjectKey = searchParams.get('pdfObjectKey')
    const pdfUploadKey = searchParams.get('pdfUploadKey')

    if (!workItemId) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 })
    }

    const result = await apsService.getWorkItemStatus(workItemId)

    // Map DA statuses to simpler ones
    const isFailed = result.status.startsWith('failed') || result.status === 'cancelled'
    const isSuccess = result.status === 'success'
    const isInProgress = result.status === 'inprogress' || result.status === 'pending'

    let pdfDownloadUrl: string | null = null
    if (isSuccess && pdfObjectKey) {
      try {
        // Finalize the S3 upload first — Design Automation wrote to the signed URL
        // but the OSS catalog doesn't know about it until we finalize
        if (pdfUploadKey) {
          try {
            await apsService.finalizeUpload(pdfObjectKey, pdfUploadKey)
          } catch (finalizeErr: any) {
            // May already be finalized or the key expired — try download anyway
            console.warn('[workitem/status] Finalize attempt:', finalizeErr.message)
          }
        }
        pdfDownloadUrl = await apsService.getPlottedPdfUrl(pdfObjectKey)
      } catch (err: any) {
        console.error('[workitem/status] Failed to get PDF URL:', err.message)
      }
    }

    return NextResponse.json({
      success: true,
      workItemId: result.id,
      status: isSuccess ? 'success' : isFailed ? 'failed' : isInProgress ? 'inprogress' : result.status,
      rawStatus: result.status,
      progress: result.progress,
      reportUrl: result.reportUrl,
      pdfDownloadUrl,
    })
  } catch (error: any) {
    console.error('[aps/workitem/status] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Work item status check failed' },
      { status: 500 }
    )
  }
}
