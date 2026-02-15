import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { getBaseUrl } from '@/lib/get-base-url'
import type { NotificationType } from '@prisma/client'

export interface TaskNotificationResult {
  success: boolean
  notificationsSent: number
  emailsSent: number
  errors: string[]
}

interface TaskInfo {
  id: string
  title: string
  projectId: string
  projectName?: string
  startDate?: string | null
  dueDate?: string | null
  priority?: string
  description?: string
}

interface UserInfo {
  id: string
  name: string | null
  email: string
}

/**
 * Service for handling task-related notifications.
 * Handles in-app notifications AND email for task events like assignment,
 * comments, completion, and overdue reminders.
 */
export class TaskNotificationService {

  /**
   * Notify a user when they are assigned a task (in-app + email)
   */
  async notifyTaskAssigned(
    task: TaskInfo,
    assigneeId: string,
    assignedByUser: UserInfo
  ): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      emailsSent: 0,
      errors: []
    }

    try {
      // Don't notify if assigning to yourself
      if (assigneeId === assignedByUser.id) {
        return result
      }

      // Create in-app notification
      await this.createInAppNotification(
        assigneeId,
        'TASK_ASSIGNED',
        'Task Assigned to You',
        `${assignedByUser.name || 'Someone'} assigned you a task: ${task.title}`,
        task.id,
        'task'
      )
      result.notificationsSent++

      // Look up the assignee's email
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, name: true, email: true }
      })

      if (assignee?.email) {
        // Send email notification
        const emailResult = await sendEmail({
          to: assignee.email,
          subject: `New Task: ${task.title} - ${task.projectName || 'Project'}`,
          html: this.generateAssignmentEmailHtml({
            assigneeName: assignee.name || assignee.email,
            taskTitle: task.title,
            taskDescription: task.description,
            projectName: task.projectName || 'Unknown Project',
            assignedByName: assignedByUser.name || 'A team member',
            priority: task.priority,
            startDate: task.startDate,
            dueDate: task.dueDate,
            taskId: task.id,
            projectId: task.projectId,
          }),
          text: this.generateAssignmentEmailText({
            assigneeName: assignee.name || assignee.email,
            taskTitle: task.title,
            taskDescription: task.description,
            projectName: task.projectName || 'Unknown Project',
            assignedByName: assignedByUser.name || 'A team member',
            priority: task.priority,
            startDate: task.startDate,
            dueDate: task.dueDate,
          }),
        })

        if (emailResult.success) {
          result.emailsSent++
        } else {
          result.errors.push(`Email failed: ${emailResult.error}`)
        }
      }

    } catch (error) {
      console.error('Error sending task assignment notification:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Notify relevant users when a comment is added to a task
   */
  async notifyTaskComment(
    task: TaskInfo & { assignedToId?: string | null; createdById: string },
    commentAuthor: UserInfo,
    commentPreview: string
  ): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      emailsSent: 0,
      errors: []
    }

    try {
      const usersToNotify = new Set<string>()

      if (task.assignedToId && task.assignedToId !== commentAuthor.id) {
        usersToNotify.add(task.assignedToId)
      }
      if (task.createdById !== commentAuthor.id) {
        usersToNotify.add(task.createdById)
      }

      const truncatedPreview = commentPreview.length > 100
        ? commentPreview.substring(0, 100) + '...'
        : commentPreview

      for (const userId of usersToNotify) {
        await this.createInAppNotification(
          userId,
          'TASK_COMMENT',
          'New Comment on Task',
          `${commentAuthor.name || 'Someone'} commented on "${task.title}": ${truncatedPreview}`,
          task.id,
          'task'
        )
        result.notificationsSent++
      }

    } catch (error) {
      console.error('Error sending task comment notification:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Notify relevant users when a task is marked as completed
   */
  async notifyTaskCompleted(
    task: TaskInfo & { assignedToId?: string | null; createdById: string },
    completedByUser: UserInfo
  ): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      emailsSent: 0,
      errors: []
    }

    try {
      const notifyUserId = task.createdById !== completedByUser.id
        ? task.createdById
        : task.assignedToId !== completedByUser.id
          ? task.assignedToId
          : null

      if (notifyUserId) {
        await this.createInAppNotification(
          notifyUserId,
          'TASK_COMPLETED',
          'Task Completed',
          `${completedByUser.name || 'Someone'} completed: ${task.title}`,
          task.id,
          'task'
        )
        result.notificationsSent++
      }

    } catch (error) {
      console.error('Error sending task completion notification:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Check for tasks due within 24 hours and notify assignees
   */
  async notifyTasksDueSoon(): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      emailsSent: 0,
      errors: []
    }

    try {
      const now = new Date()
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      const dueSoonTasks = await prisma.task.findMany({
        where: {
          dueDate: { gte: now, lte: in24Hours },
          status: { notIn: ['DONE', 'CANCELLED'] },
          assignedToId: { not: null }
        },
        include: {
          project: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      })

      for (const task of dueSoonTasks) {
        if (!task.assignedTo || !task.dueDate) continue

        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: task.assignedTo.id,
            type: 'TASK_DUE_SOON',
            relatedId: task.id,
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
          }
        })

        if (existingNotification) continue

        const hoursUntilDue = Math.round(
          (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        )

        const timeMessage = hoursUntilDue <= 1
          ? 'due in less than an hour'
          : `due in ${hoursUntilDue} hours`

        await this.createInAppNotification(
          task.assignedTo.id,
          'TASK_DUE_SOON',
          'Task Due Soon',
          `"${task.title}" in ${task.project.name} is ${timeMessage}`,
          task.id,
          'task'
        )
        result.notificationsSent++
      }

    } catch (error) {
      console.error('Error checking for due-soon tasks:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Send email reminders for tasks not completed after 3 days past due date.
   * Should be called by a daily cron job.
   */
  async sendOverdueTaskReminders(): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      emailsSent: 0,
      errors: []
    }

    try {
      const now = new Date()
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

      // Find tasks that:
      // - Have a due date that is at least 3 days in the past
      // - Are not completed or cancelled
      // - Have an assignee with an email
      const overdueTasks = await prisma.task.findMany({
        where: {
          dueDate: { lte: threeDaysAgo },
          status: { notIn: ['DONE', 'CANCELLED'] },
          assignedToId: { not: null }
        },
        include: {
          project: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      })

      for (const task of overdueTasks) {
        if (!task.assignedTo?.email || !task.dueDate) continue

        // Check if we already sent an overdue reminder for this task in the last 3 days
        // (so we don't spam — one reminder every 3 days)
        const existingReminder = await prisma.notification.findFirst({
          where: {
            userId: task.assignedTo.id,
            type: 'TASK_DUE_SOON',
            relatedId: task.id,
            title: 'Task Overdue Reminder',
            createdAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) }
          }
        })

        if (existingReminder) continue

        const daysOverdue = Math.floor(
          (now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Create in-app notification
        await this.createInAppNotification(
          task.assignedTo.id,
          'TASK_DUE_SOON',
          'Task Overdue Reminder',
          `"${task.title}" in ${task.project.name} is ${daysOverdue} days overdue`,
          task.id,
          'task'
        )
        result.notificationsSent++

        // Send email reminder
        const emailResult = await sendEmail({
          to: task.assignedTo.email,
          subject: `Overdue Task: ${task.title} (${daysOverdue} days overdue)`,
          html: this.generateOverdueEmailHtml({
            assigneeName: task.assignedTo.name || task.assignedTo.email,
            taskTitle: task.title,
            projectName: task.project.name,
            dueDate: task.dueDate.toISOString(),
            daysOverdue,
            taskId: task.id,
            projectId: task.projectId,
          }),
          text: this.generateOverdueEmailText({
            assigneeName: task.assignedTo.name || task.assignedTo.email,
            taskTitle: task.title,
            projectName: task.project.name,
            dueDate: task.dueDate.toISOString(),
            daysOverdue,
          }),
        })

        if (emailResult.success) {
          result.emailsSent++
        } else {
          result.errors.push(`Overdue email failed for task ${task.id}: ${emailResult.error}`)
        }
      }

    } catch (error) {
      console.error('Error sending overdue task reminders:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Notify when a task is reassigned from one user to another
   */
  async notifyTaskReassigned(
    task: TaskInfo,
    newAssigneeId: string,
    previousAssigneeId: string | null,
    reassignedByUser: UserInfo
  ): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      emailsSent: 0,
      errors: []
    }

    try {
      if (newAssigneeId !== reassignedByUser.id) {
        await this.createInAppNotification(
          newAssigneeId,
          'TASK_ASSIGNED',
          'Task Assigned to You',
          `${reassignedByUser.name || 'Someone'} assigned you a task: ${task.title}`,
          task.id,
          'task'
        )
        result.notificationsSent++

        // Send email to new assignee
        const assignee = await prisma.user.findUnique({
          where: { id: newAssigneeId },
          select: { id: true, name: true, email: true }
        })

        if (assignee?.email) {
          const emailResult = await sendEmail({
            to: assignee.email,
            subject: `New Task: ${task.title} - ${task.projectName || 'Project'}`,
            html: this.generateAssignmentEmailHtml({
              assigneeName: assignee.name || assignee.email,
              taskTitle: task.title,
              taskDescription: task.description,
              projectName: task.projectName || 'Unknown Project',
              assignedByName: reassignedByUser.name || 'A team member',
              priority: task.priority,
              startDate: task.startDate,
              dueDate: task.dueDate,
              taskId: task.id,
              projectId: task.projectId,
            }),
            text: this.generateAssignmentEmailText({
              assigneeName: assignee.name || assignee.email,
              taskTitle: task.title,
              taskDescription: task.description,
              projectName: task.projectName || 'Unknown Project',
              assignedByName: reassignedByUser.name || 'A team member',
              priority: task.priority,
              startDate: task.startDate,
              dueDate: task.dueDate,
            }),
          })

          if (emailResult.success) result.emailsSent++
        }
      }

      if (previousAssigneeId && previousAssigneeId !== reassignedByUser.id && previousAssigneeId !== newAssigneeId) {
        await this.createInAppNotification(
          previousAssigneeId,
          'TASK_ASSIGNED',
          'Task Reassigned',
          `${reassignedByUser.name || 'Someone'} reassigned the task "${task.title}" to another team member`,
          task.id,
          'task'
        )
        result.notificationsSent++
      }

    } catch (error) {
      console.error('Error sending task reassignment notification:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async createInAppNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedId: string,
    relatedType: string
  ) {
    try {
      await prisma.notification.create({
        data: { userId, type, title, message, relatedId, relatedType, read: false }
      })
    } catch (error) {
      console.error('Error creating in-app notification:', error)
      throw error
    }
  }

  private formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  private getPriorityLabel(priority: string | undefined): string {
    const map: Record<string, string> = {
      URGENT: 'Urgent',
      HIGH: 'High',
      MEDIUM: 'Medium',
      LOW: 'Low',
      NORMAL: 'Normal',
    }
    return map[priority || ''] || priority || 'Medium'
  }

  private getPriorityColor(priority: string | undefined): string {
    const map: Record<string, string> = {
      URGENT: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#ca8a04',
      LOW: '#16a34a',
      NORMAL: '#6b7280',
    }
    return map[priority || ''] || '#ca8a04'
  }

  // ── Email templates ──────────────────────────────────────────────────

  private generateAssignmentEmailHtml(data: {
    assigneeName: string
    taskTitle: string
    taskDescription?: string
    projectName: string
    assignedByName: string
    priority?: string
    startDate?: string | null
    dueDate?: string | null
    taskId: string
    projectId: string
  }): string {
    const baseUrl = getBaseUrl()
    const taskUrl = `${baseUrl}/tasks`
    const priorityLabel = this.getPriorityLabel(data.priority)
    const priorityColor = this.getPriorityColor(data.priority)

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Task Assigned</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); color: white; padding: 24px 28px; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600;">New Task Assigned</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">${data.projectName}</p>
    </div>
    <div style="background: white; padding: 28px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <p style="margin: 0 0 16px 0; font-size: 15px;">Hi ${data.assigneeName},</p>
      <p style="margin: 0 0 20px 0; font-size: 15px;"><strong>${data.assignedByName}</strong> assigned you a new task:</p>

      <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #111;">${data.taskTitle}</h2>
        ${data.taskDescription ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #555;">${data.taskDescription}</p>` : ''}
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #888; width: 100px;">Priority</td>
            <td style="padding: 6px 0;"><span style="color: ${priorityColor}; font-weight: 600;">${priorityLabel}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Start Date</td>
            <td style="padding: 6px 0; font-weight: 500;">${this.formatDate(data.startDate)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Due Date</td>
            <td style="padding: 6px 0; font-weight: 500;">${this.formatDate(data.dueDate)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Project</td>
            <td style="padding: 6px 0;">${data.projectName}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 24px 0 8px 0;">
        <a href="${taskUrl}" style="display: inline-block; background: #f43f5e; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">View My Tasks</a>
      </div>

      <p style="margin: 24px 0 0 0; font-size: 12px; color: #999; text-align: center;">
        StudioFlow by Meisner Interiors
      </p>
    </div>
  </div>
</body>
</html>`
  }

  private generateAssignmentEmailText(data: {
    assigneeName: string
    taskTitle: string
    taskDescription?: string
    projectName: string
    assignedByName: string
    priority?: string
    startDate?: string | null
    dueDate?: string | null
  }): string {
    return `NEW TASK ASSIGNED

Hi ${data.assigneeName},

${data.assignedByName} assigned you a new task:

Task: ${data.taskTitle}
${data.taskDescription ? `Description: ${data.taskDescription}\n` : ''}Priority: ${this.getPriorityLabel(data.priority)}
Start Date: ${this.formatDate(data.startDate)}
Due Date: ${this.formatDate(data.dueDate)}
Project: ${data.projectName}

Log in to StudioFlow to view your tasks.

- StudioFlow by Meisner Interiors`.trim()
  }

  private generateOverdueEmailHtml(data: {
    assigneeName: string
    taskTitle: string
    projectName: string
    dueDate: string
    daysOverdue: number
    taskId: string
    projectId: string
  }): string {
    const baseUrl = getBaseUrl()
    const taskUrl = `${baseUrl}/tasks`

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Task Overdue Reminder</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 24px 28px; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600;">Task Overdue Reminder</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">${data.daysOverdue} days past due date</p>
    </div>
    <div style="background: white; padding: 28px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <p style="margin: 0 0 16px 0; font-size: 15px;">Hi ${data.assigneeName},</p>
      <p style="margin: 0 0 20px 0; font-size: 15px;">This is a reminder that the following task is <strong style="color: #dc2626;">${data.daysOverdue} days overdue</strong>:</p>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #111;">${data.taskTitle}</h2>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #888; width: 100px;">Due Date</td>
            <td style="padding: 6px 0; font-weight: 500; color: #dc2626;">${this.formatDate(data.dueDate)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Project</td>
            <td style="padding: 6px 0;">${data.projectName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #888;">Status</td>
            <td style="padding: 6px 0; color: #dc2626; font-weight: 600;">${data.daysOverdue} days overdue</td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 20px 0; font-size: 14px; color: #555;">
        Please complete this task or update its status as soon as possible.
      </p>

      <div style="text-align: center; margin: 24px 0 8px 0;">
        <a href="${taskUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">View My Tasks</a>
      </div>

      <p style="margin: 24px 0 0 0; font-size: 12px; color: #999; text-align: center;">
        StudioFlow by Meisner Interiors
      </p>
    </div>
  </div>
</body>
</html>`
  }

  private generateOverdueEmailText(data: {
    assigneeName: string
    taskTitle: string
    projectName: string
    dueDate: string
    daysOverdue: number
  }): string {
    return `TASK OVERDUE REMINDER

Hi ${data.assigneeName},

This is a reminder that the following task is ${data.daysOverdue} days overdue:

Task: ${data.taskTitle}
Due Date: ${this.formatDate(data.dueDate)}
Project: ${data.projectName}
Status: ${data.daysOverdue} days overdue

Please complete this task or update its status as soon as possible.

Log in to StudioFlow to view your tasks.

- StudioFlow by Meisner Interiors`.trim()
  }
}

// Export singleton instance
export const taskNotificationService = new TaskNotificationService()
