import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { getPhaseDisplayName } from '@/lib/utils/phase-utils'
import { getBaseUrl } from '@/lib/get-base-url'

export interface TeamNotificationResult {
  success: boolean
  sentCount: number
  skippedCount: number
  errors: string[]
  results: {
    userId: string
    messageId?: string
    status: 'sent' | 'skipped' | 'error'
    reason?: string
  }[]
}

export interface NotificationRecipient {
  id: string
  name: string
  email: string
  role?: string
}

export interface NextPhaseInfo {
  id: string
  name: string
  type: string
  assignee?: NotificationRecipient | null
}

/**
 * Service for handling team notifications when phases complete
 */
export class TeamNotificationService {
  
  /**
   * Get next phase assignees who should be notified
   */
  async getNextPhaseAssignees(stageId: string, actorUserId: string): Promise<{
    nextPhases: NextPhaseInfo[]
    recipients: (NotificationRecipient & { alreadySent: boolean })[]
    actorIncluded: boolean
  }> {
    try {
      // Get the completed stage
      const stage = await prisma.stage.findUnique({
        where: { id: stageId },
        include: {
          room: {
            include: {
              stages: {
                include: {
                  assignedUser: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true
                    }
                  }
                },
                orderBy: { createdAt: 'asc' }
              }
            }
          }
        }
      })

      if (!stage) {
        throw new Error('Stage not found')
      }

      const nextPhases = this.determineNextPhases(stage.type, stage.room.stages)
      const recipients = this.collectRecipients(nextPhases, actorUserId)
      
      // Check which recipients already received notifications for this stage
      const existingNotifications = await prisma.notificationSend.findMany({
        where: {
          eventType: 'PHASE_COMPLETED',
          stageId: stageId,
          recipientUserId: { in: recipients.map(r => r.id) }
        },
        select: { recipientUserId: true }
      })

      const alreadySentUserIds = new Set(existingNotifications.map(n => n.recipientUserId))
      
      const recipientsWithStatus = recipients.map(recipient => ({
        ...recipient,
        alreadySent: alreadySentUserIds.has(recipient.id)
      }))

