import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { NextApiRequest } from 'next'
import { getSession } from '@/auth'

// Types for real-time events
export interface ProjectUpdateEvent {
  type: 'PROJECT_UPDATE_CREATED' | 'PROJECT_UPDATE_UPDATED' | 'PROJECT_UPDATE_DELETED'
  projectId: string
  updateId: string
  update?: any
  userId: string
  userName: string
  timestamp: string
}

export interface TaskEvent {
  type: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'TASK_ASSIGNED' | 'TASK_COMPLETED'
  projectId: string
  taskId: string
  task?: any
  userId: string
  userName: string
  timestamp: string
}

export interface PhotoEvent {
  type: 'PHOTO_UPLOADED' | 'PHOTO_UPDATED' | 'PHOTO_DELETED'
  projectId: string
  updateId: string
  photoId: string
  photo?: any
  userId: string
  userName: string
  timestamp: string
}

export interface MessageEvent {
  type: 'MESSAGE_SENT' | 'MESSAGE_UPDATED' | 'MESSAGE_DELETED'
  projectId: string
  updateId?: string
  taskId?: string
  messageId: string
  message?: any
  userId: string
  userName: string
  timestamp: string
}

export interface UserPresenceEvent {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_TYPING' | 'USER_IDLE'
  projectId: string
  userId: string
  userName: string
  timestamp: string
}

export interface NotificationEvent {
  type: 'NOTIFICATION_SENT'
  userId: string
  notification: {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    relatedId?: string
    relatedType?: string
    actionUrl?: string
  }
  timestamp: string
}

export type RealTimeEvent = 
  | ProjectUpdateEvent 
  | TaskEvent 
  | PhotoEvent 
  | MessageEvent 
  | UserPresenceEvent
  | NotificationEvent

// Real-time service class
export class RealTimeService {
  private io: SocketIOServer | null = null
  private httpServer: HTTPServer | null = null
  private userConnections: Map<string, Set<string>> = new Map() // userId -> Set of socketIds
  private projectRooms: Map<string, Set<string>> = new Map() // projectId -> Set of userIds

