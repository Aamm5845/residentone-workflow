'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileText,
  Image,
  Film,
  Music,
  Archive,
  File,
  Trash2,
  Plus,
  ExternalLink,
  Loader2,
  Link,
  X,
} from 'lucide-react'
import type { AttachmentData } from './types'

interface TaskAttachmentsProps {
  taskId: string
  attachments: AttachmentData[]
  onAttachmentsChange: (attachments: AttachmentData[]) => void
}

function getFileIcon(name: string, type: string | null) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const mimeType = type?.toLowerCase() || ''

  // Image types
  if (
    mimeType.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)
  ) {
    return <Image className="h-4 w-4 text-green-600" />
  }

  // Video types
  if (
    mimeType.startsWith('video/') ||
    ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)
  ) {
    return <Film className="h-4 w-4 text-purple-600" />
  }

  // Audio types
  if (
    mimeType.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)
  ) {
    return <Music className="h-4 w-4 text-pink-600" />
  }

  // Archive types
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="h-4 w-4 text-amber-600" />
  }

  // Document types
  if (
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf'].includes(ext)
  ) {
    return <FileText className="h-4 w-4 text-blue-600" />
  }

  return <File className="h-4 w-4 text-gray-500" />
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1))

  return `${size} ${units[i]}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function TaskAttachments({
  taskId,
  attachments,
  onAttachmentsChange,
}: TaskAttachmentsProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = newName.trim()
    const trimmedUrl = newUrl.trim()

    if (!trimmedName || !trimmedUrl) return

    setIsAdding(true)

    try {
      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          url: trimmedUrl,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add attachment')
      }

      const data = await response.json()
      onAttachmentsChange([...attachments, data.attachment])
      setNewName('')
      setNewUrl('')
      setShowAddForm(false)
    } catch {
      // Error handled silently
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    setDeletingIds((prev) => new Set(prev).add(attachmentId))

    try {
      const response = await fetch(
        `/api/tasks/${taskId}/attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete attachment')
      }

      onAttachmentsChange(attachments.filter((a) => a.id !== attachmentId))
    } catch {
      // Error handled silently
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(attachmentId)
        return next
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* Attachments list */}
      {attachments.length === 0 && !showAddForm ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attachments yet.
        </p>
      ) : (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50 transition-colors"
            >
              {/* File icon */}
              <span className="shrink-0">
                {getFileIcon(attachment.name, attachment.type)}
              </span>

              {/* File details */}
              <div className="flex-1 min-w-0">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block"
                >
                  {attachment.name}
                  <ExternalLink className="inline h-3 w-3 ml-1 align-baseline" />
                </a>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {attachment.size !== null && (
                    <span>{formatFileSize(attachment.size)}</span>
                  )}
                  {attachment.uploadedBy && (
                    <>
                      {attachment.size !== null && <span>-</span>}
                      <span>{attachment.uploadedBy.name || 'Unknown'}</span>
                    </>
                  )}
                  <span>-</span>
                  <span>{formatDate(attachment.createdAt)}</span>
                </div>
              </div>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteAttachment(attachment.id)}
                disabled={deletingIds.has(attachment.id)}
              >
                {deletingIds.has(attachment.id) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add attachment form */}
      {showAddForm ? (
        <form
          onSubmit={handleAddAttachment}
          className="space-y-2 rounded-lg border border-slate-200 p-3 bg-slate-50"
        >
          <div className="space-y-1.5">
            <Label htmlFor="attachment-name" className="text-xs">
              File name
            </Label>
            <Input
              id="attachment-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Floor plan v2.pdf"
              className="h-8 text-sm"
              autoFocus
              disabled={isAdding}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attachment-url" className="text-xs">
              URL
            </Label>
            <div className="flex items-center gap-1.5">
              <Link className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                id="attachment-url"
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
                disabled={isAdding}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm(false)
                setNewName('')
                setNewUrl('')
              }}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isAdding || !newName.trim() || !newUrl.trim()}
            >
              {isAdding && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Attachment
        </Button>
      )}
    </div>
  )
}
