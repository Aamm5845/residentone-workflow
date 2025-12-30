'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Loader2, Upload as UploadIcon, X, FileImage, FileText, File, Video } from 'lucide-react'

interface Room {
  id: string
  name: string
  type: string
}

interface CreateUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  rooms?: Room[]
  onSuccess?: (update: any) => void
}

const UPDATE_TYPES = [
  { value: 'GENERAL', label: 'General Update' },
  { value: 'PHOTO', label: 'Photo Update' },
  { value: 'TASK', label: 'Task Update' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'MILESTONE', label: 'Milestone' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'ISSUE', label: 'Issue' }
]

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' }
]

export default function CreateUpdateDialog({
  open,
  onOpenChange,
  projectId,
  rooms = [],
  onSuccess
}: CreateUpdateDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    type: 'GENERAL',
    priority: 'MEDIUM',
    title: '',
    description: '',
    roomId: ''
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const isPdf = file.type === 'application/pdf'
      const isValidType = isImage || isVideo || isPdf
      // Allow 100MB for videos, 50MB for images/PDFs (using client-side upload to bypass 4.5MB limit)
      const maxSize = isVideo ? 100 * 1024 * 1024 : 50 * 1024 * 1024
      const isValidSize = file.size <= maxSize
      return isValidType && isValidSize
    })
    setSelectedFiles(prev => [...prev, ...validFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FileImage className="w-4 h-4 text-blue-500" />
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4 text-purple-500" />
    if (file.type === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />
    return <File className="w-4 h-4 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Filter out empty optional fields
      const submitData = {
        ...formData,
        roomId: formData.roomId || undefined,
        description: formData.description || undefined,
        title: formData.title || undefined
      }

      const response = await fetch(`/api/projects/${projectId}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create update')
      }

      const update = await response.json()

      // Upload files using client-side Blob upload (bypasses 4.5MB serverless limit)
      if (selectedFiles.length > 0) {
        setUploadProgress(`Uploading files (0/${selectedFiles.length})...`)

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i]
          setUploadProgress(`Uploading files (${i + 1}/${selectedFiles.length})...`)

          try {
            // Step 1: Upload directly to Vercel Blob (client-side, no size limit)
            const timestamp = Date.now()
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const blobPath = `project-updates/${projectId}/${update.id}/${timestamp}-${sanitizedName}`

            const blob = await upload(blobPath, file, {
              access: 'public',
              handleUploadUrl: '/api/blob-upload'
            })

            // Step 2: Save to database via our API
            await fetch(`/api/projects/${projectId}/updates/${update.id}/blob-photo`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                blobUrl: blob.url,
                filename: file.name,
                size: file.size,
                mimeType: file.type,
                caption: formData.title || '',
                notes: formData.description || '',
                tags: [],
                roomId: formData.roomId || null,
                takenAt: new Date().toISOString()
              })
            })
          } catch (uploadError) {
            console.error('File upload error:', uploadError)
            // Continue with other files even if one fails
          }
        }
      }
      
      // Reset form
      setFormData({
        type: 'GENERAL',
        priority: 'MEDIUM',
        title: '',
        description: '',
        roomId: ''
      })
      setSelectedFiles([])
      setUploadProgress('')
      
      onOpenChange(false)
      onSuccess?.(update)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
      setUploadProgress('')
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create Project Update</DialogTitle>
          <DialogDescription>
            Add a new update to track project progress, issues, or milestones.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {UPDATE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {rooms.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="room">Room (optional)</Label>
              <Select
                value={formData.roomId}
                onValueChange={(value) => handleChange('roomId', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific room</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter update title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the update..."
              rows={4}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* File Upload Section */}
          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <UploadIcon className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Click to upload images, videos, or PDFs</span>
                <span className="text-xs text-gray-400 mt-1">Max 50MB for images/PDFs, 100MB for videos</span>
              </label>
            </div>
            
            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mt-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(file)}
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">({formatFileSize(file.size)})</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={() => removeFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </form>

        <DialogFooter className="px-4 py-3 border-t flex-shrink-0 bg-white">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadProgress || 'Creating...'}
              </>
            ) : (
              `Create Update${selectedFiles.length > 0 ? ` (${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})` : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

