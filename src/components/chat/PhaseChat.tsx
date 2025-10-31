'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { MoreHorizontal, Edit, Trash2, MessageCircle, Paperclip, X, Download, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MentionTextarea } from '@/components/ui/mention-textarea'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Reaction {
  emoji: string
  count: number
  users: Array<{
    id: string
    name: string
    image?: string
  }>
  userHasReacted: boolean
}

interface ChatMessage {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  editedAt?: string
  isEdited: boolean
  imageUrl?: string
  imageFileName?: string
  author: {
    id: string
    name: string
    role: string
    image?: string
  }
  mentions: Array<{
    id: string
    mentionedUser: {
      id: string
      name: string
      role: string
    }
  }>
  reactions: Reaction[]
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  image?: string
}

interface AssignedUser {
  id: string
  name: string
  email: string
  role: string
}

// Common emoji reactions
const EMOJI_LIST = ['👍', '❤️', '😊', '🔥', '🎉']

interface PhaseChatProps {
  stageId: string
  stageName: string
  className?: string
}

export function PhaseChat({ stageId, stageName, className }: PhaseChatProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignedUser, setAssignedUser] = useState<AssignedUser | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [notifyAssignee, setNotifyAssignee] = useState(true)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load messages and team members on mount
  useEffect(() => {
    loadMessages()
    loadTeamMembers()
  }, [stageId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/chat/${stageId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        setAssignedUser(data.stage?.assignedUser || null)
      } else {
        throw new Error('Failed to load messages')
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Failed to load chat messages')
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    try {
      const response = await fetch('/api/chat/team-members')
      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data.teamMembers || [])
      }
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.')
      return
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Image too large. Maximum size is 5MB.')
      return
    }

    setSelectedImage(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sendMessage = async (content: string, mentions: string[]) => {
    if ((!content.trim() && !selectedImage) || sending) return

    setSending(true)
    try {
      // Map mention names to user IDs
      const mentionIds = []
      for (const mention of mentions) {
        const matchingMember = teamMembers.find(member => {
          const memberNameLower = member.name.toLowerCase()
          const mentionLower = mention.toLowerCase()
          
          // Exact match
          if (memberNameLower === mentionLower) {
            return true
          }
          
          // Partial match - check if the mention is contained in the member name
          if (memberNameLower.includes(mentionLower) || memberNameLower.startsWith(mentionLower)) {
            return true
          }
          
          // Also check first name only
          const memberFirstName = memberNameLower.split(/\s|\(|\)/)[0]
          const mentionFirstName = mentionLower.split(/\s|\(|\)/)[0]
          
          return memberFirstName === mentionFirstName
        })
        
        if (matchingMember && !mentionIds.includes(matchingMember.id)) {
          mentionIds.push(matchingMember.id)
        }
      }

      let response
      
      if (selectedImage) {
        // Send with image using FormData
        const formData = new FormData()
        formData.append('content', content.trim())
        formData.append('mentions', JSON.stringify(mentionIds))
        formData.append('notifyAssignee', String(notifyAssignee))
        formData.append('image', selectedImage)
        
        response = await fetch(`/api/chat/${stageId}`, {
          method: 'POST',
          body: formData
        })
      } else {
        // Send text-only message
        response = await fetch(`/api/chat/${stageId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: content.trim(),
            mentions: mentionIds,
            notifyAssignee: notifyAssignee
          })
        })
      }

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        removeImage()
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: content.trim() })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => 
          prev.map(msg => msg.id === messageId ? data.message : msg)
        )
        setEditingMessageId(null)
        setEditingContent('')
        toast.success('Message updated!')
      } else {
        throw new Error('Failed to edit message')
      }
    } catch (error) {
      console.error('Error editing message:', error)
      toast.error('Failed to edit message')
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId))
        toast.success('Message deleted!')
      } else {
        throw new Error('Failed to delete message')
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoji })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update messages with new reaction data
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            // Fetch fresh reactions to get updated state
            fetch(`/api/chat/messages/${messageId}/reactions`)
              .then(res => res.json())
              .then(reactionData => {
                setMessages(current => current.map(m => 
                  m.id === messageId 
                    ? { ...m, reactions: reactionData.reactions || [] }
                    : m
                ))
              })
              .catch(err => console.error('Error fetching updated reactions:', err))
          }
          return msg
        }))
        
        setShowEmojiPicker(null)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Reaction API error:', response.status, errorData)
        throw new Error(errorData.error || `Failed to add reaction (${response.status})`)
      }
    } catch (error) {
      console.error('Error adding reaction:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add reaction')
    }
  }

  const startEditing = (message: ChatMessage) => {
    setEditingMessageId(message.id)
    setEditingContent(message.content)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const canModifyMessage = (message: ChatMessage) => {
    if (!session?.user) return false
    return message.author.id === session.user.id || 
           ['OWNER', 'ADMIN'].includes(session.user.role as string)
  }

  // Remove the async highlightMentions function since we'll handle it differently

  // Component to handle async mention highlighting
  const MessageContent = ({ content, orgId }: { content: string; orgId: string }) => {
    const [highlightedContent, setHighlightedContent] = useState(content)
    
    useEffect(() => {
      const highlightContent = async () => {
        try {
          const { highlightValidMentions } = await import('@/lib/mentionUtils')
          const highlighted = await highlightValidMentions(content, orgId)
          setHighlightedContent(highlighted)
        } catch (error) {
          console.error('Error highlighting mentions:', error)
          // Fallback to basic highlighting if the advanced one fails
          const basicHighlighted = content.replace(/@(\w+(?:\s+\w+)*)/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded font-medium">@$1</span>')
          setHighlightedContent(basicHighlighted)
        }
      }
      
      highlightContent()
    }, [content, orgId])
    
    return (
      <div 
        dangerouslySetInnerHTML={{
          __html: highlightedContent
        }}
      />
    )
  }

  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading chat...</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("flex flex-col h-[calc(100vh-180px)] max-h-[800px] min-h-[500px]", className)}>
      {/* Chat Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <MessageCircle className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-900 text-base">
          {stageName}
        </h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {messages.length}
        </Badge>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-3 py-4 overflow-y-auto">
        <div ref={chatContainerRef} className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1 text-gray-400">Start the conversation</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="group flex gap-2.5 hover:bg-gray-50 -mx-3 px-3 py-2 rounded-md transition-colors">
                {/* Avatar */}
                <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                  {message.author.image ? (
                    <img src={message.author.image} alt={message.author.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                      {message.author.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </Avatar>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {/* Author and Timestamp */}
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-900">
                      {message.author.name}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {format(new Date(message.createdAt), 'h:mm a')}
                    </span>
                    {message.isEdited && (
                      <span className="text-[11px] text-gray-400">(edited)</span>
                    )}
                  </div>

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
                          onClick={cancelEditing}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Message Text */}
                      {message.content && message.content !== '(Image)' && (
                        <div className="text-[13px] text-gray-700 leading-relaxed">
                          <MessageContent 
                            content={message.content} 
                            orgId={session?.user?.orgId || ''}
                          />
                        </div>
                      )}
                      
                      {/* Attached Image */}
                      {message.imageUrl && (
                        <div className="mt-1.5 relative inline-block group/image">
                          <img 
                            src={message.imageUrl} 
                            alt={message.imageFileName || 'Attached image'}
                            className="max-w-[320px] max-h-48 rounded-md border border-gray-200 cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => window.open(message.imageUrl, '_blank')}
                          />
                          <a
                            href={message.imageUrl}
                            download={message.imageFileName}
                            className="absolute top-1.5 right-1.5 p-1.5 bg-white/95 hover:bg-white rounded-md shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity"
                            title="Download image"
                          >
                            <Download className="w-3.5 h-3.5 text-gray-700" />
                          </a>
                        </div>
                      )}
                    </>
                  )}

                  {/* Mentions */}
                  {message.mentions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {message.mentions.map((mention) => (
                        <Badge key={mention.id} variant="outline" className="text-[11px] px-1.5 py-0">
                          @{mention.mentionedUser.name}
                        </Badge>
                      ))}
                    </div>
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
                                    ? "bg-blue-100 hover:bg-blue-200 border border-blue-300"
                                    : "bg-gray-100 hover:bg-gray-200 border border-gray-200"
                                )}
                              >
                                <span>{reaction.emoji}</span>
                                <span className="text-[11px] font-medium">{reaction.count}</span>
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
                    <div className="mt-2 relative">
                      <div className="absolute left-0 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
                        <div className="flex items-center gap-2">
                          {EMOJI_LIST.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(message.id, emoji)}
                              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors text-xl"
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex items-start gap-1">
                  {/* Add Reaction Button */}
                  {editingMessageId !== message.id && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                      title="Add reaction"
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  
                  {/* Edit/Delete Menu */}
                  {canModifyMessage(message) && editingMessageId !== message.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {message.author.id === session?.user.id && (
                          <DropdownMenuItem onClick={() => startEditing(message)}>
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
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Assigned Team Member Notification */}
      {assignedUser && assignedUser.id !== session?.user?.id && (
        <div className="px-3 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-2">
            {notifyAssignee ? (
              <>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">
                  <span className="font-medium">{assignedUser.name}</span> will be notified
                </span>
              </>
            ) : (
              <span className="text-gray-500">
                <span className="font-medium">{assignedUser.name}</span> won't be notified
              </span>
            )}
          </div>
          <button
            onClick={() => setNotifyAssignee(!notifyAssignee)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 hover:bg-blue-100 rounded"
            title={notifyAssignee ? "Don't notify" : 'Notify'}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-2 relative inline-block">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="max-w-[200px] max-h-24 rounded-lg border border-gray-300"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md transition-colors"
              title="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <MentionTextarea
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={sendMessage}
              teamMembers={teamMembers}
              placeholder={`Message ${stageName}...`}
              disabled={sending}
              submitLabel={sending ? "Sending..." : "Send"}
              rows={2}
            />
          </div>
          
          {/* Attach Image Button */}
          <div className="pb-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || !!selectedImage}
              title="Attach image"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default PhaseChat
