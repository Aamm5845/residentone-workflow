'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { RichTextEditor, RichTextDisplay } from '@/components/ui/RichTextEditor'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { 
  ArrowLeft, 
  Layers,
  Upload,
  FolderOpen,
  Ruler,
  FileText,
  Image as ImageIcon,
  StickyNote,
  FileSignature,
  FileCheck,
  MessageSquare,
  Trash2,
  ExternalLink,
  X,
  Check,
  Loader2,
  File,
  PenLine,
  Grid3X3,
  List,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Search,
  Clock,
  User,
  Folder,
  FolderPlus,
  Edit2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  dropboxFolder: string | null
  client?: {
    id: string
    name: string
    email: string
  }
}

interface SourceFile {
  id: string
  category: string
  title: string
  description: string | null
  dropboxPath: string | null
  dropboxUrl: string | null
  fileName: string | null
  fileSize: number | null
  mimeType: string | null
  isNote?: boolean
  noteContent?: string | null
  createdAt: string
  uploadedByUser: {
    id: string
    name: string | null
    image: string | null
  }
}

interface CategoryData {
  category: string
  label: string
  folder: string
  description: string
  files: SourceFile[]
}

interface SourcesResponse {
  project: {
    id: string
    name: string
    dropboxFolder: string | null
  }
  categories: CategoryData[]
  totalFiles: number
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Professional category config with brand colors
const CATEGORY_CONFIG: Record<string, { 
  icon: typeof Ruler
  accentColor: string
  lightBg: string
  iconColor: string
}> = {
  EXISTING_MEASUREMENTS: {
    icon: Ruler,
    accentColor: '#f6762e',
    lightBg: 'bg-orange-50',
    iconColor: 'text-orange-600'
  },
  ARCHITECT_PLANS: {
    icon: FileText,
    accentColor: '#6366ea',
    lightBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600'
  },
  REFERENCE_IMAGES: {
    icon: ImageIcon,
    accentColor: '#e94d97',
    lightBg: 'bg-pink-50',
    iconColor: 'text-pink-600'
  },
  CLIENT_NOTES: {
    icon: StickyNote,
    accentColor: '#a657f0',
    lightBg: 'bg-purple-50',
    iconColor: 'text-purple-600'
  },
  PROPOSALS: {
    icon: FileSignature,
    accentColor: '#14b8a6',
    lightBg: 'bg-teal-50',
    iconColor: 'text-teal-600'
  },
  CONTRACTS: {
    icon: FileCheck,
    accentColor: '#22c55e',
    lightBg: 'bg-green-50',
    iconColor: 'text-green-600'
  },
  COMMUNICATION: {
    icon: MessageSquare,
    accentColor: '#0ea5e9',
    lightBg: 'bg-sky-50',
    iconColor: 'text-sky-600'
  },
  OTHER: {
    icon: FolderOpen,
    accentColor: '#64748b',
    lightBg: 'bg-slate-50',
    iconColor: 'text-slate-600'
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return formatDate(dateString)
}

// File upload limits
const MAX_FILE_SIZE = 4.5 * 1024 * 1024 // 4.5MB - Vercel serverless limit
const MAX_FILE_SIZE_DISPLAY = '4.5MB'

interface ClientSourcesWorkspaceProps {
  project: Project
}

export function ClientSourcesWorkspace({ project }: ClientSourcesWorkspaceProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const mainFileInputRef = useRef<HTMLInputElement | null>(null)
  
  // Note creation state
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileDescriptions, setFileDescriptions] = useState<Record<string, string>>({})
  
  // View mode state (grid or list)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Note viewing state
  const [viewingNote, setViewingNote] = useState<SourceFile | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [editNoteTitle, setEditNoteTitle] = useState('')
  const [editNoteContent, setEditNoteContent] = useState('')
  const [savingEditedNote, setSavingEditedNote] = useState(false)

  const { data, error, mutate, isLoading } = useSWR<SourcesResponse>(
    `/api/projects/${project.id}/sources`,
    fetcher,
    { refreshInterval: 30000 }
  )

  // Filter files based on search and selected category
  const filteredData = useMemo(() => {
    if (!data) return null
    
    let categories = data.categories
    
    // Filter by selected category
    if (selectedCategory) {
      categories = categories.filter(c => c.category === selectedCategory)
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      categories = categories.map(cat => ({
        ...cat,
        files: cat.files.filter(f => 
          f.title.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query) ||
          f.fileName?.toLowerCase().includes(query)
        )
      }))
    }
    
    return {
      ...data,
      categories: categories.filter(c => c.files.length > 0 || selectedCategory === c.category)
    }
  }, [data, selectedCategory, searchQuery])