      return {
        nextPhases,
        recipients: recipientsWithStatus,
        actorIncluded: recipients.some(r => r.id === actorUserId)
      }
      
    } catch (error) {
      console.error('Error getting next phase assignees:', error)
      return { nextPhases: [], recipients: [], actorIncluded: false }
    }
  }

  /**
   * Send notifications to selected recipients
   */
  async sendPhaseCompletionNotifications({
    stageId,
    recipientIds,
    actorUserId,
    customMessage
  }: {
    stageId: string
    recipientIds: string[]
    actorUserId: string
    customMessage?: string
  }): Promise<TeamNotificationResult> {
    
    const result: TeamNotificationResult = {
      success: true,
      sentCount: 0,
      skippedCount: 0,
      errors: [],
      results: []
    }

    try {
      // Get stage and project information
      const stage = await prisma.stage.findUnique({
        where: { id: stageId },
        include: {
          room: {
            include: {
              project: {
                include: {
                  client: true
                }
              },
              stages: {
                include: {
                  assignedUser: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true
                    }
                  }
                }
              }
            }
          },
          completedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      if (!stage) {
        result.success = false
        result.errors.push('Stage not found')
        return result
      }

      // Get recipients
      const recipients = await prisma.user.findMany({
        where: {
          id: { in: recipientIds }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      })

      // Get next phase info for email content
      const nextPhases = this.determineNextPhases(stage.type, stage.room.stages)

      // Send notification to each recipient
      for (const recipient of recipients) {
        try {
          // Check if already sent (idempotency)
          const existingNotification = await prisma.notificationSend.findUnique({
            where: {
              eventType_stageId_recipientUserId: {
                eventType: 'PHASE_COMPLETED',
                stageId: stageId,
                recipientUserId: recipient.id
              }
            }
          })

          if (existingNotification) {
            result.skippedCount++
            result.results.push({
              userId: recipient.id,
              status: 'skipped',
              reason: 'Already sent'
            })
            continue
          }

          // Generate email content
          const emailContent = this.generatePhaseNotificationEmail({
            recipient,
            stage,
            nextPhases,
            completedBy: stage.completedBy,
            project: stage.room.project,
            room: stage.room,
            customMessage
          })

          // Send email
          const emailResult = await sendEmail({
            to: recipient.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          })

          // Log the notification
          await prisma.notificationSend.create({
            data: {
              eventType: 'PHASE_COMPLETED',
              stageId: stageId,
              recipientUserId: recipient.id,
              actorUserId: actorUserId,
              messageId: emailResult.messageId,
              status: emailResult.success ? 'SENT' : 'ERROR',
              errorMessage: emailResult.error,
              customMessage: customMessage
            }
          })

          if (emailResult.success) {
            result.sentCount++
            result.results.push({
              userId: recipient.id,
              messageId: emailResult.messageId,
              status: 'sent'
            })
          } else {
            result.errors.push(`Failed to send to ${recipient.name}: ${emailResult.error}`)
            result.results.push({
              userId: recipient.id,
              status: 'error',
              reason: emailResult.error
            })
          }

        } catch (error) {
          const errorMsg = `Error sending to ${recipient.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          result.results.push({
            userId: recipient.id,
            status: 'error',
            reason: errorMsg
          })
        }
      }

      if (result.errors.length > 0) {
        result.success = false
      }

      return result

    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      return result
    }
  }

  /**
   * Determine which phases should be notified based on completed phase
   */
  private determineNextPhases(completedPhaseType: string, allStages: any[]): NextPhaseInfo[] {
    const phaseSequence = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    
    if (completedPhaseType === 'CLIENT_APPROVAL') {
      // Special case: Client approval enables both DRAWINGS and FFE
      const drawingsStage = allStages.find(s => s.type === 'DRAWINGS')
      const ffeStage = allStages.find(s => s.type === 'FFE')
      
      return [drawingsStage, ffeStage].filter(Boolean).map(stage => ({
        id: stage.id,
        name: getPhaseDisplayName(stage.type),
        type: stage.type,
        assignee: stage.assignedUser
      }))
    } else {
      // Regular linear sequence
      const currentIndex = phaseSequence.indexOf(completedPhaseType)
      if (currentIndex === -1 || currentIndex === phaseSequence.length - 1) {
        return [] // Unknown phase or last phase
      }

      const nextPhaseType = phaseSequence[currentIndex + 1]
      const nextStage = allStages.find(s => s.type === nextPhaseType)
      
      return nextStage ? [{
        id: nextStage.id,
        name: getPhaseDisplayName(nextStage.type),
        type: nextStage.type,
        assignee: nextStage.assignedUser
      }] : []
    }
  }

  /**
   * Collect unique recipients from next phases
   */
  private collectRecipients(nextPhases: NextPhaseInfo[], actorUserId: string): NotificationRecipient[] {
    const recipientsMap = new Map<string, NotificationRecipient>()
    
    for (const phase of nextPhases) {
      if (phase.assignee) {
        recipientsMap.set(phase.assignee.id, {
          id: phase.assignee.id,
          name: phase.assignee.name,
          email: phase.assignee.email,
          role: phase.assignee.role
        })
      }
    }
    
    return Array.from(recipientsMap.values())
  }

  /**
   * Generate email content for phase notification
   */
  private generatePhaseNotificationEmail({
    recipient,
    stage,
    nextPhases,
    completedBy,
    project,
    room,
    customMessage
  }: {
    recipient: NotificationRecipient
    stage: any
    nextPhases: NextPhaseInfo[]
    completedBy: any
    project: any
    room: any
    customMessage?: string
  }) {
    
    const completedPhaseName = getPhaseDisplayName(stage.type)
    const nextPhaseNames = nextPhases.map(p => p.name).join(' and ')
    const roomName = room.name || room.type.replace('_', ' ').toLowerCase()
    const actorName = completedBy?.name || 'Team member'
    
    const subject = `🚀 Next Step Ready: ${project.name} - ${nextPhaseNames}`
    
    // Generate project URL (adjust based on your routing)
    const projectUrl = `${getBaseUrl()}/projects/${project.id}`
    
    const html = this.generateEmailHTML({
      recipientName: recipient.name,
      actorName,
      completedPhaseName,
      nextPhaseNames,
      roomName,
      projectName: project.name,
      projectUrl,
      customMessage
    })

    const text = `Hi ${recipient.name},

${actorName} has completed the ${completedPhaseName} phase for ${roomName} in ${project.name}.

You're assigned to the next step: ${nextPhaseNames}.

${customMessage ? `\nPersonal message: ${customMessage}\n` : ''}

You can view the project here: ${projectUrl}

Best regards,
${actorName} and the team`

    return { subject, html, text }
  }

  /**
   * Generate HTML email template
   */
  private generateEmailHTML({
    recipientName,
    actorName,
    completedPhaseName,
    nextPhaseNames,
    roomName,
    projectName,
    projectUrl,
    customMessage
  }: {
    recipientName: string
    actorName: string
    completedPhaseName: string
    nextPhaseNames: string
    roomName: string
    projectName: string
    projectUrl: string
    customMessage?: string
  }) {
    const baseUrl = getBaseUrl()
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Next Phase Ready - ${projectName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 32px; text-align: center;">
            <img src="${baseUrl}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" 
                 draggable="false" 
                 ondragstart="return false;" 
                 oncontextmenu="return false;"/>
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">🚀 Next Phase Ready</h1>
            <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 16px; font-weight: 400;">${roomName} • ${projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${recipientName},</p>
            
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${actorName}</strong> has completed the <strong>${completedPhaseName}</strong> phase for ${roomName}.
            </p>
            
            <div style="background: #f0f9ff; border-left: 4px solid #059669; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">You're assigned to the next step:</p>
                <p style="margin: 8px 0 0 0; color: #059669; font-size: 18px; font-weight: 700;">${nextPhaseNames}</p>
            </div>
            
            ${customMessage ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">Personal Message:</p>
                <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6; font-style: italic;">"${customMessage}"</p>
            </div>
            ` : ''}
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${projectUrl}" 
                   style="background: #059669; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);"
                   target="_blank">Open Project</a>
            </div>
            
            <p style="margin: 32px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                If you have any questions about this phase, feel free to reach out to ${actorName} or the team.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
  }
}

// Export singleton instance
export const teamNotificationService = new TeamNotificationService()
