'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { format, formatDistanceToNow, isToday, isYesterday, isSameDay } from 'date-fns'
import { 
  MessageSquare, 
  Users, 
  Hash, 
  FolderOpen, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Search,
  Send,
  Paperclip,
  Smile,
  MoreHorizontal,
  Edit,
  Trash2,
  Reply,
  X,
  Download,
  Image as ImageIcon,
  File,
  ExternalLink,
  Home,
  Loader2,
  Check,
  CheckCheck,
  AtSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MentionTextarea } from '@/components/ui/mention-textarea'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { getStageName } from '@/constants/workflow'

// Types
interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  image?: string
  messageCount: number
}

interface Phase {
  id: string
  type: string
  status: string
  roomId: string
  roomName: string
  messageCount: number
}

interface Project {
  id: string
  name: string
  phases: Phase[]
}

interface Reaction {
  emoji: string
  count: number
  users: Array<{ id: string; name: string; image?: string }>
  userHasReacted: boolean
}

interface MessageContext {
  type: 'phase' | 'general'
  stageId?: string
  stageName?: string
  roomId?: string
  roomName?: string
  projectId?: string
  projectName?: string
  label?: string
}

interface ChatMessage {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  editedAt?: string
  isEdited: boolean
  chatType: 'PHASE' | 'GENERAL'
  parentMessageId?: string
  parentMessage?: {
    id: string
    content: string
    author: { id: string; name: string }
  }
  imageUrl?: string
  imageFileName?: string
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>
  author: {
    id: string
    name: string
    role: string
    image?: string
  }
  mentions: Array<{
    id: string
    mentionedUser: { id: string; name: string; role: string }
  }>
  reactions: Reaction[]
  context?: MessageContext
  stage?: {
    id: string
    type: string
    room: {
      id: string
      name: string
      type: string
      project: { id: string; name: string }
    }
  }
}

// Common emoji reactions
const EMOJI_LIST = ['👍', '❤️', '😊', '🔥', '🎉', '👀', '✅']

type ConversationType = 'general' | 'team' | 'phase'

interface ActiveConversation {
  type: ConversationType
  id?: string // stageId for phase, userId for team
  user?: TeamMember
  phase?: Phase & { project: Project }
}

