'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { 
  ArrowLeft, 
  User, 
  Mail,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  Send,
  FileText,
  Info,
  RefreshCw,
  Edit2,
  MessageSquare
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import EnhancedFilePreviewModal from '@/components/ui/enhanced-file-preview-modal'
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
  approvedByAaron?: boolean
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
  const [emailAnalytics, setEmailAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  
  // PDF preview modal state
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  
  // Client approval modal state
  const [showClientApprovalModal, setShowClientApprovalModal] = useState(false)
  
  // Email preview modal state
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false)
  const [emailPreviewData, setEmailPreviewData] = useState<EmailPreviewData | null>(null)
  
  // Test email state
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)

  // Fetch email analytics
  const fetchEmailAnalytics = async (versionId: string) => {
    setLoadingAnalytics(true)
    try {
      const response = await fetch(`/api/floorplan-approvals/${versionId}/analytics`)
      if (response.ok) {
        const data = await response.json()
        setEmailAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching email analytics:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  // Fetch floorplan approval data from API
  useEffect(() => {
    const fetchFloorplanApprovalData = async () => {
      try {
        setFetchError(null)
        const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (response.ok) {
          const data = await response.json()
          const pushedVersions = (data.versions || []).filter((v: any) => v.status !== 'DRAFT')
          setVersions(pushedVersions)
          const currentPushed = pushedVersions.length > 0 ? pushedVersions[0] : null
          setCurrentVersion(currentPushed)
          setNotes(currentPushed?.notes || '')
          
          if (currentPushed?.assets) {
            setSelectedAssets((currentPushed.assets || []).filter((a: any) => a.includeInEmail).map((a: any) => a.id))
          }
          
          if (currentPushed?.sentToClientAt) {
            fetchEmailAnalytics(currentPushed.id)
          }
        } else if (response.status === 404) {
          setVersions([])
          setCurrentVersion(null)
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          setFetchError(`Failed to load floorplan approval data: ${errorData.error || 'Server error'}`)
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

  const handleUpdateStatus = async (action: string) => {
    if (!currentVersion) return

    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          versionId: currentVersion.id,
          action,
          notes: notes.trim() || undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
        
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setVersions(updatedData.versions || [])
          setCurrentVersion(updatedData.currentVersion || null)
        }
        
        toast.success('Status updated successfully!')
      } else {
        const error = await response.json()
        toast.error(`Failed to update status: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      toast.error('Failed to update status. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendToClient = async () => {
    if (!currentVersion) return

    if (selectedAssets.length === 0) {
      toast.error('Please select at least one file to include in the email')
      return
    }

    setLoading(true)
    try {
      const previewResponse = await fetch(
        `/api/floorplan-approvals/${currentVersion.id}/email-preview?selectedAssetIds=${selectedAssets.join(',')}`
      )
      
      if (previewResponse.ok) {
        const previewData = await previewResponse.json()
        
        const attachments = currentVersion?.assets.map(asset => ({
          id: asset.id,
          title: asset.asset.title,
          url: asset.asset.url,
          type: asset.asset.type,
          size: asset.asset.size,
          selected: selectedAssets.includes(asset.id)
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
        toast.error(`Failed to generate email preview: ${error.error}`)
      }
    } catch (error) {
      toast.error('Failed to generate email preview. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSendEmail = async (emailData: EmailPreviewData, selectedAttachmentIds: string[]) => {
    const response = await fetch(`/api/floorplan-approvals/${currentVersion!.id}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        selectedAssetIds: selectedAttachmentIds,
        customSubject: emailData.subject,
        customHtmlContent: emailData.htmlContent
      })
    })

    if (response.ok) {
      const data = await response.json()
      setCurrentVersion(data.version)
      setSelectedAssets(selectedAttachmentIds)
      if (data.version?.id) {
        fetchEmailAnalytics(data.version.id)
      }
    } else {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to send email')
    }
  }

  // Send test email (uses the same endpoint as regular send, but with testEmail parameter)
  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter a test email address')
      return
    }

    if (!currentVersion) {
      toast.error('No version selected')
      return
    }

    if (selectedAssets.length === 0) {
      toast.error('Please select at least one file to include in the email')
      return
    }

    setSendingTestEmail(true)
    try {
      // Use the same send-email endpoint but with testEmail parameter
      const response = await fetch(`/api/floorplan-approvals/${currentVersion.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          testEmail: testEmail.trim(),
          selectedAssetIds: selectedAssets
        })
      })
      
      if (response.ok) {
        toast.success(`Test email sent successfully to ${testEmail}`)
        setTestEmail('')
        setShowTestEmailDialog(false)
      } else {
        const error = await response.json()
        console.error('Failed to send test email:', error)
        toast.error(`Failed to send test email: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error('Failed to send test email. Please try again.')
    } finally {
      setSendingTestEmail(false)
    }
  }

  const handleClientApproval = async (method: string, notes?: string) => {
    if (!currentVersion) return

    const approvalMessage = `Client approved via ${method}${notes ? `: ${notes}` : ''}`
    
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          versionId: currentVersion.id,
          action: 'client_decision',
          clientDecision: 'APPROVED',
          clientMessage: approvalMessage
        })
      })

      if (response.ok) {
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setVersions(updatedData.versions || [])
          setCurrentVersion(updatedData.currentVersion || null)
        }
        toast.success(`Client approval recorded successfully (${method})!`)
      } else {
        const error = await response.json()
        toast.error(`Failed to record approval: ${error.error || 'Unknown error'}`)
        throw error
      }
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleClientDecision = async (decision: 'APPROVED' | 'REVISION_REQUESTED', clientMessage?: string) => {
    if (!currentVersion) return

    if (decision === 'REVISION_REQUESTED' && !showRevisionNotes && !clientMessage) {
      setShowRevisionNotes(true)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          versionId: currentVersion.id,
          action: 'client_decision',
          clientDecision: decision,
          clientMessage: clientMessage || (decision === 'REVISION_REQUESTED' ? revisionNotes : null)
        })
      })

      if (response.ok) {
        const updatedResponse = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json()
          setVersions(updatedData.versions || [])
          setCurrentVersion(updatedData.currentVersion || null)
        }

        if (decision === 'APPROVED') {
          toast.success('Client approval recorded successfully!')
        } else {
          toast.success('Revision request recorded successfully!')
          setShowRevisionNotes(false)
          setRevisionNotes('')
        }
      } else {
        const error = await response.json()
        toast.error(`Failed to record decision: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      toast.error('Failed to record client decision. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading floorplan approval workspace...</p>
        </div>
      </div>
    )
  }

  // Error state
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
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty state - No versions pushed yet
  if (!currentVersion) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.push(`/projects/${project.id}/floorplan`)}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Floorplan
            </Button>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">Phase 2</Badge>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Floorplan Approval</h2>
              <p className="text-sm text-gray-600">{project.name}</p>
            </div>
          </div>
        </div>

        {/* Empty State Content */}
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Floorplans Ready for Approval</h3>
            <p className="text-gray-600 mb-4">
              Upload floorplan drawings in the Drawings phase first, then push them here for client approval.
            </p>
            <Link href={`/projects/${project.id}/floorplan/drawings`}>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <FileText className="w-4 h-4 mr-2" />
                Go to Floorplan Drawings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(currentVersion.status)
  const isApprovedByAaron = currentVersion.approvedByAaron || currentVersion.status !== 'DRAFT'
  const isSentToClient = !!currentVersion.sentToClientAt

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push(`/projects/${project.id}/floorplan`)}
                variant="ghost"
                size="sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Floorplan
              </Button>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">Phase 2</Badge>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Floorplan Approval</h2>
                <p className="text-sm text-gray-600">{project.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {currentVersion.emailOpenedAt && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Client Viewed</span>
                  <span className="text-xs text-blue-600">
                    {new Date(currentVersion.emailOpenedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {currentVersion.clientDecision === 'APPROVED' && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 border border-green-300 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-900">CLIENT APPROVED</span>
                </div>
              )}
              {currentVersion.clientDecision === 'REVISION_REQUESTED' && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-red-100 border border-red-300 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-semibold text-red-900">REVISION REQUESTED</span>
                </div>
              )}
              <Badge className={`${statusConfig.color} px-3 py-1.5`}>
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row min-h-screen">
          {/* Main Content - Left Side */}
          <div className="flex-1 p-6 space-y-6">
            {/* Internal Approval Card */}
            <div className={`${
              isSentToClient
                ? 'bg-purple-50 border-purple-200'
                : isApprovedByAaron
                  ? 'bg-green-50 border-green-200'
                  : 'bg-blue-50 border-blue-200'
            } border rounded-lg p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isSentToClient
                      ? 'bg-purple-500'
                      : isApprovedByAaron ? 'bg-green-500' : 'bg-blue-500'
                  }`}>
                    {isSentToClient ? (
                      <Send className="w-5 h-5 text-white" />
                    ) : isApprovedByAaron ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <Info className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      isSentToClient
                        ? 'text-purple-900'
                        : isApprovedByAaron ? 'text-green-900' : 'text-blue-900'
                    }`}>
                      {isSentToClient
                        ? 'Sent to Client'
                        : isApprovedByAaron ? 'Ready for Client' : 'Internal Review Required'}
                    </h3>
                    <p className={
                      isSentToClient
                        ? 'text-purple-700'
                        : isApprovedByAaron ? 'text-green-700' : 'text-blue-700'
                    }>
                      {isSentToClient
                        ? `Floorplan was sent to client on ${new Date(currentVersion.sentToClientAt!).toLocaleDateString()}. Awaiting client response.`
                        : isApprovedByAaron
                          ? 'This floorplan version is approved and ready to send to the client.'
                          : 'Review and approve this floorplan before sending to client.'}
                    </p>
                  </div>
                </div>
                {!isApprovedByAaron && (
                  <Button
                    onClick={() => handleUpdateStatus('approve_by_aaron')}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? 'Approving...' : 'Approve for Client'}
                  </Button>
                )}
              </div>
            </div>

            {/* Floorplan Files Gallery */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Floorplan Files ({currentVersion.version})</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedAssets.length} of {currentVersion.assets?.length || 0} selected for client email
                    </p>
                  </div>
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
              </div>
              <div className="p-6">
                {(currentVersion.assets?.length || 0) > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentVersion.assets?.map((assetItem) => {
                      const isPDF = assetItem.asset.type === 'FLOORPLAN_PDF'
                      
                      return (
                        <div key={assetItem.id} className="relative border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
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
                              className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <FileText className={`w-5 h-5 ${isPDF ? 'text-red-500' : 'text-blue-500'}`} />
                                <div className="flex-1">
                                  <h5 
                                    className="text-sm font-medium text-gray-900 cursor-pointer hover:text-purple-600"
                                    onClick={() => {
                                      if (isPDF) {
                                        setSelectedFile({
                                          id: assetItem.asset.id,
                                          name: assetItem.asset.title,
                                          originalName: assetItem.asset.title,
                                          type: 'pdf',
                                          url: assetItem.asset.url,
                                          size: assetItem.asset.size || 0,
                                          uploadedAt: new Date().toISOString(),
                                          uploadedBy: { name: 'User' },
                                          metadata: {
                                            sizeFormatted: formatFileSize(assetItem.asset.size),
                                            extension: 'PDF',
                                            isImage: false,
                                            isPDF: true
                                          }
                                        })
                                        setIsPreviewModalOpen(true)
                                      }
                                    }}
                                  >
                                    {assetItem.asset.title}
                                  </h5>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mb-1">
                                {assetItem.asset.type.replace('FLOORPLAN_', '')} • {formatFileSize(assetItem.asset.size)}
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
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Files</h4>
                    <p className="text-gray-600">No floorplan files have been pushed to this version.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
              </div>
              <div className="p-6">
                {versions.flatMap(v => v.activityLogs || []).length > 0 ? (
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {versions.flatMap(version => 
                      (version.activityLogs || []).map(log => ({
                        ...log,
                        version: version.version
                      }))
                    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((log) => (
                      <div key={log.id} className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {log.user ? (
                            <User className="w-4 h-4 text-gray-600" />
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {log.user && (
                              <span className="text-xs font-medium text-gray-900">{log.user.name}</span>
                            )}
                            <Badge className="text-xs bg-blue-100 text-blue-800">{log.version}</Badge>
                          </div>
                          <p className="text-sm text-gray-900">{log.message}</p>
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
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No activity yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Right Side */}
          <div className="w-full lg:w-96 bg-gray-50 border-l border-gray-200">
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
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Version:</span>
                  <span className="text-sm font-medium">{currentVersion.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Date Sent:</span>
                  <span className="text-sm font-medium">
                    {currentVersion.sentToClientAt 
                      ? new Date(currentVersion.sentToClientAt).toLocaleDateString()
                      : '-'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-600">Opened:</span>
                  <div className="flex flex-col items-end space-y-1">
                    {currentVersion.emailOpenedAt ? (
                      <>
                        <div className="flex items-center space-x-1">
                          <Eye className="w-3 h-3 text-green-600" />
                          <span className="text-sm font-medium text-green-600">Yes</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(currentVersion.emailOpenedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center space-x-1">
                          <EyeOff className="w-3 h-3 text-gray-400" />
                          <span className="text-sm text-gray-500">Not yet</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            setLoading(true)
                            try {
                              const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
                              if (response.ok) {
                                const data = await response.json()
                                setCurrentVersion(data.currentVersion)
                                if (data.currentVersion?.sentToClientAt) {
                                  fetchEmailAnalytics(data.currentVersion.id)
                                }
                              }
                            } catch (error) {
                              console.error('Failed to refresh', error)
                            } finally {
                              setLoading(false)
                            }
                          }}
                          disabled={loading}
                          className="h-6 px-2 text-xs"
                        >
                          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Analytics */}
              {currentVersion.sentToClientAt && emailAnalytics && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Email Analytics</h4>
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
              )}

              {/* Actions */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Actions</h4>
                <div className="space-y-3">
                  {/* Send to Client */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendToClient}
                      disabled={loading || !isApprovedByAaron || selectedAssets.length === 0}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {loading ? 'Sending...' : 
                       currentVersion.sentToClientAt ? 'Resend to Client' : 'Send to Client'}
                    </Button>
                    <Button
                      onClick={() => setShowTestEmailDialog(true)}
                      disabled={loading || selectedAssets.length === 0}
                      variant="outline"
                      className="border-purple-200 text-purple-700 hover:bg-purple-50"
                      title="Send a test email to verify the email content"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {!isApprovedByAaron && (
                    <p className="text-xs text-amber-600 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Approve for client above before sending
                    </p>
                  )}
                  
                  {isApprovedByAaron && selectedAssets.length === 0 && (
                    <p className="text-xs text-amber-600 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Select at least one file to send
                    </p>
                  )}

                  {/* Client Decision Section */}
                  {currentVersion.sentToClientAt && !showRevisionNotes && (
                    <>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <p className="text-xs text-gray-500 mb-3 font-medium uppercase">Client Decision</p>
                        
                        {/* Approval Methods */}
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200 mb-3">
                          <p className="text-xs text-green-700 mb-2 font-medium">Mark as approved via:</p>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              onClick={() => handleClientApproval('email')}
                              disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                              variant="outline"
                              size="sm"
                              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 text-xs"
                            >
                              <Mail className="w-3 h-3 mr-1" />
                              Email
                            </Button>
                            <Button
                              onClick={() => handleClientApproval('phone call')}
                              disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                              variant="outline"
                              size="sm"
                              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 text-xs"
                            >
                              <Phone className="w-3 h-3 mr-1" />
                              Phone
                            </Button>
                            <Button
                              onClick={() => handleClientApproval('direct communication')}
                              disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                              variant="outline"
                              size="sm"
                              className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 text-xs"
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Other
                            </Button>
                          </div>
                          <Button
                            onClick={() => setShowClientApprovalModal(true)}
                            disabled={loading || currentVersion.clientDecision === 'APPROVED'}
                            className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {currentVersion.clientDecision === 'APPROVED' ? 'Already Approved' : 'General Approval'}
                          </Button>
                        </div>

                        {/* Revision Request */}
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <Button
                            onClick={() => handleClientDecision('REVISION_REQUESTED')}
                            disabled={loading || currentVersion.clientDecision === 'REVISION_REQUESTED'}
                            variant="outline"
                            className="w-full border-red-200 text-red-600 hover:bg-red-100"
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            {currentVersion.clientDecision === 'REVISION_REQUESTED' ? 'Revisions Requested' : 'Request Revisions'}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Revision Notes Input */}
                  {showRevisionNotes && (
                    <div className="border-t border-gray-200 pt-3 mt-3 space-y-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <h5 className="text-sm font-semibold text-amber-900 mb-2">Revision Notes</h5>
                        <Textarea
                          value={revisionNotes}
                          onChange={(e) => setRevisionNotes(e.target.value)}
                          placeholder="Describe what revisions are needed..."
                          className="min-h-[80px]"
                          rows={3}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleClientDecision('REVISION_REQUESTED')}
                          disabled={loading || !revisionNotes.trim()}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Submit
                        </Button>
                        <Button
                          onClick={() => {
                            setShowRevisionNotes(false)
                            setRevisionNotes('')
                          }}
                          disabled={loading}
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Status Display */}
              {currentVersion.clientDecision && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Current Status</h4>
                  {currentVersion.clientDecision === 'APPROVED' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-900">Client Approved</span>
                      </div>
                      {currentVersion.clientMessage && (
                        <p className="text-sm text-green-700 bg-green-100 p-2 rounded mt-2">
                          {currentVersion.clientMessage}
                        </p>
                      )}
                      {currentVersion.clientDecidedAt && (
                        <p className="text-xs text-green-600 mt-2">
                          Approved on {new Date(currentVersion.clientDecidedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                  {currentVersion.clientDecision === 'REVISION_REQUESTED' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="font-semibold text-red-900">Revision Requested</span>
                      </div>
                      {currentVersion.clientMessage && (
                        <p className="text-sm text-red-700 bg-red-100 p-2 rounded mt-2">
                          {currentVersion.clientMessage}
                        </p>
                      )}
                      {currentVersion.clientDecidedAt && (
                        <p className="text-xs text-red-600 mt-2">
                          Requested on {new Date(currentVersion.clientDecidedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
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
        onSendTest={async (emailData, selectedAttachmentIds, testEmail) => {
          // Send test email with edited content
          const response = await fetch(`/api/floorplan-approvals/${currentVersion!.id}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              testEmail,
              selectedAssetIds: selectedAttachmentIds,
              customSubject: emailData.subject,
              customHtmlContent: emailData.htmlContent
            })
          })
          
          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || 'Failed to send test email')
          }
        }}
        title="Review Email Before Sending"
      />

      {/* Test Email Dialog */}
      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              Send Test Email
            </DialogTitle>
            <DialogDescription>
              Send a test email to verify how the floorplan approval email will look before sending it to the client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="test-email" className="text-sm font-medium text-gray-700">
                Test Email Address
              </label>
              <Input
                id="test-email"
                type="email"
                placeholder="Enter email address..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testEmail.trim()) {
                    handleSendTestEmail()
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                The test email will include the same content and attachments that would be sent to the client.
              </p>
            </div>
            
            {selectedAssets.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Files to include ({selectedAssets.length}):
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  {currentVersion?.assets
                    .filter(a => selectedAssets.includes(a.id))
                    .map(a => (
                      <li key={a.id} className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {a.asset.title}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTestEmailDialog(false)}
              disabled={sendingTestEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail || !testEmail.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {sendingTestEmail ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
