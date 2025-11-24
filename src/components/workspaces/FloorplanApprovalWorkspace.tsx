'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Info, 
  User, 
  Calendar, 
  Mail,
  Eye,
  EyeOff,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  Send,
  FileText,
  ChevronDown,
  Monitor,
  TestTube,
  RefreshCw,
  RotateCcw,
  Minus,
  Upload,
  FileImage,
  Edit2,
  MessageSquare,
  Trash2,
  Loader2
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { PhaseChat } from '../chat/PhaseChat'
import Link from 'next/link'
import EnhancedFilePreviewModal from '@/components/ui/enhanced-file-preview-modal'
import CreateVersionModal from '@/components/modals/CreateVersionModal'
import ClientApprovalModal from '@/components/modals/ClientApprovalModal'
import { toast } from 'react-hot-toast'
import EmailPreviewModal, { EmailPreviewData } from '@/components/modals/EmailPreviewModal'

interface FloorplanApprovalWorkspaceProps {
  project: any
}

interface FloorplanApprovalVersion {
  id: string
  version: string
  status: 'DRAFT' | 'READY_FOR_CLIENT' | 'SENT_TO_CLIENT' | 'CLIENT_REVIEWING' | 'CLIENT_APPROVED' | 'REVISION_REQUESTED'
  sentToClientAt?: string
  emailOpenedAt?: string
  clientDecision?: 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED'
  clientDecidedAt?: string
  clientMessage?: string
  notes?: string
  createdAt: string
  updatedAt?: string
  assets: Array<{
    id: string
    asset: {
      id: string
      title: string
      url: string
      type: 'FLOORPLAN_PDF' | 'FLOORPLAN_CAD'
      size?: number
    }
    includeInEmail: boolean
  }>
  activityLogs: Array<{
    id: string
    type: string
    message: string
    user?: { name: string }
    createdAt: string
  }>
}

