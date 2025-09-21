import { NotificationTypes } from '@/hooks/useNotifications'

interface CreateNotificationParams {
  userId: string
  type: string
  title: string
  message: string
  relatedId?: string
  relatedType?: string
}

// Helper function to create notifications via API
export async function createNotification(params: CreateNotificationParams) {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create notification')
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

// Task assignment notification
export async function notifyTaskAssignment({
  assigneeId,
  assignerName,
  taskTitle,
  projectName,
  taskId,
  dueDate
}: {
  assigneeId: string
  assignerName: string
  taskTitle: string
  projectName: string
  taskId: string
  dueDate?: string
}) {
  const dueDateText = dueDate ? ` (due ${new Date(dueDate).toLocaleDateString()})` : ''
  
  return createNotification({
    userId: assigneeId,
    type: NotificationTypes.TASK_ASSIGNMENT,
    title: 'New Task Assigned',
    message: `${assignerName} assigned you "${taskTitle}" in ${projectName}${dueDateText}`,
    relatedId: taskId,
    relatedType: 'TASK'
  })
}

// Task completion notification (notify project manager/client)
export async function notifyTaskCompletion({
  notifyUserId,
  completedByName,
  taskTitle,
  projectName,
  taskId
}: {
  notifyUserId: string
  completedByName: string
  taskTitle: string
  projectName: string
  taskId: string
}) {
  return createNotification({
    userId: notifyUserId,
    type: NotificationTypes.TASK_COMPLETION,
    title: 'Task Completed',
    message: `${completedByName} completed "${taskTitle}" in ${projectName}`,
    relatedId: taskId,
    relatedType: 'TASK'
  })
}

// Project update notification
export async function notifyProjectUpdate({
  userId,
  updatedByName,
  projectName,
  updateType,
  projectId
}: {
  userId: string
  updatedByName: string
  projectName: string
  updateType: string
  projectId: string
}) {
  return createNotification({
    userId,
    type: NotificationTypes.PROJECT_UPDATE,
    title: 'Project Updated',
    message: `${updatedByName} ${updateType} in ${projectName}`,
    relatedId: projectId,
    relatedType: 'PROJECT'
  })
}

// Deadline reminder notification
export async function notifyDeadlineReminder({
  userId,
  taskTitle,
  projectName,
  dueDate,
  taskId
}: {
  userId: string
  taskTitle: string
  projectName: string
  dueDate: string
  taskId: string
}) {
  const daysUntilDue = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const timeText = daysUntilDue === 0 ? 'today' : 
                   daysUntilDue === 1 ? 'tomorrow' : 
                   `in ${daysUntilDue} days`
  
  return createNotification({
    userId,
    type: NotificationTypes.DEADLINE_REMINDER,
    title: 'Deadline Reminder',
    message: `"${taskTitle}" in ${projectName} is due ${timeText}`,
    relatedId: taskId,
    relatedType: 'TASK'
  })
}

// Message/comment notification
export async function notifyMessage({
  userId,
  senderName,
  messagePreview,
  contextTitle,
  relatedId,
  relatedType
}: {
  userId: string
  senderName: string
  messagePreview: string
  contextTitle: string
  relatedId: string
  relatedType: string
}) {
  return createNotification({
    userId,
    type: NotificationTypes.MESSAGE,
    title: 'New Message',
    message: `${senderName} commented in ${contextTitle}: "${messagePreview}"`,
    relatedId,
    relatedType
  })
}

// Mention notification
export async function notifyMention({
  userId,
  mentionedByName,
  messagePreview,
  contextTitle,
  relatedId,
  relatedType
}: {
  userId: string
  mentionedByName: string
  messagePreview: string
  contextTitle: string
  relatedId: string
  relatedType: string
}) {
  return createNotification({
    userId,
    type: NotificationTypes.MENTION,
    title: 'You were mentioned',
    message: `${mentionedByName} mentioned you in ${contextTitle}: "${messagePreview}"`,
    relatedId,
    relatedType
  })
}

// Approval request notification
export async function notifyApprovalRequest({
  approverId,
  requesterName,
  itemTitle,
  itemType,
  relatedId
}: {
  approverId: string
  requesterName: string
  itemTitle: string
  itemType: string
  relatedId: string
}) {
  return createNotification({
    userId: approverId,
    type: NotificationTypes.APPROVAL_REQUEST,
    title: 'Approval Requested',
    message: `${requesterName} requested approval for ${itemType}: "${itemTitle}"`,
    relatedId,
    relatedType: itemType.toUpperCase()
  })
}

// Approval response notification
export async function notifyApprovalResponse({
  requesterId,
  approverName,
  itemTitle,
  approved,
  relatedId,
  relatedType
}: {
  requesterId: string
  approverName: string
  itemTitle: string
  approved: boolean
  relatedId: string
  relatedType: string
}) {
  const action = approved ? 'approved' : 'rejected'
  
  return createNotification({
    userId: requesterId,
    type: NotificationTypes.APPROVAL_RESPONSE,
    title: `Request ${approved ? 'Approved' : 'Rejected'}`,
    message: `${approverName} ${action} "${itemTitle}"`,
    relatedId,
    relatedType
  })
}

// Batch create notifications for multiple users
export async function createBatchNotifications(notifications: CreateNotificationParams[]) {
  const results = await Promise.allSettled(
    notifications.map(notification => createNotification(notification))
  )
  
  const successful = results.filter(result => result.status === 'fulfilled').length
  const failed = results.filter(result => result.status === 'rejected').length
  
  console.log(`Notifications created: ${successful} successful, ${failed} failed`)
  
  return {
    successful,
    failed,
    results
  }
}

// Helper to notify all project team members
export async function notifyProjectTeam({
  projectId,
  excludeUserId,
  title,
  message,
  type = NotificationTypes.PROJECT_UPDATE
}: {
  projectId: string
  excludeUserId?: string
  title: string
  message: string
  type?: string
}) {
  try {
    // This would typically fetch project team members from the database
    // For now, we'll return a placeholder
    console.log('Would notify project team for project:', projectId)
    
    // In a real implementation, you'd:
    // 1. Fetch all team members for the project
    // 2. Filter out the excludeUserId if provided
    // 3. Create notifications for all remaining team members
    
    return { success: true, message: 'Team notifications queued' }
  } catch (error) {
    console.error('Error notifying project team:', error)
    throw error
  }
}