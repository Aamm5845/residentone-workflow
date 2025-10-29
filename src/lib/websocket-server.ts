import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/auth'
import { NextApiRequest } from 'next'

export interface SocketUser {
  id: string
  name: string
  email: string
  role: string
  organizationId: string
}

export interface SocketData {
  user?: SocketUser
  projectIds?: string[]
}

export interface ServerToClientEvents {
  // Project Updates
  'project-update:created': (data: any) => void
  'project-update:updated': (data: any) => void
  'project-update:deleted': (data: { updateId: string; projectId: string }) => void

  // Tasks
  'task:created': (data: any) => void
  'task:updated': (data: any) => void
  'task:assigned': (data: any) => void
  'task:completed': (data: any) => void
  'task:deleted': (data: { taskId: string; projectId: string }) => void

  // Messages
  'message:created': (data: any) => void
  'message:updated': (data: any) => void
  'message:deleted': (data: { messageId: string; projectId: string }) => void
  'message:reaction': (data: any) => void

  // Photos
  'photo:uploaded': (data: any) => void
  'photo:updated': (data: any) => void
  'photo:deleted': (data: { photoId: string; projectId: string }) => void

  // Notifications
  'notification:new': (data: any) => void
  'notification:read': (data: { notificationIds: string[] }) => void

  // Real-time collaboration
  'user:joined-project': (data: { userId: string; userName: string; projectId: string }) => void
  'user:left-project': (data: { userId: string; userName: string; projectId: string }) => void
  'user:typing': (data: { userId: string; userName: string; projectId: string; updateId?: string }) => void
  'user:stopped-typing': (data: { userId: string; projectId: string; updateId?: string }) => void

  // Activity feed
  'activity:new': (data: any) => void
}

export interface ClientToServerEvents {
  // Project management
  'join-project': (projectId: string) => void
  'leave-project': (projectId: string) => void

  // Real-time collaboration
  'typing': (data: { projectId: string; updateId?: string }) => void
  'stop-typing': (data: { projectId: string; updateId?: string }) => void

  // Presence
  'get-online-users': (projectId: string, callback: (users: SocketUser[]) => void) => void
}

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>

export function initializeSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const req = socket.request as NextApiRequest
      const session = await getSession({ req })

      if (!session?.user) {
        return next(new Error('Unauthorized'))
      }

      // Get user's organization and projects
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          organization: {
            include: {
              projects: {
                select: { id: true }
              }
            }
          }
        }
      })

      if (!user) {
        return next(new Error('User not found'))
      }

      socket.data.user = {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        role: user.role,
        organizationId: user.orgId || ''
      }

      socket.data.projectIds = user.organization?.projects.map(p => p.id) || []

      next()
    } catch (error) {
      console.error('Socket authentication error:', error)
      next(new Error('Authentication failed'))
    }
  })

  // Connection handling
  io.on('connection', (socket) => {
    
    // Join user's projects automatically
    if (socket.data.projectIds) {
      socket.data.projectIds.forEach(projectId => {
        socket.join(`project:${projectId}`)
      })
    }

    // Project management
    socket.on('join-project', async (projectId) => {
      if (!socket.data.user || !socket.data.projectIds?.includes(projectId)) {
        socket.emit('error', 'Unauthorized to join this project')
        return
      }

      socket.join(`project:${projectId}`)
      
      // Notify other users in the project
      socket.to(`project:${projectId}`).emit('user:joined-project', {
        userId: socket.data.user.id,
        userName: socket.data.user.name,
        projectId
      })

    })

    socket.on('leave-project', (projectId) => {
      if (!socket.data.user) return

      socket.leave(`project:${projectId}`)
      
      // Notify other users in the project
      socket.to(`project:${projectId}`).emit('user:left-project', {
        userId: socket.data.user.id,
        userName: socket.data.user.name,
        projectId
      })

    })

    // Real-time collaboration
    socket.on('typing', (data) => {
      if (!socket.data.user) return

      socket.to(`project:${data.projectId}`).emit('user:typing', {
        userId: socket.data.user.id,
        userName: socket.data.user.name,
        projectId: data.projectId,
        updateId: data.updateId
      })
    })

    socket.on('stop-typing', (data) => {
      if (!socket.data.user) return

      socket.to(`project:${data.projectId}`).emit('user:stopped-typing', {
        userId: socket.data.user.id,
        projectId: data.projectId,
        updateId: data.updateId
      })
    })

    // Get online users
    socket.on('get-online-users', async (projectId, callback) => {
      if (!socket.data.user || !socket.data.projectIds?.includes(projectId)) {
        callback([])
        return
      }

      const sockets = await io.in(`project:${projectId}`).fetchSockets()
      const onlineUsers = sockets
        .map(s => s.data.user)
        .filter((user): user is SocketUser => user !== undefined)
        .filter((user, index, self) => 
          index === self.findIndex(u => u.id === user.id)
        ) // Remove duplicates

      callback(onlineUsers)
    })

    // Disconnect handling
    socket.on('disconnect', () => {
      if (!socket.data.user || !socket.data.projectIds) return

      // Notify all projects the user was in
      socket.data.projectIds.forEach(projectId => {
        socket.to(`project:${projectId}`).emit('user:left-project', {
          userId: socket.data.user!.id,
          userName: socket.data.user!.name,
          projectId
        })
      })

    })
  })

  return io
}

