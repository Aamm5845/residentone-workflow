'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Bug, 
  Lightbulb, 
  RefreshCw, 
  MessageCircle,
  Send,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Issue {
  id: string
  title: string
  description: string
  type: 'BUG' | 'FEATURE_REQUEST' | 'UPDATE_REQUEST' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  reporter: {
    id: string
    name: string
    image?: string
    role: string
  }
  assignee?: {
    id: string
    name: string
    image?: string
    role: string
  }
  resolver?: {
    id: string
    name: string
    image?: string
    role: string
  }
  comments: Array<{
    id: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      image?: string
      role: string
    }
  }>
}

interface IssueModalProps {
  isOpen: boolean
  onClose: () => void
  onIssueCreated?: () => void
  onIssueUpdated?: () => void
  editingIssue?: Issue | null
  currentUser: {
    id: string
    name: string
    role: string
  }
}

const ISSUE_TYPES = {
  BUG: { icon: Bug, label: 'Bug Report', color: 'bg-red-100 text-red-800 border-red-200' },
  FEATURE_REQUEST: { icon: Lightbulb, label: 'Feature Request', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  UPDATE_REQUEST: { icon: RefreshCw, label: 'Update Request', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  GENERAL: { icon: MessageCircle, label: 'General', color: 'bg-gray-100 text-gray-800 border-gray-200' }
}

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-800 border-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  URGENT: 'bg-red-100 text-red-800 border-red-200'
}

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  RESOLVED: 'bg-green-100 text-green-800 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-800 border-gray-200'
}

export default function IssueModal({ 
  isOpen, 
  onClose, 
  onIssueCreated, 
  onIssueUpdated,
  editingIssue,
  currentUser 
}: IssueModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'BUG' | 'FEATURE_REQUEST' | 'UPDATE_REQUEST' | 'GENERAL'>('GENERAL')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [status, setStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('OPEN')
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [localIssue, setLocalIssue] = useState<Issue | null>(null)

  const isEditing = !!editingIssue
  const canEdit = isEditing && (
    editingIssue.reporter.id === currentUser.id ||
    editingIssue.assignee?.id === currentUser.id ||
    ['ADMIN', 'OWNER'].includes(currentUser.role)
  )
  const canDelete = isEditing && (
    editingIssue.reporter.id === currentUser.id ||
    ['ADMIN', 'OWNER'].includes(currentUser.role)
  )

  // Initialize form when editing issue changes
  useEffect(() => {
    if (editingIssue) {
      setTitle(editingIssue.title)
      setDescription(editingIssue.description)
      setType(editingIssue.type)
      setPriority(editingIssue.priority)
      setStatus(editingIssue.status)
      setLocalIssue(editingIssue)
    } else {
      // Reset form for new issue
      setTitle('')
      setDescription('')
      setType('GENERAL')
      setPriority('MEDIUM')
      setStatus('OPEN')
      setLocalIssue(null)
    }
    setNewComment('')
  }, [editingIssue, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      if (isEditing && editingIssue) {
        // Update existing issue
        const response = await fetch(`/api/issues/${editingIssue.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            description,
            type,
            priority,
            status
          }),
        })

        if (response.ok) {
          const updatedIssue = await response.json()
          setLocalIssue(updatedIssue)
          onIssueUpdated?.()
        } else {
          throw new Error('Failed to update issue')
        }
      } else {
        // Create new issue
        const response = await fetch('/api/issues', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            description,
            type,
            priority
          }),
        })

        if (response.ok) {
          onIssueCreated?.()
          onClose()
        } else {
          throw new Error('Failed to create issue')
        }
      }
    } catch (error) {
      console.error('Error submitting issue:', error)
      alert('Failed to submit issue. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isAddingComment || !editingIssue) return

    setIsAddingComment(true)
    try {
      const response = await fetch(`/api/issues/${editingIssue.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment
        }),
      })

      if (response.ok) {
        const comment = await response.json()
        if (localIssue) {
          setLocalIssue({
            ...localIssue,
            comments: [...localIssue.comments, comment]
          })
        }
        setNewComment('')
      } else {
        throw new Error('Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('Failed to add comment. Please try again.')
    } finally {
      setIsAddingComment(false)
    }
  }

  const handleDelete = async () => {
    if (!editingIssue || !canDelete) return
    
    if (!confirm('Are you sure you want to delete this issue? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/issues/${editingIssue.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onIssueUpdated?.()
        onClose()
      } else {
        throw new Error('Failed to delete issue')
      }
    } catch (error) {
      console.error('Error deleting issue:', error)
      alert('Failed to delete issue. Please try again.')
    }
  }

  const displayIssue = localIssue || editingIssue
  const TypeIcon = ISSUE_TYPES[type].icon

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <TypeIcon className="w-5 h-5" />
            <span>{isEditing ? 'Issue Details' : 'Report Issue'}</span>
            {isEditing && canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isEditing && displayIssue ? (
          // Issue Details View
          <div className="space-y-6">
            {/* Issue Header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{displayIssue.title}</h2>
                <div className="flex space-x-2">
                  <Badge className={PRIORITY_COLORS[displayIssue.priority]}>
                    {displayIssue.priority}
                  </Badge>
                  <Badge className={STATUS_COLORS[displayIssue.status]}>
                    {displayIssue.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={displayIssue.reporter.image} />
                    <AvatarFallback className="text-xs">
                      {displayIssue.reporter.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span>Reported by {displayIssue.reporter.name}</span>
                </div>
                <span>•</span>
                <span>{new Date(displayIssue.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Edit Form (if can edit) */}
            {canEdit ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-type">Type</Label>
                    <Select value={type} onValueChange={(value: any) => setType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ISSUE_TYPES).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center space-x-2">
                              <config.icon className="w-4 h-4" />
                              <span>{config.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Updating...' : 'Update Issue'}
                </Button>
              </form>
            ) : (
              // Read-only view
              <div className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <p className="mt-1 p-3 bg-gray-50 rounded-md text-gray-900 whitespace-pre-wrap">
                    {displayIssue.description}
                  </p>
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="space-y-4">
              <Label>Comments ({displayIssue.comments.length})</Label>
              
              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="flex space-x-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={!newComment.trim() || isAddingComment}
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>

              {/* Comments List */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {displayIssue.comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={comment.author.image} />
                          <AvatarFallback className="text-xs">
                            {comment.author.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{comment.author.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {comment.author.role}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
                
                {displayIssue.comments.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-4">No comments yet</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Create Issue Form
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={(value: any) => setType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ISSUE_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center space-x-2">
                          <config.icon className="w-4 h-4" />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue..."
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of the issue..."
                rows={4}
                required
              />
            </div>

            <div className="flex space-x-3">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Submitting...' : 'Submit Issue'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}