  initialize(httpServer: HTTPServer) {
    this.httpServer = httpServer
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    })

    this.setupEventHandlers()
    console.log('🚀 Real-time service initialized')
  }

  private setupEventHandlers() {
    if (!this.io) return

    this.io.on('connection', async (socket) => {
      console.log(`Socket connected: ${socket.id}`)
      
      try {
        // Authenticate user
        const session = await this.authenticateSocket(socket)
        if (!session?.user) {
          socket.emit('error', { message: 'Authentication required' })
          socket.disconnect()
          return
        }

        const userId = session.user.id
        const userName = session.user.name || session.user.email

        // Track user connection
        if (!this.userConnections.has(userId)) {
          this.userConnections.set(userId, new Set())
        }
        this.userConnections.get(userId)!.add(socket.id)

        // Store user info in socket
        socket.data.userId = userId
        socket.data.userName = userName
        socket.data.userEmail = session.user.email

        // Handle project room joining
        socket.on('join-project', async (projectId: string) => {
          try {
            // Verify user has access to project
            const hasAccess = await this.verifyProjectAccess(userId, projectId)
            if (!hasAccess) {
              socket.emit('error', { message: 'Access denied to project' })
              return
            }

            // Join project room
            socket.join(`project:${projectId}`)
            
            // Track project room membership
            if (!this.projectRooms.has(projectId)) {
              this.projectRooms.set(projectId, new Set())
            }
            this.projectRooms.get(projectId)!.add(userId)

            // Notify others in project
            socket.to(`project:${projectId}`).emit('user-presence', {
              type: 'USER_JOINED',
              projectId,
              userId,
              userName,
              timestamp: new Date().toISOString()
            } as UserPresenceEvent)

            socket.emit('joined-project', { projectId })
            console.log(`User ${userName} joined project ${projectId}`)
          } catch (error) {
            console.error('Error joining project:', error)
            socket.emit('error', { message: 'Failed to join project' })
          }
        })

        // Handle project room leaving
        socket.on('leave-project', (projectId: string) => {
          socket.leave(`project:${projectId}`)
          
          // Remove from project room tracking
          if (this.projectRooms.has(projectId)) {
            this.projectRooms.get(projectId)!.delete(userId)
          }

          // Notify others in project
          socket.to(`project:${projectId}`).emit('user-presence', {
            type: 'USER_LEFT',
            projectId,
            userId,
            userName,
            timestamp: new Date().toISOString()
          } as UserPresenceEvent)

          console.log(`User ${userName} left project ${projectId}`)
        })

        // Handle typing indicators
        socket.on('user-typing', (data: { projectId: string; updateId?: string; taskId?: string }) => {
          socket.to(`project:${data.projectId}`).emit('user-presence', {
            type: 'USER_TYPING',
            projectId: data.projectId,
            userId,
            userName,
            timestamp: new Date().toISOString(),
            ...data
          } as UserPresenceEvent)
        })

        // Handle disconnect
        socket.on('disconnect', () => {
          console.log(`Socket disconnected: ${socket.id}`)
          
          // Remove from user connections
          if (this.userConnections.has(userId)) {
            this.userConnections.get(userId)!.delete(socket.id)
            if (this.userConnections.get(userId)!.size === 0) {
              this.userConnections.delete(userId)
            }
          }

          // Remove from all project rooms and notify
          for (const [projectId, userIds] of this.projectRooms.entries()) {
            if (userIds.has(userId)) {
              userIds.delete(userId)
              socket.to(`project:${projectId}`).emit('user-presence', {
                type: 'USER_LEFT',
                projectId,
                userId,
                userName,
                timestamp: new Date().toISOString()
              } as UserPresenceEvent)
            }
          }
        })

      } catch (error) {
        console.error('Socket connection error:', error)
        socket.emit('error', { message: 'Connection failed' })
        socket.disconnect()
      }
    })
  }

  private async authenticateSocket(socket: any): Promise<any> {
    // Extract session from socket handshake
    // This is a simplified version - in production you'd validate JWT tokens
    const cookies = socket.handshake.headers.cookie
    if (!cookies) return null

    try {
      // Mock session extraction - replace with actual session validation
      const mockSession = {
        user: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com'
        }
      }
      return mockSession
    } catch (error) {
      return null
    }
  }

  private async verifyProjectAccess(userId: string, projectId: string): Promise<boolean> {
    // Mock access verification - replace with actual database check
    // In production, check if user is part of project organization
    return true
  }

  // Emit events to project rooms
  emitToProject(projectId: string, event: RealTimeEvent) {
    if (!this.io) return
    this.io.to(`project:${projectId}`).emit('project-event', event)
  }

  // Emit events to specific users
  emitToUser(userId: string, event: RealTimeEvent) {
    if (!this.io || !this.userConnections.has(userId)) return
    
    const socketIds = this.userConnections.get(userId)!
    socketIds.forEach(socketId => {
      this.io!.to(socketId).emit('user-event', event)
    })
  }

  // Emit notifications
  emitNotification(userId: string, notification: NotificationEvent['notification']) {
    this.emitToUser(userId, {
      type: 'NOTIFICATION_SENT',
      userId,
      notification,
      timestamp: new Date().toISOString()
    })
  }

  // Get online users for a project
  getProjectUsers(projectId: string): string[] {
    return Array.from(this.projectRooms.get(projectId) || [])
  }

  // Get all online users
  getOnlineUsers(): string[] {
    return Array.from(this.userConnections.keys())
  }

  // Clean up
  shutdown() {
    if (this.io) {
      this.io.close()
      this.io = null
    }
    this.userConnections.clear()
    this.projectRooms.clear()
  }
}

// Singleton instance
export const realTimeService = new RealTimeService()

// Event emitter functions for easy use throughout the app
export const emitProjectUpdateEvent = (event: Omit<ProjectUpdateEvent, 'timestamp'>) => {
  realTimeService.emitToProject(event.projectId, {
    ...event,
    timestamp: new Date().toISOString()
  })
}

export const emitTaskEvent = (event: Omit<TaskEvent, 'timestamp'>) => {
  realTimeService.emitToProject(event.projectId, {
    ...event,
    timestamp: new Date().toISOString()
  })
}

export const emitPhotoEvent = (event: Omit<PhotoEvent, 'timestamp'>) => {
  realTimeService.emitToProject(event.projectId, {
    ...event,
    timestamp: new Date().toISOString()
  })
}

export const emitMessageEvent = (event: Omit<MessageEvent, 'timestamp'>) => {
  realTimeService.emitToProject(event.projectId, {
    ...event,
    timestamp: new Date().toISOString()
  })
}

