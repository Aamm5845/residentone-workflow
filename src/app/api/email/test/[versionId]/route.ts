import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendClientApprovalEmail } from '@/lib/email-service'

// POST /api/email/test/[versionId] - Send a test email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { versionId } = await params
    const body = await request.json()
    const { testEmail } = body

    if (!testEmail) {
      return NextResponse.json({ error: 'Test email address is required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(testEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Get version details with all necessary relationships - simplified to match client approval API
    const version = await prisma.clientApprovalVersion.findFirst({
      where: {
        id: versionId
      },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    client: true
                  }
                }
              }
            }
          }
        },
        assets: {
          where: {
            includeInEmail: true
          },
          include: {
            asset: true
          }
        }
      }
    })

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const client = version.stage.room.project.client
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Transform assets for the email service - prefer Blob URL
    const emailAssets = version.assets.map(assetItem => {
      // Use Blob URL if available (fast delivery), fallback to original asset URL
      const viewableUrl = assetItem.blobUrl || assetItem.asset.url
      
      if (!assetItem.blobUrl) {
        console.warn(`[test-email] ⚠️ Asset ${assetItem.id} has no Blob URL, using original URL`);
      }
      
      return {
        id: assetItem.id,
        url: viewableUrl,
        includeInEmail: assetItem.includeInEmail
      }
    })

    try {
      // Send test email (using test email address instead of client email)
      const emailLogId = await sendClientApprovalEmail({
        versionId: version.id,
        clientEmail: testEmail, // Use test email instead of real client email
        clientName: `${client.name} (TEST)`, // Mark as test
        projectName: `${version.stage.room.project.name} - TEST EMAIL`,
        assets: emailAssets
      })

      // Mark the email log as a test email in metadata
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          metadata: {
            isTestEmail: true,
            originalClientEmail: client.email,
            testSentBy: session.user.id,
            testSentAt: new Date().toISOString()
          }
        }
      })

      // Create activity log for test email
      await prisma.clientApprovalActivity.create({
        data: {
          versionId: version.id,
          type: 'TEST_EMAIL_SENT',
          message: `Test email sent to ${testEmail} by ${session.user.name}`,
          userId: session.user.id
        }
      })

      return NextResponse.json({ 
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        emailLogId
      })

    } catch (emailError) {
      console.error('Failed to send test email:', emailError)
      return NextResponse.json({ 
        error: 'Failed to send test email',
        details: emailError instanceof Error ? emailError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}