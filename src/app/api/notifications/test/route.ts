import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { 
  notifyStageAssignment,
  notifyStageCompletion,
  notifyProjectUpdate,
  notifyDeadlineReminder,
  notifyMessage,
  notifyMention
} from '@/lib/notificationUtils'

// POST - Create test notifications for development
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type } = await request.json()

    const testNotifications: Record<string, () => Promise<any>> = {
      stage_assignment: () => notifyStageAssignment({
        assigneeId: session.user.id,
        assignerName: 'Test Manager',
        stageType: 'Design Concept',
        projectName: 'Luxury Penthouse Redesign',
        roomName: 'Master Bedroom',
        stageId: 'test-stage-123',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }),
      
      stage_completion: () => notifyStageCompletion({
        notifyUserId: session.user.id,
        completedByName: 'Jane Designer',
        stageType: 'Design Phase',
        projectName: 'Downtown Loft Project', 
        roomName: 'Living Room',
        stageId: 'test-stage-456'
      }),
      
      project_update: () => notifyProjectUpdate({
        userId: session.user.id,
        updatedByName: 'Project Manager',
        projectName: 'Modern Office Space',
        updateType: 'updated the timeline',
        projectId: 'test-project-789'
      }),
      
      deadline_reminder: () => notifyDeadlineReminder({
        userId: session.user.id,
        stageType: 'Final Presentation',
        projectName: 'Executive Conference Room',
        roomName: 'Main Conference Room',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        stageId: 'test-stage-999'
      }),
      
      message: () => notifyMessage({
        userId: session.user.id,
        senderName: 'Client Sarah',
        messagePreview: 'Love the new color scheme! Can we adjust the lighting?',
        contextTitle: 'Master Bedroom Design',
        relatedId: 'test-room-abc',
        relatedType: 'ROOM'
      }),
      
      mention: () => notifyMention({
        userId: session.user.id,
        mentionedByName: 'Team Member',
        messagePreview: 'Hey @' + (session.user.name || 'User') + ', can you review this design?',
        contextTitle: 'Design Review',
        relatedId: 'test-stage-mention',
        relatedType: 'STAGE'
      })
    }

    if (!type || !testNotifications[type]) {
      return NextResponse.json({ 
        error: 'Invalid notification type',
        availableTypes: Object.keys(testNotifications)
      }, { status: 400 })
    }

    await testNotifications[type]()

    return NextResponse.json({
      success: true,
      message: `Test ${type} notification created`,
      type
    })

  } catch (error) {
    console.error('Error creating test notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}