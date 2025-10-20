import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleWorkflowTransition, type WorkflowEvent } from '@/lib/phase-transitions'
import { getIPAddress } from '@/lib/attribution'

// POST /api/client-approval/[stageId]/client-decision - Record client's approval decision
export async function POST(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const body = await request.json()
    const { decision, notes } = body

    if (!decision || !['APPROVED', 'REVISION_REQUESTED'].includes(decision)) {
      return NextResponse.json({ error: 'Valid decision is required' }, { status: 400 })
    }

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

    // Use transaction to update multiple records atomically
    const result = await prisma.$transaction(async (tx) => {
      // Update the version with client decision
      const updatedVersion = await tx.clientApprovalVersion.update({
        where: {
          id: currentVersion.id
        },
        data: {
          clientDecision: decision,
          clientDecidedAt: new Date(),
          clientMessage: notes || null,
          status: decision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED'
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
          },
          renderingVersion: true
        }
      })

      // If revision requested, reopen the 3D rendering stage and add revision notes
      if (decision === 'REVISION_REQUESTED' && updatedVersion.renderingVersion) {
        // Update the rendering version to show revision status
        await tx.renderingVersion.update({
          where: {
            id: updatedVersion.renderingVersion.id
          },
          data: {
            status: 'IN_PROGRESS' // Reopen for revisions
          }
        })

        // Add a revision note to the rendering version
        await tx.renderingNote.create({
          data: {
            versionId: updatedVersion.renderingVersion.id,
            content: `🔄 **REVISION REQUESTED**\n\n${notes || 'Client requested revisions'}\n\n*Posted from Client Approval workspace*`,
            authorId: session.user.id
          }
        })

        // Update the 3D rendering stage to be active again
        const renderingStage = await tx.stage.findFirst({
          where: {
            roomId: currentVersion.stage.roomId,
            type: 'THREE_D'
          }
        })

        if (renderingStage) {
          await tx.stage.update({
            where: {
              id: renderingStage.id
            },
            data: {
              status: 'IN_PROGRESS',
              completedAt: null // Reopen the stage
            }
          })
        }
      }

      return updatedVersion
    })

    // Create activity log
    const activityMessage = decision === 'APPROVED' 
      ? `Client approved ${currentVersion.version} - Client approved the design by ${session.user.name}`
      : `Client requested revision ${currentVersion.version} - Client requested revisions by ${session.user.name}${notes ? `: "${notes}"` : ''}`

    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: decision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED',
        message: activityMessage,
        userId: session.user.id
      }
    })

    // Create a ClientApproval record for tracking
    await prisma.clientApproval.create({
      data: {
        versionId: currentVersion.id,
        approvedBy: session.user.email || 'Unknown',
        decision: decision,
        comments: notes || null
      }
    })

    // Trigger workflow transitions
    try {
      const ipAddress = getIPAddress(request)
      
      if (decision === 'REVISION_REQUESTED') {
        const workflowEvent: WorkflowEvent = {
          type: 'CLIENT_REVISION_REQUESTED',
          roomId: currentVersion.stage.roomId,
          stageType: 'CLIENT_APPROVAL',
          stageId: currentVersion.stageId,
          details: {
            versionId: currentVersion.id,
            clientMessage: notes
          }
        }
        
        await handleWorkflowTransition(workflowEvent, session, ipAddress)
      } else if (decision === 'APPROVED') {
        const workflowEvent: WorkflowEvent = {
          type: 'CLIENT_APPROVED',
          roomId: currentVersion.stage.roomId,
          stageType: 'CLIENT_APPROVAL',
          stageId: currentVersion.stageId,
          details: {
            versionId: currentVersion.id
          }
        }
        
        await handleWorkflowTransition(workflowEvent, session, ipAddress)
      }
    } catch (workflowError) {
      console.warn('Workflow transition failed:', workflowError)
      // Don't fail the request if workflow transition fails
    }

    return NextResponse.json({ 
      success: true,
      version: {
        ...result,
        assets: result.assets.map(asset => ({
          id: asset.id,
          asset: asset.asset,
          includeInEmail: asset.includeInEmail
        }))
      }
    })

  } catch (error) {
    console.error('Error recording client decision:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}