  // Get all files for "All Files" view
  const allFiles = useMemo(() => {
    if (!data) return []
    return data.categories.flatMap(c => c.files)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [data])

  // Open upload modal with selected files
  const handleFilesSelected = (category: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    
    const fileArray = Array.from(files)
    
    // Check for oversized files
    const oversizedFiles = fileArray.filter(f => f.size > MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => `${f.name} (${formatFileSize(f.size)})`).join('\n')
      alert(`The following files exceed the ${MAX_FILE_SIZE_DISPLAY} limit:\n\n${fileNames}\n\nPlease compress these files or upload smaller versions.`)
      // Filter out oversized files but still allow valid ones
      const validFiles = fileArray.filter(f => f.size <= MAX_FILE_SIZE)
      if (validFiles.length === 0) return
      setUploadCategory(category)
      setPendingFiles(validFiles)
      setFileDescriptions({})
      setShowUploadModal(true)
      return
    }
    
    setUploadCategory(category)
    setPendingFiles(fileArray)
    setFileDescriptions({})
    setShowUploadModal(true)
  }
  
  // Upload files with descriptions
  const handleUploadWithDescriptions = async () => {
    if (!uploadCategory || pendingFiles.length === 0) return

    setUploading(true)
    setUploadingCategory(uploadCategory)

    try {
      for (const file of pendingFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', uploadCategory)
        formData.append('title', file.name)
        formData.append('description', fileDescriptions[file.name] || '')

        const response = await fetch(`/api/projects/${project.id}/sources`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          // Handle 413 Payload Too Large specifically
          if (response.status === 413) {
            throw new Error(`File "${file.name}" is too large. Maximum file size is ${MAX_FILE_SIZE_DISPLAY}. Please compress the file or use a file sharing service.`)
          }
          const errorData = await response.json().catch(() => ({}))
          // Handle 403 Forbidden (permission errors)
          if (response.status === 403) {
            throw new Error(errorData.details || 'Dropbox permission error. Please verify the project has a valid Dropbox folder configured.')
          }
          throw new Error(errorData.error || errorData.details || 'Upload failed')
        }
      }

      // Refresh data
      mutate()
      
      // Select the category to show new files
      setSelectedCategory(uploadCategory)
      
      // Close modal and reset
      setShowUploadModal(false)
      setPendingFiles([])
      setFileDescriptions({})
      setUploadCategory(null)

    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setUploading(false)
      setUploadingCategory(null)
    }
  }
  
  // Get file preview URL
  const getFilePreviewUrl = (file: SourceFile): string | null => {
    if (file.mimeType?.startsWith('image/') && file.dropboxUrl) {
      return file.dropboxUrl.replace('dl=0', 'raw=1')
    }
    return null
  }
  
