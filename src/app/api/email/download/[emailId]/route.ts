import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/email/download/[emailId] - Track asset downloads and redirect
export async function GET(
  request: NextRequest,
  { params }: { params: { emailId: string } }
) {
  try {
    const { emailId } = await params
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')
    const downloadUrl = searchParams.get('url')

    if (!downloadUrl || !assetId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Update the email log with download information
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailId },
      include: {
        version: true
      }
    })

    if (emailLog) {
      // Update metadata to track downloads
      const currentMetadata = emailLog.metadata as any || {}
      const downloads = currentMetadata.downloads || []
      downloads.push({
        timestamp: new Date().toISOString(),
        assetId,
        url: downloadUrl,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      })

      await prisma.emailLog.update({
        where: { id: emailId },
        data: {
          metadata: {
            ...currentMetadata,
            downloads,
            downloadCount: downloads.length,
            lastDownloadAt: new Date().toISOString()
          }
        }
      })

      // Update the client approval version if not already opened
      if (!emailLog.version.emailOpenedAt) {
        await prisma.clientApprovalVersion.update({
          where: { id: emailLog.versionId },
          data: {
            emailOpenedAt: new Date(),
            status: 'CLIENT_REVIEWING'
          }
        })
      }

      // Create activity log for asset download
      await prisma.clientApprovalActivity.create({
        data: {
          versionId: emailLog.versionId,
          type: 'ASSET_DOWNLOADED',
          message: `Client downloaded asset from approval email`
        }
      })
    }

    // Redirect to the original download URL
    return NextResponse.redirect(downloadUrl)

  } catch (error) {
    console.error('Error tracking asset download:', error)
    
    // If tracking fails, still redirect to the URL
    const { searchParams } = new URL(request.url)
    const downloadUrl = searchParams.get('url')
    
    if (downloadUrl) {
      return NextResponse.redirect(downloadUrl)
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}