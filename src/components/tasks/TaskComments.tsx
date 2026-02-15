'use client'

import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Send, MoreHorizontal, Trash2, Loader2 } from 'lucide-react'
import type { CommentData } from './types'

interface TaskCommentsProps {
  taskId: string
  comments: CommentData[]
  currentUserId: string
  onCommentsChange: (comments: CommentData[]) => void
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffWeeks === 1) return '1 week ago'
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email[0]?.toUpperCase() || '?'
}

export function TaskComments({
  taskId,
  comments,
  currentUserId,
  onCommentsChange,
}: TaskCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments.length])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedContent = newComment.trim()
    if (!trimmedContent) return

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmedContent }),
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      const data = await response.json()
      onCommentsChange([...comments, data.comment])
      setNewComment('')
    } catch {
      // Error handled silently; could add toast
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    setDeletingIds((prev) => new Set(prev).add(commentId))

    try {
      const response = await fetch(
        `/api/tasks/${taskId}/comments?commentId=${commentId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete comment')
      }

      onCommentsChange(comments.filter((c) => c.id !== commentId))
    } catch {
      // Error handled silently
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmitComment(e)
    }
  }

  return (
    <div className="space-y-3">
      {/* Comments list */}
      <div
        ref={scrollRef}
        className="space-y-4 max-h-[400px] overflow-y-auto pr-1"
      >
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage
                  src={comment.author.image || undefined}
                  alt={comment.author.name || comment.author.email}
                />
                <AvatarFallback className="text-xs">
                  {getInitials(comment.author.name, comment.author.email)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {comment.author.name || comment.author.email}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {getRelativeTime(comment.createdAt)}
                  </span>

                  {/* Delete menu - only for own comments */}
                  {comment.authorId === currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 ml-auto shrink-0"
                          disabled={deletingIds.has(comment.id)}
                        >
                          {deletingIds.has(comment.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-3 w-3" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete comment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmitComment} className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment... (Ctrl+Enter to send)"
          className="min-h-[36px] text-sm resize-none"
          rows={1}
          disabled={isSubmitting}
        />
        <Button
          type="submit"
          size="icon-sm"
          disabled={isSubmitting || !newComment.trim()}
          className="shrink-0 h-9 w-9"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
