'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  Building,
  Palette,
  Activity,
  Loader2,
  Plus,
  MessageSquare,
  Paperclip,
  Eye,
  Heart,
  Download,
  ExternalLink,
  Tag,
  CheckSquare,
  Layout,
  Home,
  Bookmark,
  X,
  Upload,
  Send,
  Edit2,
  Save,
  Trash2,
  Image as ImageIcon
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import PhaseSettingsMenu from '../stages/PhaseSettingsMenu'
import { PhaseChat } from '../chat/PhaseChat'
import { MentionTextarea } from '../ui/mention-textarea'
import EnhancedFilePreviewModal from '../ui/enhanced-file-preview-modal'
import DesignNotificationIndicator from './DesignNotificationIndicator'

// Components will be implemented inline for now to fix layout issues
// TODO: Import proper components when they're available:
// import { ReferenceBoard } from './ReferenceBoard'
// import { MessagePanel } from './MessagePanel'
// import { ActionBar } from './ActionBar'
// import { UploadZone } from './UploadZone'

// Types
interface DesignSection {
  id: string
  type: 'GENERAL' | 'WALL_COVERING' | 'CEILING' | 'FLOOR'
  content?: string
  completed: boolean
  createdAt: string
  updatedAt: string
  assets: Array<{
    id: string
    title: string
    url: string
    type: string
    userDescription?: string
    createdAt: string
  }>
  comments: Array<{
    id: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      role: string
    }
  }>
  checklistItems: Array<{
    id: string
    title: string
    description?: string
    completed: boolean
    order: number
  }>
}

interface Stage {
  id: string
  type: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DRAFT' | 'IN_REVIEW' | 'FINALIZED'
  assignedUser?: {
    id: string
    name: string
  }
  dueDate?: string
  startedAt?: string
  completedAt?: string
  designSections: DesignSection[]
}

interface Room {
  id: string
  type: string
  name?: string
}

interface Project {
  id: string
  name: string
  client: {
    name: string
  }
}

interface WorkspaceData {
  stage: Stage
  room: Room
  project: Project
  completion: {
    percentage: number
    completedSections: number
    totalSections: number
  }
}

interface BedroomDesignWorkspaceProps {
  roomId: string
  projectId: string
  stageId: string
  className?: string
}

