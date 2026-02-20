'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { upload } from '@vercel/blob/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Upload,
  Loader2,
  CheckCircle,
  Tag,
  MoreVertical,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  Ruler,
  Play,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhotoItem {
  id: string
  name: string
  path: string
  relativePath: string
  url: string
  size: number
  lastModified: string
  folder: string
  tags: string[]
}

interface PhotosResponse {
  success: boolean
  photos: PhotoItem[]
  folders: string[]
  total: number
  allTags: string[]
  error?: string
}

interface PhotosGalleryProps {
  projectId: string
  dropboxFolder: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then(res => res.json())

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
function isVideoFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext))
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function getTodayDateFolder(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PhotosGallery({ projectId, dropboxFolder }: PhotosGalleryProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [tagInput, setTagInput] = useState('')

  const limit = 50
  const offset = page * limit

  const apiUrl = useMemo(() => {
    if (!dropboxFolder) return null
    let url = '/api/projects/' + projectId + '/project-files-v2/photos?limit=' + limit + '&offset=' + offset
    if (selectedFolder) {
      url += '&subfolder=' + encodeURIComponent(selectedFolder)
    }
    return url
  }, [projectId, dropboxFolder, offset, selectedFolder])

  const { data, isLoading, error, mutate } = useSWR<PhotosResponse>(apiUrl, fetcher)

  const photos = data?.photos ?? []
  const folders = data?.folders ?? []
  const total = data?.total ?? 0
  const allTags = data?.allTags ?? []

  // Client-side tag filtering
  const filteredPhotos = useMemo(() => {
    if (selectedTags.length === 0) return photos
    return photos.filter(p =>
      selectedTags.every(tag => p.tags?.includes(tag))
    )
  }, [photos, selectedTags])

  // Upload state
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)
  const [uploadType, setUploadType] = useState<'photo' | 'survey'>('photo')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)

  // Handle file input change — set uploading state IMMEDIATELY (synchronous)
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      setUploading(true)
      setUploadProgress({ done: 0, total: files.length })
      setUploadSuccess(false)
      setPendingFiles(files)
      e.target.value = ''
    }
  }, [])

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current = 0
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      setUploading(true)
      setUploadProgress({ done: 0, total: files.length })
      setUploadSuccess(false)
      setPendingFiles(files)
    }
  }, [])

  // Effect: upload pending files AFTER React paints the uploading state
  useEffect(() => {
    if (!pendingFiles) return
    const files = pendingFiles
    setPendingFiles(null)

    const doUpload = async () => {
      // Auto date folder — surveys go to a subfolder inside 5- Photos so they appear in the gallery
      const dateFolder = getTodayDateFolder()
      const targetPath = uploadType === 'survey'
        ? '5- Photos/Survey ' + dateFolder
        : '5- Photos/' + dateFolder

      const MAX_DIRECT_SIZE = 4 * 1024 * 1024 // 4MB — Vercel serverless limit

      let done = 0
      for (const file of files) {
        try {
          if (file.size > MAX_DIRECT_SIZE) {
            // Large file: upload to Vercel Blob first, then transfer to Dropbox
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_')
            const blobPath = `project-files/${projectId}/${dateFolder}/${Date.now()}-${sanitizedName}`
            const blob = await upload(blobPath, file, {
              access: 'public',
              handleUploadUrl: '/api/blob-upload',
            })
            // Transfer from blob to Dropbox
            await fetch('/api/projects/' + projectId + '/project-files-v2/upload-from-blob', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                blobUrl: blob.url,
                fileName: file.name,
                targetPath,
              }),
            })
          } else {
            // Small file: direct upload through server
            const formData = new FormData()
            formData.append('file', file)
            formData.append('path', targetPath)
            await fetch('/api/projects/' + projectId + '/project-files-v2/upload', {
              method: 'POST',
              body: formData,
            })
          }
          done++
          setUploadProgress({ done, total: files.length })
        } catch (err) {
          console.error('Upload error:', err)
          done++
          setUploadProgress({ done, total: files.length })
        }
      }

      setUploading(false)
      setUploadProgress(null)
      setUploadSuccess(true)
      mutate()
      setTimeout(() => setUploadSuccess(false), 3000)
    }

    doUpload()
  }, [pendingFiles, projectId, mutate, uploadType])

  // Reset page when folder/tag filter changes
  useEffect(() => {
    setPage(0)
  }, [selectedFolder, selectedTags])

  // Toggle tag filter
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  // Add tag to a photo
  const addTag = useCallback(async (photo: PhotoItem, newTag: string) => {
    const tag = newTag.toLowerCase().trim()
    if (!tag || photo.tags?.includes(tag)) return

    const updatedTags = [...(photo.tags || []), tag]

    // Optimistic update
    mutate(
      (current: PhotosResponse | undefined) => {
        if (!current) return current
        return {
          ...current,
          photos: current.photos.map(p =>
            p.id === photo.id ? { ...p, tags: updatedTags } : p
          ),
          allTags: [...new Set([...(current.allTags || []), tag])].sort()
        }
      },
      false
    )

    // Save to API
    await fetch('/api/projects/' + projectId + '/project-files-v2/photos/tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dropboxPath: photo.relativePath, tags: updatedTags })
    })

    mutate()
  }, [projectId, mutate])

  // Remove tag from a photo
  const removeTag = useCallback(async (photo: PhotoItem, tagToRemove: string) => {
    const updatedTags = (photo.tags || []).filter(t => t !== tagToRemove)

    // Optimistic update
    mutate(
      (current: PhotosResponse | undefined) => {
        if (!current) return current
        return {
          ...current,
          photos: current.photos.map(p =>
            p.id === photo.id ? { ...p, tags: updatedTags } : p
          ),
        }
      },
      false
    )

    // Save to API
    await fetch('/api/projects/' + projectId + '/project-files-v2/photos/tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dropboxPath: photo.relativePath, tags: updatedTags })
    })

    mutate()
  }, [projectId, mutate])

  // Selection state for multi-select / bulk delete
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const uploadMenuRef = useRef<HTMLDivElement>(null)

  // Close upload menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
        setShowUploadMenu(false)
      }
    }
    if (showUploadMenu) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showUploadMenu])

  // Toggle selection of a single photo
  const toggleSelect = useCallback((photoId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else {
        next.add(photoId)
      }
      return next
    })
  }, [])

  // Select all / deselect all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredPhotos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPhotos.map(p => p.id)))
    }
  }, [filteredPhotos, selectedIds.size])

  // Exit select mode
  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    setBulkDeleteLoading(true)
    try {
      const pathsToDelete = filteredPhotos
        .filter(p => selectedIds.has(p.id))
        .map(p => p.relativePath)

      await fetch('/api/projects/' + projectId + '/project-files-v2/photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropboxPaths: pathsToDelete })
      })

      setSelectedIds(new Set())
      setSelectMode(false)
      setBulkDeleteConfirm(false)
      // Close lightbox if open
      if (lightboxIndex !== null) {
        setLightboxIndex(null)
      }
      mutate()
    } catch (err) {
      console.error('Bulk delete error:', err)
    }
    setBulkDeleteLoading(false)
  }, [selectedIds, filteredPhotos, projectId, mutate, lightboxIndex])

  // Delete / Rename state
  const [deleteTarget, setDeleteTarget] = useState<PhotoItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [renameTarget, setRenameTarget] = useState<PhotoItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [actionMenuPhoto, setActionMenuPhoto] = useState<string | null>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  // Close action menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuPhoto(null)
      }
    }
    if (actionMenuPhoto) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [actionMenuPhoto])

  // Delete a photo
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await fetch('/api/projects/' + projectId + '/project-files-v2/photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropboxPath: deleteTarget.relativePath })
      })
      // If deleting the photo that's open in the lightbox, close the lightbox
      if (lightboxIndex !== null && filteredPhotos[lightboxIndex]?.id === deleteTarget.id) {
        setLightboxIndex(null)
      }
      mutate()
    } catch (err) {
      console.error('Delete error:', err)
    }
    setDeleteLoading(false)
    setDeleteTarget(null)
  }, [deleteTarget, projectId, mutate, lightboxIndex, filteredPhotos])

  // Rename a photo
  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return
    setRenameLoading(true)
    try {
      await fetch('/api/projects/' + projectId + '/project-files-v2/photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dropboxPath: renameTarget.relativePath,
          newName: renameValue.trim()
        })
      })
      mutate()
    } catch (err) {
      console.error('Rename error:', err)
    }
    setRenameLoading(false)
    setRenameTarget(null)
    setRenameValue('')
  }, [renameTarget, renameValue, projectId, mutate])

  // Lightbox navigation
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
    setTagInput('')
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
    setTagInput('')
  }, [])

  const goToNext = useCallback(() => {
    if (lightboxIndex !== null && lightboxIndex < filteredPhotos.length - 1) {
      setLightboxIndex(lightboxIndex + 1)
      setTagInput('')
    }
  }, [lightboxIndex, filteredPhotos.length])

  const goToPrev = useCallback(() => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1)
      setTagInput('')
    }
  }, [lightboxIndex])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate when typing in tag input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') goToNext()
      else if (e.key === 'ArrowLeft') goToPrev()
      else if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, goToNext, goToPrev, closeLightbox])

  // No Dropbox folder
  if (!dropboxFolder) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Camera className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No Dropbox folder linked</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Link a Dropbox folder to this project to browse photos.
        </p>
      </div>
    )
  }

  // Loading
  if (isLoading && photos.length === 0) {
    return <PhotosSkeleton />
  }

  // Error
  if (error || (data && !data.success)) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Camera className="w-7 h-7 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Could not load photos</h3>
        <p className="text-sm text-gray-500">{data?.error || 'An error occurred.'}</p>
      </div>
    )
  }

  // Empty
  if (photos.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Camera className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          {selectedFolder ? 'No photos in this folder' : 'No photos yet'}
        </h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
          {selectedFolder
            ? 'Try selecting a different folder or upload photos here.'
            : 'Upload photos or add them to the "5- Photos" folder in Dropbox.'}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading
              ? `Uploading ${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? 0}`
              : 'Upload Photos'}
          </Button>
          {selectedFolder && (
            <Button variant="outline" size="sm" onClick={() => setSelectedFolder(null)}>
              View All Photos
            </Button>
          )}
        </div>
        {/* Upload progress bar in empty state */}
        {uploading && uploadProgress && (
          <div className="mt-4 max-w-xs mx-auto">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Uploading {uploadProgress.done} of {uploadProgress.total} photos…
            </p>
          </div>
        )}
      </div>
    )
  }

  const hasMore = offset + limit < total
  const lightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null
  const dateFolder = getTodayDateFolder()

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Header + upload / select buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-900">
            Photos
            <span className="ml-1.5 text-xs text-gray-400 font-normal">({total})</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Select mode toggle */}
          {selectMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-1.5"
              >
                {selectedIds.size === filteredPhotos.length ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {selectedIds.size === filteredPhotos.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete ({selectedIds.size})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={exitSelectMode}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectMode(true)}
              className="gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Select
            </Button>
          )}

          {/* Upload button with dropdown for Photo / Survey */}
          <div className="relative" ref={uploadMenuRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (uploading) return
                setShowUploadMenu(!showUploadMenu)
              }}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {uploading
                ? `Uploading ${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? 0}`
                : 'Upload'}
            </Button>

            {showUploadMenu && !uploading && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                <button
                  onClick={() => {
                    setUploadType('photo')
                    setShowUploadMenu(false)
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*,video/*'
                      fileInputRef.current.click()
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Camera className="w-4 h-4 text-gray-500" />
                  <div className="text-left">
                    <p className="font-medium">Photos</p>
                    <p className="text-xs text-gray-400">Site photos &amp; videos</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setUploadType('survey')
                    setShowUploadMenu(false)
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf'
                      fileInputRef.current.click()
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Ruler className="w-4 h-4 text-blue-500" />
                  <div className="text-left">
                    <p className="font-medium">Survey</p>
                    <p className="text-xs text-gray-400">Dimension sketches &amp; notes</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload success toast */}
      {uploadSuccess && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {uploadType === 'survey' ? 'Survey uploaded to Photos/Survey ' + getTodayDateFolder() : 'Photos uploaded successfully'}
        </div>
      )}

      {/* Upload progress bar */}
      {uploading && uploadProgress && (
        <div className="mb-3">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Uploading {uploadProgress.done} of {uploadProgress.total} photos…
          </p>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-teal-50/90 border-2 border-dashed border-teal-400 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Camera className="w-10 h-10 text-teal-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-teal-700">Drop photos to upload</p>
            <p className="text-xs text-teal-500 mt-1">
              Photos will be saved to {uploadType === 'survey' ? `5- Photos/Survey ${dateFolder}` : `5- Photos/${dateFolder}`}
            </p>
          </div>
        </div>
      )}

      {/* Subfolder filter chips */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setSelectedFolder(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              !selectedFolder
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            All
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                selectedFolder === folder
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {folder}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredPhotos.map((photo, index) => {
          const isSelected = selectedIds.has(photo.id)
          return (
            <div
              key={photo.id}
              className={cn(
                'group relative aspect-square rounded-lg overflow-hidden bg-gray-100 border transition-all hover:shadow-md',
                selectMode && isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <button
                onClick={() => selectMode ? toggleSelect(photo.id) : openLightbox(index)}
                className="w-full h-full"
              >
                {isVideoFile(photo.name) ? (
                  <div className="w-full h-full relative bg-gray-900 flex items-center justify-center">
                    <video src={photo.url} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-xs text-white font-medium truncate">{photo.name}</p>
                    <p className="text-[10px] text-white/70">{formatDate(photo.lastModified)}</p>
                  </div>
                </div>
              </button>

              {/* Selection checkbox (select mode) */}
              {selectMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id) }}
                  className="absolute top-2 left-2 z-10"
                >
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-white/80 border-gray-300 backdrop-blur-sm'
                  )}>
                    {isSelected && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              )}

              {/* Folder badge */}
              {photo.folder && !selectedFolder && !selectMode && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium backdrop-blur-sm pointer-events-none">
                  {photo.folder}
                </div>
              )}
              {/* Tag count badge */}
              {photo.tags && photo.tags.length > 0 && (
                <div className={cn(
                  'absolute top-2 px-1.5 py-0.5 rounded bg-purple-600/80 text-[10px] text-white font-medium backdrop-blur-sm flex items-center gap-0.5 pointer-events-none',
                  selectMode ? 'right-2' : 'right-8'
                )}>
                  <Tag className="w-2.5 h-2.5" />
                  {photo.tags.length}
                </div>
              )}

              {/* Action menu button (hidden in select mode) */}
              {!selectMode && (
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionMenuPhoto(actionMenuPhoto === photo.id ? null : photo.id) }}
                    className="p-1 rounded-md bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-colors"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {/* Dropdown */}
                  {actionMenuPhoto === photo.id && (
                    <div
                      ref={actionMenuRef}
                      className="absolute top-full right-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuPhoto(null)
                          setRenameTarget(photo)
                          // Pre-fill with name without extension so user can't accidentally remove it
                          const extMatch = photo.name.match(/\.[a-zA-Z0-9]+$/)
                          setRenameValue(extMatch ? photo.name.slice(0, -extMatch[0].length) : photo.name)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionMenuPhoto(null)
                          setDeleteTarget(photo)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Filtered results message */}
      {selectedTags.length > 0 && filteredPhotos.length === 0 && (
        <div className="py-12 text-center">
          <Tag className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No photos match the selected tags</p>
          <button
            onClick={() => setSelectedTags([])}
            className="text-sm text-teal-600 hover:text-teal-700 mt-2"
          >
            Clear tag filters
          </button>
        </div>
      )}

      {/* Load more / pagination */}
      {(hasMore || page > 0) && (
        <div className="flex items-center justify-center gap-3 mt-6">
          {page > 0 && (
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
          )}
          <span className="text-sm text-gray-500">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          {hasMore && (
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          )}
        </div>
      )}

      {/* Lightbox Dialog */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => { if (!open) closeLightbox() }}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 bg-black border-none overflow-hidden [&>button]:hidden">
          {lightboxPhoto && (
            <div className="relative w-full h-full flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/80">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{lightboxPhoto.name}</p>
                  <p className="text-xs text-white/50">
                    {formatDate(lightboxPhoto.lastModified)} · {formatFileSize(lightboxPhoto.size)}
                    {lightboxPhoto.folder && (' · ' + lightboxPhoto.folder)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setRenameTarget(lightboxPhoto)
                      const extMatch = lightboxPhoto.name.match(/\.[a-zA-Z0-9]+$/)
                      setRenameValue(extMatch ? lightboxPhoto.name.slice(0, -extMatch[0].length) : lightboxPhoto.name)
                    }}
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    title="Rename"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(lightboxPhoto)}
                    className="p-2 rounded-lg text-white/70 hover:text-red-400 hover:bg-white/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-white/20 mx-0.5" />
                  <a
                    href={lightboxPhoto.url}
                    download={lightboxPhoto.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={closeLightbox}
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tags bar */}
              <div className="flex items-center gap-2 px-4 py-2 bg-black/60 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-white/40 shrink-0" />
                {lightboxPhoto.tags?.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(lightboxPhoto, tag)}
                      className="hover:text-red-300 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="bg-white/10 text-white text-xs rounded-full px-2.5 py-1 border border-white/20 placeholder-white/40 outline-none focus:border-white/40 w-24"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      addTag(lightboxPhoto, tagInput.trim())
                      setTagInput('')
                    }
                  }}
                />
              </div>

              {/* Image / Video */}
              <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                {isVideoFile(lightboxPhoto.name) ? (
                  <video
                    src={lightboxPhoto.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <img
                    src={lightboxPhoto.url}
                    alt={lightboxPhoto.name}
                    className="max-w-full max-h-full object-contain"
                  />
                )}

                {/* Prev/Next arrows */}
                {lightboxIndex !== null && lightboxIndex > 0 && (
                  <button
                    onClick={goToPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {lightboxIndex !== null && lightboxIndex < filteredPhotos.length - 1 && (
                  <button
                    onClick={goToNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Bottom counter */}
              <div className="text-center py-2 bg-black/80">
                <span className="text-xs text-white/50">
                  {(lightboxIndex ?? 0) + 1} of {filteredPhotos.length}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) { setDeleteTarget(null) } }}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Delete Photo</h3>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete <span className="font-medium text-gray-700">{deleteTarget?.name}</span>? This will permanently remove it from Dropbox.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="gap-1.5"
              >
                {deleteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setRenameValue('') } }}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Rename Photo</h3>
              <p className="text-sm text-gray-500 mt-1">
                Enter a new name for this photo. This will rename it in Dropbox.
              </p>
            </div>
            <div className="flex items-center gap-0">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="New filename"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameValue.trim()) handleRename()
                }}
              />
              {renameTarget && (() => {
                const extMatch = renameTarget.name.match(/\.[a-zA-Z0-9]+$/)
                return extMatch ? (
                  <span className="px-3 py-2 text-sm bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-500">
                    {extMatch[0]}
                  </span>
                ) : null
              })()}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setRenameTarget(null); setRenameValue('') }}
                disabled={renameLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRename}
                disabled={renameLoading || !renameValue.trim() || renameValue === renameTarget?.name}
                className="gap-1.5"
              >
                {renameLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={(open) => { if (!open) setBulkDeleteConfirm(false) }}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Delete {selectedIds.size} Photos</h3>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete <span className="font-medium text-gray-700">{selectedIds.size} photo{selectedIds.size !== 1 ? 's' : ''}</span>? This will permanently remove them from Dropbox.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkDeleteConfirm(false)}
                disabled={bulkDeleteLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                className="gap-1.5"
              >
                {bulkDeleteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete {selectedIds.size} Photos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PhotosSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
