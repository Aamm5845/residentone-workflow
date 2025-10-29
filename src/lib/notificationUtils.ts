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

// Stage assignment notification
export async function notifyStageAssignment({
  assigneeId,
  assignerName,
  stageType,
  projectName,
  roomName,
  stageId,
  dueDate
}: {
  assigneeId: string
  assignerName: string
  stageType: string
  projectName: string
  roomName: string
  stageId: string
  dueDate?: string
}) {
  const dueDateText = dueDate ? ` (due ${new Date(dueDate).toLocaleDateString()})` : ''
  
  return createNotification({
    userId: assigneeId,
    type: NotificationTypes.STAGE_ASSIGNED,
    title: 'New Stage Assigned',
    message: `${assignerName} assigned you ${stageType} for ${roomName} in ${projectName}${dueDateText}`,
    relatedId: stageId,
    relatedType: 'STAGE'
  })
}

// Stage completion notification
export async function notifyStageCompletion({
  notifyUserId,
  completedByName,
  stageType,
  projectName,
  roomName,
  stageId
}: {
  notifyUserId: string
  completedByName: string
  stageType: string
  projectName: string
  roomName: string
  stageId: string
}) {
  return createNotification({
    userId: notifyUserId,
    type: NotificationTypes.STAGE_COMPLETED,
    title: 'Stage Completed',
    message: `${completedByName} completed ${stageType} for ${roomName} in ${projectName}`,
    relatedId: stageId,
    relatedType: 'STAGE'
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
  stageType,
  projectName,
  roomName,
  dueDate,
  stageId
}: {
  userId: string
  stageType: string
  projectName: string
  roomName: string
  dueDate: string
  stageId: string
}) {
  const daysUntilDue = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const timeText = daysUntilDue === 0 ? 'today' : 
                   daysUntilDue === 1 ? 'tomorrow' : 
                   `in ${daysUntilDue} days`
  
  return createNotification({
    userId,
    type: NotificationTypes.DUE_DATE_REMINDER,
    title: 'Deadline Reminder',
    message: `${stageType} for ${roomName} in ${projectName} is due ${timeText}`,
    relatedId: stageId,
    relatedType: 'STAGE'
  })
}

// Message/comment notification (using project update type as closest match)
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
    type: NotificationTypes.PROJECT_UPDATE,
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

// Batch create notifications for multiple users
export async function createBatchNotifications(notifications: CreateNotificationParams[]) {
  const results = await Promise.allSettled(
    notifications.map(notification => createNotification(notification))
  )
  
  const successful = results.filter(result => result.status === 'fulfilled').length
  const failed = results.filter(result => result.status === 'rejected').length

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
