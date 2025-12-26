import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendClientApprovalEmail, sendEmail } from '@/lib/email-service'

// POST /api/client-approval/[stageId]/resend-to-client - Resend approval email to client
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

    if (!currentVersion.sentToClientAt) {
      return NextResponse.json({ error: 'Email must be sent at least once before resending' }, { status: 400 })
    }

    // Update selected assets if provided
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

    // Get email assets for the email service
    const emailAssets = currentVersion.assets
      .filter(asset => selectedAssetIds?.includes(asset.id) || asset.includeInEmail)
      .map(assetItem => ({
        id: assetItem.id,
        url: assetItem.asset.url,
        includeInEmail: true
      }))

    // Send the resend email
    try {
      const client = currentVersion.stage.room.project.client
      if (!client?.email || !client?.name) {
        return NextResponse.json({ error: 'Client email or name not found' }, { status: 400 })
      }

      if (typeof customHtmlContent === 'string' && customHtmlContent.trim() !== '') {
        const computedSubject = (typeof customSubject === 'string' && customSubject.trim() !== '')
          ? customSubject.trim()
          : `Your ${currentVersion.stage.room.name || currentVersion.stage.room.type || 'Design'} Renderings Are Ready | ${currentVersion.stage.room.project.name}`

        const emailResult = await sendEmail({
          to: client.email,
          subject: computedSubject,
          html: customHtmlContent
        })

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
        await sendClientApprovalEmail({
          versionId: currentVersion.id,
          clientEmail: client.email,
          clientName: client.name,
          projectName: currentVersion.stage.room.project.name,
          assets: emailAssets
        })
      }
    } catch (emailError) {
      console.error('Failed to resend email:', emailError)
      return NextResponse.json({ error: 'Failed to resend email to client' }, { status: 500 })
    }

    // Update the version to record the resend (but don't change sentToClientAt)
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        // Keep the original sentToClientAt, but update other fields if needed
        updatedAt: new Date()
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

    // Create activity log for resend
    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: 'EMAIL_RESENT',
        message: `${currentVersion.version} resent to client - Approval email resent to client by ${session.user.name} with ${selectedAssetIds?.length || emailAssets.length} assets`,
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
    console.error('Error resending to client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
