'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Layers,
  Upload,
  FolderOpen,
  Ruler,
  FileText,
  Image,
  StickyNote,
  FileSignature,
  FileCheck,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Download,
  ExternalLink,
  Plus,
  X,
  Check,
  Loader2,
  File,
  ChevronDown,
  ChevronRight,
  PenLine,
  CheckSquare,
  Square
} from 'lucide-react'

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

const CATEGORY_CONFIG: Record<string, { 
  icon: typeof Ruler
  gradient: string
  border: string
  iconBg: string
  titleColor: string
  descColor: string
}> = {
  EXISTING_MEASUREMENTS: {
    icon: Ruler,
    gradient: 'from-amber-50 to-orange-100',
    border: 'border-amber-200 hover:border-amber-300',
    iconBg: 'bg-[#f6762e]',
    titleColor: 'text-amber-800',
    descColor: 'text-amber-600'
  },
  ARCHITECT_PLANS: {
    icon: FileText,
    gradient: 'from-indigo-50 to-blue-100',
    border: 'border-indigo-200 hover:border-indigo-300',
    iconBg: 'bg-[#6366ea]',
    titleColor: 'text-indigo-800',
    descColor: 'text-indigo-600'
  },
  REFERENCE_IMAGES: {
    icon: Image,
    gradient: 'from-pink-50 to-rose-100',
    border: 'border-pink-200 hover:border-pink-300',
    iconBg: 'bg-[#e94d97]',
    titleColor: 'text-pink-800',
    descColor: 'text-pink-600'
  },
  CLIENT_NOTES: {
    icon: StickyNote,
    gradient: 'from-purple-50 to-violet-100',
    border: 'border-purple-200 hover:border-purple-300',
    iconBg: 'bg-[#a657f0]',
    titleColor: 'text-purple-800',
    descColor: 'text-purple-600'
  },
  PROPOSALS: {
    icon: FileSignature,
    gradient: 'from-teal-50 to-emerald-100',
    border: 'border-teal-200 hover:border-teal-300',
    iconBg: 'bg-[#14b8a6]',
    titleColor: 'text-teal-800',
    descColor: 'text-teal-600'
  },
  CONTRACTS: {
    icon: FileCheck,
    gradient: 'from-green-50 to-emerald-100',
    border: 'border-green-200 hover:border-green-300',
    iconBg: 'bg-green-600',
    titleColor: 'text-green-800',
    descColor: 'text-green-600'
  },
  COMMUNICATION: {
    icon: MessageSquare,
    gradient: 'from-sky-50 to-blue-100',
    border: 'border-sky-200 hover:border-sky-300',
    iconBg: 'bg-sky-500',
    titleColor: 'text-sky-800',
    descColor: 'text-sky-600'
  },
  OTHER: {
    icon: FolderOpen,
    gradient: 'from-gray-50 to-slate-100',
    border: 'border-gray-200 hover:border-gray-300',
    iconBg: 'bg-gray-500',
    titleColor: 'text-gray-800',
    descColor: 'text-gray-600'
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

interface ClientSourcesWorkspaceProps {
  project: Project
}

export function ClientSourcesWorkspace({ project }: ClientSourcesWorkspaceProps) {
  const router = useRouter()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  
  // Note creation state
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const { data, error, mutate, isLoading } = useSWR<SourcesResponse>(
    `/api/projects/${project.id}/sources`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleFileUpload = async (category: string, files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadingCategory(category)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', category)
        formData.append('title', file.name)

        const response = await fetch(`/api/projects/${project.id}/sources`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }
      }

      // Refresh data
      mutate()
      
      // Expand the category to show new files
      setExpandedCategories(prev => new Set([...prev, category]))

    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setUploading(false)
      setUploadingCategory(null)
    }
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

  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault()
    setDragOverCategory(category)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverCategory(null)
  }

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault()
    setDragOverCategory(null)
    handleFileUpload(category, e.dataTransfer.files)
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
        throw new Error('Failed to save note')
      }

      // Reset form and refresh data
      setNoteTitle('')
      setNoteContent('')
      setShowNoteForm(false)
      mutate()
      
      // Expand Client Notes to show new note
      setExpandedCategories(prev => new Set([...prev, 'CLIENT_NOTES']))
    } catch (error) {
      console.error('Save note error:', error)
      alert('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  const totalFiles = data?.totalFiles || 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Button
            onClick={() => router.push(`/projects/${project.id}/floorplan`)}
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Floorplan
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Client Sources</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>{project.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  <span>{totalFiles} files</span>
                </div>
              </div>
            </div>
          </div>
          
          <p className="text-gray-500 mt-3 max-w-2xl">
            Organize all files received from the client - measurements, architect plans, 
            reference images, notes, proposals, and communication. Files are automatically 
            synced to Dropbox.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#a657f0]" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">
            Failed to load sources. Please refresh.
          </div>
        ) : (
          <div className="grid gap-4">
            {(data?.categories || []).map((categoryData) => {
              const config = CATEGORY_CONFIG[categoryData.category]
              if (!config) return null // Skip if config not found
              const Icon = config.icon
              const isExpanded = expandedCategories.has(categoryData.category)
              const fileCount = categoryData.files?.length || 0
              const isDragOver = dragOverCategory === categoryData.category
              const isUploading = uploadingCategory === categoryData.category

              return (
                <div
                  key={categoryData.category}
                  className={`bg-gradient-to-br ${config.gradient} rounded-xl border ${
                    isDragOver ? 'border-[#a657f0] ring-2 ring-[#a657f0]/20' : config.border
                  } transition-all duration-200`}
                  onDragOver={(e) => handleDragOver(e, categoryData.category)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, categoryData.category)}
                >
                  {/* Category Header */}
                  <div 
                    className="p-5 cursor-pointer"
                    onClick={() => toggleCategory(categoryData.category)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 ${config.iconBg} rounded-lg flex items-center justify-center shadow-sm`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className={`font-semibold ${config.titleColor}`}>
                            {categoryData.label}
                          </h3>
                          <p className={`text-sm ${config.descColor}`}>
                            {categoryData.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium px-3 py-1 rounded-full bg-white/60 ${config.titleColor}`}>
                          {fileCount} {fileCount === 1 ? 'file' : 'files'}
                        </span>
                        
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[categoryData.category] = el }}
                          className="hidden"
                          multiple
                          onChange={(e) => handleFileUpload(categoryData.category, e.target.files)}
                        />
                        
                        {/* Write Note button - only for Client Notes */}
                        {categoryData.category === 'CLIENT_NOTES' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`${config.titleColor} hover:bg-white/50`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowNoteForm(true)
                              setExpandedCategories(prev => new Set([...prev, 'CLIENT_NOTES']))
                            }}
                          >
                            <PenLine className="w-4 h-4" />
                            <span className="ml-2 hidden sm:inline">Write Note</span>
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`${config.titleColor} hover:bg-white/50`}
                          onClick={(e) => {
                            e.stopPropagation()
                            fileInputRefs.current[categoryData.category]?.click()
                          }}
                          disabled={uploading}
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span className="ml-2 hidden sm:inline">Upload</span>
                        </Button>
                        
                        <div className={`${config.titleColor}`}>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Files List */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4">
                      {/* Note creation form - only for Client Notes */}
                      {categoryData.category === 'CLIENT_NOTES' && showNoteForm && (
                        <div className="bg-white rounded-lg border border-purple-200 p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <PenLine className="w-4 h-4 text-[#a657f0]" />
                            <span className="font-medium text-gray-900">New Note</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Note title..."
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0] outline-none"
                          />
                          <textarea
                            placeholder="Write your note here... (requirements, preferences, meeting notes, checklist items...)"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0] outline-none resize-none"
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
                      
                      {fileCount === 0 && !(categoryData.category === 'CLIENT_NOTES' && showNoteForm) ? (
                        <div 
                          className={`border-2 border-dashed ${isDragOver ? 'border-[#a657f0]' : 'border-gray-200'} rounded-lg p-8 text-center bg-white/40`}
                        >
                          {categoryData.category === 'CLIENT_NOTES' ? (
                            <>
                              <PenLine className={`w-8 h-8 mx-auto mb-3 ${config.descColor}`} />
                              <p className={`font-medium ${config.titleColor}`}>
                                Write notes or upload files
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                Add requirements, preferences, or meeting notes
                              </p>
                            </>
                          ) : (
                            <>
                              <Upload className={`w-8 h-8 mx-auto mb-3 ${config.descColor}`} />
                              <p className={`font-medium ${config.titleColor}`}>
                                Drop files here or click Upload
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                Files will be synced to Dropbox
                              </p>
                            </>
                          )}
                        </div>
                      ) : fileCount > 0 && (
                        <div className="bg-white/60 rounded-lg divide-y divide-gray-100">
                          {categoryData.files.map((file) => {
                            // Check if this is a note (no fileName, mimeType is text/plain)
                            const isNote = !file.fileName && file.mimeType === 'text/plain'
                            
                            return (
                              <div 
                                key={file.id}
                                className="flex items-center justify-between p-4 hover:bg-white/80 transition-colors group"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    isNote ? 'bg-purple-100' : 'bg-gray-100'
                                  }`}>
                                    {isNote ? (
                                      <StickyNote className="w-5 h-5 text-[#a657f0]" />
                                    ) : file.mimeType?.startsWith('image/') ? (
                                      <Image className="w-5 h-5 text-gray-500" />
                                    ) : file.mimeType === 'application/pdf' ? (
                                      <FileText className="w-5 h-5 text-red-500" />
                                    ) : (
                                      <File className="w-5 h-5 text-gray-500" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 truncate">
                                      {file.title}
                                    </p>
                                    {isNote && file.description && (
                                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                                        {file.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                      {isNote ? (
                                        <span className="text-[#a657f0] font-medium">Note</span>
                                      ) : (
                                        <span>{file.fileSize ? formatFileSize(file.fileSize) : '—'}</span>
                                      )}
                                      <span>•</span>
                                      <span>{formatDate(file.createdAt)}</span>
                                      {file.uploadedByUser?.name && (
                                        <>
                                          <span>•</span>
                                          <span>{file.uploadedByUser.name}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {file.dropboxUrl && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                                      onClick={() => window.open(file.dropboxUrl!, '_blank')}
                                      title="Open in Dropbox"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
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
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

