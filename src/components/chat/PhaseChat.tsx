'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { MoreHorizontal, Edit, Trash2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MentionTextarea } from '@/components/ui/mention-textarea'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  editedAt?: string
  isEdited: boolean
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
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  image?: string
}

interface PhaseChatProps {
  stageId: string
  stageName: string
  className?: string
}

export function PhaseChat({ stageId, stageName, className }: PhaseChatProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

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

  const sendMessage = async (content: string, mentions: string[]) => {
    if (!content.trim() || sending) return

    setSending(true)
    try {
      // Map mention names to user IDs using the same matching logic as the mention validation
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

      const response = await fetch(`/api/chat/${stageId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content.trim(),
          mentions: mentionIds
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        toast.success('Message sent!')
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
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
    <Card className={cn("flex flex-col", className)}>
      {/* Chat Header */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200">
        <MessageCircle className="w-5 h-5 text-gray-600" />
        <h3 className="font-medium text-gray-900">
          Team Chat - {stageName}
        </h3>
        <Badge variant="secondary" className="ml-auto">
          {messages.length} messages
        </Badge>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" style={{ height: '400px' }}>
        <div ref={chatContainerRef} className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="group flex gap-3">
                {/* Avatar */}
                <Avatar className="w-8 h-8 flex-shrink-0">
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">
                      {message.author.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                    </span>
                    {message.isEdited && (
                      <span className="text-xs text-gray-400">(edited)</span>
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
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <MessageContent 
                        content={message.content} 
                        orgId={session?.user?.orgId || ''}
                      />
                    </div>
                  )}

                  {/* Mentions */}
                  {message.mentions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.mentions.map((mention) => (
                        <Badge key={mention.id} variant="outline" className="text-xs">
                          @{mention.mentionedUser.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Actions */}
                {canModifyMessage(message) && editingMessageId !== message.id && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
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
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <MentionTextarea
          value={newMessage}
          onChange={setNewMessage}
          onSubmit={sendMessage}
          teamMembers={teamMembers}
          placeholder={`Message the ${stageName} team...`}
          disabled={sending}
          submitLabel={sending ? "Sending..." : "Send"}
          rows={2}
        />
      </div>
    </Card>
  )
}

export default PhaseChat
