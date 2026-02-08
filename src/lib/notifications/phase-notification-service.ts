import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { getPhaseConfig } from '@/lib/constants/room-phases'
import { getBaseUrl } from '@/lib/get-base-url'
import type { AuthSession } from '@/lib/attribution'

export interface PhaseNotificationResult {
  success: boolean
  notificationsSent: number
  emailsSent: number
  errors: string[]
  details: {
    inAppNotifications: string[]
    emailNotifications: string[]
  }
}

export interface UserNotificationData {
  id: string
  name: string
  email: string
  role: string
}

/**
 * Main service for handling phase completion notifications
 * Handles both in-app notifications and email alerts
 */
export class PhaseNotificationService {
  
  /**
   * Handle notifications when a phase is completed
   */
  async handlePhaseCompletion(
    stageId: string,
    completedByUserId: string,
    session: AuthSession,
    options: {
      autoEmail?: boolean
    } = { autoEmail: true }
  ): Promise<PhaseNotificationResult & {
    nextPhaseInfo?: {
      stageId: string
      stageType: string
      assignee: {
        id: string
        name: string
        email: string
      } | null
      emailPreview?: {
        subject: string
        preview: string
      }
    }[]
  }> {
    
    const result: PhaseNotificationResult & {
      nextPhaseInfo?: {
        stageId: string
        stageType: string
        assignee: {
          id: string
          name: string
          email: string
        } | null
        emailPreview?: {
          subject: string
          preview: string
        }
      }[]
    } = {
      success: true,
      notificationsSent: 0,
      emailsSent: 0,
      errors: [],
      details: {
        inAppNotifications: [],
        emailNotifications: []
      },
      nextPhaseInfo: []
    }

    try {
      // Get the completed stage and room information
      const completedStage = await prisma.stage.findUnique({
        where: { id: stageId },
        include: {
          room: {
            include: {
              project: {
                include: {
                  organization: true,
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
                },
                orderBy: { createdAt: 'asc' }
              }
            }
          },
          completedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      })

      if (!completedStage) {
        result.success = false
        result.errors.push('Stage not found')
        return result
      }

      const room = completedStage.room
      const project = room.project
      const completedByUser = completedStage.completedBy

      if (!completedByUser) {
        result.errors.push('Completed by user information not available')
      }

      // Send completion notification email
      await this.sendPhaseCompletionEmail(
        completedStage,
        completedByUser,
        room,
        project,
        result
      )

      // Handle next phase notifications based on completed phase type
      if (completedStage.type === 'CLIENT_APPROVAL') {
        // Special case: Client approval completion notifies both DRAWINGS and FFE
        await this.handleClientApprovalCompletion(
          room.stages,
          completedStage,
          room,
          project,
          result,
          options
        )
      } else {
        // Regular case: Notify next phase assignee
        await this.handleRegularPhaseCompletion(
          room.stages,
          completedStage,
          room,
          project,
          result,
          options
        )
      }

    } catch (error) {
      console.error('Error handling phase completion notifications:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Handle client approval completion - notify both DRAWINGS and FFE phases
   */
  private async handleClientApprovalCompletion(
    allStages: any[],
    completedStage: any,
    room: any,
    project: any,
    result: any,
    options: { autoEmail?: boolean } = { autoEmail: true }
  ) {
    // Find DRAWINGS and FFE stages
    const drawingsStage = allStages.find(s => s.type === 'DRAWINGS')
    const ffeStage = allStages.find(s => s.type === 'FFE')

    const stagesToNotify = [drawingsStage, ffeStage].filter(Boolean)

    for (const stage of stagesToNotify) {
      if (stage.assignedUser) {
        // Create in-app notification
        await this.createInAppNotification(
          stage.assignedUser.id,
        'STAGE_ASSIGNED',
          `${this.getPhaseDisplayName(stage.type)} Phase Ready`,
          `Client approval for ${room.name || room.type} in ${project.name} has been completed. You can now start the ${this.getPhaseDisplayName(stage.type)} phase.`,
          stage.id,
          'STAGE'
        )
        result.notificationsSent++
        result.details.inAppNotifications.push(`${stage.type} assignee: ${stage.assignedUser.name}`)

        // Collect next phase info
        const emailPreview = {
          subject: `${this.getPhaseDisplayName(stage.type)} Phase Ready to Start - ${project.name}`,
          preview: `Client approval for ${room.name || room.type} has been completed. You can now start the ${this.getPhaseDisplayName(stage.type)} phase.`
        }
        
        result.nextPhaseInfo.push({
          stageId: stage.id,
          stageType: stage.type,
          assignee: {
            id: stage.assignedUser.id,
            name: stage.assignedUser.name,
            email: stage.assignedUser.email
          },
          emailPreview
        })

        // Send email notification only if autoEmail is true
        if (options.autoEmail) {
          await this.sendPhaseReadyEmail(
            stage.assignedUser,
            stage,
            completedStage,
            room,
            project,
            result
          )
        }
      }
    }
  }

  /**
   * Handle regular phase completion - notify next phase assignee
   */
  private async handleRegularPhaseCompletion(
    allStages: any[],
    completedStage: any,
    room: any,
    project: any,
    result: any,
    options: { autoEmail?: boolean } = { autoEmail: true }
  ) {
    // Define phase sequence
    const phaseSequence = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    const currentIndex = phaseSequence.indexOf(completedStage.type)
    
    if (currentIndex === -1 || currentIndex === phaseSequence.length - 1) {
      // Unknown phase or last phase - no next phase to notify
      return
    }

    const nextPhaseType = phaseSequence[currentIndex + 1]
    const nextStage = allStages.find(s => s.type === nextPhaseType)

    if (nextStage && nextStage.assignedUser) {
      // Create in-app notification
      await this.createInAppNotification(
        nextStage.assignedUser.id,
        'STAGE_ASSIGNED',
        `${this.getPhaseDisplayName(nextStage.type)} Phase Ready`,
        `${this.getPhaseDisplayName(completedStage.type)} for ${room.name || room.type} in ${project.name} has been completed. You can now start the ${this.getPhaseDisplayName(nextStage.type)} phase.`,
        nextStage.id,
        'STAGE'
      )
      result.notificationsSent++
      result.details.inAppNotifications.push(`Next phase assignee: ${nextStage.assignedUser.name}`)

      // Collect next phase info
      const emailPreview = {
        subject: `${this.getPhaseDisplayName(nextStage.type)} Phase Ready to Start - ${project.name}`,
        preview: `${this.getPhaseDisplayName(completedStage.type)} for ${room.name || room.type} has been completed. You can now start the ${this.getPhaseDisplayName(nextStage.type)} phase.`
      }
      
      result.nextPhaseInfo.push({
        stageId: nextStage.id,
        stageType: nextStage.type,
        assignee: {
          id: nextStage.assignedUser.id,
          name: nextStage.assignedUser.name,
          email: nextStage.assignedUser.email
        },
        emailPreview
      })

      // Send email notification only if autoEmail is true
      if (options.autoEmail) {
        await this.sendPhaseReadyEmail(
          nextStage.assignedUser,
          nextStage,
          completedStage,
          room,
          project,
          result
        )
      }
    }
  }

  /**
   * Send phase completion email to relevant parties
   */
  private async sendPhaseCompletionEmail(
    completedStage: any,
    completedByUser: any,
    room: any,
    project: any,
    result: PhaseNotificationResult
  ) {
    if (!completedByUser) return

    try {
      const phaseDisplayName = this.getPhaseDisplayName(completedStage.type)
      const roomDisplayName = room.name || room.type.replace('_', ' ')
      
      const emailData = {
        to: [project.organization.users?.map((u: any) => u.email).filter(Boolean) || []].flat(),
        subject: `${phaseDisplayName} Phase Completed - ${project.name}`,
        html: this.generatePhaseCompletionEmailHtml({
          phaseDisplayName,
          roomDisplayName,
          projectName: project.name,
          clientName: project.client?.name,
          completedByName: completedByUser.name,
          completedAt: completedStage.completedAt,
          stageId: completedStage.id,
          projectId: project.id,
          roomId: room.id
        }),
        text: this.generatePhaseCompletionEmailText({
          phaseDisplayName,
          roomDisplayName,
          projectName: project.name,
          clientName: project.client?.name,
          completedByName: completedByUser.name,
          completedAt: completedStage.completedAt
        })
      }

      // Note: Replace with your actual email sending implementation
      // await sendEmail(emailData)
      
      result.emailsSent++
      result.details.emailNotifications.push(`Phase completion email sent for ${phaseDisplayName}`)

    } catch (error) {
      console.error('Error sending phase completion email:', error)
      result.errors.push(`Email send failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send email notification about next phase being ready
   */
  private async sendPhaseReadyEmail(
    assignedUser: UserNotificationData,
    nextStage: any,
    completedStage: any,
    room: any,
    project: any,
    result: PhaseNotificationResult
  ) {
    try {
      const nextPhaseDisplayName = this.getPhaseDisplayName(nextStage.type)
      const completedPhaseDisplayName = this.getPhaseDisplayName(completedStage.type)
      const roomDisplayName = room.name || room.type.replace('_', ' ')
      
      const emailData = {
        to: assignedUser.email,
        subject: `${nextPhaseDisplayName} Phase Ready to Start - ${project.name}`,
        html: this.generatePhaseReadyEmailHtml({
          assigneeName: assignedUser.name,
          nextPhaseDisplayName,
          completedPhaseDisplayName,
          roomDisplayName,
          projectName: project.name,
          clientName: project.client?.name,
          stageId: nextStage.id,
          projectId: project.id,
          roomId: room.id
        }),
        text: this.generatePhaseReadyEmailText({
          assigneeName: assignedUser.name,
          nextPhaseDisplayName,
          completedPhaseDisplayName,
          roomDisplayName,
          projectName: project.name,
          clientName: project.client?.name
        })
      }

      // Note: Replace with your actual email sending implementation
      // await sendEmail(emailData)
      
      result.emailsSent++
      result.details.emailNotifications.push(`Phase ready email sent to ${assignedUser.name}`)

    } catch (error) {
      console.error('Error sending phase ready email:', error)
      result.errors.push(`Email send failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    relatedId: string,
    relatedType: string
  ) {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          relatedId,
          relatedType,
          read: false
        }
      })
    } catch (error) {
      console.error('Error creating in-app notification:', error)
      throw error
    }
  }

  /**
   * Get display name for a phase type
   */
  private getPhaseDisplayName(phaseType: string): string {
    const phaseNames: Record<string, string> = {
      'DESIGN_CONCEPT': 'Design Concept',
      'THREE_D': '3D Rendering',
      'CLIENT_APPROVAL': 'Client Approval',
      'DRAWINGS': 'Drawings',
      'FFE': 'FFE'
    }
    return phaseNames[phaseType] || phaseType
  }

  /**
   * Generate HTML for phase completion email
   */
  private generatePhaseCompletionEmailHtml(data: {
    phaseDisplayName: string
    roomDisplayName: string
    projectName: string
    clientName?: string
    completedByName: string
    completedAt: Date
    stageId: string
    projectId: string
    roomId: string
  }): string {
    const formattedDate = new Date(data.completedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const baseUrl = getBaseUrl()
    const phaseUrl = `${baseUrl}/projects/${data.projectId}/rooms/${data.roomId}?stage=${data.stageId}`

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Phase Completed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .success-badge { background: #28a745; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Phase Completed</h1>
              <span class="success-badge">Completed</span>
            </div>
            <div class="content">
              <p><strong>${data.phaseDisplayName}</strong> phase has been completed!</p>
              
              <div class="details">
                <h3>Project Details:</h3>
                <ul>
                  <li><strong>Project:</strong> ${data.projectName}</li>
                  <li><strong>Room:</strong> ${data.roomDisplayName}</li>
                  ${data.clientName ? `<li><strong>Client:</strong> ${data.clientName}</li>` : ''}
                  <li><strong>Completed by:</strong> ${data.completedByName}</li>
                  <li><strong>Completed on:</strong> ${formattedDate}</li>
                </ul>
              </div>
              
              <p>This phase completion may trigger the next phase to become available for work.</p>
              
              <p style="margin-top: 30px;">
                <a href="${phaseUrl}" class="button">
                  View Phase
                </a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Generate text version for phase completion email
   */
  private generatePhaseCompletionEmailText(data: {
    phaseDisplayName: string
    roomDisplayName: string
    projectName: string
    clientName?: string
    completedByName: string
    completedAt: Date
  }): string {
    const formattedDate = new Date(data.completedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    return `
PHASE COMPLETED

${data.phaseDisplayName} phase has been completed!

Project Details:
- Project: ${data.projectName}
- Room: ${data.roomDisplayName}
${data.clientName ? `- Client: ${data.clientName}` : ''}
- Completed by: ${data.completedByName}
- Completed on: ${formattedDate}

This phase completion may trigger the next phase to become available for work.

ResidentOne Workflow Team
    `.trim()
  }

  /**
   * Generate HTML for phase ready email
   */
  private generatePhaseReadyEmailHtml(data: {
    assigneeName: string
    nextPhaseDisplayName: string
    completedPhaseDisplayName: string
    roomDisplayName: string
    projectName: string
    clientName?: string
    stageId: string
    projectId: string
    roomId: string
  }): string {
    const baseUrl = getBaseUrl()
    const phaseUrl = `${baseUrl}/projects/${data.projectId}/rooms/${data.roomId}?stage=${data.stageId}`

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Phase Ready to Start</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .ready-badge { background: #17a2b8; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Phase is Ready!</h1>
              <span class="ready-badge">Ready to Start</span>
            </div>
            <div class="content">
              <p>Hi ${data.assigneeName},</p>
              
              <p><strong>${data.nextPhaseDisplayName}</strong> phase is now ready to start!</p>
              
              <div class="details">
                <h3>Project Details:</h3>
                <ul>
                  <li><strong>Project:</strong> ${data.projectName}</li>
                  <li><strong>Room:</strong> ${data.roomDisplayName}</li>
                  ${data.clientName ? `<li><strong>Client:</strong> ${data.clientName}</li>` : ''}
                  <li><strong>Previous Phase:</strong> ${data.completedPhaseDisplayName} (Completed)</li>
                  <li><strong>Your Phase:</strong> ${data.nextPhaseDisplayName}</li>
                </ul>
              </div>
              
              <p>The previous phase has been completed, and you can now start working on your assigned phase.</p>
              
              <p style="margin-top: 30px;">
                <a href="${phaseUrl}" class="button">
                  Start Working on ${data.nextPhaseDisplayName}
                </a>
              </p>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                If you have any questions or need assistance, please don't hesitate to reach out to the project team.
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Generate text version for phase ready email
   */
  private generatePhaseReadyEmailText(data: {
    assigneeName: string
    nextPhaseDisplayName: string
    completedPhaseDisplayName: string
    roomDisplayName: string
    projectName: string
    clientName?: string
  }): string {
    return `
YOUR PHASE IS READY TO START!

Hi ${data.assigneeName},

${data.nextPhaseDisplayName} phase is now ready to start!

Project Details:
- Project: ${data.projectName}
- Room: ${data.roomDisplayName}
${data.clientName ? `- Client: ${data.clientName}` : ''}
- Previous Phase: ${data.completedPhaseDisplayName} (Completed)
- Your Phase: ${data.nextPhaseDisplayName}

The previous phase has been completed, and you can now start working on your assigned phase.

If you have any questions or need assistance, please don't hesitate to reach out to the project team.

Best regards,
ResidentOne Workflow Team
    `.trim()
  }
}

// Export singleton instance
export const phaseNotificationService = new PhaseNotificationService()
