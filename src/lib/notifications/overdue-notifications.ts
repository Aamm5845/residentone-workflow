import { prisma } from '@/lib/prisma'
import { isPhaseOverdue, isPhaseDueSoon, getPhaseUrgency } from '@/lib/validation/due-date-validation'

export interface OverdueNotification {
  id: string
  type: 'overdue' | 'due_soon'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  stageId: string
  roomId: string
  projectId: string
  assignedUserId?: string
  dueDate: Date
  createdAt: Date
}

// Get all overdue and due soon phases for notifications
export async function getOverduePhases(orgId: string): Promise<OverdueNotification[]> {
  try {
    // Get all active stages with due dates
    const stages = await prisma.stage.findMany({
      where: {
        room: {
          project: { orgId }
        },
        status: { in: ['IN_PROGRESS', 'NEEDS_ATTENTION', 'PENDING_APPROVAL'] },
        dueDate: { not: null }
      },
      include: {
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            }
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    const notifications: OverdueNotification[] = []

    for (const stage of stages) {
      const isOverdue = isPhaseOverdue(stage.dueDate, stage.status)
      const isDueSoon = isPhaseDueSoon(stage.dueDate, stage.status, 3)
      
      if (isOverdue || isDueSoon) {
        const urgency = getPhaseUrgency(stage.dueDate, stage.status)
        const phaseName = stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
        const roomName = stage.room.name || stage.room.type.replace('_', ' ')
        
        let title: string
        let message: string
        
        if (isOverdue) {
          const daysOverdue = Math.floor((new Date().getTime() - new Date(stage.dueDate!).getTime()) / (1000 * 60 * 60 * 24))
          title = `🚨 ${phaseName} Phase Overdue`
          message = `${phaseName} phase for ${roomName} in ${stage.room.project.name} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`
        } else {
          const daysUntilDue = Math.ceil((new Date(stage.dueDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          title = `⏰ ${phaseName} Phase Due Soon`
          message = `${phaseName} phase for ${roomName} in ${stage.room.project.name} is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`
        }

        notifications.push({
          id: `${stage.id}-${isOverdue ? 'overdue' : 'due_soon'}`,
          type: isOverdue ? 'overdue' : 'due_soon',
          severity: urgency,
          title,
          message,
          stageId: stage.id,
          roomId: stage.roomId,
          projectId: stage.room.project.id,
          assignedUserId: stage.assignedTo || undefined,
          dueDate: stage.dueDate!,
          createdAt: new Date()
        })
      }
    }

    return notifications
  } catch (error) {
    console.error('Error getting overdue phases:', error)
    return []
  }
}

// Get user-specific overdue notifications
export async function getUserOverdueNotifications(userId: string, orgId: string): Promise<OverdueNotification[]> {
  try {
    const allNotifications = await getOverduePhases(orgId)
    
    // Filter for notifications assigned to this user
    return allNotifications.filter(notification => 
      notification.assignedUserId === userId
    )
  } catch (error) {
    console.error('Error getting user overdue notifications:', error)
    return []
  }
}

// Create in-app notifications for overdue phases
export async function createOverdueNotifications(orgId: string): Promise<void> {
  try {
    const notifications = await getOverduePhases(orgId)
    
    for (const notification of notifications) {
      if (notification.assignedUserId) {
        // Check if notification already exists to avoid duplicates
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: notification.assignedUserId,
            type: 'OVERDUE_TASK',
            stageId: notification.stageId,
            read: false
          }
        })

        if (!existingNotification) {
          await prisma.notification.create({
            data: {
              userId: notification.assignedUserId,
              type: 'OVERDUE_TASK',
              title: notification.title,
              message: notification.message,
              data: {
                stageId: notification.stageId,
                roomId: notification.roomId,
                projectId: notification.projectId,
                severity: notification.severity,
                dueDate: notification.dueDate.toISOString()
              },
              stageId: notification.stageId,
              read: false
            }
          })
        }
      }
    }
  } catch (error) {
    console.error('Error creating overdue notifications:', error)
    throw error
  }
}

// Send email notifications for critical overdue phases
export async function sendOverdueEmailNotifications(orgId: string): Promise<void> {
  try {
    const notifications = await getOverduePhases(orgId)
    const criticalNotifications = notifications.filter(n => n.severity === 'critical')
    
    // Group notifications by user
    const userNotifications = criticalNotifications.reduce((acc, notification) => {
      if (notification.assignedUserId) {
        if (!acc[notification.assignedUserId]) {
          acc[notification.assignedUserId] = []
        }
        acc[notification.assignedUserId].push(notification)
      }
      return acc
    }, {} as Record<string, OverdueNotification[]>)

    // Send emails to each user with their overdue tasks
    for (const [userId, userTasks] of Object.entries(userNotifications)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true }
      })

      if (user && userTasks.length > 0) {
        // Here you would integrate with your email service
        // For now, we'll just log the intention to send an email
        
        // Example email content
        const taskList = userTasks.map(task => `• ${task.title}`).join('\n')
        const emailContent = `
Dear ${user.name},

You have ${userTasks.length} critical overdue task${userTasks.length > 1 ? 's' : ''} that need immediate attention:

${taskList}

Please log into your dashboard to address these items as soon as possible.

Best regards,
ResidentOne Workflow Team
        `
        
        // TODO: Integrate with your email service here
        // await emailService.send({
        //   to: user.email,
        //   subject: `🚨 Critical Overdue Tasks - Action Required`,
        //   body: emailContent
        // })
      }
    }
  } catch (error) {
    console.error('Error sending overdue email notifications:', error)
    throw error
  }
}

// Summary statistics for overdue phases
export async function getOverdueStatistics(orgId: string) {
  try {
    const notifications = await getOverduePhases(orgId)
    
    const stats = {
      total: notifications.length,
      overdue: notifications.filter(n => n.type === 'overdue').length,
      dueSoon: notifications.filter(n => n.type === 'due_soon').length,
      critical: notifications.filter(n => n.severity === 'critical').length,
      high: notifications.filter(n => n.severity === 'high').length,
      medium: notifications.filter(n => n.severity === 'medium').length,
      low: notifications.filter(n => n.severity === 'low').length,
      byPhase: {} as Record<string, number>
    }
    
    // Count by phase type
    notifications.forEach(notification => {
      const stage = notification.stageId
      // Extract phase type from notification title or maintain it separately
      const phaseType = notification.title.split(' ')[1] // Basic extraction
      stats.byPhase[phaseType] = (stats.byPhase[phaseType] || 0) + 1
    })
    
    return stats
  } catch (error) {
    console.error('Error getting overdue statistics:', error)
    return null
  }
}
