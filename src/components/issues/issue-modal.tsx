'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
import { AlertCircle, Bug, Lightbulb, RefreshCw, MessageCircle, Trash2, CheckCircle, Terminal, Upload, X, Image as ImageIcon, Zap, ArrowLeft } from 'lucide-react'
import { AIAssistedIssueForm } from './ai-assisted-issue-form'

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
    imageUrl?: string
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
  const pathname = usePathname() // Capture current page for issue context
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [consoleLog, setConsoleLog] = useState('')
  const [type, setType] = useState<'BUG' | 'FEATURE_REQUEST' | 'UPDATE_REQUEST' | 'GENERAL'>('GENERAL')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [status, setStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('OPEN')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [useAIAssist, setUseAIAssist] = useState(false)

  const isEditing = !!editingIssue
  const canEdit = true // Everyone can edit
  const canDelete = true // Everyone can delete

  // Initialize form when editing issue changes
  useEffect(() => {
    if (editingIssue) {
      setTitle(editingIssue.title)
      setDescription(editingIssue.description)
      setConsoleLog(editingIssue.metadata?.consoleLog || '')
      setType(editingIssue.type)
      setPriority(editingIssue.priority)
      setStatus(editingIssue.status)
      // Set existing image if available
      if (editingIssue.metadata?.imageUrl) {
        setImagePreview(editingIssue.metadata.imageUrl)
      } else {
        setImagePreview(null)
      }
      setImageFile(null)
      setImageError(null)
    } else {
      // Reset form for new issue
      setTitle('')
      setDescription('')
      setConsoleLog('')
      setType('GENERAL')
      setPriority('MEDIUM')
      setStatus('OPEN')
      setImageFile(null)
      setImagePreview(null)
      setImageError(null)
      setUseAIAssist(false)
    }
  }, [editingIssue, isOpen])

  
  // Cleanup image preview URL on unmount or when imageFile changes
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  // Handle image file selection with validation
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setImageError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
      return
    }

    // Validate file size (4MB max)
    const maxSize = 4 * 1024 * 1024 // 4MB
    if (file.size > maxSize) {
      setImageError('File is too large. Maximum size is 4MB.')
      return
    }

    // Clear any previous error
    setImageError(null)

    // Clean up previous preview URL if it was a blob
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setImageFile(file)
    setImagePreview(previewUrl)
  }

  // Remove selected image
  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }
    setImageFile(null)
    setImagePreview(null)
    setImageError(null)
  }

  // Reset form when modal opens/closes
  const handleClose = () => {
    if (!isEditing) {
      setTitle('')
      setDescription('')
      setConsoleLog('')
      setType('GENERAL')
      setPriority('MEDIUM')
      setStatus('OPEN')
      setUseAIAssist(false)
    }
    // Clean up image preview
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }
    setImageFile(null)
    setImagePreview(null)
    setImageError(null)
    onClose()
  }

  // Handle clicking Urgent Auto Fix button
  const handleUrgentAutoFix = () => {
    setPriority('URGENT')
    setUseAIAssist(true)
  }

  // Handle AI-assisted form submission
  const handleAISubmit = async (data: {
    title: string
    description: string
    type: string
    consoleLog?: string
    imageFile?: File | null
  }) => {
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('description', data.description)
      formData.append('type', data.type)
      formData.append('priority', priority)
      formData.append('aiAssisted', 'true') // Mark as AI-assisted for auto-fix

      if (data.consoleLog) {
        formData.append('consoleLog', data.consoleLog)
      }

      if (data.imageFile) {
        formData.append('image', data.imageFile)
      }

      const response = await fetch('/api/issues', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        onIssueCreated?.()
        handleClose()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create issue')
      }
    } catch (error) {
      console.error('Error submitting issue:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Error submitting issue: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !session?.user) return

    setIsSubmitting(true)
    try {
      if (isEditing && editingIssue) {
        // Update existing issue (no image replacement for now)
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
              consoleLog: consoleLog.trim() || null
            }
          }),
        })

        if (response.ok) {
          onIssueUpdated?.()
          handleClose()
        } else {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error || `Failed to update issue (${response.status})`
          throw new Error(errorMessage)
        }
      } else {
        // Create new issue with FormData to support image upload
        const formData = new FormData()
        formData.append('title', title.trim())
        formData.append('description', description.trim())
        formData.append('type', type)
        formData.append('priority', priority)
        
        if (consoleLog) {
          formData.append('consoleLog', consoleLog)
        }
        
        if (imageFile) {
          formData.append('image', imageFile)
        }
        
        const response = await fetch('/api/issues', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          onIssueCreated?.()
          handleClose()
        } else {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create issue')
        }
      }
    } catch (error) {
      console.error('Error submitting issue:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Error submitting issue: ${errorMessage}`)
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
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `Failed to delete issue (${response.status})`
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error deleting issue:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Error deleting issue: ${errorMessage}`)
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
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `Failed to resolve issue (${response.status})`
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error resolving issue:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Error resolving issue: ${errorMessage}`)
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
      <DialogContent className={viewOnly ? "max-w-3xl" : useAIAssist && !isEditing ? "max-w-xl" : "max-w-md"}>
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
          <DialogDescription className="sr-only">
            {viewOnly ? 'View issue details' : isEditing ? 'Edit or manage the issue' : 'Report a new issue or bug'}
          </DialogDescription>
        </DialogHeader>

        {/* AI-Assisted Issue Form for urgent auto-fix */}
        {useAIAssist && !isEditing && !viewOnly ? (
          <div className="p-6">
            <AIAssistedIssueForm
              priority={priority as 'HIGH' | 'URGENT'}
              currentPage={pathname || undefined}
              onSubmit={handleAISubmit}
              onCancel={handleClose}
              onSwitchToManual={() => setUseAIAssist(false)}
            />
          </div>
        ) : viewOnly ? (
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
                  {ISSUE_TYPES[type]?.label || type || 'Unknown'}
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

            {editingIssue?.metadata?.imageUrl && (
              <div>
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Attached Screenshot
                </Label>
                <div className="mt-2">
                  <a
                    href={editingIssue.metadata.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={editingIssue.metadata.imageUrl}
                      alt="Issue attachment"
                      className="w-full max-h-96 object-contain border border-gray-200 rounded-md bg-gray-50 hover:border-blue-400 transition-colors"
                    />
                  </a>
                  <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
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

          {/* Urgent Auto Fix button for new issues */}
          {!isEditing && (
            <button
              type="button"
              onClick={handleUrgentAutoFix}
              className="w-full p-3 border-2 border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-red-100 rounded-md group-hover:bg-red-200 transition-colors">
                  <Zap className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">Urgent Auto Fix</span>
                  <p className="text-xs text-gray-500">AI will clarify and fix automatically</p>
                </div>
              </div>
            </button>
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

          <div>
            <Label htmlFor="issueImage" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Attach Screenshot (Optional)
            </Label>
            <div className="mt-2">
              {!imagePreview ? (
                <label
                  htmlFor="issueImage"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Click to upload an image</span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG, WebP (Max 4MB)</span>
                  <input
                    id="issueImage"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Issue preview"
                    className="w-full h-48 object-contain border border-gray-200 rounded-lg bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {imageError && (
                <p className="text-sm text-red-600 mt-2">{imageError}</p>
              )}
            </div>
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