export default function MessagingWorkspace() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [generalChatCount, setGeneralChatCount] = useState(0)
  
  // Active conversation
  const [activeConversation, setActiveConversation] = useState<ActiveConversation>({ type: 'general' })
  
  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  
  // Chat input
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  
  // New message modal
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [newMessageProject, setNewMessageProject] = useState('')
  const [newMessageRoom, setNewMessageRoom] = useState('')
  const [newMessagePhase, setNewMessagePhase] = useState('')
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [availablePhases, setAvailablePhases] = useState<any[]>([])
  
  // UI state
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversation.type === 'general') {
      loadGeneralChat()
    } else if (activeConversation.type === 'team' && activeConversation.id) {
      loadUserMessages(activeConversation.id)
    } else if (activeConversation.type === 'phase' && activeConversation.id) {
      loadPhaseMessages(activeConversation.id)
    }
  }, [activeConversation])

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/messaging/conversations')
      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data.teamMembers || [])
        setProjects(data.projects || [])
        setGeneralChatCount(data.generalChatCount || 0)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const loadGeneralChat = async () => {
    setMessagesLoading(true)
    try {
      const response = await fetch('/api/messaging/general')
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error loading general chat:', error)
      toast.error('Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const loadUserMessages = async (userId: string) => {
    setMessagesLoading(true)
    try {
      const response = await fetch(`/api/messaging/user/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.allMessages || [])
        // Note: User info is already set when clicking on the team member
        // Don't update activeConversation here to avoid infinite loop
      }
    } catch (error) {
      console.error('Error loading user messages:', error)
      toast.error('Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const loadPhaseMessages = async (stageId: string) => {
    setMessagesLoading(true)
    try {
      const response = await fetch(`/api/chat/${stageId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error loading phase messages:', error)
      toast.error('Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}`)
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File too large: ${file.name}. Max 10MB.`)
        return
      }
    }

    setSelectedFiles(files)
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const sendMessage = async (content: string, mentions: string[]) => {
    if ((!content.trim() && selectedFiles.length === 0) || sending) return

    setSending(true)
    try {
      // Map mention names to user IDs
      const mentionIds: string[] = []
      for (const mention of mentions) {
        const matchingMember = teamMembers.find(member => {
          const memberNameLower = member.name.toLowerCase()
          const mentionLower = mention.toLowerCase()
          return memberNameLower.includes(mentionLower) || 
                 memberNameLower.split(/\s|\(|\)/)[0] === mentionLower.split(/\s|\(|\)/)[0]
        })
        if (matchingMember && !mentionIds.includes(matchingMember.id)) {
          mentionIds.push(matchingMember.id)
        }
      }

      let apiUrl = ''
      if (activeConversation.type === 'general') {
        apiUrl = '/api/messaging/general'
      } else if (activeConversation.type === 'phase' && activeConversation.id) {
        apiUrl = `/api/chat/${activeConversation.id}`
      } else if (activeConversation.type === 'team' && activeConversation.id) {
        // For team conversations, we need to determine the right endpoint
        // If there's a phase context, post to that phase, otherwise general
        apiUrl = '/api/messaging/general'
      }

      let response
      if (selectedFiles.length > 0) {
        const formData = new FormData()
        formData.append('content', content.trim())
        formData.append('mentions', JSON.stringify(mentionIds))
        if (replyingTo) formData.append('parentMessageId', replyingTo.id)
        selectedFiles.forEach((file, index) => {
          formData.append(`file${index}`, file)
        })
        
        response = await fetch(apiUrl, {
          method: 'POST',
          body: formData
        })
      } else {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            mentions: mentionIds,
            parentMessageId: replyingTo?.id
          })
        })
      }

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        clearFiles()
        setReplyingTo(null)
        toast.success('Message sent!')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const editMessage = async (messageId: string, content: string) => {
    if (!content.trim()) return

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => prev.map(msg => msg.id === messageId ? data.message : msg))
        setEditingMessageId(null)
        setEditingContent('')
        toast.success('Message updated!')
      }
    } catch (error) {
      console.error('Error editing message:', error)
      toast.error('Failed to edit message')
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId))
        toast.success('Message deleted!')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Failed to delete message')
    }
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      })

      if (response.ok) {
        // Refresh reactions
        const reactionRes = await fetch(`/api/chat/messages/${messageId}/reactions`)
        if (reactionRes.ok) {
          const reactionData = await reactionRes.json()
          setMessages(prev => prev.map(m => 
            m.id === messageId ? { ...m, reactions: reactionData.reactions || [] } : m
          ))
        }
        setShowEmojiPicker(null)
      }
    } catch (error) {
      console.error('Error adding reaction:', error)
      toast.error('Failed to add reaction')
    }
  }

  const canModifyMessage = (message: ChatMessage) => {
    if (!session?.user) return false
    return message.author.id === session.user.id || 
           ['OWNER', 'ADMIN'].includes(session.user.role as string)
  }

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  // Format date for message grouping
  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'EEEE, MMMM d')
  }

  // Group messages by date
  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { date: string; messages: ChatMessage[] }[] = []
    let currentGroup: { date: string; messages: ChatMessage[] } | null = null

    messages.forEach(msg => {
      const dateLabel = formatMessageDate(msg.createdAt)
      if (!currentGroup || currentGroup.date !== dateLabel) {
        currentGroup = { date: dateLabel, messages: [] }
        groups.push(currentGroup)
      }
      currentGroup.messages.push(msg)
    })

    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  // Message content with mentions highlighted
  const MessageContent = ({ content, orgId }: { content: string; orgId: string }) => {
    const [highlightedContent, setHighlightedContent] = useState(content)
    
    useEffect(() => {
      const highlightContent = async () => {
        try {
          const { highlightValidMentions } = await import('@/lib/mentionUtils')
          const highlighted = await highlightValidMentions(content, orgId)
          setHighlightedContent(highlighted)
        } catch (error) {
          const basicHighlighted = content.replace(/@(\w+(?:\s+\w+)*)/g, '<span class="bg-indigo-100 text-indigo-800 px-1 rounded font-medium">@$1</span>')
          setHighlightedContent(basicHighlighted)
        }
      }
      highlightContent()
    }, [content, orgId])
    
    return <div dangerouslySetInnerHTML={{ __html: highlightedContent }} />
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Left Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200/80 flex flex-col shadow-sm">
        {/* Sidebar Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              Messages
            </h2>
            <Button
              size="sm"
              onClick={() => setShowNewMessageModal(true)}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white h-9 w-9 p-0 rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="pl-10 bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 h-10 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* General Chat */}
            <div>
              <button
                onClick={() => setActiveConversation({ type: 'general' })}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  activeConversation.type === 'general'
                    ? "bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 border border-transparent"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                  activeConversation.type === 'general' 
                    ? "bg-gradient-to-br from-violet-500 to-purple-600" 
                    : "bg-gradient-to-br from-violet-100 to-purple-100"
                )}>
                  <Home className={cn("w-5 h-5", activeConversation.type === 'general' ? "text-white" : "text-violet-600")} />
                </div>
                <span className={cn("font-medium flex-1 text-left", activeConversation.type === 'general' ? "text-violet-900" : "text-gray-700")}>Team Chat</span>
                {generalChatCount > 0 && (
                  <Badge className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    activeConversation.type === 'general' 
                      ? "bg-violet-600 text-white" 
                      : "bg-violet-100 text-violet-700"
                  )}>
                    {generalChatCount}
                  </Badge>
                )}
              </button>
            </div>

            {/* Team Members */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                Team Members
              </h3>
              <div className="space-y-1">
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setActiveConversation({ 
                      type: 'team', 
                      id: member.id,
                      user: member 
                    })}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                      activeConversation.type === 'team' && activeConversation.id === member.id
                        ? "bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 border border-transparent"
                    )}
                  >
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      {member.image ? (
                        <img src={member.image} alt={member.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold rounded-full shadow-sm">
                          {member.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className={cn("text-sm font-medium truncate", 
                        activeConversation.type === 'team' && activeConversation.id === member.id 
                          ? "text-violet-900" 
                          : "text-gray-700"
                      )}>{member.name}</p>
                      <p className="text-xs text-gray-400 truncate">{member.role}</p>
                    </div>
                    {member.messageCount > 0 && (
                      <Badge className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        activeConversation.type === 'team' && activeConversation.id === member.id
                          ? "bg-violet-600 text-white"
                          : "bg-violet-100 text-violet-700"
                      )}>
                        {member.messageCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* My Phases */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3 flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
                My Phases
              </h3>
              <div className="space-y-1">
                {projects.map((project) => (
                  <div key={project.id}>
                    <button
                      onClick={() => toggleProject(project.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
                    >
                      {expandedProjects.has(project.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm font-medium truncate flex-1 text-left">
                        {project.name}
                      </span>
                    </button>
                    
                    {expandedProjects.has(project.id) && (
                      <div className="ml-5 space-y-1 mt-1 border-l-2 border-gray-100 pl-3">
                        {project.phases.map((phase) => (
                          <button
                            key={phase.id}
                            onClick={() => setActiveConversation({
                              type: 'phase',
                              id: phase.id,
                              phase: { ...phase, project }
                            })}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm",
                              activeConversation.type === 'phase' && activeConversation.id === phase.id
                                ? "bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-900 shadow-sm"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent"
                            )}
                          >
                            <Hash className={cn("w-3.5 h-3.5", 
                              activeConversation.type === 'phase' && activeConversation.id === phase.id
                                ? "text-emerald-600"
                                : "text-gray-400"
                            )} />
                            <span className="flex-1 text-left truncate">
                              {phase.roomName} - {getStageName(phase.type)}
                            </span>
                            {phase.messageCount > 0 && (
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                activeConversation.type === 'phase' && activeConversation.id === phase.id
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-200 text-gray-600"
                              )}>
                                {phase.messageCount}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {projects.length === 0 && (
                  <p className="text-gray-500 text-sm px-3 py-2 italic">
                    No phases assigned to you
                  </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-gray-50/50">
        {/* Chat Header */}
        <div className="h-18 px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {activeConversation.type === 'general' && (
              <>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-800">Team Chat</h1>
                  <p className="text-sm text-gray-500">General team discussion</p>
                </div>
              </>
            )}
            
            {activeConversation.type === 'team' && activeConversation.user && (
              <>
                <Avatar className="w-12 h-12">
                  {activeConversation.user.image ? (
                    <img src={activeConversation.user.image} alt={activeConversation.user.name} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold rounded-2xl shadow-lg shadow-violet-200">
                      {activeConversation.user.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </Avatar>
                <div>
                  <h1 className="text-xl font-semibold text-gray-800">{activeConversation.user.name}</h1>
                  <p className="text-sm text-gray-500">{activeConversation.user.role}</p>
                </div>
              </>
            )}
            
            {activeConversation.type === 'phase' && activeConversation.phase && (
              <>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                  <Hash className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-800">
                    {activeConversation.phase.roomName} - {getStageName(activeConversation.phase.type)}
                  </h1>
                  <p className="text-sm text-gray-500">{activeConversation.phase.project.name}</p>
                </div>
              </>
            )}
          </div>

          {activeConversation.type === 'phase' && activeConversation.phase && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/projects/${activeConversation.phase!.project.id}/rooms/${activeConversation.phase!.roomId}?stage=${activeConversation.phase!.id}`, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open Phase
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-8 py-6">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
              </div>
              <p className="text-sm text-gray-400">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-5 shadow-sm">
                <MessageSquare className="w-10 h-10 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No messages yet</h3>
              <p className="text-gray-500 max-w-sm">
                Start the conversation by sending a message below
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messageGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {/* Date Divider */}
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs font-medium text-gray-500 bg-white px-2">
                      {group.date}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  
                  {/* Messages */}
                  {group.messages.map((message) => (
                    <div 
                      key={message.id} 
                      className="group flex gap-3 hover:bg-gray-50 -mx-3 px-3 py-2 rounded-xl transition-colors"
                    >
                      {/* Avatar */}
                      <Avatar className="w-9 h-9 flex-shrink-0 mt-0.5">
                        {message.author.image ? (
                          <img src={message.author.image} alt={message.author.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold rounded-full">
                            {message.author.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                      </Avatar>

                      {/* Message Content */}
                      <div className="flex-1 min-w-0">
                        {/* Author and Timestamp */}
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900">
                            {message.author.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {format(new Date(message.createdAt), 'h:mm a')}
                          </span>
                          {message.isEdited && (
                            <span className="text-xs text-gray-400">(edited)</span>
                          )}
                        </div>

                        {/* Context Badge for team view */}
                        {activeConversation.type === 'team' && message.context && (
                          <div className="mb-2">
                            {message.context.type === 'phase' ? (
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-100"
                                onClick={() => window.open(`/projects/${message.context!.projectId}/rooms/${message.context!.roomId}?stage=${message.context!.stageId}`, '_blank')}
                              >
                                📍 {message.context.projectName} → {message.context.roomName} → {message.context.stageName}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                                💬 {message.context.label}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Reply indicator */}
                        {message.parentMessage && (
                          <div className="mb-2 pl-3 border-l-2 border-gray-300 bg-gray-50 py-1.5 px-3 rounded text-xs">
                            <div className="flex items-center gap-1 text-gray-500 mb-0.5">
                              <Reply className="w-3 h-3" />
                              <span>Replying to {message.parentMessage.author.name}</span>
                            </div>
                            <div className="text-gray-600 truncate">
                              {message.parentMessage.content}
                            </div>
                          </div>
                        )}

                        {/* Message Text or Edit Form */}
                        {editingMessageId === message.id ? (
                          <div className="mt-2">
                            <MentionTextarea
                              value={editingContent}
                              onChange={setEditingContent}
                              teamMembers={teamMembers}
                              placeholder="Edit your message..."
                              rows={2}
                              className="text-sm"
                            />
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                onClick={() => editMessage(message.id, editingContent)}
                                disabled={!editingContent.trim()}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingMessageId(null); setEditingContent('') }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {message.content && message.content !== '(Attachment)' && (
                              <div className="text-sm text-gray-700 leading-relaxed">
                                <MessageContent 
                                  content={message.content} 
                                  orgId={session?.user?.orgId || ''}
                                />
                              </div>
                            )}
                            
                            {/* Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((attachment: any) => {
                                  const FileIcon = attachment.type.startsWith('image/') ? ImageIcon : File
                                  return (
                                    <div
                                      key={attachment.id}
                                      className="flex items-center gap-2 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors cursor-pointer max-w-sm"
                                      onClick={() => window.open(attachment.url, '_blank')}
                                    >
                                      <FileIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-700 truncate">
                                          {attachment.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {attachment.size < 1024 * 1024
                                            ? `${(attachment.size / 1024).toFixed(1)} KB`
                                            : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`}
                                        </div>
                                      </div>
                                      <Download className="w-4 h-4 text-gray-400" />
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        )}

                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {message.reactions.map((reaction, index) => (
                              <TooltipProvider key={index}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleReaction(message.id, reaction.emoji)}
                                      className={cn(
                                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors",
                                        reaction.userHasReacted
                                          ? "bg-indigo-100 hover:bg-indigo-200 border border-indigo-300"
                                          : "bg-gray-100 hover:bg-gray-200 border border-gray-200"
                                      )}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span className="font-medium">{reaction.count}</span>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      {reaction.users.map(u => u.name).join(', ')}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        )}

                        {/* Emoji Picker */}
                        {showEmojiPicker === message.id && (
                          <div className="mt-2">
                            <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                              {EMOJI_LIST.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(message.id, emoji)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Message Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0"
                          onClick={() => setReplyingTo(message)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0"
                          onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </Button>
                        
                        {canModifyMessage(message) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {message.author.id === session?.user.id && (
                                <DropdownMenuItem onClick={() => { setEditingMessageId(message.id); setEditingContent(message.content) }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => deleteMessage(message.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="p-5 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
          {/* Reply Indicator */}
          {replyingTo && (
            <div className="mb-4 p-3 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Reply className="w-4 h-4 text-violet-600" />
                  <span className="text-sm text-gray-700">
                    Replying to <span className="font-semibold text-violet-700">{replyingTo.author.name}</span>
                  </span>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1.5 hover:bg-violet-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="text-sm text-gray-600 truncate mt-1.5 pl-6">
                {replyingTo.content || '(Attachment)'}
              </div>
            </div>
          )}
          
          {/* File Attachments Preview */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedFiles.map((file, index) => {
                const FileIcon = file.type.startsWith('image/') ? ImageIcon : File
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <FileIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <MentionTextarea
                value={newMessage}
                onChange={setNewMessage}
                onSubmit={sendMessage}
                teamMembers={teamMembers}
                placeholder={`Message ${
                  activeConversation.type === 'general' ? 'Team Chat' :
                  activeConversation.type === 'team' ? activeConversation.user?.name || 'team member' :
                  activeConversation.phase ? `${activeConversation.phase.roomName}` : 'here'
                }...`}
                disabled={sending}
                submitLabel={sending ? "Sending..." : "Send"}
                rows={2}
              />
            </div>
            
            {/* Attach Files Button */}
            <div className="pb-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* New Message Modal */}
      <Dialog open={showNewMessageModal} onOpenChange={setShowNewMessageModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              New Message
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Choose where to send your message:
            </p>
            
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => {
                  setActiveConversation({ type: 'general' })
                  setShowNewMessageModal(false)
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Home className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Team Chat</div>
                  <div className="text-xs text-gray-500">General team discussion</div>
                </div>
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or choose a phase</span>
                </div>
              </div>
              
              {projects.map((project) => (
                <div key={project.id} className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{project.name}</p>
                  <div className="grid grid-cols-1 gap-2 pl-4">
                    {project.phases.map((phase) => (
                      <Button
                        key={phase.id}
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2"
                        onClick={() => {
                          setActiveConversation({
                            type: 'phase',
                            id: phase.id,
                            phase: { ...phase, project }
                          })
                          setShowNewMessageModal(false)
                        }}
                      >
                        <Hash className="w-3.5 h-3.5 text-gray-400" />
                        {phase.roomName} - {getStageName(phase.type)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