  // Get file icon based on mime type
  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return File
    if (mimeType.startsWith('image/')) return FileImage
    if (mimeType === 'application/pdf') return FileText
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
    if (mimeType.includes('zip') || mimeType.includes('archive')) return FileArchive
    return File
  }

  const handleDelete = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const response = await fetch(
        `/api/projects/${project.id}/sources?sourceId=${sourceId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      mutate()
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete file')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault()
    handleFilesSelected(category, e.dataTransfer.files)
  }

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      alert('Please enter a note title')
      return
    }

    setSavingNote(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/sources/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle,
          content: noteContent,
          category: 'CLIENT_NOTES'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || 'Failed to save note')
      }

      // Reset form and refresh data
      setNoteTitle('')
      setNoteContent('')
      setShowNoteForm(false)
      mutate()
      
      // Select Client Notes category
      setSelectedCategory('CLIENT_NOTES')
    } catch (error) {
      console.error('Save note error:', error)
      alert(error instanceof Error ? error.message : 'Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  // Start editing a note
  const startEditingNote = (note: SourceFile) => {
    setEditNoteTitle(note.title)
    // Use noteContent for notes, fall back to description for backwards compatibility
    setEditNoteContent(note.noteContent || note.description || '')
    setEditingNote(true)
  }

  // Save edited note
  const handleSaveEditedNote = async () => {
    if (!viewingNote || !editNoteTitle.trim()) {
      alert('Please enter a note title')
      return
    }

    setSavingEditedNote(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/sources/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: viewingNote.id,
          title: editNoteTitle,
          content: editNoteContent
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || 'Failed to update note')
      }

      // Refresh data and exit edit mode
      mutate()
      setEditingNote(false)
      
      // Update the viewingNote with new values
      setViewingNote({
        ...viewingNote,
        title: editNoteTitle,
        noteContent: editNoteContent,
        description: editNoteContent
      })
    } catch (error) {
      console.error('Update note error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update note')
    } finally {
      setSavingEditedNote(false)
    }
  }

  // Cancel editing note
  const cancelEditingNote = () => {
    setEditingNote(false)
    setEditNoteTitle('')
    setEditNoteContent('')
  }

  const totalFiles = data?.totalFiles || 0
  const selectedCategoryData = selectedCategory 
    ? data?.categories.find(c => c.category === selectedCategory)
    : null

  // Files to display based on selection
  const displayFiles = selectedCategory && filteredData
    ? filteredData.categories.find(c => c.category === selectedCategory)?.files || []
    : searchQuery 
    ? filteredData?.categories.flatMap(c => c.files) || []
    : allFiles

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push(`/projects/${project.id}/floorplan`)}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-900 -ml-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              
              <div className="h-8 w-px bg-gray-200" />
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-gray-900">Client Sources</h1>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{project.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-white shadow-sm text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'list' 
                      ? 'bg-white shadow-sm text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              {/* Upload Button */}
              <Button
                onClick={() => {
                  if (selectedCategory) {
                    fileInputRefs.current[selectedCategory]?.click()
                  } else {
                    // Open category picker or default to OTHER
                    setUploadCategory('OTHER')
                    mainFileInputRef.current?.click()
                  }
                }}
                className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
              <input
                type="file"
                ref={mainFileInputRef}
                className="hidden"
                multiple
                onChange={(e) => handleFilesSelected(uploadCategory || 'OTHER', e.target.files)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Categories */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
              {/* Search */}
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0] outline-none transition-all"
                  />
                </div>
              </div>
              
              {/* Categories */}
              <div className="p-2">
                {/* All Files option */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    selectedCategory === null
                      ? 'bg-[#a657f0] text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span className="flex-1 text-left font-medium">All Files</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    selectedCategory === null 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {totalFiles}
                  </span>
                </button>
                
                <div className="h-px bg-gray-100 my-2" />
                
                {/* Category folders */}
                {(data?.categories || []).map((categoryData) => {
                  const config = CATEGORY_CONFIG[categoryData.category]
                  if (!config) return null
                  const Icon = config.icon
                  const fileCount = categoryData.files?.length || 0
                  const isSelected = selectedCategory === categoryData.category

                  return (
                    <button
                      key={categoryData.category}
                      onClick={() => setSelectedCategory(categoryData.category)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        isSelected
                          ? 'bg-[#a657f0] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-white/20' : config.lightBg
                      }`}>
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : config.iconColor}`} />
                      </div>
                      <span className="flex-1 text-left font-medium truncate">
                        {categoryData.label}
                      </span>
                      {fileCount > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          isSelected 
                            ? 'bg-white/20 text-white' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {fileCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              
              {/* Quick Actions */}
              <div className="p-3 border-t border-gray-100 space-y-2">
                <button
                  onClick={() => {
                    setShowNoteForm(true)
                    setSelectedCategory('CLIENT_NOTES')
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all font-medium"
                >
                  <PenLine className="w-4 h-4" />
                  <span>Write a Note</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#a657f0]" />
              </div>
            ) : error ? (
              <div className="text-center py-20 text-red-500">
                Failed to load sources. Please refresh.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header with count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedCategory 
                        ? selectedCategoryData?.label || 'Files'
                        : searchQuery 
                        ? 'Search Results'
                        : 'Recent Files'
                      }
                    </h2>
                    <span className="text-sm text-gray-500">
                      ({displayFiles.length} {displayFiles.length === 1 ? 'file' : 'files'})
                    </span>
                  </div>
                  
                  {selectedCategory && (
                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[selectedCategory] = el }}
                      className="hidden"
                      multiple
                      onChange={(e) => handleFilesSelected(selectedCategory, e.target.files)}
                    />
                  )}
                </div>
                
                {/* Note Form - Always show when triggered */}
                {showNoteForm && (
                  <div className="bg-white rounded-xl border border-purple-200 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <PenLine className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="font-semibold text-gray-900">New Note</span>
                    </div>
                    <div className="relative mb-3">
                      <input
                        type="text"
                        placeholder="Note title (required)"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0] outline-none text-sm",
                          !noteTitle.trim() && noteContent ? "border-amber-300 bg-amber-50" : "border-gray-200"
                        )}
                      />
                      {!noteTitle.trim() && noteContent && (
                        <p className="text-xs text-amber-600 mt-1">Please add a title to save your note</p>
                      )}
                    </div>
                    <RichTextEditor
                      content={noteContent}
                      onChange={setNoteContent}
                      placeholder="Write your note here... (requirements, preferences, meeting notes, checklist items...)"
                      className="mb-4"
                      minHeight="120px"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowNoteForm(false)
                          setNoteTitle('')
                          setNoteContent('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
                        onClick={handleSaveNote}
                        disabled={savingNote || !noteTitle.trim()}
                      >
                        {savingNote ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Save Note
                      </Button>
                    </div>
                  </div>
                )}

                {/* Empty State or Files */}
                {displayFiles.length === 0 && !showNoteForm ? (
                  <div 
                    className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, selectedCategory || 'OTHER')}
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      {selectedCategory ? (
                        (() => {
                          const Icon = CATEGORY_CONFIG[selectedCategory]?.icon || FolderOpen
                          return <Icon className="w-8 h-8 text-gray-400" />
                        })()
                      ) : (
                        <FolderPlus className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {selectedCategory 
                        ? `No ${selectedCategoryData?.label.toLowerCase() || 'files'} yet`
                        : 'No files uploaded yet'
                      }
                    </h3>
                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                      {selectedCategory 
                        ? `Drag and drop files here or click upload to add ${selectedCategoryData?.label.toLowerCase()}.`
                        : 'Start by uploading client files, documents, and reference materials.'
                      }
                    </p>
                    
                    <div className="flex items-center justify-center gap-3">
                      <input
                        type="file"
                        ref={(el) => { if (selectedCategory) fileInputRefs.current[selectedCategory] = el }}
                        className="hidden"
                        multiple
                        onChange={(e) => handleFilesSelected(selectedCategory || 'OTHER', e.target.files)}
                      />
                      <Button
                        onClick={() => {
                          if (selectedCategory) {
                            fileInputRefs.current[selectedCategory]?.click()
                          } else {
                            setUploadCategory('OTHER')
                            mainFileInputRef.current?.click()
                          }
                        }}
                        className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Files
                      </Button>
                      
                      {selectedCategory === 'CLIENT_NOTES' && (
                        <Button
                          onClick={() => setShowNoteForm(true)}
                          variant="outline"
                          className="border-purple-200 text-purple-600 hover:bg-purple-50"
                        >
                          <PenLine className="w-4 h-4 mr-2" />
                          Write Note
                        </Button>
                      )}
                    </div>
                  </div>
                ) : displayFiles.length > 0 && (
                  <>
                    {/* Grid View */}
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {displayFiles.map((file) => {
                          const isNote = !file.fileName && file.mimeType === 'text/plain'
                          const isImage = file.mimeType?.startsWith('image/')
                          const FileIcon = getFileIcon(file.mimeType)
                          const previewUrl = getFilePreviewUrl(file)
                          const categoryConfig = CATEGORY_CONFIG[file.category]
                          
                          return (
                            <div 
                              key={file.id}
                              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#a657f0]/30 transition-all duration-200 group"
                            >
                              {/* Preview area */}
                              <div className={`aspect-[4/3] relative bg-gray-50 flex items-center justify-center overflow-hidden`}>
                                {isNote ? (
                                  <div className="p-3 text-left h-full overflow-hidden">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <StickyNote className="w-3 h-3 text-purple-600" />
                                      </div>
                                      <span className="text-xs font-medium text-purple-600">Note</span>
                                    </div>
                                    <div className="text-xs text-gray-600 line-clamp-4 overflow-hidden">
                                      {file.description ? (
                                        <RichTextDisplay content={file.description} className="text-xs [&_p]:text-xs [&_li]:text-xs" />
                                      ) : (
                                        <span className="text-gray-400 italic">No content</span>
                                      )}
                                    </div>
                                  </div>
                                ) : isImage && previewUrl ? (
                                  <img 
                                    src={previewUrl} 
                                    alt={file.title}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                    }}
                                  />
                                ) : null}
                                {!isNote && (!isImage || !previewUrl) && (
                                  <FileIcon className="w-12 h-12 text-gray-300" />
                                )}
                                {isImage && previewUrl && (
                                  <div className="hidden w-full h-full items-center justify-center">
                                    <FileIcon className="w-12 h-12 text-gray-300" />
                                  </div>
                                )}
                                
                                {/* Category badge */}
                                {!selectedCategory && categoryConfig && (
                                  <div 
                                    className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium text-white"
                                    style={{ backgroundColor: categoryConfig.accentColor }}
                                  >
                                    {data?.categories.find(c => c.category === file.category)?.label}
                                  </div>
                                )}
                                
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                                  {isNote ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setViewingNote(file)
                                      }}
                                      className="p-2.5 bg-white rounded-full hover:bg-purple-50 transition-colors"
                                      title="View Note"
                                    >
                                      <Eye className="w-4 h-4 text-purple-600" />
                                    </button>
                                  ) : file.dropboxUrl && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        window.open(file.dropboxUrl!, '_blank')
                                      }}
                                      className="p-2.5 bg-white rounded-full hover:bg-gray-100 transition-colors"
                                      title="Open in Dropbox"
                                    >
                                      <Eye className="w-4 h-4 text-gray-700" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDelete(file.id)
                                    }}
                                    className="p-2.5 bg-white rounded-full hover:bg-red-50 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* File info */}
                              <div className="p-3">
                                <p className="font-medium text-sm text-gray-900 truncate" title={file.title}>
                                  {file.title}
                                </p>
                                {file.description && !isNote && (
                                  <p className="text-xs text-gray-500 truncate mt-0.5" title={file.description}>
                                    {file.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                                  {isNote ? (
                                    <span className="text-purple-600 font-medium">Note</span>
                                  ) : (
                                    <span>{file.fileSize ? formatFileSize(file.fileSize) : '—'}</span>
                                  )}
                                  <span>•</span>
                                  <span>{formatRelativeTime(file.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      /* List View */
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                        {displayFiles.map((file) => {
                          const isNote = !file.fileName && file.mimeType === 'text/plain'
                          const isImage = file.mimeType?.startsWith('image/')
                          const FileIcon = getFileIcon(file.mimeType)
                          const previewUrl = getFilePreviewUrl(file)
                          const categoryConfig = CATEGORY_CONFIG[file.category]
                          
                          return (
                            <div 
                              key={file.id}
                              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                            >
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                {/* Thumbnail */}
                                <div className={`w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden ${
                                  isNote ? 'bg-purple-100' : 'bg-gray-100'
                                } flex items-center justify-center`}>
                                  {isNote ? (
                                    <StickyNote className="w-5 h-5 text-purple-600" />
                                  ) : isImage && previewUrl ? (
                                    <img 
                                      src={previewUrl} 
                                      alt={file.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <FileIcon className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 truncate">
                                      {file.title}
                                    </p>
                                    {!selectedCategory && categoryConfig && (
                                      <span 
                                        className="px-2 py-0.5 rounded text-xs font-medium text-white flex-shrink-0"
                                        style={{ backgroundColor: categoryConfig.accentColor }}
                                      >
                                        {data?.categories.find(c => c.category === file.category)?.label}
                                      </span>
                                    )}
                                  </div>
                                  {file.description && (
                                    <p className="text-sm text-gray-500 truncate mt-0.5">
                                      {file.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                    {isNote ? (
                                      <span className="text-purple-600 font-medium">Note</span>
                                    ) : (
                                      <span>{file.fileSize ? formatFileSize(file.fileSize) : '—'}</span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatRelativeTime(file.createdAt)}
                                    </span>
                                    {file.uploadedByUser?.name && (
                                      <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {file.uploadedByUser.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isNote ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                                    onClick={() => setViewingNote(file)}
                                    title="View Note"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                ) : file.dropboxUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 text-gray-500 hover:text-gray-700"
                                    onClick={() => window.open(file.dropboxUrl!, '_blank')}
                                    title="Open in Dropbox"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(file.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Upload Modal with Descriptions */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upload Files</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Add descriptions to help identify each file
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setPendingFiles([])
                  setFileDescriptions({})
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {/* Category selector */}
            {!selectedCategory && (
              <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                    const Icon = config.icon
                    const label = data?.categories.find(c => c.category === key)?.label || key
                    return (
                      <button
                        key={key}
                        onClick={() => setUploadCategory(key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                          uploadCategory === key
                            ? 'bg-[#a657f0] text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:border-[#a657f0]/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Files List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {pendingFiles.map((file, index) => {
                const isImage = file.type.startsWith('image/')
                const previewUrl = isImage ? URL.createObjectURL(file) : null
                
                return (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex gap-4 p-4 bg-gray-50 rounded-xl"
                  >
                    {/* Preview */}
                    <div className="w-16 h-16 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
                      {isImage && previewUrl ? (
                        <img 
                          src={previewUrl} 
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <File className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    
                    {/* File Info & Description */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatFileSize(file.size)}
                      </p>
                      <input
                        type="text"
                        placeholder="Add description (optional)"
                        value={fileDescriptions[file.name] || ''}
                        onChange={(e) => setFileDescriptions(prev => ({
                          ...prev,
                          [file.name]: e.target.value
                        }))}
                        className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0] outline-none"
                      />
                    </div>
                    
                    {/* Remove button */}
                    <button
                      onClick={() => {
                        setPendingFiles(prev => prev.filter((_, i) => i !== index))
                        setFileDescriptions(prev => {
                          const next = { ...prev }
                          delete next[file.name]
                          return next
                        })
                      }}
                      className="p-2 hover:bg-gray-200 rounded-lg h-fit transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                )
              })}
              
              {pendingFiles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No files selected
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-2xl">
              <span className="text-sm text-gray-500">
                {pendingFiles.length} {pendingFiles.length === 1 ? 'file' : 'files'} selected
              </span>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false)
                    setPendingFiles([])
                    setFileDescriptions({})
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
                  onClick={handleUploadWithDescriptions}
                  disabled={uploading || pendingFiles.length === 0 || !uploadCategory}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {pendingFiles.length > 1 ? 'All' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Note Viewing Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => {
        if (!open) {
          setViewingNote(null)
          setEditingNote(false)
          setEditNoteTitle('')
          setEditNoteContent('')
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <StickyNote className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                {editingNote ? (
                  <input
                    type="text"
                    value={editNoteTitle}
                    onChange={(e) => setEditNoteTitle(e.target.value)}
                    className="text-lg font-semibold text-gray-900 w-full border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0] outline-none"
                    placeholder="Note title..."
                    autoFocus
                  />
                ) : (
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    {viewingNote?.title}
                  </DialogTitle>
                )}
                <DialogDescription className="text-sm text-gray-500 mt-0.5">
                  {viewingNote && (
                    <>
                      Created {formatRelativeTime(viewingNote.createdAt)}
                      {viewingNote.uploadedByUser?.name && ` by ${viewingNote.uploadedByUser.name}`}
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-1 py-4">
            {editingNote ? (
              <textarea
                value={editNoteContent}
                onChange={(e) => setEditNoteContent(e.target.value)}
                className="w-full h-64 border border-gray-300 rounded-lg px-4 py-3 text-gray-700 focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0] outline-none resize-none"
                placeholder="Note content..."
              />
            ) : viewingNote?.description ? (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <RichTextDisplay 
                  content={viewingNote.description} 
                  className="text-gray-700"
                />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <StickyNote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>This note has no content</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between gap-2 pt-4 border-t">
            <div>
              {!editingNote && (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (viewingNote) {
                      handleDelete(viewingNote.id)
                      setViewingNote(null)
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {editingNote ? (
                <>
                  <Button
                    variant="outline"
                    onClick={cancelEditingNote}
                    disabled={savingEditedNote}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
                    onClick={handleSaveEditedNote}
                    disabled={savingEditedNote || !editNoteTitle.trim()}
                  >
                    {savingEditedNote ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setViewingNote(null)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#a657f0]/30 text-[#a657f0] hover:bg-[#a657f0]/10"
                    onClick={() => viewingNote && startEditingNote(viewingNote)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Note
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
