import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendClientApprovalEmail, sendEmail } from '@/lib/email-service'
import { dropboxService } from '@/lib/dropbox-service'
import { getBaseUrl } from '@/lib/get-base-url'

// POST /api/client-approval/[stageId]/send-to-client - Send approval email to client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const body = await request.json()
    const { selectedAssetIds, customSubject, customHtmlContent } = body

    // Get the current version
    const currentVersion = await prisma.clientApprovalVersion.findFirst({
      where: {
        stageId
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
          include: {
            asset: {
              include: {
                uploadedByUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!currentVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    if (!currentVersion.approvedByAaron) {
      return NextResponse.json({ error: 'Version must be approved by Aaron first' }, { status: 400 })
    }

    // Update selected assets
    if (selectedAssetIds && selectedAssetIds.length > 0) {
      // First, set all assets to not included
      await prisma.clientApprovalAsset.updateMany({
        where: {
          versionId: currentVersion.id
        },
        data: {
          includeInEmail: false
        }
      })

      // Then, set selected assets to included
      await prisma.clientApprovalAsset.updateMany({
        where: {
          versionId: currentVersion.id,
          id: {
            in: selectedAssetIds
          }
        },
        data: {
          includeInEmail: true
        }
      })
    }

    // Get email assets - use Blob URLs (fast, reliable) with Dropbox temporary links as fallback
    // If no selectedAssetIds provided, include ALL assets marked as includeInEmail
    const assetsToInclude = selectedAssetIds && selectedAssetIds.length > 0
      ? currentVersion.assets.filter(asset => selectedAssetIds.includes(asset.id))
      : currentVersion.assets.filter(asset => asset.includeInEmail)
    
    // Generate proper URLs for each asset (async because Dropbox needs API call)
    const emailAssets = await Promise.all(assetsToInclude.map(async (assetItem) => {
        // Prefer Blob URL (fast delivery)
        if (assetItem.blobUrl) {
          return {
            id: assetItem.id,
            url: assetItem.blobUrl,
            includeInEmail: true
          }
        }
        
        // If no Blob URL, try to get Dropbox temporary link
        if (assetItem.asset.provider === 'dropbox' && assetItem.asset.url) {
          try {
            const dropboxPath = assetItem.asset.url.startsWith('/') 
              ? assetItem.asset.url 
              : '/' + assetItem.asset.url
            const temporaryLink = await dropboxService.getTemporaryLink(dropboxPath)
            if (temporaryLink) {
              console.log(`[send-to-client] ✅ Generated Dropbox temp link for asset ${assetItem.id}`)
              return {
                id: assetItem.id,
                url: temporaryLink,
                includeInEmail: true
              }
            }
          } catch (error) {
            console.error(`[send-to-client] ❌ Failed to get Dropbox link for asset ${assetItem.id}:`, error)
          }
        }
        
        // Last resort: use existing URL (may not work)
        console.warn(`[send-to-client] ⚠️ Asset ${assetItem.id} has no valid URL, email images may not display`);
        return {
          id: assetItem.id,
          url: assetItem.asset.url || '',
          includeInEmail: true
        }
      }))
    
    // Filter out any assets without valid URLs
    const validEmailAssets = emailAssets.filter(a => a.url && a.url.startsWith('http'))
    
    console.log(`[send-to-client] Including ${validEmailAssets.length} assets with valid URLs in email (total selected: ${emailAssets.length})`)

    // Send the actual email
    try {
      const client = currentVersion.stage.room.project.client
      if (!client?.email || !client?.name) {
        return NextResponse.json({ error: 'Client email or name not found' }, { status: 400 })
      }

      // Prefer edited content when provided
      if (typeof customHtmlContent === 'string' && customHtmlContent.trim() !== '') {
        const computedSubject = (typeof customSubject === 'string' && customSubject.trim() !== '')
          ? customSubject.trim()
          : `Your ${currentVersion.stage.room.name || currentVersion.stage.room.type || 'Design'} Renderings Are Ready | ${currentVersion.stage.room.project.name}`

        const emailResult = await sendEmail({
          to: client.email,
          subject: computedSubject,
          html: customHtmlContent
        })

        // Log the send so analytics and history still work
        await prisma.emailLog.create({
          data: {
            versionId: currentVersion.id,
            to: client.email,
            subject: computedSubject,
            html: customHtmlContent,
            sentAt: new Date(),
            type: 'DELIVERY',
            deliveryStatus: 'SENT',
            providerId: emailResult.messageId,
            provider: emailResult.provider
          }
        })
      } else {
        // Use default template
        await sendClientApprovalEmail({
          versionId: currentVersion.id,
          clientEmail: client.email,
          clientName: client.name,
          projectName: currentVersion.stage.room.project.name,
          assets: validEmailAssets
        })
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      return NextResponse.json({ error: 'Failed to send email to client' }, { status: 500 })
    }

    // Update the version to mark as sent
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        sentToClientAt: new Date(),
        sentById: session.user.id,
        status: 'SENT_TO_CLIENT'
      },
      include: {
        assets: {
          include: {
            asset: {
              include: {
                uploadedByUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: 'EMAIL_SENT',
        message: `${currentVersion.version} sent to client - Approval email sent to client by ${session.user.name} with ${validEmailAssets.length} assets`,
        userId: session.user.id
      }
    })

    return NextResponse.json({ 
      success: true,
      version: {
        ...updatedVersion,
        assets: updatedVersion.assets.map(asset => ({
          id: asset.id,
          asset: asset.asset,
          includeInEmail: asset.includeInEmail
        }))
      }
    })

  } catch (error) {
    console.error('Error sending to client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
