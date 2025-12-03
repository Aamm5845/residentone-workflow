import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { selectedAssetIds, testEmail, customSubject, customHtmlContent } = data

    // Find the version and verify access
    const version = await prisma.floorplanApprovalVersion.findFirst({
      where: {
        id: resolvedParams.versionId,
        project: {
          orgId: session.user.orgId
        }
      },
      include: {
        project: {
          include: {
            client: true
          }
        },
        assets: {
          include: {
            asset: true
          }
        }
      }
    })

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Check if version is approved (either explicitly or by being pushed to approval)
    const isApproved = version.approvedByAaron || version.status !== 'DRAFT'
    if (!isApproved) {
      return NextResponse.json({
        error: 'Cannot send to client: Version must be approved first'
      }, { status: 400 })
    }

    // Get selected assets or default to all assets
    let assetsToInclude = version.assets
    if (selectedAssetIds && selectedAssetIds.length > 0) {
      assetsToInclude = version.assets.filter(a => selectedAssetIds.includes(a.id))
    }

    if (assetsToInclude.length === 0) {
      return NextResponse.json({
        error: 'No assets selected for email. Please select at least one floorplan to include.'
      }, { status: 400 })
    }

    // Get client email
    const clientEmail = testEmail || version.project.client?.email
    
    if (!clientEmail) {
      return NextResponse.json({
        error: 'No client email available. Please add client email to project or provide test email.'
      }, { status: 400 })
    }

    // Use custom email content if provided, otherwise generate default template
    let emailSubject: string
    let emailHtml: string
    
    if (customSubject && customHtmlContent) {
      // Use custom content
      emailSubject = customSubject
      emailHtml = customHtmlContent
    } else {
      // Generate default email content
      emailSubject = `${version.project.name} - Floorplan Ready for Approval`
      
      emailHtml = generateFloorplanApprovalEmailHtml({
        clientName: version.project.client?.name || 'Valued Client',
        projectName: version.project.name,
        versionName: version.version,
        floorplanCount: assetsToInclude.length,
        assets: assetsToInclude.map(a => ({
          id: a.asset.id,
          title: a.asset.title,
          url: a.asset.url,
          type: a.asset.type,
          size: a.asset.size
        })),
        approvalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/floorplan-approval/${version.id}`,
        companyName: process.env.COMPANY_NAME || 'Your Interior Design Studio'
      })
    }

    // Generate tracking pixel ID and URL
    const trackingPixelId = `floorplan_${version.id}_${Date.now()}`
    const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email-tracking/${trackingPixelId}/pixel.png`
    
    // Replace tracking pixel placeholder in HTML with actual tracking URL
    const finalEmailHtml = emailHtml.replace(
      'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"',
      `src="${trackingPixelUrl}"`
    )

    // Fetch PDF files and prepare as base64 attachments
    const attachments = []
    for (const assetItem of assetsToInclude) {
      if (assetItem.asset.type === 'FLOORPLAN_PDF' && assetItem.asset.url) {
        try {
          // Fetch the PDF from the URL
          const response = await fetch(assetItem.asset.url)
          if (response.ok) {
            const buffer = await response.arrayBuffer()
            const base64Content = Buffer.from(buffer).toString('base64')
            
            attachments.push({
              filename: assetItem.asset.title.endsWith('.pdf') ? assetItem.asset.title : `${assetItem.asset.title}.pdf`,
              content: base64Content
            })
          }
        } catch (error) {
          console.error(`Failed to fetch PDF for attachment: ${assetItem.asset.title}`, error)
          // Continue with other attachments even if one fails
        }
      }
    }

    // Send actual email using Resend service with attachments
    const emailResult = await sendEmail({
      to: clientEmail,
      subject: emailSubject,
      html: finalEmailHtml,
      tags: ['floorplan-approval', testEmail ? 'test' : 'client'],
      attachments: attachments.length > 0 ? attachments : undefined
    })

    if (emailResult.messageId) {
      // Check if this is a resend (before any DB updates)
      const isResend = !testEmail && !!version.sentToClientAt
      
      // Create email log
      const emailLog = await prisma.floorplanApprovalEmailLog.create({
        data: {
          versionId: version.id,
          to: clientEmail,
          subject: emailSubject,
          htmlContent: finalEmailHtml,
          trackingPixelId: trackingPixelId,
          sentAt: new Date()
        }
      })

      // Update version status if not a test email
      if (!testEmail) {
        
        await prisma.floorplanApprovalVersion.update({
          where: { id: version.id },
          data: {
            sentToClientAt: new Date(),
            status: 'SENT_TO_CLIENT',
            sentById: session.user.id
          }
        })

        // Create activity log
        await prisma.floorplanApprovalActivity.create({
          data: {
            versionId: version.id,
            type: isResend ? 'email_resent' : 'email_sent',
            message: isResend 
              ? `Floorplan approval email resent to ${clientEmail}`
              : `Floorplan approval email sent to ${clientEmail}`,
            userId: session.user.id,
            metadata: JSON.stringify({
              emailId: emailLog.id,
              recipientEmail: clientEmail,
              assetCount: assetsToInclude.length,
              trackingPixelId,
              isResend
            })
          }
        })
      } else {
        // Test email activity
        await prisma.floorplanApprovalActivity.create({
          data: {
            versionId: version.id,
            type: 'test_email_sent',
            message: `Test floorplan approval email sent to ${clientEmail}`,
            userId: session.user.id,
            metadata: JSON.stringify({
              emailId: emailLog.id,
              testEmail: clientEmail,
              assetCount: assetsToInclude.length
            })
          }
        })
      }

      // Log to main activity log
      await logActivity({
        session,
        action: ActivityActions.FLOORPLAN_APPROVAL_SENT,
        entity: EntityTypes.PROJECT,
        entityId: version.projectId,
        details: {
          action: testEmail ? 'floorplan_test_email_sent' : (isResend ? 'floorplan_email_resent' : 'floorplan_email_sent'),
          versionId: version.id,
          version: version.version,
          projectName: version.project.name,
          clientName: version.project.client?.name,
          recipientEmail: clientEmail,
          assetCount: assetsToInclude.length,
          isTest: !!testEmail,
          isResend
        },
        ipAddress
      })

      return NextResponse.json({
        success: true,
        message: testEmail 
          ? `Test email sent successfully to ${clientEmail}`
          : isResend 
          ? `Floorplan approval email resent successfully to ${clientEmail}`
          : `Floorplan approval email sent successfully to ${clientEmail}`,
        emailLog: {
          id: emailLog.id,
          to: emailLog.to,
          subject: emailLog.subject,
          sentAt: emailLog.sentAt,
          trackingPixelId: emailLog.trackingPixelId
        },
        version: !testEmail ? {
          status: 'SENT_TO_CLIENT',
          sentToClientAt: new Date()
        } : undefined
      })

    } else {
      return NextResponse.json({
        error: 'Failed to send email',
        details: 'Email service error occurred'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error sending floorplan approval email:', error)
    return NextResponse.json({
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to generate HTML email content
function generateFloorplanApprovalEmailHtml(data: {
  clientName: string
  projectName: string
  versionName: string
  floorplanCount: number
  assets: any[]
  approvalUrl: string
  companyName: string
}) {
  const { clientName, projectName, versionName, floorplanCount } = data

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Floorplan Review - ${projectName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
        
        <!-- Header -->
        <div style="background: #18181b; padding: 32px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 600;">Floorplan Review</h1>
            <p style="margin: 8px 0 0 0; color: #a1a1aa; font-size: 14px;">${projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px;">
            <p style="margin: 0 0 20px 0; color: #18181b; font-size: 15px;">Hi ${clientName},</p>
            
            <p style="margin: 0 0 20px 0; color: #52525b; font-size: 15px;">
                The latest floorplan${floorplanCount > 1 ? 's' : ''} for your project ${floorplanCount > 1 ? 'are' : 'is'} ready. Please find ${floorplanCount > 1 ? 'them' : 'it'} attached to this email.
            </p>

            <!-- Summary Box -->
            <div style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 20px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="color: #71717a; font-size: 13px; padding: 4px 0;">Project</td>
                        <td style="color: #18181b; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 500;">${projectName}</td>
                    </tr>
                    <tr>
                        <td style="color: #71717a; font-size: 13px; padding: 4px 0;">Version</td>
                        <td style="color: #18181b; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 500;">${versionName}</td>
                    </tr>
                    <tr>
                        <td style="color: #71717a; font-size: 13px; padding: 4px 0;">Files</td>
                        <td style="color: #18181b; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 500;">${floorplanCount} PDF${floorplanCount > 1 ? 's' : ''}</td>
                    </tr>
                </table>
            </div>

            <p style="margin: 0 0 20px 0; color: #52525b; font-size: 15px;">
                Take your time to review. If you have any questions or would like to discuss changes, just reply to this email.
            </p>
            
            <p style="margin: 24px 0 0 0; color: #52525b; font-size: 15px;">
                Best regards,<br>
                <strong style="color: #18181b;">The Meisner Interiors Team</strong>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #fafafa; border-top: 1px solid #e4e4e7; padding: 20px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #18181b; font-size: 13px; font-weight: 600;">Meisner Interiors</p>
            <p style="margin: 0; color: #71717a; font-size: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" style="color: #71717a; text-decoration: none;">projects@meisnerinteriors.com</a>
                &nbsp;•&nbsp;
                <a href="tel:+15147976957" style="color: #71717a; text-decoration: none;">514-797-6957</a>
            </p>
            
            <!-- Tracking Pixel -->
            <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="1" height="1" style="display:none;" alt="" />
        </div>
    </div>
</body>
</html>`
}

// Helper function to generate plain text email content
function generateFloorplanApprovalEmailText(data: {
  clientName: string
  projectName: string
  versionName: string
  floorplanCount: number
  approvalUrl: string
}) {
  const { clientName, projectName, versionName, floorplanCount, approvalUrl } = data

  return `
Dear ${clientName},

This is the latest floor design for your project. We've included ${floorplanCount} floorplan document${floorplanCount !== 1 ? 's' : ''} for your review.

Project Details:
- Project: ${projectName}
- Version: ${versionName}
- Floorplans: ${floorplanCount} document${floorplanCount !== 1 ? 's' : ''} included

Floorplan Information:
These floorplan documents show the layout and design details for your project. Each PDF contains detailed information about room layouts, dimensions, and design elements.

You can download and save these files for your records. The PDF files are attached to this email or can be accessed through our project portal.

Questions about the design? Please reply to this email to discuss any aspects of the floorplans.

Best regards,
Your Interior Design Team
`
}