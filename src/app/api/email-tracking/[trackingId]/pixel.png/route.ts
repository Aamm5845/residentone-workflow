import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/email-tracking/[trackingId]/pixel.png - Email tracking pixel
export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  try {
    const { trackingId } = await params

    // Find and update the email log
    const emailLog = await prisma.clientApprovalEmailLog.findFirst({
      where: {
        trackingPixelId: trackingId
      }
    })

    if (emailLog && !emailLog.openedAt) {
      // Update email as opened and update the version status if needed
      await prisma.$transaction(async (tx) => {
        // Update email log
        await tx.clientApprovalEmailLog.update({
          where: {
            id: emailLog.id
          },
          data: {
            openedAt: new Date()
          }
        })

        // Update version status and add activity log
        const version = await tx.clientApprovalVersion.findUnique({
          where: {
            id: emailLog.versionId
          }
        })

        if (version && version.status === 'SENT_TO_CLIENT') {
          await tx.clientApprovalVersion.update({
            where: {
              id: version.id
            },
            data: {
              emailOpenedAt: new Date(),
              status: 'CLIENT_REVIEWING',
              activityLogs: {
                create: {
                  type: 'email_opened',
                  message: 'Client opened email'
                }
              }
            }
          })
        }
      })
    }

    // Return a 1x1 transparent PNG
    const transparentPixel = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ])

    return new NextResponse(transparentPixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': transparentPixel.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error tracking email:', error)
    // Still return the pixel even if tracking fails
    const transparentPixel = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ])

    return new NextResponse(transparentPixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}