// Utility functions to emit events from API routes
export function getSocketInstance() {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.')
  }
  return io
}

// Emit project update events
export function emitProjectUpdateCreated(projectId: string, update: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('project-update:created', update)
  }
}

export function emitProjectUpdateUpdated(projectId: string, update: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('project-update:updated', update)
  }
}

export function emitProjectUpdateDeleted(projectId: string, updateId: string) {
  if (io) {
    io.to(`project:${projectId}`).emit('project-update:deleted', { updateId, projectId })
  }
}

// Emit task events
export function emitTaskCreated(projectId: string, task: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('task:created', task)
  }
}

export function emitTaskUpdated(projectId: string, task: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('task:updated', task)
  }
}

export function emitTaskAssigned(projectId: string, task: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('task:assigned', task)
  }
}

export function emitTaskCompleted(projectId: string, task: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('task:completed', task)
  }
}

export function emitTaskDeleted(projectId: string, taskId: string) {
  if (io) {
    io.to(`project:${projectId}`).emit('task:deleted', { taskId, projectId })
  }
}

// Emit message events
export function emitMessageCreated(projectId: string, message: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('message:created', message)
  }
}

export function emitMessageUpdated(projectId: string, message: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('message:updated', message)
  }
}

export function emitMessageDeleted(projectId: string, messageId: string) {
  if (io) {
    io.to(`project:${projectId}`).emit('message:deleted', { messageId, projectId })
  }
}

export function emitMessageReaction(projectId: string, reaction: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('message:reaction', reaction)
  }
}

// Emit photo events
export function emitPhotoUploaded(projectId: string, photo: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('photo:uploaded', photo)
  }
}

export function emitPhotoUpdated(projectId: string, photo: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('photo:updated', photo)
  }
}

export function emitPhotoDeleted(projectId: string, photoId: string) {
  if (io) {
    io.to(`project:${projectId}`).emit('photo:deleted', { photoId, projectId })
  }
}

// Emit notification events
export function emitNotificationToUser(userId: string, notification: any) {
  if (io) {
    // Find user's sockets and emit to all of them
    io.sockets.sockets.forEach((socket) => {
      if (socket.data.user?.id === userId) {
        socket.emit('notification:new', notification)
      }
    })
  }
}

export function emitNotificationsRead(userId: string, notificationIds: string[]) {
  if (io) {
    io.sockets.sockets.forEach((socket) => {
      if (socket.data.user?.id === userId) {
        socket.emit('notification:read', { notificationIds })
      }
    })
  }
}

// Emit activity events
export function emitNewActivity(projectId: string, activity: any) {
  if (io) {
    io.to(`project:${projectId}`).emit('activity:new', activity)
  }
}
