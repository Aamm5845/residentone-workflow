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
    const { selectedAssetIds, testEmail } = data

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

    if (!version.approvedByAaron) {
      return NextResponse.json({
        error: 'Cannot send to client: Version must be approved by Aaron first'
      }, { status: 400 })
    }

    // Get selected assets or default to all email-included assets
    let assetsToInclude = version.assets.filter(a => a.includeInEmail)
    if (selectedAssetIds && selectedAssetIds.length > 0) {
      assetsToInclude = version.assets.filter(a => 
        selectedAssetIds.includes(a.id) && a.includeInEmail
      )
    }

    if (assetsToInclude.length === 0) {
      return NextResponse.json({
        error: 'No assets selected for email. Please select at least one floorplan to include.'
      }, { status: 400 })
    }

    // Generate email content
    const emailSubject = `${version.project.name} - Floorplan Ready for Approval`
    const clientEmail = testEmail || version.project.client?.email
    
    if (!clientEmail) {
      return NextResponse.json({
        error: 'No client email available. Please add client email to project or provide test email.'
      }, { status: 400 })
    }

    // Generate HTML email content
    const emailHtml = generateFloorplanApprovalEmailHtml({
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

    const emailText = generateFloorplanApprovalEmailText({
      clientName: version.project.client?.name || 'Valued Client',
      projectName: version.project.name,
      versionName: version.version,
      floorplanCount: assetsToInclude.length,
      approvalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/floorplan-approval/${version.id}`
    })

    // Generate tracking pixel ID
    const trackingPixelId = `floorplan_${version.id}_${Date.now()}`
    
    // Send email using existing email service
    const emailData = {
      to: clientEmail,
      subject: emailSubject,
      html: emailHtml.replace('{{TRACKING_PIXEL_ID}}', trackingPixelId),
      text: emailText
    }

    // Send actual email using Resend service
    
    // Use the actual email service with Resend
    const emailResult = await sendEmail({
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      tags: ['floorplan-approval', testEmail ? 'test' : 'client']
    })

    if (emailResult.messageId) {
      // Create email log
      const emailLog = await prisma.floorplanApprovalEmailLog.create({
        data: {
          versionId: version.id,
          to: clientEmail,
          subject: emailSubject,
          htmlContent: emailHtml,
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
            sentById: session.user.id,
            status: 'SENT_TO_CLIENT',
            ...withUpdateAttribution(session)
          }
        })

        // Create activity log
        await prisma.floorplanApprovalActivity.create({
          data: {
            versionId: version.id,
            type: 'email_sent',
            message: `Floorplan approval email sent to ${clientEmail}`,
            userId: session.user.id,
            metadata: JSON.stringify({
              emailId: emailLog.id,
              recipientEmail: clientEmail,
              assetCount: assetsToInclude.length,
              trackingPixelId
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
        action: ActivityActions.PROJECT_UPDATE,
        entity: EntityTypes.PROJECT,
        entityId: version.projectId,
        details: {
          action: testEmail ? 'floorplan_test_email_sent' : 'floorplan_email_sent',
          versionId: version.id,
          version: version.version,
          projectName: version.project.name,
          clientName: version.project.client?.name,
          recipientEmail: clientEmail,
          assetCount: assetsToInclude.length,
          isTest: !!testEmail
        },
        ipAddress
      })

      return NextResponse.json({
        success: true,
        message: testEmail 
          ? `Test email sent successfully to ${clientEmail}`
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
  const { clientName, projectName, versionName, floorplanCount, assets, approvalUrl, companyName } = data

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Floorplan Approval - Meisner Interiors</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px 32px; text-align: center;">
            <!-- <img src="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/logo.png" 
                 alt="Interior Design Studio" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" 
                 draggable="false" 
                 ondragstart="return false;" 
                 oncontextmenu="return false;"/> -->
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Floorplan Approval</h1>
            <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Dear ${clientName},</p>
            
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.7;">This is the latest floor design for your project and is ready for your review and approval.</p>
            
            <!-- Project Details -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Project Details</h3>
                <p style="margin: 8px 0; color: #475569;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 8px 0; color: #475569;"><strong>Version:</strong> ${versionName}</p>
                <p style="margin: 8px 0; color: #475569;"><strong>Floorplans:</strong> ${floorplanCount} document${floorplanCount !== 1 ? 's' : ''} included</p>
            </div>

            ${assets.length > 0 ? `
            <div style="margin: 32px 0;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Included Floorplans</h3>
                <div style="margin: 16px 0;">
                    ${assets.map(asset => `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 12px 0; background: #ffffff;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="flex: 1;">
                                <div style="font-size: 16px; color: #1e293b; margin: 0 0 8px 0; font-weight: 600;">${asset.title}</div>
                                <div style="font-size: 13px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">${asset.type === 'FLOORPLAN_PDF' ? 'PDF Floorplan' : 'CAD File'}</div>
                                <div style="font-size: 12px; color: #94a3b8;">${asset.size ? Math.round(asset.size / 1024 / 1024 * 100) / 100 + ' MB' : 'File size not available'}</div>
                            </div>
                            <div style="margin-left: 16px;">
                                <a href="${asset.url}" 
                                   style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;"
                                   target="_blank" rel="noopener noreferrer">Download PDF</a>
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Approval buttons removed - now just an informational email -->
            <div style="text-align: center; margin: 32px 0;">
                <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0;">Please review the floorplan documents above. You can download each PDF by clicking the download button next to each file.</p>
            </div>

            <!-- Information Section -->
            <div style="margin: 32px 0;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Floorplan Information</h3>
                <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; margin: 16px 0; border-radius: 0 8px 8px 0;">
                    <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">These floorplan documents show the layout and design details for your project. Each PDF contains detailed information about room layouts, dimensions, and design elements.</p>
                    <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0;">You can download and save these files for your records. If you have any questions about the floorplans, please don't hesitate to reach out.</p>
                </div>
            </div>
            
            <p style="margin: 32px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">Questions about the design? Please reply to this email or call us to discuss any changes or concerns.</p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Interior Design Studio</div>
            
            <div style="margin-bottom: 12px;">
                <span style="color: #64748b; font-size: 13px;">Professional Interior Design Services</span>
            </div>
            
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">Questions? Please reply to this email to discuss any changes or concerns.</p>
            
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