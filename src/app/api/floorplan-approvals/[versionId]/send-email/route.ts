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
        action: ActivityActions.PROJECT_UPDATE,
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
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Floorplan Documents Ready</h1>
            <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Dear ${clientName},</p>
            
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.7;">Your floorplan documents are ready for review. We've attached ${floorplanCount} PDF ${floorplanCount !== 1 ? 'files' : 'file'} to this email for your convenience.</p>
            
            <!-- Project Details -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; font-weight: 600;">Project Details</h3>
                <p style="margin: 8px 0; color: #475569;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 8px 0; color: #475569;"><strong>Version:</strong> ${versionName}</p>
                <p style="margin: 8px 0; color: #475569;"><strong>Attachments:</strong> ${floorplanCount} floorplan ${floorplanCount !== 1 ? 'documents' : 'document'}</p>
            </div>

            <!-- Attachment Notice -->
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-radius: 8px; padding: 24px; margin: 32px 0; text-align: center;">
                <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 18px; font-weight: 600;">📎 Floorplans Attached</h3>
                <p style="margin: 0; color: #1e40af; font-size: 15px; line-height: 1.7;">All floorplan documents are attached to this email. You can open them directly from your email attachments.</p>
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