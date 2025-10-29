import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  SocketUser 
} from '@/lib/websocket-server'

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>

export function useWebSocket() {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<SocketInstance | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<SocketUser[]>([])
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!session?.user) return

    const socketInstance: SocketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      auth: {
        token: session.user.id
      },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socketInstance.on('connect', () => {
      
      setIsConnected(true)
      setSocket(socketInstance)

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = undefined
      }
    })

    socketInstance.on('disconnect', () => {
      
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setIsConnected(false)
      
      // Retry connection after delay
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          socketInstance.connect()
        }, 2000)
      }
    })

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      socketInstance.disconnect()
    }
  }, [session])

  const joinProject = (projectId: string) => {
    if (socket && isConnected) {
      socket.emit('join-project', projectId)
    }
  }

  const leaveProject = (projectId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-project', projectId)
    }
  }

  const startTyping = (projectId: string, updateId?: string) => {
    if (socket && isConnected) {
      socket.emit('typing', { projectId, updateId })
    }
  }

  const stopTyping = (projectId: string, updateId?: string) => {
    if (socket && isConnected) {
      socket.emit('stop-typing', { projectId, updateId })
    }
  }

  const getOnlineUsers = (projectId: string) => {
    if (socket && isConnected) {
      socket.emit('get-online-users', projectId, (users) => {
        setOnlineUsers(users)
      })
    }
  }

  return {
    socket,
    isConnected,
    onlineUsers,
    joinProject,
    leaveProject,
    startTyping,
    stopTyping,
    getOnlineUsers
  }
}

// Hook for project-specific real-time updates
export function useProjectUpdates(projectId: string | null) {
  const { socket, isConnected, joinProject, leaveProject } = useWebSocket()
  const [updates, setUpdates] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    if (!socket || !isConnected || !projectId) return

    // Join the project room
    joinProject(projectId)

    // Listen for project update events
    socket.on('project-update:created', (update) => {
      setUpdates(prev => [update, ...prev])
    })

    socket.on('project-update:updated', (update) => {
      setUpdates(prev => 
        prev.map(u => u.id === update.id ? { ...u, ...update } : u)
      )
    })

    socket.on('project-update:deleted', ({ updateId }) => {
      setUpdates(prev => prev.filter(u => u.id !== updateId))
    })

    // Listen for task events
    socket.on('task:created', (task) => {
      setTasks(prev => [task, ...prev])
    })

    socket.on('task:updated', (task) => {
      setTasks(prev => 
        prev.map(t => t.id === task.id ? { ...t, ...task } : t)
      )
    })

    socket.on('task:deleted', ({ taskId }) => {
      setTasks(prev => prev.filter(t => t.id !== taskId))
    })

    // Listen for message events
    socket.on('message:created', (message) => {
      setMessages(prev => [message, ...prev])
    })

    socket.on('message:updated', (message) => {
      setMessages(prev => 
        prev.map(m => m.id === message.id ? { ...m, ...message } : m)
      )
    })

    socket.on('message:deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    })

    socket.on('message:reaction', (reaction) => {
      setMessages(prev => 
        prev.map(m => {
          if (m.id === reaction.messageId) {
            return {
              ...m,
              reactions: m.reactions ? [...m.reactions, reaction] : [reaction]
            }
          }
          return m
        })
      )
    })

    // Listen for photo events
    socket.on('photo:uploaded', (photo) => {
      setPhotos(prev => [photo, ...prev])
    })

    socket.on('photo:updated', (photo) => {
      setPhotos(prev => 
        prev.map(p => p.id === photo.id ? { ...p, ...photo } : p)
      )
    })

    socket.on('photo:deleted', ({ photoId }) => {
      setPhotos(prev => prev.filter(p => p.id !== photoId))
    })

    // Listen for activity events
    socket.on('activity:new', (activity) => {
      setActivities(prev => [activity, ...prev.slice(0, 49)]) // Keep only 50 recent activities
    })

    return () => {
      // Cleanup listeners
      socket.off('project-update:created')
      socket.off('project-update:updated')
      socket.off('project-update:deleted')
      socket.off('task:created')
      socket.off('task:updated')
      socket.off('task:deleted')
      socket.off('message:created')
      socket.off('message:updated')
      socket.off('message:deleted')
      socket.off('message:reaction')
      socket.off('photo:uploaded')
      socket.off('photo:updated')
      socket.off('photo:deleted')
      socket.off('activity:new')

      // Leave project room
      if (projectId) {
        leaveProject(projectId)
      }
    }
  }, [socket, isConnected, projectId, joinProject, leaveProject])

  return {
    updates,
    tasks,
    messages,
    photos,
    activities,
    setUpdates,
    setTasks,
    setMessages,
    setPhotos,
    setActivities
  }
}

// Hook for user notifications
export function useNotifications() {
  const { socket, isConnected } = useWebSocket()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!socket || !isConnected) return

    socket.on('notification:new', (notification) => {
      setNotifications(prev => [notification, ...prev])
      setUnreadCount(prev => prev + 1)
    })

    socket.on('notification:read', ({ notificationIds }) => {
      setNotifications(prev => 
        prev.map(n => 
          notificationIds.includes(n.id) 
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length))
    })

    return () => {
      socket.off('notification:new')
      socket.off('notification:read')
    }
  }, [socket, isConnected])

  return {
    notifications,
    unreadCount,
    setNotifications,
    setUnreadCount
  }
}

// Hook for typing indicators
export function useTypingIndicators(projectId: string | null, updateId?: string) {
  const { socket, isConnected, startTyping, stopTyping } = useWebSocket()
  const [typingUsers, setTypingUsers] = useState<SocketUser[]>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!socket || !isConnected || !projectId) return

    socket.on('user:typing', ({ userId, userName, projectId: typingProjectId, updateId: typingUpdateId }) => {
      if (typingProjectId === projectId && typingUpdateId === updateId) {
        setTypingUsers(prev => {
          const exists = prev.find(u => u.id === userId)
          if (!exists) {
            return [...prev, { id: userId, name: userName } as SocketUser]
          }
          return prev
        })
      }
    })

    socket.on('user:stopped-typing', ({ userId, projectId: typingProjectId, updateId: typingUpdateId }) => {
      if (typingProjectId === projectId && typingUpdateId === updateId) {
        setTypingUsers(prev => prev.filter(u => u.id !== userId))
      }
    })

    return () => {
      socket.off('user:typing')
      socket.off('user:stopped-typing')
    }
  }, [socket, isConnected, projectId, updateId])

  const handleStartTyping = () => {
    if (projectId) {
      startTyping(projectId, updateId)
      
      // Auto-stop typing after 3 seconds of inactivity
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        handleStopTyping()
      }, 3000)
    }
  }

  const handleStopTyping = () => {
    if (projectId) {
      stopTyping(projectId, updateId)
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = undefined
      }
    }
  }

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return {
    typingUsers,
    startTyping: handleStartTyping,
    stopTyping: handleStopTyping
  }
}
