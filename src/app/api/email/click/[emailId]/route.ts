import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/email/click/[emailId] - Track email clicks and redirect
export async function GET(
  request: NextRequest,
  { params }: { params: { emailId: string } }
) {
  try {
    const { emailId } = await params
    const { searchParams } = new URL(request.url)
    const redirectUrl = searchParams.get('url')

    if (!redirectUrl) {
      return NextResponse.json({ error: 'Missing redirect URL' }, { status: 400 })
    }

    // Update the email log with click information
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailId },
      include: {
        version: true
      }
    })

    if (emailLog) {
      // Update metadata to track clicks
      const currentMetadata = emailLog.metadata as any || {}
      const clicks = currentMetadata.clicks || []
      clicks.push({
        timestamp: new Date().toISOString(),
        url: redirectUrl,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      })

      await prisma.emailLog.update({
        where: { id: emailId },
        data: {
          metadata: {
            ...currentMetadata,
            clicks,
            clickCount: clicks.length,
            lastClickAt: new Date().toISOString()
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

      // Create activity log for link click
      await prisma.clientApprovalActivity.create({
        data: {
          versionId: emailLog.versionId,
          type: 'EMAIL_CLICKED',
          message: 'Client clicked link in approval email'
        }
      })
    }

    // Redirect to the original URL
    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('Error tracking email click:', error)
    
    // If tracking fails, still redirect to the URL
    const { searchParams } = new URL(request.url)
    const redirectUrl = searchParams.get('url')
    
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl)
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}