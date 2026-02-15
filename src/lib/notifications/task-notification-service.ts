import { prisma } from '@/lib/prisma'
import type { NotificationType } from '@prisma/client'

export interface TaskNotificationResult {
  success: boolean
  notificationsSent: number
  errors: string[]
}

interface TaskInfo {
  id: string
  title: string
  projectId: string
  projectName?: string
}

interface UserInfo {
  id: string
  name: string | null
  email: string
}

/**
 * Service for handling task-related notifications.
 * Handles in-app notifications for task events like assignment,
 * comments, completion, and due date reminders.
 */
export class TaskNotificationService {

  /**
   * Notify a user when they are assigned a task
   */
  async notifyTaskAssigned(
    task: TaskInfo,
    assigneeId: string,
    assignedByUser: UserInfo
  ): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      errors: []
    }

    try {
      // Don't notify if assigning to yourself
      if (assigneeId === assignedByUser.id) {
        return result
      }

      await this.createInAppNotification(
        assigneeId,
        'TASK_ASSIGNED',
        'Task Assigned to You',
        `${assignedByUser.name || 'Someone'} assigned you a task: ${task.title}`,
        task.id,
        'task'
      )
      result.notificationsSent++

    } catch (error) {
      console.error('Error sending task assignment notification:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Notify relevant users when a comment is added to a task
   * Notifies: task assignee and task creator (excluding the comment author)
   */
  async notifyTaskComment(
    task: TaskInfo & { assignedToId?: string | null; createdById: string },
    commentAuthor: UserInfo,
    commentPreview: string
  ): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      errors: []
    }

    try {
      const usersToNotify = new Set<string>()

      // Notify task assignee
      if (task.assignedToId && task.assignedToId !== commentAuthor.id) {
        usersToNotify.add(task.assignedToId)
      }

      // Notify task creator
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
   * Notifies: task creator (if completer is assignee) or task assignee (if completer is creator)
   */
  async notifyTaskCompleted(
    task: TaskInfo & { assignedToId?: string | null; createdById: string },
    completedByUser: UserInfo
  ): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      errors: []
    }

    try {
      // Determine who to notify - notify the "other" person involved
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
   * This should be called by a cron job / scheduled function
   */
  async notifyTasksDueSoon(): Promise<TaskNotificationResult> {
    const result: TaskNotificationResult = {
      success: true,
      notificationsSent: 0,
      errors: []
    }

    try {
      const now = new Date()
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      // Find tasks that are:
      // - Due within the next 24 hours
      // - Not completed or cancelled
      // - Have an assignee
      const dueSoonTasks = await prisma.task.findMany({
        where: {
          dueDate: {
            gte: now,
            lte: in24Hours
          },
          status: {
            notIn: ['DONE', 'CANCELLED']
          },
          assignedToId: {
            not: null
          }
        },
        include: {
          project: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      })

      for (const task of dueSoonTasks) {
        if (!task.assignedTo || !task.dueDate) continue

        // Check if we already sent a due-soon notification for this task today
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: task.assignedTo.id,
            type: 'TASK_DUE_SOON',
            relatedId: task.id,
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Within last 24 hours
            }
          }
        })

        if (existingNotification) continue // Already notified

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
      errors: []
    }

    try {
      // Notify new assignee (unless they did the reassignment)
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
      }

      // Notify previous assignee that they've been unassigned (unless they did it)
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

  /**
   * Create an in-app notification
   */
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
}

// Export singleton instance
export const taskNotificationService = new TaskNotificationService()
