'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send,
  Paperclip,
  Smile,
  MoreHorizontal,
  Reply,
  Edit3,
  Trash2,
  Heart,
  ThumbsUp,
  Eye,
  EyeOff,
  Image,
  File,
  Clock,
  CheckCheck,
  AlertCircle,
  Users,
  Search,
  Filter,
  Pin,
  Star,
  Download,
  Forward,
  Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'

interface Message {
  id: string
  content: string
  authorId: string
  author: {
    id: string
    name: string
    email?: string
    image?: string
  }
  messageType?: 'MESSAGE' | 'SYSTEM' | 'NOTIFICATION' | 'URGENT' | 'REMINDER'
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  parentMessageId?: string
  parentMessage?: {
    id: string
    content: string
    author: {
      id: string
      name: string
    }
  }
  mentions?: any[]
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>
  reactions?: Array<{
    emoji: string
    users: Array<{ id: string; name: string }>
  }>
  readBy?: Array<{
    userId: string
    userName: string
    readAt: string
  }>
  isUrgent?: boolean
  isEdited?: boolean
  editedAt?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

interface User {
  id: string
  name: string
  email: string
  image?: string
  isOnline?: boolean
  lastSeen?: string
}

interface TypingIndicator {
  userId: string
  userName: string
  timestamp: string
}

interface ChatInterfaceProps {
  projectId: string
  updateId?: string
  taskId?: string
  messages: Message[]
  currentUser: User
  participants: User[]
  onSendMessage: (content: string, parentId?: string, attachments?: File[]) => void
  onEditMessage: (messageId: string, content: string) => void
  onDeleteMessage: (messageId: string) => void
  onReactToMessage: (messageId: string, emoji: string) => void
  onUploadFile: (files: File[]) => Promise<Array<{ id: string; name: string; url: string; type: string; size: number }>>
  canEdit?: boolean
  showParticipants?: boolean
  height?: string
}

const EMOJI_LIST = ['👍', '❤️', '😊', '😂', '😮', '😢', '🔥', '🎉', '✅', '❌']

export default function ChatInterface({
  projectId,
  updateId,
  taskId,
  messages,
  currentUser,
  participants,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReactToMessage,
  onUploadFile,
  canEdit = false,
  showParticipants = true,
  height = 'h-96'
}: ChatInterfaceProps) {
  const [newMessage, setNewMessage] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredMessages, setFilteredMessages] = useState(messages)
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Filter messages based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = messages.filter(message =>
        message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        message.author.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        message.attachments.some(att => att.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      setFilteredMessages(filtered)
    } else {
      setFilteredMessages(messages)
    }
  }, [searchQuery, messages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom()
  }, [filteredMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Handle typing indicators
  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true)
      // TODO: Emit typing event via WebSocket
      
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      
    }, 3000)
  }, [isTyping])

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return

    try {
      let attachments: any[] = []
      
      // Upload files if any
      if (selectedFiles.length > 0) {
        setUploadingFiles(true)
        attachments = await onUploadFile(selectedFiles)
        setSelectedFiles([])
      }

      // Send message
      onSendMessage(
        newMessage.trim(),
        replyingTo?.id,
        attachments.length > 0 ? attachments : undefined
      )

      // Clear form
      setNewMessage('')
      setReplyingTo(null)
      setIsTyping(false)
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleEditMessage = () => {
    if (!editingMessage || !newMessage.trim()) return

    onEditMessage(editingMessage.id, newMessage.trim())
    setEditingMessage(null)
    setNewMessage('')
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (isToday(date)) {
      return format(date, 'HH:mm')
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`
    } else if (isThisWeek(date)) {
      return format(date, 'EEE HH:mm')
    } else {
      return format(date, 'MMM d, HH:mm')
    }
  }

  const MessageBubble = ({ message, isOwn }: { message: Message; isOwn: boolean }) => {
    // Use parentMessage from message object if available, otherwise search in messages array
    const parentMessage = message.parentMessage || 
      (message.parentMessageId ? messages.find(m => m.id === message.parentMessageId) : null)

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
          {!isOwn && (
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={message.author.image} />
              <AvatarFallback className="text-xs">
                {message.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          )}

          <div className={`group relative ${isOwn ? 'ml-2' : 'mr-2'}`}>
            {/* Reply indicator */}
            {parentMessage && (
              <div className={`text-xs text-gray-500 mb-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                <div className="flex items-center gap-1">
                  <Reply className="w-3 h-3" />
                  <span>Replying to {parentMessage.author.name}</span>
                </div>
                <div className="bg-gray-100 rounded p-2 mt-1 border-l-2 border-gray-300">
                  <p className="text-xs truncate">{parentMessage.content}</p>
                </div>
              </div>
            )}

            <div
              className={`relative px-4 py-2 rounded-2xl ${
                isOwn
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 rounded-bl-md'
              } ${message.isUrgent ? 'ring-2 ring-red-400' : ''}`}
            >
              {/* Message content */}
              <div className="space-y-2">
                {!isOwn && (
                  <div className="text-xs font-medium text-gray-600">
                    {message.author.name}
                  </div>
                )}

                {message.content && (
                  <div className={`text-sm ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                    {message.content}
                  </div>
                )}

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {message.attachments.map((attachment) => {
                      // Determine icon based on file type
                      let FileIcon = File
                      if (attachment.type.startsWith('image/')) {
                        FileIcon = Image
                      } else if (attachment.type === 'application/pdf') {
                        FileIcon = File
                      }
                      
                      return (
                        <div
                          key={attachment.id}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            isOwn ? 'bg-purple-500' : 'bg-gray-50'
                          }`}
                        >
                          <FileIcon className="w-4 h-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {attachment.name}
                            </div>
                            <div className="text-xs opacity-70">
                              {attachment.size < 1024 
                                ? `${attachment.size} B`
                                : attachment.size < 1024 * 1024
                                ? `${(attachment.size / 1024).toFixed(1)} KB`
                                : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
                              }
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={() => window.open(attachment.url, '_blank')}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {message.reactions.map((reaction, index) => (
                      <button
                        key={index}
                        onClick={() => onReactToMessage(message.id, reaction.emoji)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs transition-colors"
                      >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.users.length}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Message metadata */}
                <div className={`flex items-center justify-between text-xs mt-2 ${
                  isOwn ? 'text-purple-200' : 'text-gray-500'
                }`}>
                  <span>{formatMessageTime(message.createdAt)}</span>
                  <div className="flex items-center gap-1">
                    {message.isEdited && (
                      <span className="opacity-70">edited</span>
                    )}
                    {isOwn && (
                      <div className="flex items-center">
                        {message.readBy.length > 1 ? (
                          <CheckCheck className="w-3 h-3" />
                        ) : (
                          <CheckCheck className="w-3 h-3 opacity-50" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Message actions */}
              <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                <div className="flex bg-white border border-gray-200 rounded-lg shadow-sm p-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setShowEmojiPicker(message.id)}
                        >
                          <Smile className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add reaction</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setReplyingTo(message)}
                        >
                          <Reply className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reply</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {isOwn && canEdit && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingMessage(message)
                                setNewMessage(message.content)
                                messageInputRef.current?.focus()
                              }}
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Delete this message?')) {
                                  onDeleteMessage(message.id)
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy text
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Forward className="w-4 h-4 mr-2" />
                        Forward
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Pin className="w-4 h-4 mr-2" />
                        Pin message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Emoji picker */}
              {showEmojiPicker === message.id && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                  <div className="grid grid-cols-5 gap-1">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReactToMessage(message.id, emoji)
                          setShowEmojiPicker(null)
                        }}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <Card className={`flex flex-col ${height}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Messages</CardTitle>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48 h-8"
              />
            </div>

            {showParticipants && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    {participants.length}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <div className="p-2">
                    <h4 className="font-medium text-sm mb-2">Participants</h4>
                    {participants.map(user => (
                      <div key={user.id} className="flex items-center gap-2 py-1">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={user.image} />
                          <AvatarFallback className="text-xs">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{user.name}</span>
                        {user.isOnline && (
                          <div className="w-2 h-2 bg-green-500 rounded-full ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <AnimatePresence>
              {filteredMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.authorId === currentUser.id}
                />
              ))}
            </AnimatePresence>

            {/* Typing indicators */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span>
                  {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="border-t bg-gray-50 p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <Reply className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Replying to {replyingTo.author.name}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {replyingTo.content}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReplyingTo(null)}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* File attachments preview */}
        {selectedFiles.length > 0 && (
          <div className="border-t bg-gray-50 p-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">
                Attached files ({selectedFiles.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2"
                  >
                    {file.type.startsWith('image/') ? (
                      <Image className="w-4 h-4 text-gray-400" />
                    ) : (
                      <File className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm truncate max-w-20">
                      {file.name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                      className="h-4 w-4 p-0 text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message input */}
        <div className="border-t p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Textarea
                ref={messageInputRef}
                placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  handleTypingStart()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (editingMessage) {
                      handleEditMessage()
                    } else {
                      handleSendMessage()
                    }
                  }
                  if (e.key === 'Escape') {
                    if (editingMessage) {
                      setEditingMessage(null)
                      setNewMessage('')
                    }
                    if (replyingTo) {
                      setReplyingTo(null)
                    }
                  }
                }}
                className="min-h-[40px] max-h-32 resize-none"
                rows={1}
              />
            </div>

            <div className="flex items-center gap-1">
              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles}
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              {/* Send button */}
              <Button
                size="sm"
                onClick={editingMessage ? handleEditMessage : handleSendMessage}
                disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploadingFiles}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {uploadingFiles ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : editingMessage ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {editingMessage && (
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <span>Press Enter to save, Escape to cancel</span>
            </div>
          )}
        </div>
      </CardContent>

      {/* Click outside to close emoji picker */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowEmojiPicker(null)}
        />
      )}
    </Card>
  )
}
