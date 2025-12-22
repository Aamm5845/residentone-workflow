import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'
import { getBaseUrl } from '@/lib/get-base-url'

// GET /api/floorplan-approvals/[versionId]/email-preview - Get email preview before sending
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const selectedAssetIdsParam = searchParams.get('selectedAssetIds')
    const selectedAssetIds = selectedAssetIdsParam ? selectedAssetIdsParam.split(',') : []

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

    // Get selected assets or default to all email-included assets
    let assetsToInclude = version.assets.filter(a => a.includeInEmail)
    if (selectedAssetIds && selectedAssetIds.length > 0) {
      assetsToInclude = version.assets.filter(a => 
        selectedAssetIds.includes(a.id) && a.includeInEmail
      )
    }

    // Generate email content
    const emailSubject = `${version.project.name} - Floorplan Ready for Approval`
    const clientEmail = version.project.client?.email || ''
    
    if (!clientEmail) {
      return NextResponse.json({
        error: 'No client email available. Please add client email to project.'
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
      approvalUrl: `${getBaseUrl()}/floorplan-approval/${version.id}`,
      companyName: process.env.COMPANY_NAME || 'Your Interior Design Studio'
    })

    return NextResponse.json({
      to: clientEmail,
      subject: emailSubject,
      htmlContent: emailHtml,
      previewData: {
        clientName: version.project.client?.name,
        projectName: version.project.name,
        versionName: version.version,
        assetCount: assetsToInclude.length
      }
    })

  } catch (error) {
    console.error('Error generating floorplan email preview:', error)
    return NextResponse.json({
      error: 'Failed to generate email preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to generate HTML email content (copied from send-email route)
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
                Your floorplan${floorplanCount > 1 ? 's are' : ' is'} ready for review. We've attached ${floorplanCount} PDF ${floorplanCount > 1 ? 'files' : 'file'} to this email for your convenience.
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
                        <td style="color: #71717a; font-size: 13px; padding: 4px 0;">Attachments</td>
                        <td style="color: #18181b; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 500;">${floorplanCount} PDF${floorplanCount > 1 ? 's' : ''}</td>
                    </tr>
                </table>
            </div>

            <p style="margin: 0 0 20px 0; color: #52525b; font-size: 15px;">
                Please review the attached documents at your convenience. If you have any questions or would like to discuss changes, simply reply to this email.
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
