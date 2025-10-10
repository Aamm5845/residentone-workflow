'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MentionTextarea } from '@/components/ui/mention-textarea'
import { processMentions, highlightMentions, highlightValidMentions } from '@/lib/mentionUtils'
import { useSession } from 'next-auth/react'
import {
  Send,
  MessageSquare,
  User,
  Reply,
  MoreVertical,
  Edit3,
  Trash2,
  Pin,
  PinOff,
  Heart,
  AtSign,
  Hash,
  Bold,
  Italic,
  Link,
  List,
  CheckSquare,
  Quote,
  Clock,
  Filter,
  Search,
  X,
  Plus,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

// Types
interface Author {
  id: string
  name: string
  role: string
  avatar?: string
  color?: string
}

interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  author: Author
  parentId?: string
  isPinned: boolean
  likes: number
  isLiked: boolean
  replies?: Comment[]
  mentions: string[]
  tags: Array<{
    id: string
    name: string
    color: string
  }>
}

interface DesignSection {
  id: string
  type: 'GENERAL' | 'WALL_COVERING' | 'CEILING' | 'FLOOR'
  comments: Comment[]
}

interface MessagePanelProps {
  sections: DesignSection[]
  onUpdate: () => void
  stageId: string
  projectId: string
  roomId: string
}

// User colors for avatars
const USER_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-teal-500'
]