const getStatusConfig = (status: string) => {
  const configs = {
    'DRAFT': { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    'READY_FOR_CLIENT': { label: 'Ready to Send', color: 'bg-green-100 text-green-800' },
    'SENT_TO_CLIENT': { label: 'Sent to Client', color: 'bg-purple-100 text-purple-800' },
    'CLIENT_REVIEWING': { label: 'Client Reviewing', color: 'bg-yellow-100 text-yellow-800' },
    'CLIENT_APPROVED': { label: 'Client Approved', color: 'bg-green-100 text-green-800' },
    'REVISION_REQUESTED': { label: 'Revision Requested', color: 'bg-red-100 text-red-800' }
  }
  return configs[status as keyof typeof configs] || { label: status, color: 'bg-gray-100 text-gray-800' }
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown size'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
}

export default function FloorplanApprovalWorkspace({
  project
}: FloorplanApprovalWorkspaceProps) {
  const router = useRouter()
  const [currentVersion, setCurrentVersion] = useState<FloorplanApprovalVersion | null>(null)
  const [versions, setVersions] = useState<FloorplanApprovalVersion[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [showRevisionNotes, setShowRevisionNotes] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [emailAnalytics, setEmailAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [showEmailDetails, setShowEmailDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<'assets' | 'email' | 'activity'>('assets')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  
  // PDF preview modal state
  const [selectedFile, setSelectedFile] = useState<{
    id: string
    name: string
    originalName: string
    type: 'image' | 'pdf' | 'document'
    url: string
    size: number
    uploadedAt: string
    uploadedBy: {
      name: string
    }
    metadata?: {
      sizeFormatted: string
      extension: string
      isImage: boolean
      isPDF: boolean
    }
  } | null>(null)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  
  // Version creation modal state
  const [showCreateVersionModal, setShowCreateVersionModal] = useState(false)
  const [nextVersionNumber, setNextVersionNumber] = useState('v1')
  
  // Client approval modal state
  const [showClientApprovalModal, setShowClientApprovalModal] = useState(false)
  
  // Email preview modal state
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false)
  const [emailPreviewData, setEmailPreviewData] = useState<EmailPreviewData | null>(null)

  // Fetcher function for SWR
  const fetcher = (url: string) => fetch(url).then(res => res.json())

  // Fetch floorplan approval data from API
  useEffect(() => {
    const fetchFloorplanApprovalData = async () => {
      try {
        setFetchError(null)
        const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (response.ok) {
          const data = await response.json()
          setVersions(data.versions || [])
          setCurrentVersion(data.currentVersion || null)
          setNotes(data.currentVersion?.notes || '')
          
          // Calculate next version number
          const nextVersionNum = `v${(data.versions?.length || 0) + 1}`
          setNextVersionNumber(nextVersionNum)
          
          // Initialize selected assets
          if (data.currentVersion?.assets) {
            setSelectedAssets(data.currentVersion.assets.filter((a: any) => a.includeInEmail).map((a: any) => a.id))
          }
          
          // Fetch email analytics if version was sent
          if (data.currentVersion?.sentToClientAt) {
            fetchEmailAnalytics(data.currentVersion.id)
          }
        } else if (response.status === 404) {
          // No versions yet - this is normal for new floorplan approval
          setVersions([])
          setCurrentVersion(null)
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          setFetchError(`Failed to load floorplan approval data: ${errorData.error || 'Server error'}`)
          console.error('Failed to fetch floorplan approval data:', errorData)
        }
      } catch (error) {
        console.error('Error fetching floorplan approval data:', error)
        setFetchError('Network error occurred. Please try again.')
      } finally {
        setIsInitialLoading(false)
      }
    }

    fetchFloorplanApprovalData()
  }, [project.id])

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isPreviewModalOpen) {
        setIsPreviewModalOpen(false)
        setSelectedFile(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isPreviewModalOpen])

  // Fetch email analytics
  const fetchEmailAnalytics = async (versionId: string) => {
    setLoadingAnalytics(true)
    try {
      const response = await fetch(`/api/floorplan-approvals/${versionId}/analytics`)
      if (response.ok) {
        const data = await response.json()
        setEmailAnalytics(data)
      } else {
        console.error('Failed to fetch email analytics')
      }
    } catch (error) {
      console.error('Error fetching email analytics:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const createNewVersion = async (versionNotes: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: versionNotes
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Refresh all data
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setVersions(updatedData.versions || [])
          setCurrentVersion(updatedData.currentVersion || null)
          
          // Update next version number
          const nextVersionNum = `v${(updatedData.versions?.length || 0) + 1}`
          setNextVersionNumber(nextVersionNum)
          
          // Don't clear notes - they should reflect the current version
          setNotes(updatedData.currentVersion?.notes || '')
        }
        
        setSelectedAssets([])
        
        toast.success(`Version ${data.version.version} created successfully!`, {
          duration: 4000,
          position: 'top-right'
        })
      } else {
        const error = await response.json()
        console.error('Failed to create version:', error)
        toast.error(`Failed to create version: ${error.error || 'Unknown error'}`, {
          duration: 5000,
          position: 'top-right'
        })
        throw new Error(error.error || 'Failed to create version')
      }
    } catch (error) {
      console.error('Error creating version:', error)
      if (!error.message?.includes('Failed to create version:')) {
        toast.error('Failed to create version. Please try again.', {
          duration: 5000,
          position: 'top-right'
        })
      }
      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    if (!currentVersion) {
      alert('Please create a version first')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const filesArray = Array.from(files)
      let successCount = 0
      
      // Upload files one by one since API expects single file
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i]
        const formData = new FormData()
        formData.append('file', file) // Use 'file' not 'files'
        formData.append('versionId', currentVersion.id)

        const response = await fetch(`/api/projects/${project.id}/floorplan-assets`, {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          successCount++
          const progress = Math.round(((i + 1) / filesArray.length) * 100)
          setUploadProgress(progress)
        } else {
          const error = await response.json()
          console.error(`Upload failed for ${file.name}:`, error)
          alert(`Upload failed for ${file.name}: ${error.error}`)
        }
      }
      
      if (successCount > 0) {
        // Refresh current version data
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setCurrentVersion(updatedData.currentVersion)
          setVersions(updatedData.versions)
        }
        
        alert(`Successfully uploaded ${successCount} of ${filesArray.length} files`)
      }
      
      setTimeout(() => setUploadProgress(0), 1000)
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this file? This cannot be undone.')) {
      return
    }

    setDeletingAssetId(assetId)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-assets?assetId=${assetId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json().catch(() => ({}))
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to delete asset')
      }

      // Refresh the current version data
      const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json()
        setCurrentVersion(updatedData.currentVersion || null)
        setVersions(updatedData.versions || [])
      }

      toast.success('File deleted successfully', {
        duration: 3000,
        position: 'top-right'
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete file'
      console.error('Error deleting asset:', error)
      toast.error(message, {
        duration: 5000,
        position: 'top-right'
      })
    } finally {
      setDeletingAssetId(null)
    }
  }

  const handleSendToClient = async () => {
    if (!currentVersion) return

    // Pre-flight validation
    if (selectedAssets.length === 0) {
      toast.error('Please select at least one file to include in the email', {
        duration: 5000,
        position: 'top-right'
      })
      return
    }

    setLoading(true)
    try {
      // Fetch email preview first
      const selectedAssetIds = selectedAssets
      const previewResponse = await fetch(
        `/api/floorplan-approvals/${currentVersion.id}/email-preview?selectedAssetIds=${selectedAssetIds.join(',')}`
      )
      
      if (previewResponse.ok) {
        const previewData = await previewResponse.json()
        
        // Build attachments list from current version assets
        const attachments = currentVersion?.assets.map(asset => ({
          id: asset.id,
          title: asset.asset.title,
          url: asset.asset.url,
          type: asset.asset.type,
          size: asset.asset.size,
          selected: selectedAssetIds.includes(asset.id)
        })) || []
        
        setEmailPreviewData({
          to: previewData.to,
          subject: previewData.subject,
          htmlContent: previewData.htmlContent,
          attachments
        })
        setShowEmailPreviewModal(true)
      } else {
        const error = await previewResponse.json()
        toast.error(`Failed to generate email preview: ${error.error}`, {
          duration: 5000,
          position: 'top-right'
        })
      }
    } catch (error) {
      console.error('Failed to fetch email preview:', error)
      toast.error('Failed to generate email preview. Please try again.', {
        duration: 5000,
        position: 'top-right'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSendEmail = async (emailData: EmailPreviewData, selectedAttachmentIds: string[]) => {
    const response = await fetch(`/api/floorplan-approvals/${currentVersion!.id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        selectedAssetIds: selectedAttachmentIds,
        customSubject: emailData.subject,
        customHtmlContent: emailData.htmlContent
      })
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok) {
      setCurrentVersion(data.version)
      
      // Update selected assets to reflect what was sent
      setSelectedAssets(selectedAttachmentIds)

      // Fetch email analytics after sending
      if (data.version?.id) {
        fetchEmailAnalytics(data.version.id)
      }
    } else {
      const message = data.error || data.details || 'Failed to send email'
      console.error('Failed to send email:', data)
      throw new Error(message)
    }
  }

  const handleUpdateStatus = async (action: string) => {
    if (!currentVersion) return

    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          versionId: currentVersion.id,
          action,
          notes: notes.trim() || undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
        
        // Refresh all data to get latest activity logs
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setVersions(updatedData.versions || [])
          setCurrentVersion(updatedData.currentVersion || null)
        }
        
        toast.success('Status updated successfully!', {
          duration: 4000,
          position: 'top-right'
        })
      } else {
        const error = await response.json()
        console.error('Failed to update status:', error)
        toast.error(`Failed to update status: ${error.error || 'Unknown error'}`, {
          duration: 5000,
          position: 'top-right'
        })
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status. Please try again.', {
        duration: 5000,
        position: 'top-right'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClientDecision = async (decision: 'APPROVED' | 'REVISION_REQUESTED', clientMessage?: string) => {
    if (!currentVersion) return

    // For revision requests, show notes input first
    if (decision === 'REVISION_REQUESTED' && !showRevisionNotes && !clientMessage) {
      setShowRevisionNotes(true)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          versionId: currentVersion.id,
          action: 'client_decision',
          clientDecision: decision,
          clientMessage: clientMessage || (decision === 'REVISION_REQUESTED' ? revisionNotes : null)
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Refresh all data to get latest activity logs
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setVersions(updatedData.versions || [])
          setCurrentVersion(updatedData.currentVersion || null)
        }

        if (decision === 'APPROVED') {
          toast.success('Client approval recorded successfully!', {
            duration: 4000,
            position: 'top-right'
          })
        } else {
          toast.success('Revision request recorded successfully!', {
            duration: 4000,
            position: 'top-right'
          })
          setShowRevisionNotes(false)
          setRevisionNotes('')
        }
      } else {
        const error = await response.json()
        console.error('Failed to record client decision:', error)
        toast.error(`Failed to record decision: ${error.error || 'Unknown error'}`, {
          duration: 5000,
          position: 'top-right'
        })
      }
    } catch (error) {
      console.error('Error recording client decision:', error)
      toast.error('Failed to record client decision. Please try again.', {
        duration: 5000,
        position: 'top-right'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClientApproval = async (method: string, notes?: string) => {
    if (!currentVersion) return

    const approvalMessage = `Client approved via ${method}${notes ? `: ${notes}` : ''}`
    
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          versionId: currentVersion.id,
          action: 'client_decision',
          clientDecision: 'APPROVED',
          clientMessage: approvalMessage
        })
      })

      if (response.ok) {
        // Refresh all data to get latest activity logs
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setVersions(updatedData.versions || [])
          setCurrentVersion(updatedData.currentVersion || null)
        }

        toast.success(`Client approval recorded successfully (${method})!`, {
          duration: 4000,
          position: 'top-right'
        })
      } else {
        const error = await response.json()
        console.error('Failed to record client approval:', error)
        toast.error(`Failed to record approval: ${error.error || 'Unknown error'}`, {
          duration: 5000,
          position: 'top-right'
        })
        throw error
      }
    } catch (error) {
      console.error('Error recording client approval:', error)
      if (!error.message?.includes('Failed to record approval')) {
        toast.error('Failed to record client approval. Please try again.', {
          duration: 5000,
          position: 'top-right'
        })
      }
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Quick approval method for direct approval buttons
  const handleClientApprovalWithMethod = async (method: 'EMAIL' | 'PHONE' | 'OTHER') => {
    const methodLabels = {
      'EMAIL': 'email',
      'PHONE': 'phone call',
      'OTHER': 'direct communication'
    }
    await handleClientApproval(methodLabels[method])
  }

  // Extract approval method from client message for tagging
  const getApprovalMethod = (clientMessage?: string) => {
    if (!clientMessage) return null
    
    if (clientMessage.includes('via email')) {
      return { type: 'email', icon: Mail, color: 'bg-blue-100 text-blue-800', label: 'Via Email' }
    }
    if (clientMessage.includes('via phone call')) {
      return { type: 'phone', icon: Phone, color: 'bg-green-100 text-green-800', label: 'Via Phone' }
    }
    if (clientMessage.includes('via direct communication')) {
      return { type: 'other', icon: MessageSquare, color: 'bg-purple-100 text-purple-800', label: 'Direct Communication' }
    }
    return null
  }

  const handleSendTestEmail = async () => {
    if (!testEmail.trim() || !currentVersion) {
      alert('Please enter a test email address')
      return
    }

    setSendingTestEmail(true)
    try {
      const response = await fetch(`/api/floorplan-approvals/${currentVersion.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          testEmail: testEmail.trim(),
          selectedAssetIds: selectedAssets
        })
      })

      if (response.ok) {
        alert(`Test email sent successfully to ${testEmail}`)
        setTestEmail('')
        setShowTestEmailDialog(false)
      } else {
        const error = await response.json()
        console.error('Failed to send test email:', error)
        alert(`Failed to send test email: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      alert('Failed to send test email. Please try again.')
    } finally {
      setSendingTestEmail(false)
    }
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading floorplan approval workspace...</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Floorplan Approval</h3>
          <p className="text-gray-600 mb-4">{fetchError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const statusConfig = currentVersion ? getStatusConfig(currentVersion.status) : null

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push(`/projects/${project.id}`)}
                variant="ghost"
                size="sm"
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Floorplan Approval Workspace</h2>
                <p className="text-sm text-gray-600">Manage floorplan approvals and client communication for {project.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Client Approved with Method Tag */}
              {currentVersion?.clientDecision === 'APPROVED' && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 border border-green-300 rounded-lg shadow-sm">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-semibold text-green-900">CLIENT APPROVED</span>
                  </div>
                  {(() => {
                    const method = getApprovalMethod(currentVersion.clientMessage)
                    if (method) {
                      const IconComponent = method.icon
                      return (
                        <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${method.color} shadow-sm`}>
                          <IconComponent className="w-3 h-3 mr-1.5" />
                          {method.label}
                        </div>
                      )
                    }
                    return null
                  })()
                  }
                </div>
              )}
              
              {/* Revision Requested with Notes Preview */}
              {currentVersion?.clientDecision === 'REVISION_REQUESTED' && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-red-100 border border-red-300 rounded-lg shadow-sm">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-semibold text-red-900">REVISION REQUESTED</span>
                  </div>
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 shadow-sm">
                    <Edit2 className="w-3 h-3 mr-1.5" />
                    Requires Changes
                  </div>
                </div>
              )}
              
              {/* Workflow Status Badge */}
              {statusConfig && (
                <Badge className={`${statusConfig.color} px-3 py-1.5 text-xs font-medium shadow-sm`}>
                  {statusConfig.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex space-x-8">
            {['assets', 'email', 'activity'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'assets' && 'Assets'}
                {tab === 'email' && 'Email Preview'}
                {tab === 'activity' && 'Activity Log'}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex">
          {/* Left Side - Tab Content */}
          <div className="flex-1 p-6">
            {activeTab === 'assets' && (
              <div className="space-y-6">
                {/* Create New Version */}
                {!currentVersion && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Floorplan Version Yet</h3>
                    <p className="text-gray-500 mb-4">Create your first version to start uploading floorplans</p>
                    <Button
                      onClick={() => setShowCreateVersionModal(true)}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Create First Version
                    </Button>
                  </div>
                )}

                {currentVersion && (
                  <>
                    {/* Version Header */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Version {currentVersion.version}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {selectedAssets.length} of {currentVersion.assets?.length || 0} selected for client email
                          </p>
                          {currentVersion.notes && (
                            <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-400">
                              <p className="text-xs text-blue-800 font-medium">Version Notes:</p>
                              <p className="text-sm text-blue-700">{currentVersion.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => setShowCreateVersionModal(true)}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            New Version
                          </Button>
                        </div>
                      </div>

                      {/* Upload Area */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          id="file-upload"
                          multiple
                          accept=".pdf,.dwg,.dxf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleFileUpload(e.target.files)
                            }
                          }}
                          className="hidden"
                          disabled={uploading}
                        />
                        <label
                          htmlFor="file-upload"
                          className={`cursor-pointer ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {uploading ? 'Uploading...' : 'Click to upload floorplan files (PDF, DWG, DXF)'}
                          </p>
                          {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </label>
                      </div>

                      {/* Asset Selection */}
                      {(currentVersion.assets?.length || 0) > 0 && (
                        <div className="mt-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-medium text-gray-900">Uploaded Files</h4>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAssets(currentVersion.assets?.map(a => a.id) || [])}
                                disabled={selectedAssets.length === (currentVersion.assets?.length || 0)}
                              >
                                Select All
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAssets([])}
                                disabled={selectedAssets.length === 0}
                              >
                                Select None
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentVersion.assets?.map((assetItem) => {
                              const isPDF = assetItem.asset.type === 'FLOORPLAN_PDF'
                              
                              const handleFileClick = () => {
                                if (isPDF) {
                                  setSelectedFile({
                                    id: assetItem.asset.id,
                                    name: assetItem.asset.title,
                                    originalName: assetItem.asset.title,
                                    type: 'pdf',
                                    url: assetItem.asset.url,
                                    size: assetItem.asset.size || 0,
                                    uploadedAt: new Date().toISOString(), // API doesn't provide createdAt, using current date
                                    uploadedBy: {
                                      name: 'User' // You might want to add proper user info from the API
                                    },
                                    metadata: {
                                      sizeFormatted: formatFileSize(assetItem.asset.size),
                                      extension: 'PDF',
                                      isImage: false,
                                      isPDF: true
                                    }
                                  })
                                  setIsPreviewModalOpen(true)
                                }
                              }
                              
                              return (
                                <div key={assetItem.id} className="relative border border-gray-200 rounded-lg p-4">
                                  {/* Delete Button */}
                                  <button
                                    onClick={() => handleDeleteAsset(assetItem.asset.id)}
                                    disabled={deletingAssetId === assetItem.asset.id}
                                    className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Delete file"
                                    aria-label="Delete file"
                                  >
                                    {deletingAssetId === assetItem.asset.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                  
                                  <div className="flex items-start space-x-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedAssets.includes(assetItem.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAssets(prev => [...prev, assetItem.id])
                                        } else {
                                          setSelectedAssets(prev => prev.filter(id => id !== assetItem.id))
                                        }
                                      }}
                                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        {isPDF ? (
                                          <FileText className="w-5 h-5 text-red-500" />
                                        ) : (
                                          <FileImage className="w-5 h-5 text-blue-500" />
                                        )}
                                        <div className="flex-1">
                                          <h5 
                                            className={`text-sm font-medium text-gray-900 ${
                                              isPDF ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''
                                            }`}
                                            onClick={handleFileClick}
                                          >
                                            {assetItem.asset.title}
                                          </h5>
                                          {isPDF && (
                                            <p className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer" onClick={handleFileClick}>
                                              Click to preview PDF
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-500 mb-2">
                                        {assetItem.asset.type.split('FLOORPLAN_').join('').toLowerCase()} • {formatFileSize(assetItem.asset.size)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {selectedAssets.includes(assetItem.id) ? '✓ Include in email' : '○ Not selected'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notes Section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Notes</h4>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this floorplan version..."
                        className="min-h-[80px]"
                        rows={3}
                      />
                      <div className="flex justify-end mt-3">
                        <Button
                          onClick={() => handleUpdateStatus('update_notes')}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          {loading ? 'Saving...' : 'Save Notes'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'email' && (
              <div className="space-y-6">
                {currentVersion ? (
                  <>
                    {/* Email Preview */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Preview</h3>
                      <div className="bg-gray-50 p-3 rounded-lg mb-4">
                        <p className="text-sm text-gray-600">
                          <strong>To:</strong> {project.client?.email}<br/>
                          <strong>Subject:</strong> {project.name} - Floorplan Ready for Approval
                        </p>
                      </div>
                      {currentVersion && (
                        <iframe
                          src={'/api/floorplan-approvals/' + currentVersion.id + '/preview?format=html'}
                          className="w-full h-96 border border-gray-200 rounded-lg"
                          title="Email Preview"
                        />
                      )}
                    </div>

                    {/* Test Email */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Test Email</h4>
                      <div className="flex space-x-3">
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="test@example.com"
                        />
                        <Button
                          onClick={handleSendTestEmail}
                          disabled={!testEmail.trim() || sendingTestEmail}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          <TestTube className="w-4 h-4 mr-2" />
                          {sendingTestEmail ? 'Sending...' : 'Send Test'}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Version to Preview</h3>
                    <p className="text-gray-500">Create a version and upload assets to preview the email</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>
                {(() => {
                  // Collect all activity logs from all versions, sorted by date
                  const allLogs = versions.flatMap(version => 
                    (version.activityLogs || []).map(log => ({
                      ...log,
                      version: version.version
                    }))
                  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  
                  return allLogs.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {allLogs.map((log) => (
                        <div key={log.version + '-' + log.id} className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            {log.user ? (
                              <User className="w-4 h-4 text-gray-600" />
                            ) : (
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              {log.user && (
                                <span className="text-xs font-medium text-gray-900">{log.user.name}</span>
                              )}
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {log.version}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {log.type.split('_').join(' ').toLowerCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 mb-1">{log.message}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-gray-400" />
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">No activity yet</h4>
                      <p className="text-xs text-gray-500">Activity will appear here as actions are taken</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-96 bg-gray-50 border-l border-gray-200">
            <div className="p-6 space-y-6">
              {/* Project Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Project Details</h4>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Project:</span>
                  <span className="text-sm font-medium">{project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Client:</span>
                  <span className="text-sm font-medium">{project.client?.name || 'N/A'}</span>
                </div>
                {currentVersion && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current Version:</span>
                      <span className="text-sm font-medium">{currentVersion.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Date Sent:</span>
                      <span className="text-sm font-medium">
                        {currentVersion.sentToClientAt 
                          ? new Date(currentVersion.sentToClientAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '-'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Opened:</span>
                      <div className="flex items-center space-x-1">
                        {currentVersion.emailOpenedAt ? (
                          <>
                            <Eye className="w-3 h-3 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              {new Date(currentVersion.emailOpenedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-500">Not opened</span>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Versions History */}
              {versions.length > 1 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Version History</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {versions.slice().reverse().map((version) => (
                      <div key={version.id} className="flex items-start justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-medium text-gray-900">{version.version}</span>
                            {version.id === currentVersion?.id && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                current
                              </span>
                            )}
                          </div>
                          {version.notes && (
                            <p className="text-xs text-gray-600 truncate" title={version.notes}>
                              {version.notes}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(version.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {currentVersion && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Actions</h4>
                  <div className="space-y-3">
                    
                    {/* 1. Mark Ready for Client */}
                    <Button
                      onClick={() => handleUpdateStatus('approve_by_aaron')}
                      disabled={loading || currentVersion.status !== 'DRAFT'}
                      variant="outline"
                      className="w-full"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {currentVersion.status === 'DRAFT' ? 'Mark Ready for Client' : 'Ready for Client ✓'}
                    </Button>

                    {/* 2. Send to Client */}
                    <div className="space-y-2">
                      <Button
                        onClick={handleSendToClient}
                        disabled={
                          loading || 
                          !currentVersion.approvedByAaron || 
                          selectedAssets.length === 0 || 
                          currentVersion.sentToClientAt !== null
                        }
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                        title={
                          !currentVersion.approvedByAaron 
                            ? 'Version must be approved internally first' 
                            : selectedAssets.length === 0 
                            ? 'Select at least one file to send' 
                            : currentVersion.sentToClientAt 
                            ? 'Already sent to client' 
                            : 'Send floorplan approval email to client'
                        }
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {currentVersion.sentToClientAt ? 
                          `Sent to Client (${new Date(currentVersion.sentToClientAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` 
                          : loading ? 'Sending...' 
                          : !currentVersion.approvedByAaron ? 'Requires Internal Approval First'
                          : selectedAssets.length === 0 ? 'Select Files to Send'
                          : 'Send to Client'
                        }
                      </Button>
                      {!currentVersion.sentToClientAt && !currentVersion.approvedByAaron && (
                        <p className="text-xs text-amber-600 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Mark as "Ready for Client" above before sending
                        </p>
                      )}
                      {!currentVersion.sentToClientAt && currentVersion.approvedByAaron && selectedAssets.length === 0 && (
                        <p className="text-xs text-amber-600 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Select at least one file from the Assets tab
                        </p>
                      )}
                    </div>

                    {/* 3. Client Approved Section */}
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <h5 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                        Client Approved
                      </h5>
                      
                      {/* Approval Methods */}
                      <div className="space-y-2">
                        <p className="text-xs text-green-700 mb-2">Mark as approved via:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            onClick={() => handleClientApprovalWithMethod('EMAIL')}
                            disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                            variant="outline"
                            size="sm"
                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 text-xs px-2 py-1"
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Email
                          </Button>
                          <Button
                            onClick={() => handleClientApprovalWithMethod('PHONE')}
                            disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                            variant="outline"
                            size="sm"
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 text-xs px-2 py-1"
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            Phone
                          </Button>
                          <Button
                            onClick={() => handleClientApprovalWithMethod('OTHER')}
                            disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                            variant="outline"
                            size="sm"
                            className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 text-xs px-2 py-1"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Other
                          </Button>
                        </div>
                        
                        {/* General Approval Button */}
                        <Button
                          onClick={() => setShowClientApprovalModal(true)}
                          disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm mt-2"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {currentVersion.clientDecision === 'APPROVED' ? 'Already Approved ✓' : 'General Approval'}
                        </Button>
                      </div>
                    </div>

                    {/* 4. Need Revisions Section */}
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <h5 className="text-sm font-semibold text-red-900 mb-3 flex items-center">
                        <XCircle className="w-4 h-4 mr-2 text-red-600" />
                        Need Revisions
                      </h5>
                      
                      <Button
                        onClick={() => setShowRevisionNotes(true)}
                        disabled={loading || currentVersion.clientDecision === 'REVISION_REQUESTED'}
                        variant="outline"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        {currentVersion.clientDecision === 'REVISION_REQUESTED' ? 'Revisions Requested ✓' : 'Request Revisions'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Status Section */}
              {currentVersion && (currentVersion.clientDecision === 'APPROVED' || currentVersion.clientDecision === 'REVISION_REQUESTED') && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Current Status</h4>
                  
                  {/* Client Approved Status */}
                  {currentVersion.clientDecision === 'APPROVED' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-base font-semibold text-green-900">
                            Client Approved
                          </span>
                        </div>
                        {(() => {
                          const method = getApprovalMethod(currentVersion.clientMessage)
                          if (method) {
                            const IconComponent = method.icon
                            return (
                              <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-semibold ${method.color} shadow-sm`}>
                                <IconComponent className="w-4 h-4 mr-2" />
                                {method.label}
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                      
                      {currentVersion.clientMessage && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-green-800 mb-2">Client Message:</p>
                          <div className="text-sm text-green-700 bg-green-100 p-3 rounded-lg border-l-4 border-green-400">
                            {currentVersion.clientMessage}
                          </div>
                        </div>
                      )}
                      
                      {currentVersion.clientDecidedAt && (
                        <p className="text-sm text-green-600 font-medium">
                          ✓ Approved on {new Date(currentVersion.clientDecidedAt).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Revision Requested Status */}
                  {currentVersion.clientDecision === 'REVISION_REQUESTED' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          <span className="text-base font-semibold text-red-900">
                            Revision Requested
                          </span>
                        </div>
                        <div className="inline-flex items-center px-3 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-800 shadow-sm">
                          <Edit2 className="w-4 h-4 mr-2" />
                          Requires Changes
                        </div>
                      </div>
                      
                      {currentVersion.clientMessage && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-red-800 mb-2">Revision Notes:</p>
                          <div className="text-sm text-red-700 bg-red-100 p-3 rounded-lg border-l-4 border-red-500">
                            {currentVersion.clientMessage}
                          </div>
                        </div>
                      )}
                      
                      {currentVersion.clientDecidedAt && (
                        <p className="text-sm text-red-600 font-medium">
                          ⚠ Requested on {new Date(currentVersion.clientDecidedAt).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recent Activity Log */}
              {currentVersion && currentVersion.activityLogs && currentVersion.activityLogs.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {currentVersion.activityLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          {log.user ? (
                            <User className="w-4 h-4 text-gray-600" />
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {log.user && (
                              <span className="text-xs font-medium text-gray-900">{log.user.name}</span>
                            )}
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {log.type.split('_').join(' ').toLowerCase()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-900 mb-1">{log.message}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(log.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {currentVersion.activityLogs.length > 8 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                      <button
                        onClick={() => setActiveTab('activity')}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All Activity ({currentVersion.activityLogs.length} total)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Revision Notes Input */}
              {currentVersion && showRevisionNotes && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Add Revision Notes</h4>
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h5 className="text-sm font-semibold text-amber-900 mb-3">What needs to be revised?</h5>
                      <Textarea
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        placeholder="Describe what revisions are needed..."
                        className="min-h-[100px] text-sm"
                        rows={4}
                      />
                    </div>
                    <div className="flex space-x-3">
                      <Button
                        onClick={() => handleClientDecision('REVISION_REQUESTED')}
                        disabled={loading || !revisionNotes.trim()}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {loading ? 'Saving...' : 'Submit Revision Request'}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowRevisionNotes(false)
                          setRevisionNotes('')
                        }}
                        disabled={loading}
                        variant="outline"
                        className="px-6"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Analytics */}
              {currentVersion?.sentToClientAt && emailAnalytics && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Email Analytics</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="text-blue-600 font-medium">{emailAnalytics.totalSent || 0}</div>
                        <div className="text-blue-500 text-xs">Emails Sent</div>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <div className="text-green-600 font-medium">{emailAnalytics.totalOpened || 0}</div>
                        <div className="text-green-500 text-xs">Times Opened</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* PDF Preview Modal */}
      {selectedFile && (
        <EnhancedFilePreviewModal
          file={selectedFile}
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false)
            setSelectedFile(null)
          }}
        />
      )}
      
      {/* Create Version Modal */}
      <CreateVersionModal
        isOpen={showCreateVersionModal}
        onClose={() => setShowCreateVersionModal(false)}
        onConfirm={createNewVersion}
        loading={loading}
        versionNumber={nextVersionNumber}
      />
      
      {/* Client Approval Modal */}
      <ClientApprovalModal
        isOpen={showClientApprovalModal}
        onClose={() => setShowClientApprovalModal(false)}
        onConfirm={handleClientApproval}
        loading={loading}
        versionNumber={currentVersion?.version || ''}
      />
      
      {/* Email Preview Modal */}
      <EmailPreviewModal
        open={showEmailPreviewModal}
        onOpenChange={setShowEmailPreviewModal}
        emailData={emailPreviewData}
        onSend={handleConfirmSendEmail}
        title="Review Email Before Sending"
      />
    </>
  )
}
