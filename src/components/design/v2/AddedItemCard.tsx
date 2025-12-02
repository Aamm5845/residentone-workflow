'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  MoreVertical,
  Trash2,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  X,
  ExternalLink,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Download,
  Paperclip,
  MessageSquare,
  StickyNote
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import DynamicIcon from './DynamicIcon'
import { useDeviceType } from '@/hooks/useDeviceType'

interface Props {
  item: any
  onUpdate: () => void
  viewMode: 'grid' | 'list'
  expanded: boolean  // Controlled by parent DesignConceptWorkspace
  onToggleExpanded: () => void  // Calls parent's toggle function
}

/**
 * AddedItemCard - Display and manage a design concept item
 * 
 * Features:
 * - Controlled expand/collapse state via props (prevents all items expanding together)
 * - Multi-note system with explicit save button and timestamps
 * - Consistent card sizing (fixed height when collapsed, flexible when expanded)
 * - Image and link management
 * - Completion toggle for renderer workflow
 */
export default function AddedItemCard({ item, onUpdate, viewMode, expanded, onToggleExpanded }: Props) {
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [viewingImageIndex, setViewingImageIndex] = useState(0)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  
  // iPad/Tablet detection for responsive styling
  const { isIPad, isTablet } = useDeviceType()
  const isTabletDevice = isIPad || isTablet

  // Debug: Log item data
  React.useEffect(() => {
    console.log('[AddedItemCard] Rendering item:', {
      id: item.id,
      name: item.libraryItem?.name,
      imageCount: item.images?.length || 0,
      linkCount: item.links?.length || 0,
      images: item.images
    })
  }, [item])

  const libraryItem = item.libraryItem
  const isCompleted = item.completedByRenderer
  const images = item.images || []
  const links = item.links || []
  const itemNotes = item.itemNotes || []
  const attachments = item.attachments || []

  // Save new note
  const saveNote = async () => {
    if (!newNoteContent.trim()) {
      toast.error('Note cannot be empty')
      return
    }

    setIsSavingNote(true)
    try {
      const response = await fetch(`/api/design-items/${item.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent })
      })

      if (!response.ok) throw new Error('Failed to save note')
      
      setNewNoteContent('')
      await onUpdate()
      toast.success('Note saved')
    } catch (error) {
      console.error('Error saving note:', error)
      toast.error('Failed to save note')
    } finally {
      setIsSavingNote(false)
    }
  }

  // Toggle completion (Vitor's action)
  const toggleComplete = async () => {
    try {
      const response = await fetch(`/api/design-items/${item.id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !isCompleted })
      })

      if (!response.ok) throw new Error('Failed to toggle completion')
      
      onUpdate()
      toast.success(isCompleted ? 'Marked as pending' : 'Marked as complete')
    } catch (error) {
      console.error('Error toggling completion:', error)
      toast.error('Failed to update status')
    }
  }

  // Delete item
  const deleteItem = async () => {
    if (!confirm(`Remove ${libraryItem.name} from design concept?`)) return

    try {
      const response = await fetch(`/api/design-items/${item.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete item')
      
      onUpdate()
      toast.success('Item removed')
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to remove item')
    }
  }

  // Delete image
  const deleteImage = async (imageId: string) => {
    if (!confirm('Remove this image?')) return

    try {
      const response = await fetch(`/api/design-items/${item.id}/images/${imageId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete image')
      
      onUpdate()
      toast.success('Image removed')
    } catch (error) {
      console.error('Error deleting image:', error)
      toast.error('Failed to remove image')
    }
  }

  // Delete link
  const deleteLink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/design-items/${item.id}/links/${linkId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete link')
      
      onUpdate()
      toast.success('Link removed')
    } catch (error) {
      console.error('Error deleting link:', error)
      toast.error('Failed to remove link')
    }
  }

  // Add link
  const addLink = async () => {
    if (!linkUrl) {
      toast.error('Please enter a URL')
      return
    }

    try {
      const response = await fetch(`/api/design-items/${item.id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl, title: linkTitle })
      })

      if (!response.ok) throw new Error('Failed to add link')
      
      setLinkUrl('')
      setLinkTitle('')
      setShowLinkDialog(false)
      onUpdate()
      toast.success('Link added')
    } catch (error) {
      console.error('Error adding link:', error)
      toast.error('Failed to add link')
    }
  }

  // Unified file upload handler - handles both images and documents
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    
    // Validate file size
    const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${isImage ? '10MB' : '50MB'}`)
      return
    }

    setIsUploadingFile(true)
    const toastId = toast.loading(`Uploading ${isImage ? 'image' : 'file'} to Dropbox...`)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Route to appropriate endpoint based on file type
      const endpoint = isImage 
        ? `/api/design-items/${item.id}/images`
        : `/api/design-items/${item.id}/attachments`

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload file')
      }

      console.log(`[AddedItemCard] ${isImage ? 'Image' : 'File'} uploaded successfully`)
      toast.success(`${isImage ? 'Image' : 'File'} uploaded successfully`, { id: toastId })
      
      await onUpdate()
      event.target.value = ''
    } catch (error: any) {
      console.error('Error uploading file:', error)
      toast.error(error.message || 'Failed to upload file', { id: toastId })
    } finally {
      setIsUploadingFile(false)
    }
  }

  // Delete attachment
  const deleteAttachment = async (attachmentId: string) => {
    if (!confirm('Remove this file?')) return

    try {
      const response = await fetch(`/api/design-items/${item.id}/attachments/${attachmentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete attachment')
      
      onUpdate()
      toast.success('File removed')
    } catch (error) {
      console.error('Error deleting attachment:', error)
      toast.error('Failed to remove file')
    }
  }

  // Get file icon based on MIME type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />
    if (fileType.includes('word') || fileType.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />
    if (fileType.includes('zip') || fileType.includes('compressed')) return <FileArchive className="w-5 h-5 text-orange-500" />
    return <FileText className="w-5 h-5 text-gray-500" />
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Calculate if item has any content
  const hasContent = (images.length + attachments.length) > 0 || links.length > 0 || itemNotes.length > 0

  return (
    <div className={cn(
      "rounded-xl border-2 transition-all duration-200 w-full overflow-hidden",
      isCompleted 
        ? "opacity-60 bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200" 
        : "bg-white border-gray-100 hover:border-indigo-200 hover:shadow-lg"
    )}>
      {/* Card Header - iPad: larger padding and touch targets */}
      <div className={cn("p-4", isTabletDevice && "p-5")}>
        {/* Top row: Checkbox, Name, Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex items-start gap-3 flex-1 min-w-0", isTabletDevice && "gap-4")}>
            {/* Completion Checkbox - iPad: larger touch target */}
            <button
              onClick={toggleComplete}
              className={cn(
                "flex-shrink-0 mt-0.5 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full",
                isTabletDevice && "p-1 -m-1" // Larger touch area on iPad
              )}
              aria-label={isCompleted ? 'Mark as pending' : 'Mark as complete'}
              aria-checked={isCompleted}
            >
              {isCompleted ? (
                <CheckCircle2 className={cn("w-6 h-6 text-green-500", isTabletDevice && "w-8 h-8")} />
              ) : (
                <Circle className={cn("w-6 h-6 text-gray-300 hover:text-indigo-400", isTabletDevice && "w-8 h-8")} />
              )}
            </button>

            {/* Item Info - iPad: larger text */}
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-semibold leading-tight",
                isCompleted ? "line-through text-gray-400" : "text-gray-900",
                isTabletDevice ? "text-lg" : "text-base"
              )}>
                {libraryItem.name}
              </h3>
              {/* Category - iPad: larger text */}
              <p className={cn(
                "text-gray-500 mt-0.5",
                isTabletDevice ? "text-sm" : "text-xs"
              )}>
                {libraryItem.category || 'Uncategorized'}
              </p>
            </div>
          </div>

          {/* Action Buttons - iPad: larger buttons */}
          <div className={cn("flex items-center flex-shrink-0", isTabletDevice ? "gap-2" : "gap-1")}>
          {/* More Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              className={cn("p-0", isTabletDevice ? "h-11 w-11" : "h-8 w-8")}
            >
              <MoreVertical className={cn(isTabletDevice ? "w-5 h-5" : "w-4 h-4")} />
            </Button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      deleteItem()
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove Item</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Expand/Collapse Toggle - iPad: larger button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
            className={cn(
              "p-0 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
              isTabletDevice ? "h-11 w-11" : "h-8 w-8"
            )}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? (
              <ChevronUp className={cn(isTabletDevice ? "w-5 h-5" : "w-4 h-4")} />
            ) : (
              <ChevronDown className={cn(isTabletDevice ? "w-5 h-5" : "w-4 h-4")} />
            )}
          </Button>
        </div>
        </div>

        {/* Content indicators - iPad: larger text and icons */}
        {hasContent && (
          <div className={cn(
            "flex items-center mt-3 pt-3 border-t border-gray-100",
            isTabletDevice ? "gap-4" : "gap-3"
          )}>
            {(images.length + attachments.length) > 0 && (
              <div className="flex items-center gap-1.5 text-blue-600">
                <Paperclip className={cn(isTabletDevice ? "w-5 h-5" : "w-4 h-4")} />
                <span className={cn("font-medium", isTabletDevice ? "text-base" : "text-sm")}>
                  {images.length + attachments.length} files
                </span>
              </div>
            )}
            {links.length > 0 && (
              <div className="flex items-center gap-1.5 text-purple-600">
                <LinkIcon className={cn(isTabletDevice ? "w-5 h-5" : "w-4 h-4")} />
                <span className={cn("font-medium", isTabletDevice ? "text-base" : "text-sm")}>
                  {links.length} links
                </span>
              </div>
            )}
            {itemNotes.length > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600">
                <StickyNote className={cn(isTabletDevice ? "w-5 h-5" : "w-4 h-4")} />
                <span className={cn("font-medium", isTabletDevice ? "text-base" : "text-sm")}>
                  {itemNotes.length} notes
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Content - iPad: larger padding and text */}
      {expanded && (
        <div className={cn(
          "border-t border-gray-100 space-y-4 transition-all duration-300",
          isTabletDevice ? "p-5 space-y-5" : "p-4"
        )}>
        {/* Notes */}
        <div>
          <label className={cn(
            "block font-medium text-gray-700 mb-2",
            isTabletDevice ? "text-base" : "text-sm"
          )}>
            Notes for Renderer ({itemNotes.length})
          </label>
          
          {/* Existing Notes List - iPad: larger text */}
          {itemNotes.length > 0 && (
            <div className={cn("mb-3 space-y-2 overflow-y-auto", isTabletDevice ? "max-h-80 space-y-3" : "max-h-64")}>
              {itemNotes.map((note: any) => (
                <div key={note.id} className={cn(
                  "bg-gray-50 rounded-lg border border-gray-200",
                  isTabletDevice ? "p-4" : "p-3"
                )}>
                  <p className={cn(
                    "text-gray-900 whitespace-pre-wrap",
                    isTabletDevice ? "text-base leading-relaxed" : "text-sm"
                  )}>
                    {note.content}
                  </p>
                  <div className={cn(
                    "mt-2 flex items-center text-gray-500",
                    isTabletDevice ? "text-sm" : "text-xs"
                  )}>
                    <span className="font-medium">{note.author.name || note.author.email}</span>
                    <span className="mx-1">•</span>
                    <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Add New Note - iPad: larger textarea and button */}
          <div className={cn("space-y-2", isTabletDevice && "space-y-3")}>
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Add a new note, specification, or detail for the 3D renderer..."
              className={cn(
                "w-full border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                isTabletDevice ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
              )}
              rows={isTabletDevice ? 4 : 3}
            />
            <Button
              onClick={saveNote}
              disabled={isSavingNote || !newNoteContent.trim()}
              size={isTabletDevice ? "default" : "sm"}
              className={cn(
                "bg-indigo-600 hover:bg-indigo-700 text-white",
                isTabletDevice && "h-11 px-5 text-base"
              )}
            >
              {isSavingNote ? (
                <>
                  <Loader2 className={cn("mr-1 animate-spin", isTabletDevice ? "w-4 h-4" : "w-3 h-3")} />
                  Saving...
                </>
              ) : (
                'Save Note'
              )}
            </Button>
          </div>
        </div>

        {/* Files & Images - Unified Upload Section - iPad: larger elements */}
        <div>
          <div className={cn("flex items-center justify-between", isTabletDevice ? "mb-3" : "mb-2")}>
            <label className={cn(
              "font-medium text-gray-700 flex items-center",
              isTabletDevice ? "text-base space-x-2" : "text-sm space-x-1"
            )}>
              <ImageIcon className={cn(isTabletDevice ? "w-5 h-5" : "w-4 h-4")} />
              <span>Files & Images</span>
              <span className="text-gray-500">({images.length + attachments.length} total)</span>
            </label>
            <Button 
              size={isTabletDevice ? "default" : "sm"}
              variant="outline" 
              className={cn(isTabletDevice ? "h-10 px-4 text-sm" : "h-7 text-xs")}
              disabled={isUploadingFile}
              onClick={() => document.getElementById(`file-upload-${item.id}`)?.click()}
            >
              <Plus className={cn("mr-1", isTabletDevice ? "w-4 h-4" : "w-3 h-3")} />
              {isUploadingFile ? 'Uploading...' : 'Upload'}
            </Button>
            <input
              id={`file-upload-${item.id}`}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploadingFile}
            />
          </div>

          {/* Display content */}
          {(images.length > 0 || attachments.length > 0) ? (
            <div className="space-y-3">
              {/* Images Grid */}
              {images.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Images ({images.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((image: any, idx: number) => (
                      <div key={image.id} className="relative aspect-square group">
                        <img
                          src={image.thumbnailUrl || image.url}
                          alt={image.fileName}
                          className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer"
                          onClick={() => {
                            setViewingImageIndex(idx)
                            setShowImageViewer(true)
                          }}
                        />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteImage(image.id)
                          }}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-1 right-1 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-3 h-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File Attachments List */}
              {attachments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Files ({attachments.length})</p>
                  <div className="space-y-2">
                    {attachments.map((attachment: any) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {getFileIcon(attachment.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {attachment.fileName.replace(/^\d+_/, '')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(attachment.fileSize || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => deleteAttachment(attachment.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <ImageIcon className="w-8 h-8 text-gray-400" />
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">No files or images yet</p>
              <p className="text-xs text-gray-400">Upload images, PDFs, documents, and more</p>
            </div>
          )}
        </div>

        {/* Links */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
              <LinkIcon className="w-4 h-4" />
              <span>Product Links</span>
              <span className="text-gray-500">({item.links?.length || 0})</span>
            </label>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-xs"
              onClick={() => setShowLinkDialog(true)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Link
            </Button>
          </div>

          {item.links && item.links.length > 0 ? (
            <div className="space-y-3">
              {item.links.map((link: any) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all group overflow-hidden"
                >
                  <div className="flex gap-3 p-3">
                    {/* Preview Image */}
                    {link.imageUrl ? (
                      <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={link.imageUrl}
                          alt={link.title || 'Link preview'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Hide image on error
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : link.favicon ? (
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded flex items-center justify-center">
                        <img
                          src={link.favicon}
                          alt=""
                          className="w-6 h-6"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        <LinkIcon className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Link Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600">
                            {link.title || link.url}
                          </h4>
                          {link.description && (
                            <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                              {link.description}
                            </p>
                          )}
                          {link.siteName && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              {link.favicon && (
                                <img src={link.favicon} alt="" className="w-3 h-3" onError={(e) => e.currentTarget.style.display = 'none'} />
                              )}
                              {link.siteName}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="p-1 text-gray-400 group-hover:text-indigo-500">
                            <ExternalLink className="w-3 h-3" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteLink(link.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500">No links yet</p>
              <p className="text-xs text-gray-400">Add product URLs or references</p>
            </div>
          )}
        </div>

        {/* Footer - Activity Log */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            <div>
              <span className="text-gray-600 font-medium">Added:</span>
              {' '}
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              {item.createdBy && (
                <span className="text-gray-700">
                  {' '}by {item.createdBy.name}
                </span>
              )}
            </div>
            {isCompleted && item.completedAt && (
              <div>
                <span className="text-green-600 font-medium">Completed:</span>
                {' '}
                {formatDistanceToNow(new Date(item.completedAt), { addSuffix: true })}
                {item.completedBy && (
                  <span className="text-gray-700">
                    {' '}by {item.completedBy.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLinkDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Add Product Link</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Product name or description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <Button onClick={addLink} className="flex-1">
                Add Link
              </Button>
              <Button variant="outline" onClick={() => setShowLinkDialog(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Lightbox */}
      {showImageViewer && item.images && item.images.length > 0 && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setShowImageViewer(false)}>
          <div className="relative max-w-6xl max-h-screen p-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageViewer(false)}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={item.images[viewingImageIndex].url}
              alt={item.images[viewingImageIndex].fileName}
              className="max-w-full max-h-screen object-contain"
            />
            {item.images.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
                {item.images.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setViewingImageIndex(idx)}
                    className={`w-2 h-2 rounded-full ${
                      idx === viewingImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
