import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/email/track/[emailId] - Track email opens via pixel
export async function GET(
  request: NextRequest,
  { params }: { params: { emailId: string } }
) {
  try {
    const { emailId } = params

    // Update the email log with opened timestamp
    
    const updatedLog = await prisma.emailLog.update({
      where: { 
        id: emailId 
      },
      data: { 
        openedAt: new Date() 
      }
    })

    // Log the client approval version as opened if not already
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailId },
      include: {
        version: true
      }
    })

    if (emailLog && !emailLog.version.emailOpenedAt) {
      await prisma.clientApprovalVersion.update({
        where: { id: emailLog.versionId },
        data: {
          emailOpenedAt: new Date(),
          status: 'CLIENT_REVIEWING'
        }
      })

      // Create activity log
      await prisma.clientApprovalActivity.create({
        data: {
          versionId: emailLog.versionId,
          type: 'EMAIL_OPENED',
          message: 'Client opened the approval email'
        }
      })
    }

    // Return a 1x1 transparent pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ TRACKING ERROR - Failed to track email:', error)
    console.error('❌ TRACKING ERROR - emailId was:', emailId)
    console.error('❌ TRACKING ERROR - Full error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    
    // Still return a pixel even if tracking fails
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )

    return new NextResponse(pixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}