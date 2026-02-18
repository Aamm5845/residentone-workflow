'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  FolderOpen,
  File,
  FileText,
  Image as ImageIcon,
  PenTool,
  Box,
  Camera,
  FileCheck,
  BookOpen,
  Download,
  ExternalLink,
  ArrowLeft,
  Film,
  FileSpreadsheet,
  Presentation,
  Music,
  Archive,
  Upload,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DropboxFileItem {
  id: string
  name: string
  path: string
  size: number
  lastModified: string
  isFolder: boolean
  revision?: string
  thumbnailUrl?: string
}

interface BrowseResponse {
  success: boolean
  files: DropboxFileItem[]
  folders: DropboxFileItem[]
  hasMore: boolean
  cursor?: string
  currentPath: string
}

interface AllFilesBrowserProps {
  projectId: string
  dropboxFolder: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FOLDER_CONFIG: Record<string, { icon: any; colorClass: string; bgClass: string; label: string }> = {
  '1- cad':        { icon: PenTool,   colorClass: 'text-blue-600',    bgClass: 'bg-blue-50 border-blue-200',    label: 'CAD Files' },
  '2- 3d models':  { icon: Box,       colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50 border-emerald-200', label: '3D Models' },
  '3- renderings': { icon: ImageIcon,  colorClass: 'text-purple-600',  bgClass: 'bg-purple-50 border-purple-200',  label: 'Renderings' },
  '4- drawings':   { icon: FileText,  colorClass: 'text-red-600',     bgClass: 'bg-red-50 border-red-200',     label: 'Drawings' },
  '5- photos':     { icon: Camera,    colorClass: 'text-teal-600',    bgClass: 'bg-teal-50 border-teal-200',    label: 'Photos' },
  '6- documents':  { icon: FileCheck, colorClass: 'text-amber-600',   bgClass: 'bg-amber-50 border-amber-200',   label: 'Documents' },
  '7- reference':  { icon: BookOpen,  colorClass: 'text-gray-600',    bgClass: 'bg-gray-50 border-gray-200',    label: 'Reference' },
}

function getFolderConfig(name: string) {
  const lower = name.toLowerCase()
  for (const [key, config] of Object.entries(FOLDER_CONFIG)) {
    if (lower.startsWith(key)) return config
  }
  return { icon: FolderOpen, colorClass: 'text-gray-500', bgClass: 'bg-gray-50 border-gray-200', label: name }
}

function getFileIcon(filename: string): { icon: any; colorClass: string } {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return { icon: FileText, colorClass: 'text-red-500' }
  if (lower.endsWith('.dwg') || lower.endsWith('.dxf')) return { icon: PenTool, colorClass: 'text-blue-500' }
  if (lower.endsWith('.skp')) return { icon: Box, colorClass: 'text-emerald-500' }
  if (lower.endsWith('.max') || lower.endsWith('.3ds')) return { icon: Box, colorClass: 'text-orange-500' }
  if (lower.endsWith('.psd') || lower.endsWith('.ai') || lower.endsWith('.indd')) return { icon: ImageIcon, colorClass: 'text-purple-500' }
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|heic|tiff|bmp|svg)$/)) return { icon: ImageIcon, colorClass: 'text-teal-500' }
  if (lower.match(/\.(mp4|mov|avi|wmv|mkv)$/)) return { icon: Film, colorClass: 'text-indigo-500' }
  if (lower.match(/\.(mp3|wav|aac|flac)$/)) return { icon: Music, colorClass: 'text-pink-500' }
  if (lower.match(/\.(xlsx|xls|csv)$/)) return { icon: FileSpreadsheet, colorClass: 'text-green-600' }
  if (lower.match(/\.(pptx|ppt)$/)) return { icon: Presentation, colorClass: 'text-orange-500' }
  if (lower.match(/\.(docx|doc|txt|rtf)$/)) return { icon: FileText, colorClass: 'text-blue-600' }
  if (lower.match(/\.(zip|rar|7z|tar|gz)$/)) return { icon: Archive, colorClass: 'text-gray-500' }
  return { icon: File, colorClass: 'text-gray-400' }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function cleanFolderName(name: string): string {
  // Strip number prefix like "1- " or "2- "
  return name.replace(/^\d+-\s*/, '')
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AllFilesBrowser({ projectId, dropboxFolder }: AllFilesBrowserProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)

  const { data, isLoading, error, mutate } = useSWR<BrowseResponse>(
    dropboxFolder
      ? '/api/projects/' + projectId + '/project-files-v2/browse?path=' + encodeURIComponent(currentPath) + '&thumbnails=true'
      : null,
    fetcher
  )

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return []
    return currentPath.split('/').filter(Boolean)
  }, [currentPath])

  // Upload files to current folder
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!currentPath || files.length === 0) return
    setUploading(true)
    setUploadProgress({ done: 0, total: files.length })
    setUploadSuccess(false)

    let done = 0
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', currentPath)
        await fetch('/api/projects/' + projectId + '/project-files-v2/upload', {
          method: 'POST',
          body: formData,
        })
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
    mutate() // Refresh the file list
    setTimeout(() => setUploadSuccess(false), 3000)
  }, [currentPath, projectId, mutate])

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
      uploadFiles(e.dataTransfer.files)
    }
  }, [uploadFiles])

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
      e.target.value = '' // Reset so same file can be re-selected
    }
  }, [uploadFiles])

  // Navigate into a folder
  const navigateToFolder = (folderPath: string) => {
    setCurrentPath(folderPath)
  }

  // Navigate via breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    if (index < 0) {
      setCurrentPath('')
    } else {
      const parts = currentPath.split('/').filter(Boolean)
      setCurrentPath(parts.slice(0, index + 1).join('/'))
    }
  }

  // Handle download (open temp link in new tab)
  const handleDownload = async (file: DropboxFileItem) => {
    if (file.thumbnailUrl) {
      window.open(file.thumbnailUrl, '_blank')
      return
    }
    // For non-image files, fetch a temp link
    try {
      const res = await fetch(
        '/api/projects/' + projectId + '/project-files-v2/browse?path=' + encodeURIComponent(currentPath) + '&thumbnails=true'
      )
      const data = await res.json()
      const found = data.files?.find((f: any) => f.path === file.path)
      if (found?.thumbnailUrl) {
        window.open(found.thumbnailUrl, '_blank')
      }
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  // No Dropbox folder
  if (!dropboxFolder) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No Dropbox folder linked</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Link a Dropbox folder to this project to browse your files here.
        </p>
      </div>
    )
  }

  // Loading
  if (isLoading) {
    return currentPath ? <FileListSkeleton /> : <FolderCardsSkeleton />
  }

  // Error
  if (error || (data && !data.success)) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="w-7 h-7 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Could not load files</h3>
        <p className="text-sm text-gray-500">{data?.error || 'An error occurred while loading files.'}</p>
      </div>
    )
  }

  const folders = data?.folders ?? []
  const files = data?.files ?? []

  // =========================================================================
  // ROOT VIEW — Folder cards
  // =========================================================================
  if (!currentPath) {
    return (
      <div>
        {folders.length === 0 && files.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No folders found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Your Dropbox project folder appears to be empty.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {folders.map((folder) => {
              const config = getFolderConfig(folder.name)
              const Icon = config.icon
              return (
                <button
                  key={folder.id}
                  onClick={() => navigateToFolder(folder.path)}
                  className={cn(
                    'group relative flex flex-col items-center gap-3 p-6 rounded-xl border transition-all',
                    'hover:shadow-md hover:-translate-y-0.5',
                    config.bgClass
                  )}
                >
                  <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center bg-white/80 shadow-sm')}>
                    <Icon className={cn('w-6 h-6', config.colorClass)} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">{cleanFolderName(folder.name)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Root-level files (if any) */}
        {files.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Files</h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {files.map((file) => (
                <FileRow key={file.id} file={file} onDownload={handleDownload} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // SUBFOLDER VIEW — Breadcrumbs + file table + upload
  // =========================================================================
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
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Breadcrumb + upload button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Files
          </button>
          {breadcrumbs.map((segment, index) => (
            <span key={index} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-gray-900">{cleanFolderName(segment)}</span>
              ) : (
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className="text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {cleanFolderName(segment)}
                </button>
              )}
            </span>
          ))}
        </div>

        {/* Upload button */}
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
            : 'Upload Files'}
        </Button>
      </div>

      {/* Upload success toast */}
      {uploadSuccess && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Files uploaded successfully
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
            Uploading {uploadProgress.done} of {uploadProgress.total} files…
          </p>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-teal-50/90 border-2 border-dashed border-teal-400 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="w-10 h-10 text-teal-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-teal-700">Drop files to upload</p>
            <p className="text-xs text-teal-500 mt-1">Files will be added to the current folder</p>
          </div>
        </div>
      )}

      {/* Content */}
      {folders.length === 0 && files.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Empty folder</h3>
          <p className="text-sm text-gray-500 mb-4">
            No files in this folder yet. Upload files or drag & drop them here.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Files
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_140px_80px] gap-4 px-4 py-2.5 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div>Name</div>
            <div>Size</div>
            <div>Modified</div>
            <div></div>
          </div>

          {/* Folders first */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => navigateToFolder(folder.path)}
              className="w-full grid grid-cols-[1fr_100px_140px_80px] gap-4 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">{folder.name}</span>
              </div>
              <div className="text-sm text-gray-400">—</div>
              <div className="text-sm text-gray-500">{formatDate(folder.lastModified)}</div>
              <div />
            </button>
          ))}

          {/* Files */}
          {files.map((file) => (
            <FileRow key={file.id} file={file} onDownload={handleDownload} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// File Row
// ---------------------------------------------------------------------------

function FileRow({ file, onDownload }: { file: DropboxFileItem; onDownload: (f: DropboxFileItem) => void }) {
  const { icon: FileIcon, colorClass } = getFileIcon(file.name)
  const isImage = file.thumbnailUrl != null

  return (
    <div className="group grid grid-cols-[1fr_100px_140px_80px] gap-4 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50">
      <div className="flex items-center gap-3 min-w-0">
        {isImage && file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt=""
            className="w-8 h-8 rounded object-cover shrink-0 border border-gray-200"
          />
        ) : (
          <FileIcon className={cn('w-5 h-5 shrink-0', colorClass)} />
        )}
        <span className="text-sm text-gray-900 truncate">{file.name}</span>
      </div>
      <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
      <div className="text-sm text-gray-500">{formatDate(file.lastModified)}</div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDownload(file)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function FolderCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-gray-200 bg-white animate-pulse">
          <div className="w-12 h-12 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded w-20" />
        </div>
      ))}
    </div>
  )
}

function FileListSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-4 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 animate-pulse">
            <div className="w-5 h-5 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded flex-1 max-w-xs" />
            <div className="h-4 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
