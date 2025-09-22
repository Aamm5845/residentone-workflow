'use client'

import { useState, useEffect } from 'react'
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
  Camera,
  ChevronDown,
  Monitor,
  TestTube
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

interface ClientApprovalWorkspaceProps {
  stage: any
  room: any
  project: any
  onComplete: () => void
  onUpdateSection?: (sectionType: string, content: string) => void
}

interface ClientApprovalVersion {
  id: string
  version: string
  status: 'DRAFT' | 'PENDING_AARON_APPROVAL' | 'READY_FOR_CLIENT' | 'SENT_TO_CLIENT' | 'CLIENT_REVIEWING' | 'FOLLOW_UP_REQUIRED' | 'CLIENT_APPROVED' | 'REVISION_REQUESTED'
  approvedByAaron: boolean
  aaronApprovedAt?: string
  sentToClientAt?: string
  emailOpenedAt?: string
  followUpCompletedAt?: string
  followUpNotes?: string
  clientDecision?: 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED'
  clientDecidedAt?: string
  clientMessage?: string
  assets: Array<{
    id: string
    asset: {
      id: string
      title: string
      url: string
      type: string
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
    'PENDING_AARON_APPROVAL': { label: 'Pending Aaron\'s Approval', color: 'bg-blue-100 text-blue-800' },
    'READY_FOR_CLIENT': { label: 'Ready to Send', color: 'bg-green-100 text-green-800' },
    'SENT_TO_CLIENT': { label: 'Sent to Client', color: 'bg-purple-100 text-purple-800' },
    'CLIENT_REVIEWING': { label: 'Client Reviewing', color: 'bg-yellow-100 text-yellow-800' },
    'FOLLOW_UP_REQUIRED': { label: 'Follow-Up Pending', color: 'bg-amber-100 text-amber-800' },
    'CLIENT_APPROVED': { label: 'Client Approved', color: 'bg-green-100 text-green-800' },
    'REVISION_REQUESTED': { label: 'Revision Requested', color: 'bg-red-100 text-red-800' }
  }
  return configs[status as keyof typeof configs] || { label: status, color: 'bg-gray-100 text-gray-800' }
}

export default function ClientApprovalWorkspace({
  stage,
  room,
  project,
  onComplete,
  onUpdateSection
}: ClientApprovalWorkspaceProps) {
  const [currentVersion, setCurrentVersion] = useState<ClientApprovalVersion | null>(null)
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [availableRenderingVersions, setAvailableRenderingVersions] = useState<any[]>([])
  const [pushingToClient, setPushingToClient] = useState(false)
  const [showRevisionNotes, setShowRevisionNotes] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [emailAnalytics, setEmailAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // Fetcher function for SWR
  const fetcher = (url: string) => fetch(url).then(res => res.json())

  // Fetch activity logs using SWR
  const { 
    data: activityData, 
    error: activityError, 
    isLoading: activityLoading,
    mutate: mutateActivity
  } = useSWR(`/api/stages/${stage.id}/activity`, async (url) => {
    console.log('Fetching activity logs from:', url);
    const res = await fetch(url);
    const data = await res.json();
    console.log('Activity logs API response:', data);
    return data;
  }, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true,
    errorRetryCount: 3,
    dedupingInterval: 2000
  })

  // Fetch email analytics
  const fetchEmailAnalytics = async (versionId: string) => {
    setLoadingAnalytics(true)
    try {
      const response = await fetch(`/api/email/analytics/${versionId}`)
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

  // Fetch client approval data from API
  useEffect(() => {
    const fetchClientApprovalData = async () => {
      try {
        setFetchError(null)
        const response = await fetch(`/api/client-approval/${stage.id}`)
        if (response.ok) {
          const data = await response.json()
          if (!data.currentVersion && data.availableRenderingVersions) {
            // No client approval version yet, but rendering versions are available
            setAvailableRenderingVersions(data.availableRenderingVersions)
            setCurrentVersion(null)
            return
          } else if (!data.currentVersion) {
            setFetchError('No approval version found. Upload 3D renderings first.')
            return
          }
          setCurrentVersion(data.currentVersion)
          setFollowUpNotes(data.currentVersion?.followUpNotes || '')
          // Initialize selected assets
          setSelectedAssets(data.currentVersion?.assets?.filter((a: any) => a.includeInEmail).map((a: any) => a.id) || [])
          
          // Fetch email analytics if version was sent
          if (data.currentVersion?.sentToClientAt) {
            fetchEmailAnalytics(data.currentVersion.id)
          }
        } else if (response.status === 404) {
          setFetchError('No approval version found. Upload 3D renderings first.')
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          setFetchError(`Failed to load approval data: ${errorData.error || 'Server error'}`)
          console.error('Failed to fetch client approval data:', errorData)
          // Fall back to mock data for development
          const mockVersion: ClientApprovalVersion = {
            id: '1',
            version: 'v1',
            status: 'FOLLOW_UP_REQUIRED',
            approvedByAaron: true,
            aaronApprovedAt: '2025-09-21T10:00:00Z',
            sentToClientAt: '2025-09-21T14:30:00Z',
            emailOpenedAt: '2025-09-22T10:04:00Z',
            followUpCompletedAt: null,
            followUpNotes: 'Client asked for darker wood finish on table',
            clientDecision: 'PENDING',
            assets: [
              {
                id: '1',
                asset: {
                  id: 'asset-1',
                  title: 'Dining Room Overview',
                  url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600&q=80',
                  type: 'IMAGE'
                },
                includeInEmail: true
              }
            ],
            activityLogs: [
              {
                id: '1',
                type: 'upload',
                message: 'Version v1 created',
                user: { name: 'System' },
                createdAt: '2025-09-20T15:00:00Z'
              },
              {
                id: '2',
                type: 'aaron_approved',
                message: 'Aaron approved rendering',
                user: { name: 'Aaron' },
                createdAt: '2025-09-21T10:00:00Z'
              },
              {
                id: '3',
                type: 'sent_to_client',
                message: 'Email sent to client',
                createdAt: '2025-09-21T14:30:00Z'
              },
              {
                id: '4',
                type: 'email_opened',
                message: 'Client opened email',
                createdAt: '2025-09-22T10:04:00Z'
              }
            ]
          }
          setCurrentVersion(mockVersion)
          setFollowUpNotes(mockVersion.followUpNotes || '')
          // Initialize selected assets for mock data
          setSelectedAssets(mockVersion.assets?.filter(a => a.includeInEmail).map(a => a.id) || [])
        }
      } catch (error) {
        console.error('Error fetching client approval data:', error)
        setFetchError('Network error occurred. Please try again.')
      } finally {
        setIsInitialLoading(false)
      }
    }

    fetchClientApprovalData()
  }, [stage.id])

  const handlePushToClient = async (renderingVersionId: string) => {
    setPushingToClient(true)
    try {
      const response = await fetch(`/api/client-approval/${stage.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ renderingVersionId })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.currentVersion)
        setAvailableRenderingVersions([])
        // Initialize selected assets
        setSelectedAssets(data.currentVersion?.assets?.filter((a: any) => a.includeInEmail).map((a: any) => a.id) || [])
      } else {
        const error = await response.json()
        console.error('Failed to push to client:', error)
        alert(`Failed to push to client: ${error.error}`)
      }
    } catch (error) {
      console.error('Error pushing to client:', error)
      alert('Failed to push to client. Please try again.')
    } finally {
      setPushingToClient(false)
    }
  }

  const handleAaronApproval = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/client-approval/${stage.id}/aaron-approve`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approved: true, notes: null })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
        // Refresh activity log
        mutateActivity()
      } else {
        console.error('Failed to approve rendering')
        alert('Failed to approve rendering. Please try again.')
      }
    } catch (error) {
      console.error('Error approving rendering:', error)
      alert('Failed to approve rendering. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendToClient = async () => {
    setLoading(true)
    try {
      // Use the selected assets from state
      const selectedAssetIds = selectedAssets
      
      const response = await fetch(`/api/client-approval/${stage.id}/send-to-client`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ selectedAssetIds })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
        
        // Fetch email analytics after sending
        if (data.version?.id) {
          fetchEmailAnalytics(data.version.id)
        }
        
        // Refresh activity log
        mutateActivity()
        
        alert('Email sent to client successfully!')
      } else {
        const error = await response.json()
        console.error('Failed to send email:', error)
        alert(`Failed to send email: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending to client:', error)
      alert('Failed to send email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsSent = async () => {
    if (!confirm('Mark as already sent to client? This will skip the automated email sending step.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/client-approval/${stage.id}/mark-as-sent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ selectedAssetIds: selectedAssets })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
        // Refresh activity log
        mutateActivity()
        alert('Marked as sent to client successfully!')
      } else {
        const error = await response.json()
        console.error('Failed to mark as sent:', error)
        alert(`Failed to mark as sent: ${error.error}`)
      }
    } catch (error) {
      console.error('Error marking as sent:', error)
      alert('Failed to mark as sent. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkFollowUpDone = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/client-approval/${stage.id}/mark-followup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: followUpNotes })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
        
        // Create notification for team member about client decision needed
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: stage.assignedTo,
              type: 'PROJECT_UPDATE',
              title: 'Client Follow-up Completed',
              message: `Follow-up completed for ${room.name || room.type}. Client decision needed.`,
              relatedId: stage.id,
              relatedType: 'STAGE'
            })
          })
        } catch (notificationError) {
          console.warn('Failed to create notification:', notificationError)
        }
        
        // Refresh activity log
        mutateActivity()
        
        alert('Follow-up marked as completed!')
      } else {
        const error = await response.json()
        console.error('Failed to mark follow-up done:', error)
        alert(`Failed to mark follow-up: ${error.error}`)
      }
    } catch (error) {
      console.error('Error marking follow-up done:', error)
      alert('Failed to mark follow-up. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      alert('Please enter a test email address')
      return
    }

    setSendingTestEmail(true)
    try {
      const response = await fetch(`/api/email/test/${currentVersion?.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ testEmail: testEmail.trim() })
      })
      
      if (response.ok) {
        const data = await response.json()
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

  const handleClientDecision = async (decision: 'APPROVED' | 'REVISION_REQUESTED') => {
    // For revision requests, show notes input first
    if (decision === 'REVISION_REQUESTED' && !showRevisionNotes) {
      setShowRevisionNotes(true)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/client-approval/${stage.id}/client-decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          decision, 
          notes: decision === 'REVISION_REQUESTED' ? revisionNotes : null
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
        
        // Refresh activity log
        mutateActivity()
        
        if (decision === 'APPROVED') {
          alert('Client decision recorded: Approved!')
          // Complete the stage and move to next phase
          onComplete()
        } else {
          alert('Client decision recorded: Revision requested')
          setShowRevisionNotes(false)
          setRevisionNotes('')
        }
      } else {
        const error = await response.json()
        console.error('Failed to record client decision:', error)
        alert(`Failed to record decision: ${error.error}`)
      }
    } catch (error) {
      console.error('Error recording client decision:', error)
      alert('Failed to record client decision. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading client approval workspace...</p>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Client Approval</h3>
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

  if (!currentVersion && availableRenderingVersions.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Camera className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Renderings Available</h3>
          <p className="text-gray-600 mb-4">Upload and complete 3D renderings in the Rendering workspace first, then push them here for client review.</p>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
          >
            Go to Rendering Workspace
          </Button>
        </div>
      </div>
    )
  }

  if (!currentVersion && availableRenderingVersions.length > 0) {
    return (
      <div className="bg-white min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Client Approval Workspace</h2>
                <p className="text-sm text-gray-600">Ready to push renderings to client approval</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className="bg-amber-100 text-amber-800">
                Ready to Push
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Available Rendering Versions */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Available Rendering Versions</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Select a completed rendering version to push to client approval
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {availableRenderingVersions.map((version) => (
                    <div key={version.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Camera className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="text-lg font-medium text-gray-900">
                                {version.customName || version.version}
                              </h4>
                              <Badge className="bg-green-100 text-green-800">
                                Completed
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Created by {version.createdBy.name} • {new Date(version.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              {version.assetCount} rendering{version.assetCount !== 1 ? 's' : ''}
                            </p>
                            
                            {/* Asset Thumbnails */}
                            {version.assets.length > 0 && (
                              <div className="flex space-x-2 mt-3">
                                {version.assets.map((asset: any) => (
                                  <div key={asset.id} className="w-16 h-12 bg-gray-100 rounded overflow-hidden">
                                    <img
                                      src={asset.url}
                                      alt={asset.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                                {version.assetCount > 4 && (
                                  <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                                    <span className="text-xs text-gray-600">+{version.assetCount - 4}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handlePushToClient(version.id)}
                          disabled={pushingToClient}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {pushingToClient ? 'Pushing...' : 'Push to Client Approval'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
              <h4 className="font-semibold text-blue-900 mb-2">📋 Next Steps</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Select a completed rendering version above</li>
                <li>• Push it to Client Approval to create the approval workflow</li>
                <li>• Once pushed, you can manage approvals and send to clients</li>
                <li>• You can still go back to Rendering workspace to upload more files</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(currentVersion.status)

  return (
    <>
    <div className="bg-white min-h-screen">
      {/* Status Badge */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Client Approval Workspace</h2>
              <p className="text-sm text-gray-600">Manage rendering approvals and client communication</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Main Content - Left Side */}
        <div className="flex-1 p-6 space-y-6">
          {/* Internal Approval Card - Always visible at top */}
          <div className={`${currentVersion.approvedByAaron 
            ? 'bg-green-50 border-green-200' 
            : 'bg-blue-50 border-blue-200'
          } border rounded-lg p-6`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  currentVersion.approvedByAaron ? 'bg-green-500' : 'bg-blue-500'
                }`}>
                  {currentVersion.approvedByAaron ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : (
                    <Info className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${
                    currentVersion.approvedByAaron ? 'text-green-900' : 'text-blue-900'
                  }`}>
                    {currentVersion.approvedByAaron ? 'Approved by Aaron' : 'Internal Approval Required'}
                  </h3>
                  <p className={currentVersion.approvedByAaron ? 'text-green-700' : 'text-blue-700'}>
                    {currentVersion.approvedByAaron 
                      ? `Approved on ${new Date(currentVersion.aaronApprovedAt!).toLocaleDateString()}` 
                      : 'Before sending to the client, Aaron must approve this rendering.'}
                  </p>
                </div>
              </div>
              {!currentVersion.approvedByAaron && (
                <Button
                  onClick={handleAaronApproval}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? 'Approving...' : 'Approve Rendering'}
                </Button>
              )}
            </div>
          </div>

          {/* Rendering Gallery with Selection */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">3D Renderings ({currentVersion.version})</h3>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {currentVersion.assets?.map((assetItem) => (
                    <div key={assetItem.id} className="relative group">
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={assetItem.asset.url}
                          alt={assetItem.asset.title}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        {/* Selection Checkbox */}
                        <div className="absolute top-3 left-3">
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
                            className="w-5 h-5 text-blue-600 bg-white border-2 border-white rounded focus:ring-blue-500 focus:ring-2 shadow-lg"
                          />
                        </div>
                        {/* View Full Size Overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                          <Button 
                            variant="outline" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white"
                            onClick={() => window.open(assetItem.asset.url, '_blank')}
                          >
                            View Full Size
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-900">{assetItem.asset.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedAssets.includes(assetItem.id) ? '✓ Include in email' : '○ Not selected'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Renderings</h4>
                  <p className="text-gray-600">Upload renderings from the 3D Rendering phase to get started.</p>
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
              {/* Loading State */}
              {activityLoading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-3 animate-pulse">
                      <div className="w-2 h-2 bg-gray-300 rounded-full flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {activityError && !activityLoading && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Failed to load activity</h4>
                  <p className="text-xs text-gray-500 mb-3">Unable to fetch activity logs</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => mutateActivity()}
                    className="text-xs"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {!activityLoading && !activityError && (!activityData?.activities || activityData.activities.length === 0) && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">No activity yet</h4>
                  <p className="text-xs text-gray-500">Activity will appear here as actions are taken</p>
                </div>
              )}

              {/* Activity List */}
              {!activityLoading && !activityError && activityData?.activities && activityData.activities.length > 0 && (
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {activityData.activities.map((log: any) => (
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.type === 'CLIENT_DECISION' || log.type === 'CLIENT_APPROVED' ? 'bg-green-100 text-green-800' :
                            log.type === 'EMAIL_SENT' || log.type === 'SENT_TO_CLIENT' ? 'bg-blue-100 text-blue-800' :
                            log.type === 'AARON_APPROVED' || log.type === 'APPROVED' ? 'bg-purple-100 text-purple-800' :
                            log.type === 'MARKED_AS_SENT' ? 'bg-orange-100 text-orange-800' :
                            log.type === 'FOLLOW_UP_COMPLETED' ? 'bg-cyan-100 text-cyan-800' :
                            log.type === 'REVISION_REQUESTED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.type.replace(/_/g, ' ').toLowerCase()}
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
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Right Side */}
        <div className="w-full lg:w-96 bg-gray-50 border-l border-gray-200">
          <div className="p-6 space-y-6">
            {/* Version Control */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Version History</h4>
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-semibold">{currentVersion.version}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Current Version</p>
                    <p className="text-xs text-gray-500">Created {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Room:</span>
                <span className="text-sm font-medium">{room.name || room.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Uploaded by:</span>
                <span className="text-sm font-medium">
                  {currentVersion.assets && currentVersion.assets.length > 0 
                    ? currentVersion.assets[0]?.asset?.uploader?.name || 'Unknown'
                    : '-'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Approved by Aaron:</span>
                <span className={`text-sm font-medium ${
                  currentVersion.approvedByAaron ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {currentVersion.approvedByAaron ? 'Yes' : 'No'}
                </span>
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
                        {new Date(currentVersion.emailOpenedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(currentVersion.emailOpenedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
            </div>

            {/* Email Analytics */}
            {currentVersion?.sentToClientAt && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Email Analytics</h4>
                {loadingAnalytics ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                  </div>
                ) : emailAnalytics ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="text-blue-600 font-medium">{emailAnalytics.analytics.totalSent}</div>
                        <div className="text-blue-500 text-xs">Emails Sent</div>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <div className="text-green-600 font-medium">{emailAnalytics.analytics.totalOpened}</div>
                        <div className="text-green-500 text-xs">Times Opened</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-purple-50 p-2 rounded">
                        <div className="text-purple-600 font-medium">{emailAnalytics.analytics.openRate}%</div>
                        <div className="text-purple-500 text-xs">Open Rate</div>
                      </div>
                      <div className="bg-orange-50 p-2 rounded">
                        <div className="text-orange-600 font-medium">{emailAnalytics.analytics.totalClicks}</div>
                        <div className="text-orange-500 text-xs">Link Clicks</div>
                      </div>
                    </div>
                    
                    {/* Download Analytics */}
                    {(emailAnalytics.analytics.totalDownloads > 0 || emailAnalytics.analytics.totalDownloaded > 0) && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-emerald-50 p-2 rounded">
                          <div className="text-emerald-600 font-medium">{emailAnalytics.analytics.totalDownloads || 0}</div>
                          <div className="text-emerald-500 text-xs">Downloads</div>
                        </div>
                        <div className="bg-cyan-50 p-2 rounded">
                          <div className="text-cyan-600 font-medium">{emailAnalytics.analytics.downloadRate || 0}%</div>
                          <div className="text-cyan-500 text-xs">Download Rate</div>
                        </div>
                      </div>
                    )}
                    
                    {emailAnalytics.analytics.firstOpenAt && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <div>First opened: {new Date(emailAnalytics.analytics.firstOpenAt).toLocaleDateString('en-US', { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                        })}</div>
                        {emailAnalytics.analytics.lastOpenAt && emailAnalytics.analytics.lastOpenAt !== emailAnalytics.analytics.firstOpenAt && (
                          <div>Last opened: {new Date(emailAnalytics.analytics.lastOpenAt).toLocaleDateString('en-US', { 
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No analytics data available
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Notes */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Notes from Follow-Up</h4>
              <Textarea
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Add notes from client conversation..."
                className="min-h-[80px]"
              />
            </div>

            {/* Action Buttons - All visible based on state */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">Actions</h4>
              <div className="space-y-3">
                {/* Email Preview & Test Section - Only available after Aaron's approval */}
                {currentVersion.approvedByAaron ? (
                  <div className="space-y-2">
                    <Button
                      onClick={() => setShowEmailPreview(!showEmailPreview)}
                      variant="outline"
                      className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <Monitor className="w-4 h-4 mr-2" />
                      {showEmailPreview ? 'Hide Email Preview' : 'Preview Email'}
                    </Button>
                    
                    <Button
                      onClick={() => setShowTestEmailDialog(true)}
                      variant="outline"
                      className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      <TestTube className="w-4 h-4 mr-2" />
                      Send Test Email
                    </Button>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-900">Waiting for Aaron's Approval</span>
                    </div>
                    <p className="text-xs text-amber-700">
                      Email preview and testing will be available after Aaron approves this version.
                    </p>
                  </div>
                )}

                {/* Send to Client Section */}
                {currentVersion.approvedByAaron && (
                  <>
                    {!currentVersion.sentToClientAt ? (
                      <>
                        {/* Send to Client */}
                        <Button
                          onClick={handleSendToClient}
                          disabled={loading}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {loading ? 'Sending...' : 'Send to Client'}
                        </Button>
                        
                        {/* Divider */}
                        <div className="flex items-center">
                          <div className="flex-1 border-t border-gray-300"></div>
                          <span className="px-3 text-xs text-gray-500 bg-white">OR</span>
                          <div className="flex-1 border-t border-gray-300"></div>
                        </div>
                        
                        {/* Already Sent Outside System */}
                        <Button
                          onClick={handleMarkAsSent}
                          disabled={loading}
                          variant="outline"
                          className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          {loading ? 'Marking as Sent...' : 'Mark as Already Sent'}
                        </Button>
                        <p className="text-xs text-gray-500 text-center mt-1">
                          Use this if you sent the email outside this system
                        </p>
                      </>
                    ) : (
                      /* Show status when already sent - differentiate between system vs manual */
                      <div className={`w-full p-3 rounded-lg border ${
                        currentVersion.followUpNotes === 'Email sent manually outside of system'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {currentVersion.followUpNotes === 'Email sent manually outside of system' ? (
                            <>
                              <Mail className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-900">
                                Marked as Already Sent
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-900">
                                Sent via System
                              </span>
                            </>
                          )}
                        </div>
                        <p className={`text-xs mt-1 ${
                          currentVersion.followUpNotes === 'Email sent manually outside of system'
                            ? 'text-blue-700'
                            : 'text-green-700'
                        }`}>
                          {new Date(currentVersion.sentToClientAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {currentVersion.followUpNotes === 'Email sent manually outside of system' && (
                            <span className="block text-xs mt-1">Sent externally, not tracked by system</span>
                          )}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Mark Follow-Up Done */}
                <Button
                  onClick={handleMarkFollowUpDone}
                  disabled={loading || !currentVersion.sentToClientAt || currentVersion.followUpCompletedAt !== null}
                  variant="outline"
                  className="w-full disabled:bg-gray-100"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Mark Follow-Up Done'}
                </Button>

                {/* Client Decision Buttons */}
                {!showRevisionNotes ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleClientDecision('APPROVED')}
                      disabled={loading || !currentVersion.followUpCompletedAt || currentVersion.clientDecision === 'APPROVED'}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 text-sm"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Client Approved
                    </Button>
                    <Button
                      onClick={() => handleClientDecision('REVISION_REQUESTED')}
                      disabled={loading || !currentVersion.followUpCompletedAt || currentVersion.clientDecision === 'REVISION_REQUESTED'}
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 disabled:bg-gray-100 text-sm"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Revision Requested
                    </Button>
                  </div>
                ) : (
                  /* Revision Notes Input */
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <XCircle className="w-4 h-4 text-amber-600" />
                        <h5 className="text-sm font-semibold text-amber-900">Revision Notes</h5>
                      </div>
                      <p className="text-xs text-amber-700 mb-3">
                        Add notes explaining what revisions are needed:
                      </p>
                      <Textarea
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        placeholder="Client wants darker wood finish on table, different lighting fixtures in dining area..."
                        className="min-h-[80px] text-sm"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleClientDecision('REVISION_REQUESTED')}
                        disabled={loading || !revisionNotes.trim()}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 text-sm"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        {loading ? 'Saving...' : 'Submit Revision Request'}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowRevisionNotes(false)
                          setRevisionNotes('')
                        }}
                        disabled={loading}
                        variant="outline"
                        className="text-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Email Preview Modal */}
    {showEmailPreview && currentVersion && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
            <Button
              onClick={() => setShowEmailPreview(false)}
              variant="outline"
              size="sm"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4">
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-600">
                <strong>To:</strong> {project.client?.email}<br/>
                <strong>Subject:</strong> ✨ {room.name || room.type} Design Ready for Approval - {project.name}
              </p>
            </div>
            <iframe
              src={`/api/email/preview/${currentVersion.id}?format=html`}
              className="w-full h-96 border border-gray-200 rounded-lg"
              title="Email Preview"
            />
          </div>
        </div>
      </div>
    )}

    {/* Test Email Dialog */}
    {showTestEmailDialog && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Send Test Email</h3>
            <Button
              onClick={() => {
                setShowTestEmailDialog(false)
                setTestEmail('')
              }}
              variant="outline"
              size="sm"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Email Address
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your.email@example.com"
                  disabled={sendingTestEmail}
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This will send a test version of the client approval email to the specified address. The email will be marked as "TEST" and won't affect the actual client approval process.
                </p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={handleSendTestEmail}
                  disabled={!testEmail.trim() || sendingTestEmail}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-300"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
                </Button>
                <Button
                  onClick={() => {
                    setShowTestEmailDialog(false)
                    setTestEmail('')
                  }}
                  variant="outline"
                  disabled={sendingTestEmail}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