// Status configuration
const STATUS_CONFIG = {
  DRAFT: { name: 'Draft', color: 'bg-gray-100 text-gray-800', icon: Clock },
  IN_REVIEW: { name: 'In Review', color: 'bg-yellow-100 text-yellow-800', icon: Eye },
  FINALIZED: { name: 'Finalized', color: 'bg-green-100 text-green-800', icon: CheckCircle2 }
}

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function BedroomDesignWorkspace({ 
  roomId, 
  projectId, 
  stageId,
  className = ''
}: BedroomDesignWorkspaceProps) {
  // State management
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['GENERAL']))
  const [isCompleting, setIsCompleting] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [uploadingSection, setUploadingSection] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<Record<string, string>>({})
  const [newComments, setNewComments] = useState<Record<string, string>>({})
  const [postingComment, setPostingComment] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<Array<{id: string, name: string, email: string, role: string}>>([])
  const [previewFile, setPreviewFile] = useState<any>(null)
  const [editingImageNote, setEditingImageNote] = useState<string | null>(null)
  const [imageNotes, setImageNotes] = useState<Record<string, string>>({})
  const [isClient, setIsClient] = useState(false)
  
  // Handle client-side rendering to avoid hydration issues
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // File input refs for each section
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Data fetching with SWR
  const { data: workspaceData, error, isLoading, mutate: refreshWorkspace } = useSWR<WorkspaceData>(
    stageId ? `/api/stages/${stageId}/sections` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      errorRetryCount: 3,
      errorRetryInterval: 5000
    }
  )
  
  // Load team members for mentions
  useEffect(() => {
    const loadTeamMembers = async () => {
      try {
        const response = await fetch('/api/chat/team-members')
        if (response.ok) {
          const data = await response.json()
          setTeamMembers(data.teamMembers || [])
        }
      } catch (error) {
        console.error('Error loading team members:', error)
      }
    }
    loadTeamMembers()
  }, [])

  // Completion status check
  const { data: completionStatus } = useSWR(
    stageId ? `/api/design/complete?stageId=${stageId}` : null,
    fetcher,
    {
      refreshInterval: 10000 // Check completion status more frequently
    }
  )

  // Memoized calculations
  const canMarkComplete = useMemo(() => {
    if (!workspaceData || !completionStatus) return false
    return completionStatus.stage.canComplete && workspaceData.stage.status !== 'FINALIZED'
  }, [workspaceData, completionStatus])

  const overallProgress = useMemo(() => {
    if (!workspaceData) return 0
    return workspaceData.completion.percentage
  }, [workspaceData])

  // Status management functions
  const updateStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/stages/${stageId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        refreshWorkspace()
        toast.success(`Status updated to ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.name || newStatus}`)
      }
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  // Phase completion handler
  const handleMarkComplete = async () => {
    if (!stageId || !canMarkComplete) return

    setIsCompleting(true)
    try {
      await updateStatus('FINALIZED')
      toast.success('Design Concept finalized successfully!', {
        description: 'Ready for next phase.'
      })
    } catch (error) {
      toast.error('Failed to finalize design concept')
    } finally {
      setIsCompleting(false)
    }
  }
  
  // Handle upload completion
  const handleUploadComplete = (asset: any) => {
    refreshWorkspace() // Refresh the workspace
    toast.success('Reference uploaded successfully!')
  }
  
  const handleUploadError = (error: string) => {
    toast.error(error)
  }
  
  // Section management functions
  const toggleSection = (sectionType: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionType)) {
      newExpanded.delete(sectionType)
    } else {
      newExpanded.add(sectionType)
    }
    setExpandedSections(newExpanded)
  }

  // Section completion toggle
  const toggleSectionCompletion = async (sectionType: string) => {
    const section = safeStage.designSections.find(s => s.type === sectionType)
    if (!section) {
      // If section doesn't exist, create it first
      try {
        const sectionId = await getOrCreateSectionId(sectionType)
        // Now toggle completion on the new section
        await toggleExistingSectionCompletion(sectionId, true)
      } catch (error) {
        console.error('Error creating and completing section:', error)
        toast.error('Failed to create and complete section')
      }
      return
    }
    
    await toggleExistingSectionCompletion(section.id, !section.completed)
  }

  const toggleExistingSectionCompletion = async (sectionId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/design/sections/${sectionId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update section completion')
      }
      
      const result = await response.json()
      console.log('Section completion updated:', result)
      
      // Refresh workspace to show updated status
      refreshWorkspace()
      
      toast.success(completed 
        ? 'Section marked as complete' 
        : 'Section marked as incomplete'
      )
      
    } catch (error) {
      console.error('Error updating section completion:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update section')
    }
  }

  // Get or create design section
  const getOrCreateSectionId = async (sectionType: string): Promise<string> => {
    console.log('🔍 getOrCreateSectionId called with:', { sectionType, stageId })
    
    if (!stageId) {
      throw new Error('No stage ID available')
    }
    
    // First try to find existing section
    const existingSection = safeStage.designSections.find(s => s.type === sectionType)
    console.log('🔍 Checking existing sections:', {
      availableSections: safeStage.designSections.map(s => ({ id: s.id, type: s.type })),
      searchingFor: sectionType,
      existingSection: existingSection ? { id: existingSection.id, type: existingSection.type } : null
    })
    
    if (existingSection?.id) {
      console.log('✅ Found existing section:', existingSection.id)
      // Validate the section ID format
      if (typeof existingSection.id !== 'string' || existingSection.id.length < 10) {
        console.error('❌ Invalid section ID format:', existingSection.id)
        throw new Error('Invalid section ID format')
      }
      return existingSection.id
    }
    
    // If no section exists, create one via API
    try {
      console.log('🆕 Creating new section via API:', { stageId, type: sectionType })
      
      const requestBody = { 
        stageId,
        type: sectionType
      }
      
      console.log('📡 Making request with body:', requestBody)
      
      const response = await fetch('/api/design/sections', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        credentials: 'include' // Ensure cookies are included
      })
      
      console.log('📡 Section creation response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      if (!response.ok) {
        let errorText = ''
        try {
          errorText = await response.text()
          console.error('❌ Section creation error response:', errorText)
        } catch (e) {
          console.error('❌ Could not read error response')
        }
        throw new Error(`Section creation failed: ${response.status} ${response.statusText}. ${errorText}`)
      }
      
      const result = await response.json()
      console.log('📊 Section creation result:', result)
      
      if (result.success && result.section?.id) {
        console.log('✅ Section created successfully:', result.section.id)
        // Validate the new section ID format
        if (typeof result.section.id !== 'string' || result.section.id.length < 10) {
          console.error('❌ Invalid new section ID format:', result.section.id)
          throw new Error('Invalid new section ID format')
        }
        
        refreshWorkspace() // Refresh data to show new section
        return result.section.id
      } else {
        console.error('❌ Section creation failed:', result)
        throw new Error(result.error || result.message || 'Failed to create section - invalid response format')
      }
    } catch (error) {
      console.error('❌ Error creating section:', error)
      console.error('Error details:', error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Unknown error type')
      
      toast.error(`Failed to create section: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // File upload handler
  const handleFileUpload = async (sectionType: string, files: FileList) => {
    console.log('📤 handleFileUpload called with:', { 
      sectionType, 
      fileCount: files.length,
      files: Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })),
      stageId 
    })
    
    if (!files.length) {
      console.log('⚠️ No files to upload')
      return
    }

    setUploadingSection(sectionType)
    try {
      console.log('🎯 Getting/creating section ID...')
      const sectionId = await getOrCreateSectionId(sectionType)
      console.log('✅ Got section ID:', sectionId)
      
      // Upload each file
      const uploadPromises = Array.from(files).map(async (file, index) => {
        console.log(`📤 Uploading file ${index + 1}/${files.length}:`, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          sectionId
        })
        
        const formData = new FormData()
        formData.append('file', file)
        formData.append('sectionId', sectionId)
        
        console.log('📡 Making upload request to /api/design/upload...')
        
        // Log all cookies and headers for debugging
        console.log('🍪 Current cookies:', document.cookie)
        console.log('🌐 Current location:', window.location.href)
        
        const response = await fetch('/api/design/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include' // Ensure cookies are included
        })
        
        console.log('📈 Upload response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ Upload failed with error data:', errorData)
          throw new Error(errorData.error || `Upload failed: ${response.status} ${response.statusText}`)
        }
        
        const result = await response.json()
        console.log('✅ Upload successful:', result)
        return result
      })
      
      console.log('⏳ Waiting for all uploads to complete...')
      const results = await Promise.all(uploadPromises)
      console.log('🎉 All uploads completed:', results)
      
      toast.success(`${files.length} file(s) uploaded successfully`)
      
      console.log('🔄 Refreshing workspace...')
      refreshWorkspace() // Refresh to show uploaded files
      
    } catch (error) {
      console.error('❌ Upload error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      console.log('🏁 Upload process finished, clearing uploading state')
      setUploadingSection(null)
    }
  }

  // Comment posting handler with mentions support
  const handlePostComment = async (sectionType: string, mentions: string[] = []) => {
    const comment = newComments[sectionType]?.trim()
    console.log('💬 handlePostComment called with:', { 
      sectionType, 
      comment: comment ? `"${comment}" (length: ${comment.length})` : 'EMPTY/NULL',
      mentions,
      stageId 
    })
    
    if (!comment) {
      console.log('⚠️ No comment content, aborting')
      return
    }

    setPostingComment(sectionType)
    try {
      console.log('🎯 Getting/creating section ID for comment...')
      const sectionId = await getOrCreateSectionId(sectionType)
      console.log('✅ Got section ID for comment:', sectionId)
      
      // Map mention names to user IDs using the same matching logic as the mention validation
      const mentionIds = []
      for (const mention of mentions) {
        const matchingMember = teamMembers.find(member => {
          const memberNameLower = member.name.toLowerCase()
          const mentionLower = mention.toLowerCase()
          
          // Exact match
          if (memberNameLower === mentionLower) {
            return true
          }
          
          // Partial match - check if the mention is contained in the member name
          if (memberNameLower.includes(mentionLower) || memberNameLower.startsWith(mentionLower)) {
            return true
          }
          
          // Also check first name only
          const memberFirstName = memberNameLower.split(/\s|\(|\)/)[0]
          const mentionFirstName = mentionLower.split(/\s|\(|\)/)[0]
          
          return memberFirstName === mentionFirstName
        })
        
        if (matchingMember && !mentionIds.includes(matchingMember.id)) {
          mentionIds.push(matchingMember.id)
        }
      }
      
      const requestBody = {
        sectionId,
        content: comment,
        mentions: mentionIds
      }
      console.log('📡 Making comment request to /api/design/comments with body:', requestBody)
      
      // Log all cookies and headers for debugging
      console.log('🍪 Current cookies:', document.cookie)
      console.log('🌐 Current location:', window.location.href)
      
      const response = await fetch('/api/design/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        credentials: 'include' // Ensure cookies are included
      })
      
      console.log('📈 Comment response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      if (!response.ok) {
        console.error('❌ Comment request failed with status:', response.status, response.statusText)
        console.error('❌ Response headers:', Object.fromEntries(response.headers.entries()))
        
        let errorData = {}
        try {
          const responseText = await response.text()
          console.error('❌ Raw response text:', responseText)
          if (responseText) {
            errorData = JSON.parse(responseText)
          }
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError)
        }
        
        console.error('❌ Comment failed with error data:', errorData)
        const errorMessage = (errorData as any).error || (errorData as any).message || `Comment failed: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }
      
      const result = await response.json()
      console.log('✅ Comment posted successfully:', result)
      
      // Clear comment input and refresh
      console.log('🧹 Clearing comment input and refreshing workspace...')
      setNewComments(prev => ({ ...prev, [sectionType]: '' }))
      refreshWorkspace()
      toast.success('Comment posted successfully')
      
    } catch (error) {
      console.error('❌ Comment error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error(error instanceof Error ? error.message : 'Failed to post comment')
    } finally {
      console.log('🏁 Comment process finished, clearing posting state')
      setPostingComment(null)
    }
  }

  // Content editing handlers
  const startEditingContent = (sectionType: string, currentContent: string = '') => {
    setEditingSection(sectionType)
    setEditingContent(prev => ({ ...prev, [sectionType]: currentContent }))
  }

  const saveContent = async (sectionType: string) => {
    const content = editingContent[sectionType]?.trim()
    if (!content) return

    try {
      const response = await fetch(`/api/stages/${stageId}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType,
          content
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save content')
      }
      
      setEditingSection(null)
      refreshWorkspace()
      toast.success('Content saved successfully')
    } catch (error) {
      console.error('Save error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save content')
    }
  }

  // Save image note
  const saveImageNote = async (assetId: string) => {
    const note = imageNotes[assetId]?.trim() || ''
    
    try {
      const response = await fetch(`/api/design/assets/${assetId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save image note')
      }
      
      setEditingImageNote(null)
      refreshWorkspace()
      toast.success('Image note saved successfully')
    } catch (error) {
      console.error('Save image note error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save image note')
    }
  }

  // Loading states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <p className="text-gray-600">Loading Design Concept Workspace...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-800">Failed to Load Workspace</h3>
            <p className="text-red-600 mt-1">
              {error.message || 'There was an error loading the workspace. Please refresh the page.'}
            </p>
            <Button 
              onClick={() => refreshWorkspace()} 
              variant="outline" 
              size="sm"
              className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!workspaceData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">No workspace data available.</p>
      </div>
    )
  }

  const { stage, room, project } = workspaceData
  const StatusIcon = STATUS_CONFIG[stage.status as keyof typeof STATUS_CONFIG]?.icon || Clock
  
  // Add defensive programming - ensure arrays are always arrays
  const safeStage = {
    ...stage,
    designSections: Array.isArray(stage.designSections) ? stage.designSections : [],
    assignedUser: stage.assignedUser || null
  }
  
  // Debug workspace data and session
  console.log('🔍 Rendering BedroomDesignWorkspace with data:', {
    stageId,
    stage: {
      id: safeStage.id,
      status: safeStage.status,
      type: safeStage.type,
      designSections: safeStage.designSections.map(s => ({ id: s.id, type: s.type }))
    },
    room: {
      id: room?.id,
      name: room?.name,
      type: room?.type
    },
    project: {
      id: project?.id,
      name: project?.name
    }
  })

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* 1. Room Overview (Top Section) */}
      <div className="px-6 py-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Home className="w-8 h-8 text-white" />
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                {room.name || room.type} – Design Concept
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                <div className="flex items-center space-x-1">
                  <Building className="w-4 h-4" />
                  <span className="font-medium">{project.name}</span>
                </div>
                <span className="text-gray-400">•</span>
                <span>{project.client.name}</span>
              </div>
              
              {/* Assignment Info */}
              {safeStage.assignedUser && (
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>Assigned to {safeStage.assignedUser.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Controls */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-900">{overallProgress}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
            
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={safeStage.status}
                onChange={(e) => updateStatus(e.target.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  STATUS_CONFIG[safeStage.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'
                }`}
              >
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="FINALIZED">Finalized</option>
              </select>
            </div>
            
            {/* Design Notifications */}
            <DesignNotificationIndicator stageId={safeStage.id} />
            
            <PhaseSettingsMenu 
              stageId={safeStage.id}
              stageName="Design Concept"
              isNotApplicable={safeStage.status === 'NOT_APPLICABLE'}
              onReset={() => refreshWorkspace()}
              onMarkNotApplicable={() => refreshWorkspace()}
              onMarkApplicable={() => refreshWorkspace()}
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-white/80 rounded-full h-4 border border-white">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <Palette className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Design Sections</p>
                <p className="font-bold text-gray-900">{workspaceData.completion.totalSections}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Completed</p>
                <p className="font-bold text-gray-900">{workspaceData.completion.completedSections}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Messages</p>
                <p className="font-bold text-gray-900">
                  {safeStage.designSections.reduce((total, section) => total + ((section.comments && Array.isArray(section.comments)) ? section.comments.length : 0), 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/50">
            <div className="flex items-center space-x-2">
              <Bookmark className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-xs text-gray-600">References</p>
                <p className="font-bold text-gray-900">
                  {safeStage.designSections.reduce((total, section) => total + ((section.assets && Array.isArray(section.assets)) ? section.assets.length : 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout - With Sidebar */}
      <div className="flex">
        {/* Main Workspace */}
        <div className="flex-1 p-6">
          {/* 2. Design Sections */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Design Sections</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Complete each section to finalize your design concept
                </p>
              </div>
            </div>

          {/* Design Sections */}
          <div className="space-y-6">
            {['GENERAL', 'WALL_COVERING', 'CEILING', 'FLOOR'].map((sectionType) => {
              const sectionDef = {
                'GENERAL': { name: 'General Design', icon: '✨', color: 'from-purple-500 to-pink-500', description: 'Overall design concept, mood, and styling direction' },
                'WALL_COVERING': { name: 'Wall Covering', icon: '🎨', color: 'from-blue-500 to-cyan-500', description: 'Wall treatments, paint colors, wallpaper, and finishes' },
                'CEILING': { name: 'Ceiling Design', icon: '⬆️', color: 'from-amber-500 to-orange-500', description: 'Ceiling treatments, lighting integration, and details' },
                'FLOOR': { name: 'Floor Design', icon: '⬇️', color: 'from-emerald-500 to-teal-500', description: 'Flooring materials, patterns, transitions, and area rugs' }
              }[sectionType]
              
              const section = safeStage.designSections.find(s => s.type === sectionType)
              const isCompleted = section?.completed || false
              const isExpanded = expandedSections.has(sectionType)
              const isUploading = uploadingSection === sectionType
              const isEditing = editingSection === sectionType
              const isPostingComment = postingComment === sectionType
              
              return (
                <div key={sectionType} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  {/* Section Header */}
                  <div 
                    className="p-6 cursor-pointer select-none" 
                    onClick={() => toggleSection(sectionType)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 bg-gradient-to-br ${sectionDef.color} rounded-xl flex items-center justify-center shadow-sm`}>
                          <span className="text-2xl">{sectionDef.icon}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{sectionDef.name}</h3>
                          <p className="text-sm text-gray-600">{sectionDef.description}</p>
                          <div className="flex items-center space-x-3 mt-2">
                            {isCompleted && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                ✅ Complete
                              </div>
                            )}
                            
                            {/* Content indicators with enhanced visibility */}
                            {section?.content && section.content.trim() && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                📝 Has Notes
                              </div>
                            )}
                            
                            {section?.assets && Array.isArray(section.assets) && section.assets.length > 0 && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                🖼️ {section.assets.length} image{section.assets.length !== 1 ? 's' : ''}
                              </div>
                            )}
                            
                            {section?.comments && Array.isArray(section.comments) && section.comments.length > 0 && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                                💬 {section.comments.length} comment{section.comments.length !== 1 ? 's' : ''}
                              </div>
                            )}
                            
                            {/* New content indicator (last updated within 24 hours) - client-side only */}
                            {isClient && section?.updatedAt && new Date(section.updatedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000 && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 animate-pulse">
                                🆕 Updated recently
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Section completion toggle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation() // Prevent section toggle
                            toggleSectionCompletion(sectionType)
                          }}
                          className={`p-2 rounded-lg border transition-colors ${
                            isCompleted 
                              ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                          }`}
                          title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                        >
                          <CheckSquare className="w-4 h-4" />
                        </Button>
                        
                        {/* Expand/collapse toggle */}
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section Content (when expanded) */}
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-gray-100">
                      <div className="pt-6 space-y-6">
                        {/* Content Section */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">Design Notes</h4>
                            {!isEditing && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditingContent(sectionType, section?.content || '')}
                              >
                                <Edit2 className="w-4 h-4 mr-1" />
                                {section?.content ? 'Edit' : 'Add Notes'}
                              </Button>
                            )}
                          </div>
                          
                          {isEditing ? (
                            <div className="space-y-3">
                              <textarea
                                value={editingContent[sectionType] || ''}
                                onChange={(e) => setEditingContent(prev => ({ ...prev, [sectionType]: e.target.value }))}
                                placeholder={`Describe your ${sectionDef.name.toLowerCase()} concepts, materials, colors, and ideas...`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                rows={4}
                              />
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingSection(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => saveContent(sectionType)}
                                  className="bg-purple-600 hover:bg-purple-700"
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-4">
                              {section?.content ? (
                                <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
                              ) : (
                                <p className="italic text-gray-500">No design notes added yet. Click 'Add Notes' to get started.</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Image Gallery */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">Reference Images</h4>
                            <div className="flex items-center space-x-2">
                              <input
                                type="file"
                                ref={(el) => { fileInputRefs.current[sectionType] = el }}
                                multiple
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleFileUpload(sectionType, e.target.files)
                                  }
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRefs.current[sectionType]?.click()}
                                disabled={isUploading}
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                {isUploading ? 'Uploading...' : 'Upload Images'}
                              </Button>
                            </div>
                          </div>
                          
                          {section?.assets && Array.isArray(section.assets) && section.assets.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {section.assets.map((asset) => {
                                const isEditingNote = editingImageNote === asset.id
                                const currentNote = imageNotes[asset.id] || asset.userDescription || ''
                                
                                return (
                                  <div key={asset.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    {/* Image */}
                                    <div 
                                      className="group relative bg-gray-100 rounded-lg overflow-hidden aspect-square cursor-pointer"
                                      onClick={() => setPreviewFile({
                                        id: asset.id,
                                        name: asset.title,
                                        originalName: asset.title,
                                        type: asset.type === 'IMAGE' ? 'image' : asset.type === 'PDF' ? 'pdf' : 'document',
                                        url: asset.url,
                                        size: 0,
                                        uploadedAt: asset.createdAt,
                                        uploadedBy: { name: 'User' },
                                        metadata: {
                                          sizeFormatted: '0 KB',
                                          extension: asset.url.split('.').pop() || '',
                                          isImage: asset.type === 'IMAGE',
                                          isPDF: asset.type === 'PDF'
                                        }
                                      })}
                                    >
                                      <img 
                                        src={asset.url} 
                                        alt={asset.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                                          <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Image Title */}
                                    <h5 className="font-medium text-gray-900 text-sm">{asset.title}</h5>
                                    
                                    {/* Image Notes */}
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">Notes</span>
                                        {!isEditingNote && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setEditingImageNote(asset.id)
                                              setImageNotes(prev => ({ ...prev, [asset.id]: asset.userDescription || '' }))
                                            }}
                                            className="text-xs h-7 px-2"
                                          >
                                            <Edit2 className="w-3 h-3 mr-1" />
                                            {asset.userDescription ? 'Edit' : 'Add Note'}
                                          </Button>
                                        )}
                                      </div>
                                      
                                      {isEditingNote ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={currentNote}
                                            onChange={(e) => setImageNotes(prev => ({ ...prev, [asset.id]: e.target.value }))}
                                            placeholder="Add a note about this image... (materials, colors, inspiration, etc.)"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                            rows={3}
                                          />
                                          <div className="flex justify-end space-x-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                setEditingImageNote(null)
                                                setImageNotes(prev => ({ ...prev, [asset.id]: asset.userDescription || '' }))
                                              }}
                                              className="text-xs h-7 px-2"
                                            >
                                              Cancel
                                            </Button>
                                            <Button
                                              size="sm"
                                              onClick={() => saveImageNote(asset.id)}
                                              className="bg-purple-600 hover:bg-purple-700 text-xs h-7 px-2"
                                            >
                                              <Save className="w-3 h-3 mr-1" />
                                              Save
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="bg-white rounded-md p-3 border border-gray-200">
                                          {asset.userDescription ? (
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{asset.userDescription}</p>
                                          ) : (
                                            <p className="text-sm italic text-gray-500">No notes yet. Click 'Add Note' to describe this image.</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                              <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-500 mb-2">No reference images yet</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRefs.current[sectionType]?.click()}
                                disabled={isUploading}
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Upload First Image
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Comments Section */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">Comments & Discussion</h4>
                          
                          {/* Existing Comments */}
                          {section?.comments && Array.isArray(section.comments) && section.comments.length > 0 && (
                            <div className="space-y-3 mb-4">
                              {section.comments.map((comment) => (
                                <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <span className="text-sm font-medium text-purple-600">
                                        {comment.author.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <span className="font-medium text-gray-900 text-sm">{comment.author.name}</span>
                                        <span className="text-xs text-gray-500">
                                          {isClient ? new Date(comment.createdAt).toLocaleDateString() : 'Loading date...'}
                                        </span>
                                      </div>
                                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* New Comment Input */}
                          <div className="flex space-x-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="flex-1">
                              <MentionTextarea
                                value={newComments[sectionType] || ''}
                                onChange={(value) => setNewComments(prev => ({ ...prev, [sectionType]: value }))}
                                onSubmit={(text, mentions) => handlePostComment(sectionType, mentions)}
                                teamMembers={teamMembers}
                                placeholder={`Add a comment about ${sectionDef.name.toLowerCase()}... Use @name to mention team members`}
                                rows={2}
                                disabled={isPostingComment}
                                submitLabel={isPostingComment ? 'Posting...' : 'Post Comment'}
                                className="focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* 3. Completion Section */}
          {canMarkComplete && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-800">Ready to Complete</h3>
                  <p className="text-sm text-green-600">All sections are ready. Mark this phase as complete.</p>
                </div>
                <Button
                  onClick={handleMarkComplete}
                  disabled={isCompleting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {showActivityLog && (
            <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowActivityLog(false)}
                >
                  Hide Activity
                </Button>
              </div>
              {/* Activity Timeline */}
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Recent Activity</p>
                    <p className="text-xs text-gray-500 mt-1">Design workspace initialized • Just now</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
        
        {/* Chat Sidebar */}
        <div className="w-96 border-l border-gray-200 bg-gray-50">
          {workspaceData && (
            <PhaseChat
              stageId={workspaceData.stage.id}
              stageName={`Design Concept - ${workspaceData.room.name || workspaceData.room.type}`}
              className="h-full"
            />
          )}
        </div>
      </div>
      
      {/* Enhanced File Preview Modal */}
      {previewFile && (
        <EnhancedFilePreviewModal
          file={previewFile}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
      
    </div>
  )
}
