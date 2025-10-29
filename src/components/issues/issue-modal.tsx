'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Bug, Lightbulb, RefreshCw, MessageCircle, Trash2, CheckCircle, Terminal } from 'lucide-react'

interface Issue {
  id: string
  title: string
  description: string
  type: 'BUG' | 'FEATURE_REQUEST' | 'UPDATE_REQUEST' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  createdAt: string
  updatedAt: string
  reporter: {
    id: string
    name: string
    image?: string
    role: string
  }
  metadata?: {
    consoleLog?: string
  }
}

interface IssueModalProps {
  isOpen: boolean
  onClose: () => void
  onIssueCreated?: () => void
  onIssueUpdated?: () => void
  editingIssue?: Issue | null
  viewOnly?: boolean
}

const ISSUE_TYPES = {
  BUG: { icon: Bug, label: 'Bug Report' },
  FEATURE_REQUEST: { icon: Lightbulb, label: 'Feature Request' },
  UPDATE_REQUEST: { icon: RefreshCw, label: 'Update Request' },
  GENERAL: { icon: MessageCircle, label: 'General' }
}

export function IssueModal({ isOpen, onClose, onIssueCreated, onIssueUpdated, editingIssue, viewOnly = false }: IssueModalProps) {
  const { data: session } = useSession()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [consoleLog, setConsoleLog] = useState('')
  const [type, setType] = useState<'BUG' | 'FEATURE_REQUEST' | 'UPDATE_REQUEST' | 'GENERAL'>('GENERAL')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [status, setStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('OPEN')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!editingIssue
  const canEdit = isEditing && (
    editingIssue.reporter.id === session?.user?.id ||
    ['ADMIN', 'OWNER'].includes(session?.user?.role || '')
  )
  const canDelete = canEdit

  // Initialize form when editing issue changes
  useEffect(() => {
    if (editingIssue) {
      setTitle(editingIssue.title)
      setDescription(editingIssue.description)
      setConsoleLog(editingIssue.metadata?.consoleLog || '')
      setType(editingIssue.type)
      setPriority(editingIssue.priority)
      setStatus(editingIssue.status)
    } else {
      // Reset form for new issue
      setTitle('')
      setDescription('')
      setConsoleLog('')
      setType('GENERAL')
      setPriority('MEDIUM')
      setStatus('OPEN')
    }
  }, [editingIssue, isOpen])

  // Reset form when modal opens/closes
  const handleClose = () => {
    if (!isEditing) {
      setTitle('')
      setDescription('')
      setConsoleLog('')
      setType('GENERAL')
      setPriority('MEDIUM')
      setStatus('OPEN')
    }
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !session?.user) return

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
            status,
            metadata: {
              consoleLog: consoleLog || undefined
            }
          }),
        })

        if (response.ok) {
          onIssueUpdated?.()
          handleClose()
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
            priority,
            metadata: {
              consoleLog: consoleLog || undefined
            }
          }),
        })

        if (response.ok) {
          onIssueCreated?.()
          handleClose()
        } else {
          throw new Error('Failed to create issue')
        }
      }
    } catch (error) {
      console.error('Error submitting issue:', error)
      alert(`Failed to ${isEditing ? 'update' : 'create'} issue. Please try again.`)
    } finally {
      setIsSubmitting(false)
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
        handleClose()
      } else {
        throw new Error('Failed to delete issue')
      }
    } catch (error) {
      console.error('Error deleting issue:', error)
      alert('Failed to delete issue. Please try again.')
    }
  }

  const handleMarkResolved = async () => {
    if (!editingIssue) return
    
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/issues/${editingIssue.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'RESOLVED'
        }),
      })

      if (response.ok) {
        onIssueUpdated?.()
        handleClose()
      } else {
        throw new Error('Failed to resolve issue')
      }
    } catch (error) {
      console.error('Error resolving issue:', error)
      alert('Failed to resolve issue. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Don't render if no user session
  if (!session?.user) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={viewOnly ? "max-w-3xl" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>{viewOnly ? 'View Issue' : isEditing ? 'Manage Issue' : 'Report Issue'}</span>
            </div>
            {isEditing && canDelete && !viewOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {viewOnly ? (
          <div className="space-y-4 p-6">
            {/* Quick Actions for viewing */}
            {isEditing && (
              <div className="flex space-x-2 pb-4 border-b">
                {editingIssue?.status !== 'RESOLVED' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleMarkResolved}
                    className="text-green-700 border-green-200 hover:bg-green-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Mark Resolved
                  </Button>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Type</Label>
                <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md text-sm">
                  {ISSUE_TYPES[type].label}
                </div>
              </div>

              <div>
                <Label>Priority</Label>
                <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md text-sm">
                  {priority}
                </div>
              </div>
              
              <div>
                <Label>Status</Label>
                <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md text-sm">
                  {status.replace('_', ' ')}
                </div>
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md text-sm">
                {title}
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <div className="mt-2 px-3 py-2 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                {description}
              </div>
            </div>

            {consoleLog && (
              <div>
                <Label className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Console Log
                </Label>
                <div className="mt-2 px-3 py-2 bg-gray-900 text-green-400 rounded-md text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {consoleLog}
                </div>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <Button type="button" onClick={handleClose} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Quick Actions for editing */}
          {isEditing && (
            <div className="flex space-x-2 pb-4 border-b">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkResolved}
                className="text-green-700 border-green-200 hover:bg-green-50"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark Resolved
              </Button>
            </div>
          )}
          
          <div className={`grid ${isEditing ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
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
            
            {isEditing && (
              <div>
                <Label htmlFor="status">Status</Label>
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
            )}
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

          <div>
            <Label htmlFor="consoleLog" className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Console Log (Press F12 to open browser console)
            </Label>
            <Textarea
              id="consoleLog"
              value={consoleLog}
              onChange={(e) => setConsoleLog(e.target.value)}
              placeholder="Paste any console errors or logs here...\n\nPress F12 in your browser to open the developer console, then copy any error messages and paste them here."
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (isEditing ? 'Updating...' : 'Submitting...') : (isEditing ? 'Update Issue' : 'Submit Issue')}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default IssueModal
