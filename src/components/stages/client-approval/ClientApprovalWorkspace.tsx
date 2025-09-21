'use client'

import { useState, useEffect } from 'react'
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
  ChevronDown
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

  // Fetch client approval data from API
  useEffect(() => {
    const fetchClientApprovalData = async () => {
      try {
        const response = await fetch(`/api/client-approval/${stage.id}`)
        if (response.ok) {
          const data = await response.json()
          setCurrentVersion(data.currentVersion)
          setFollowUpNotes(data.currentVersion?.followUpNotes || '')
          // Initialize selected assets
          setSelectedAssets(data.currentVersion?.assets?.filter((a: any) => a.includeInEmail).map((a: any) => a.id) || [])
        } else {
          console.error('Failed to fetch client approval data')
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
      }
    }

    fetchClientApprovalData()
  }, [stage.id])

  const handleAaronApproval = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/client-approval/${stage.id}/aaron-approve`, { 
        method: 'POST' 
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentVersion(data.version)
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

  const handleClientDecision = async (decision: 'APPROVED' | 'REVISION_REQUESTED') => {
    setLoading(true)
    try {
      // API call to record client decision
      // await fetch(`/api/client-approval/${stage.id}/client-decision`, {
      //   method: 'POST',
      //   body: JSON.stringify({ decision, notes: followUpNotes })
      // })
      
      if (currentVersion) {
        setCurrentVersion({
          ...currentVersion,
          clientDecision: decision,
          clientDecidedAt: new Date().toISOString(),
          status: decision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED'
        })
      }

      if (decision === 'APPROVED') {
        // Complete the stage and move to next phase
        onComplete()
      }
    } catch (error) {
      console.error('Error recording client decision:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!currentVersion) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading client approval workspace...</p>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(currentVersion.status)

  return (
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
                    {selectedAssets.length} of {currentVersion.assets.length} selected for client email
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAssets(currentVersion.assets.map(a => a.id))}
                    disabled={selectedAssets.length === currentVersion.assets.length}
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
              {currentVersion.assets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {currentVersion.assets.map((assetItem) => (
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
            <div className="p-6 space-y-4">
              {currentVersion.activityLogs.map((log) => (
                <div key={log.id} className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{log.message}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              ))}
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
                    ? currentVersion.assets[0].asset.uploader?.name || 'Unknown'
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
                {/* Send to Client */}
                <Button
                  onClick={handleSendToClient}
                  disabled={loading || !currentVersion.approvedByAaron || currentVersion.sentToClientAt !== null}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {loading && !currentVersion.sentToClientAt ? 'Sending...' : 'Send to Client'}
                </Button>

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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}