export function MessagePanel({ sections, onUpdate, stageId, projectId, roomId }: MessagePanelProps) {
  const { data: session } = useSession()
  const [newMessage, setNewMessage] = useState('')
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [isComposing, setIsComposing] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showPinnedOnly, setShowPinnedOnly] = useState(false)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Flatten all comments from all sections and transform data
  const allComments = sections.reduce<Comment[]>((acc, section) => {
    const transformedComments = section.comments.map(comment => ({
      ...comment,
      sectionType: section.type,
      // Transform database structure to expected format
      isPinned: !!comment.commentPin,
      likes: comment.commentLikes?.length || 0,
      isLiked: false, // Simplified for now
      replies: [], // TODO: Implement threaded comments if needed
      mentions: comment.mentions ? JSON.parse(comment.mentions) : [],
      tags: comment.commentTags?.map((ct: any) => ct.tag) || []
    }))
    return [...acc, ...transformedComments]
  }, [])

  // Build threaded comments structure
  const buildCommentTree = (comments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>()
    const rootComments: Comment[] = []

    // First pass: create map and initialize replies arrays
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] })
    })

    // Second pass: build tree structure
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!
      
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId)
        if (parent) {
          parent.replies = parent.replies || []
          parent.replies.push(commentWithReplies)
        }
      } else {
        rootComments.push(commentWithReplies)
      }
    })

    return rootComments.sort((a, b) => {
      // Pinned comments first, then by creation date
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  // Filter comments
  const filteredComments = allComments.filter(comment => {
    const matchesSection = selectedSection === 'all' || comment.sectionType === selectedSection
    const matchesSearch = !searchTerm || 
      comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.author.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPinned = !showPinnedOnly || comment.isPinned
    
    return matchesSection && matchesSearch && matchesPinned
  })

  const threadedComments = buildCommentTree(filteredComments)


  // Fetch team members on component mount
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch('/api/team/mentions')
        if (response.ok) {
          const data = await response.json()
          setTeamMembers(data.teamMembers)
        }
      } catch (error) {
        // Error fetching team members
      }
    }
    
    fetchTeamMembers()
  }, [])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allComments.length])

  // Submit new message with @mention processing
  const handleSubmitMessage = async (text: string, mentions: string[]) => {
    if (!text.trim() || !session?.user) return

    const messageData = {
      sectionType: selectedSection !== 'all' ? selectedSection : 'GENERAL',
      content: text.trim(),
      mentions: JSON.stringify(mentions)
    }

    try {
      const response = await fetch(`/api/stages/${stageId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      })

      if (response.ok) {
        // Process mentions and create notifications
        if (mentions.length > 0 && session?.user) {
          const contextTitle = `${selectedSection !== 'all' ? selectedSection.replace('_', ' ') : 'General'} Discussion`
          await processMentions({
            text,
            authorId: session.user.id,
            authorName: session.user.name || 'Unknown User',
            orgId: session.user.orgId || '',
            contextTitle,
            relatedId: stageId,
            relatedType: 'STAGE',
            messagePreview: text.substring(0, 100)
          })
          
          if (mentions.length > 0) {
            toast.success(`Message sent! ${mentions.length} team member${mentions.length > 1 ? 's' : ''} mentioned.`)
          }
        } else {
          toast.success('Message sent!')
        }
        
        setNewMessage('')
        setReplyingTo(null)
        setIsComposing(false)
        onUpdate()
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    }
  }

  // Handle comment interactions
  const handleLikeComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      toast.error('Failed to like comment')
    }
  }

  const handlePinComment = async (commentId: string, isPinned: boolean) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !isPinned })
      })

      if (response.ok) {
        onUpdate()
        toast.success(isPinned ? 'Comment unpinned' : 'Comment pinned')
      }
    } catch (error) {
      toast.error('Failed to pin comment')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onUpdate()
        toast.success('Comment deleted')
      }
    } catch (error) {
      toast.error('Failed to delete comment')
    }
  }

  const startReply = (commentId: string) => {
    setReplyingTo(commentId)
    setIsComposing(true)
  }

  const startEdit = (comment: Comment) => {
    setEditingComment(comment.id)
    setEditContent(comment.content)
  }

  const saveEdit = async () => {
    if (!editingComment || !editContent.trim()) return

    try {
      const response = await fetch(`/api/comments/${editingComment}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent.trim()
        })
      })

      if (response.ok) {
        setEditingComment(null)
        setEditContent('')
        onUpdate()
        toast.success('Comment updated')
      }
    } catch (error) {
      toast.error('Failed to update comment')
    }
  }

  const toggleThread = (commentId: string) => {
    const newExpanded = new Set(expandedThreads)
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId)
    } else {
      newExpanded.add(commentId)
    }
    setExpandedThreads(newExpanded)
  }

  const getUserColor = (userId: string) => {
    return USER_COLORS[userId.charCodeAt(0) % USER_COLORS.length]
  }

  // Component to handle async message content parsing
  const CommentContent = ({ content, orgId }: { content: string; orgId: string }) => {
    const [parsedContent, setParsedContent] = useState(content)
    
    useEffect(() => {
      const parseContent = async () => {
        try {
          const highlightedMentions = await highlightValidMentions(content, orgId)
          const formatted = highlightedMentions
            .replace(/#(\w+)/g, '<span class="text-purple-600 font-medium bg-purple-50 px-1 rounded">#$1</span>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
          setParsedContent(formatted)
        } catch (error) {
          console.error('Error parsing message content:', error)
          // Fallback to basic highlighting if the advanced one fails
          const basicFormatted = content
            .replace(/@(\w+(?:\s+\w+)*)/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded font-medium">@$1</span>')
            .replace(/#(\w+)/g, '<span class="text-purple-600 font-medium bg-purple-50 px-1 rounded">#$1</span>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
          setParsedContent(basicFormatted)
        }
      }
      
      parseContent()
    }, [content, orgId])
    
    return (
      <div 
        className="prose prose-sm max-w-none text-gray-900 mb-3"
        dangerouslySetInnerHTML={{ __html: parsedContent }}
      />
    )
  }

  // Comment Component
  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const [showActions, setShowActions] = useState(false)
    const hasReplies = comment.replies && comment.replies.length > 0
    const isExpanded = expandedThreads.has(comment.id)

    return (
      <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''} mb-4`}>
        <div 
          className={`bg-white rounded-lg border p-4 hover:shadow-sm transition-all ${
            comment.isPinned ? 'ring-2 ring-amber-200 border-amber-300' : 'border-gray-200'
          }`}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          {/* Pinned badge */}
          {comment.isPinned && (
            <div className="mb-2">
              <span className="inline-flex items-center bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
                <Pin className="w-3 h-3 mr-1" />
                Pinned
              </span>
            </div>
          )}

          {/* Author info */}
          <div className="flex items-start space-x-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getUserColor(comment.author.id)}`}>
              {comment.author.avatar ? (
                <img src={comment.author.avatar} alt={comment.author.name} className="w-8 h-8 rounded-full" />
              ) : (
                comment.author.name[0].toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{comment.author.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    {comment.updatedAt !== comment.createdAt && ' (edited)'}
                  </p>
                </div>
                
                {/* Actions */}
                {showActions && (
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-7 h-7 p-0"
                      onClick={() => handleLikeComment(comment.id)}
                    >
                      <Heart className={`w-4 h-4 ${comment.isLiked ? 'text-red-500 fill-current' : 'text-gray-400'}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-7 h-7 p-0"
                      onClick={() => startReply(comment.id)}
                    >
                      <Reply className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-7 h-7 p-0"
                      onClick={() => handlePinComment(comment.id, comment.isPinned)}
                    >
                      {comment.isPinned ? (
                        <PinOff className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Pin className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-7 h-7 p-0"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comment content */}
          {editingComment === comment.id ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex space-x-2">
                <Button size="sm" onClick={saveEdit}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <CommentContent 
              content={comment.content} 
              orgId={session?.user?.orgId || ''}
            />
          )}

          {/* Tags */}
          {comment.tags && comment.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {comment.tags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              {comment.likes > 0 && (
                <span className="flex items-center space-x-1">
                  <Heart className="w-3 h-3" />
                  <span>{comment.likes}</span>
                </span>
              )}
              {hasReplies && (
                <button
                  onClick={() => toggleThread(comment.id)}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span>{comment.replies!.length} replies</span>
                </button>
              )}
            </div>
            <button
              onClick={() => startReply(comment.id)}
              className="hover:text-gray-700"
            >
              Reply
            </button>
          </div>
        </div>

        {/* Replies */}
        {hasReplies && isExpanded && (
          <div className="mt-3">
            {comment.replies!.map(reply => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-purple-600" />
            Messages & Notes
          </h3>
          <Button
            onClick={() => setIsComposing(true)}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Message
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-between">
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Sections</option>
              <option value="GENERAL">✨ General</option>
              <option value="WALL_COVERING">🎨 Wall Covering</option>
              <option value="CEILING">⬆️ Ceiling</option>
              <option value="FLOOR">⬇️ Floor</option>
            </select>

            <Button
              variant={showPinnedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            >
              <Pin className="w-4 h-4 mr-1" />
              Pinned
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {threadedComments.length > 0 ? (
          <>
            {threadedComments.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600 mb-6">Start a conversation about this design concept.</p>
            <Button
              onClick={() => setIsComposing(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Start Discussion
            </Button>
          </div>
        )}
      </div>

      {/* Compose Message */}
      {isComposing && (
        <div className="p-4 border-t border-gray-200 bg-white">
          {replyingTo && (
            <div className="mb-2 p-2 bg-blue-50 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Replying to message</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReplyingTo(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <MentionTextarea
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={handleSubmitMessage}
              teamMembers={teamMembers}
              placeholder="Write your message... Use @name to mention team members and #tags"
              rows={3}
              submitLabel="Send Message"
              className="focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Button type="button" size="sm" variant="ghost" className="w-8 h-8 p-0" title="Bold">
                  <Bold className="w-4 h-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="w-8 h-8 p-0" title="Italic">
                  <Italic className="w-4 h-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="w-8 h-8 p-0" title="Add Link">
                  <Link className="w-4 h-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="w-8 h-8 p-0" title="Mention Team Member">
                  <AtSign className="w-4 h-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="w-8 h-8 p-0" title="Add Tag">
                  <Hash className="w-4 h-4" />
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsComposing(false)
                  setNewMessage('')
                  setReplyingTo(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}