export const emitNotification = (userId: string, notification: NotificationEvent['notification']) => {
  realTimeService.emitNotification(userId, notification)
}

// Client-side hook for React components
export function useRealTime(projectId?: string) {
  if (typeof window === 'undefined') return null

  // This would be implemented as a React hook in production
  // For now, return a mock object
  return {
    connect: () => console.log('Connecting to real-time service...'),
    disconnect: () => console.log('Disconnecting from real-time service...'),
    joinProject: (id: string) => console.log(`Joining project ${id}...`),
    leaveProject: (id: string) => console.log(`Leaving project ${id}...`),
    emit: (event: string, data: any) => console.log(`Emitting ${event}:`, data),
    on: (event: string, callback: (data: any) => void) => console.log(`Listening to ${event}...`),
    off: (event: string) => console.log(`Stopped listening to ${event}...`)
  }
}

// WebSocket API route helper
export function createWebSocketHandler() {
  return async function handler(req: NextApiRequest, res: any) {
    if (!res.socket.server.io) {
      console.log('Setting up Socket.IO server...')
      
      realTimeService.initialize(res.socket.server)
      res.socket.server.io = realTimeService
    }

    res.end()
  }
}

// Utility functions for common real-time operations
export class NotificationService {
  static async notifyTaskAssignment(
    assigneeId: string,
    task: any,
    assignedBy: { id: string; name: string }
  ) {
    emitNotification(assigneeId, {
      id: `task-assigned-${task.id}`,
      title: 'New Task Assigned',
      message: `${assignedBy.name} assigned you "${task.title}"`,
      type: 'info',
      relatedId: task.id,
      relatedType: 'task',
      actionUrl: `/projects/${task.projectId}/project-updates?tab=tasks`
    })
  }

  static async notifyTaskCompletion(
    projectId: string,
    task: any,
    completedBy: { id: string; name: string }
  ) {
    // Notify project team members (except the person who completed it)
    const projectUsers = realTimeService.getProjectUsers(projectId)
    const notification = {
      id: `task-completed-${task.id}`,
      title: 'Task Completed',
      message: `${completedBy.name} completed "${task.title}"`,
      type: 'success' as const,
      relatedId: task.id,
      relatedType: 'task',
      actionUrl: `/projects/${projectId}/project-updates?tab=tasks`
    }

    projectUsers
      .filter(userId => userId !== completedBy.id)
      .forEach(userId => emitNotification(userId, notification))
  }

  static async notifyPhotoUpload(
    projectId: string,
    photo: any,
    uploadedBy: { id: string; name: string }
  ) {
    const projectUsers = realTimeService.getProjectUsers(projectId)
    const notification = {
      id: `photo-uploaded-${photo.id}`,
      title: 'New Photo Added',
      message: `${uploadedBy.name} added a new photo${photo.caption ? `: ${photo.caption}` : ''}`,
      type: 'info' as const,
      relatedId: photo.id,
      relatedType: 'photo',
      actionUrl: `/projects/${projectId}/project-updates?tab=photos`
    }

    projectUsers
      .filter(userId => userId !== uploadedBy.id)
      .forEach(userId => emitNotification(userId, notification))
  }

  static async notifyUrgentTask(
    projectId: string,
    task: any,
    createdBy: { id: string; name: string }
  ) {
    const projectUsers = realTimeService.getProjectUsers(projectId)
    const notification = {
      id: `urgent-task-${task.id}`,
      title: '🚨 Urgent Task Created',
      message: `${createdBy.name} created an urgent task: "${task.title}"`,
      type: 'warning' as const,
      relatedId: task.id,
      relatedType: 'task',
      actionUrl: `/projects/${projectId}/project-updates?tab=tasks`
    }

    projectUsers
      .filter(userId => userId !== createdBy.id)
      .forEach(userId => emitNotification(userId, notification))
  }

  static async notifyMilestoneReached(
    projectId: string,
    milestone: any,
    achievedBy: { id: string; name: string }
  ) {
    const projectUsers = realTimeService.getProjectUsers(projectId)
    const notification = {
      id: `milestone-${milestone.id}`,
      title: '🎉 Milestone Reached!',
      message: `"${milestone.name}" milestone has been completed`,
      type: 'success' as const,
      relatedId: milestone.id,
      relatedType: 'milestone',
      actionUrl: `/projects/${projectId}/project-updates?tab=timeline`
    }

    projectUsers.forEach(userId => emitNotification(userId, notification))
  }
}