'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PhaseChat } from '../chat/PhaseChat'
import PhaseSettingsMenu from './PhaseSettingsMenu'
import StageWorkspaceHeader from './StageWorkspaceHeader'
import { 
  CheckCircle, 
  User, 
  Calendar, 
  Box, 
  Upload, 
  MessageSquare, 
  AlertTriangle, 
  X, 
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  Save,
  MoreHorizontal,
  Activity,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  Clock,
  FileText,
  RefreshCw,
  HardDrive,
  Link2,
  ExternalLink,
  FileBox
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropboxFileBrowser } from '@/components/spec-book/DropboxFileBrowser'

interface RenderingVersion {
  id: string
  version: string
  customName: string | null
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PUSHED_TO_CLIENT'
  createdAt: string
  completedAt: string | null
  pushedToClientAt: string | null
  sourceFilePath: string | null
  sourceFileName: string | null
  createdBy: { id: string; name: string; email: string }
  completedBy: { id: string; name: string; email: string } | null
  assets: Array<{
    id: string
    title: string
    url: string
    type: string
    description: string | null
    size: number
    createdAt: string
  }>
  notes: Array<{
    id: string
    content: string
    author: { id: string; name: string; email: string }
    createdAt: string
    updatedAt: string
  }>
  clientApprovalVersion: {
    id: string
    version: string
    status: string
    clientDecision: string | null
    clientMessage: string | null
    clientDecidedAt: string | null
  } | null
}

interface RenderingWorkspaceProps {
  stage: any
  room: any
  project: any
  onComplete: () => void
}

const getStatusConfig = (status: string) => {
  const configs = {
    'IN_PROGRESS': { 
      label: 'In Progress', 
      color: 'bg-blue-100 text-blue-800 border-blue-200' 
    },
    'COMPLETED': { 
      label: 'Completed', 
      color: 'bg-green-100 text-green-800 border-green-200' 
    },
    'PUSHED_TO_CLIENT': { 
      label: 'Pushed to Client', 
      color: 'bg-purple-100 text-purple-800 border-purple-200' 
    }
  }
  return configs[status as keyof typeof configs] || { 
    label: status, 
    color: 'bg-gray-100 text-gray-800 border-gray-200' 
  }
}

export default function RenderingWorkspace({ 
  stage, 
  room, 
  project, 
  onComplete 
}: RenderingWorkspaceProps) {
  const [renderingVersions, setRenderingVersions] = useState<RenderingVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
  const [editingNames, setEditingNames] = useState<Set<string>>(new Set())
  const [editingDescriptions, setEditingDescriptions] = useState<Set<string>>(new Set())
  const [newNotes, setNewNotes] = useState<Record<string, string>>({})
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [syncingVersionId, setSyncingVersionId] = useState<string | null>(null)
  const [pushingToClientId, setPushingToClientId] = useState<string | null>(null)
  const [showSourceFileDialog, setShowSourceFileDialog] = useState<string | null>(null)
  const [linkingSourceFile, setLinkingSourceFile] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Sync files to Dropbox
  const syncToDropbox = async (versionId: string) => {
    try {
      setSyncingVersionId(versionId)
      toast.loading('Syncing files to Dropbox...', { id: 'sync-dropbox' })
      
      const response = await fetch(`/api/renderings/${versionId}/sync-to-dropbox`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        const { results, roomName, versionFolder } = data
        const message = `Synced ${results.synced.length} files to Dropbox\nFolder: ${versionFolder}`
        toast.success(message, { id: 'sync-dropbox', duration: 5000 })
        
        if (results.failed.length > 0) {
          toast.error(`Failed to sync ${results.failed.length} files`, { duration: 5000 })
        }
      } else {
        toast.error(data.error || 'Failed to sync to Dropbox', { id: 'sync-dropbox' })
      }
    } catch (error) {
      console.error('Error syncing to Dropbox:', error)
      toast.error('Failed to sync to Dropbox', { id: 'sync-dropbox' })
    } finally {
      setSyncingVersionId(null)
    }
  }

  // Fetch rendering versions
  const fetchRenderingVersions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/renderings?stageId=${stage.id}`)
      if (response.ok) {
        const data = await response.json()
        setRenderingVersions(data.renderingVersions || [])
        
        // Auto-expand the first version if it exists
        if (data.renderingVersions?.length > 0 && expandedVersions.size === 0) {
          setExpandedVersions(new Set([data.renderingVersions[0].id]))
        }
      } else {
        console.error('Failed to fetch rendering versions')
      }
    } catch (error) {
      console.error('Error fetching rendering versions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRenderingVersions()
  }, [stage.id])

  // Create new version
  const createNewVersion = async () => {
    try {
      setCreatingVersion(true)
      const response = await fetch('/api/renderings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId: room.id,
          stageId: stage.id
        })
      })

      if (response.ok) {
        const newVersion = await response.json()
        setRenderingVersions(prev => [newVersion, ...prev])
        setExpandedVersions(new Set([newVersion.id]))
      } else {
        const error = await response.json()
        console.error(`Failed to create version: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating version:', error)
      console.error('Failed to create version')
    } finally {
      setCreatingVersion(false)
    }
  }

  // Upload files to version
  const uploadFiles = async (versionId: string, files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach(file => {
      formData.append('files', file)
    })

    try {
      setUploading(true)
      const response = await fetch(`/api/renderings/${versionId}/upload`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        await fetchRenderingVersions() // Refresh to get updated assets
      } else {
        const error = await response.json()
        console.error(`Upload failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      console.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Update version (complete/reopen/rename)
  const updateVersion = async (versionId: string, action: string, customName?: string) => {
    try {
      const response = await fetch(`/api/renderings/${versionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, customName })
      })

      if (response.ok) {
        await fetchRenderingVersions()
      } else {
        const error = await response.json()
        console.error(`Failed to update version: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating version:', error)
      console.error('Failed to update version')
    }
  }

  // Add note to version
  const addNote = async (versionId: string) => {
    const content = newNotes[versionId]?.trim()
    if (!content) return

    try {
      const response = await fetch(`/api/renderings/${versionId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      })

      if (response.ok) {
        setNewNotes(prev => ({ ...prev, [versionId]: '' }))
        await fetchRenderingVersions()
      } else {
        const error = await response.json()
        console.error(`Failed to add note: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding note:', error)
      console.error('Failed to add note')
    }
  }

  // Update asset description
  const updateAssetDescription = async (assetId: string, description: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}/description`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description })
      })

      if (response.ok) {
        await fetchRenderingVersions()
      } else {
        const error = await response.json()
        console.error(`Failed to update description: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating description:', error)
      console.error('Failed to update description')
    }
  }

  // Delete asset
  const deleteAsset = async (assetId: string, assetTitle: string, isPushedToClient: boolean) => {
    if (isPushedToClient) {
      alert('Cannot delete files from versions that have been pushed to client approval')
      return
    }

    if (!window.confirm(`Delete "${assetTitle}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchRenderingVersions()
      } else {
        const error = await response.json()
        console.error(`Failed to delete asset: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting asset:', error)
      console.error('Failed to delete asset')
    }
  }

  // Push version to client approval
  const pushToClient = async (versionId: string) => {
    setPushingToClientId(versionId)
    try {
      const response = await fetch(`/api/renderings/${versionId}/push-to-client`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        
        // Show success toast
        toast.success(`Successfully pushed to Client Approval!`)
        
        // Refresh the rendering versions to show updated status
        await fetchRenderingVersions()
        
        // If phase transitions occurred, trigger a soft refresh of the page
        // to update phase status in parent components (like room phase board)
        if (result.phaseTransitions && result.phaseTransitions.length > 0) {
          // Use router.refresh() pattern or call onComplete to notify parent
          if (onComplete) {
            onComplete()
          }
        }
      } else {
        const error = await response.json()
        toast.error(`Failed to push to client: ${error.error}`)
        console.error(`Failed to push to client: ${error.error}`)
      }
    } catch (error) {
      console.error('Error pushing to client:', error)
      toast.error('Failed to push to client. Please try again.')
    } finally {
      setPushingToClientId(null)
    }
  }

  // Link source file (Max file) from Dropbox
  const linkSourceFile = async (versionId: string, filePath: string, fileName: string) => {
    setLinkingSourceFile(true)
    try {
      const response = await fetch(`/api/renderings/${versionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'link_source_file',
          sourceFilePath: filePath,
          sourceFileName: fileName
        })
      })

      if (response.ok) {
        await fetchRenderingVersions()
        setShowSourceFileDialog(null)
        toast.success(`Linked Max file: ${fileName}`)
      } else {
        const error = await response.json()
        toast.error(`Failed to link file: ${error.error}`)
      }
    } catch (error) {
      console.error('Error linking source file:', error)
      toast.error('Failed to link source file')
    } finally {
      setLinkingSourceFile(false)
    }
  }

  // Unlink source file
  const unlinkSourceFile = async (versionId: string) => {
    if (!window.confirm('Unlink the source Max file from this version?')) return

    try {
      const response = await fetch(`/api/renderings/${versionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'link_source_file',
          sourceFilePath: null,
          sourceFileName: null
        })
      })

      if (response.ok) {
        await fetchRenderingVersions()
        toast.success('Source file unlinked')
      } else {
        const error = await response.json()
        toast.error(`Failed to unlink: ${error.error}`)
      }
    } catch (error) {
      console.error('Error unlinking source file:', error)
      toast.error('Failed to unlink source file')
    }
  }

  // Delete version
  const deleteVersion = async (versionId: string, versionName: string) => {
    const version = renderingVersions.find(v => v.id === versionId)
    const isPushedToClient = version?.status === 'PUSHED_TO_CLIENT'
    
    let confirmMessage = `Delete ${versionName}? This cannot be undone.`
    
    if (isPushedToClient) {
      confirmMessage = `WARNING: Delete ${versionName}? It has been pushed to client approval and this will remove it from the client review process.`
    }
    
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      const response = await fetch(`/api/renderings/${versionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchRenderingVersions()
        
      } else {
        const error = await response.json()
        console.error(`Failed to delete version: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting version:', error)
      console.error('Failed to delete version')
    }
  }

  // Toggle version expansion
  const toggleVersion = (versionId: string) => {
    setExpandedVersions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(versionId)) {
        newSet.delete(versionId)
      } else {
        newSet.add(versionId)
      }
      return newSet
    })
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Ensure this component only renders for 3D stages
  if (stage.type !== 'THREE_D') {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-500 mb-2">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-semibold">Invalid Stage Type</h3>
        </div>
        <p className="text-gray-600">3D Rendering Workspace can only be used for 3D Rendering phases.</p>
        <p className="text-sm text-gray-500 mt-1">Current stage type: {stage.type}</p>
      </div>
    )
  }

  const isNotApplicable = stage.status === 'NOT_APPLICABLE'
  
  return (
    <div className={`border border-gray-200 rounded-lg ${
      isNotApplicable 
        ? 'bg-gray-100 border-gray-300 opacity-75' 
        : 'bg-white'
    }`}>
      {/* Unified Header */}
      <StageWorkspaceHeader
        projectId={project.id}
        projectName={project.name}
        roomId={room.id}
        roomName={room.name}
        roomType={room.type}
        stageId={stage.id}
        stageType={stage.type}
        stageStatus={stage.status}
        assignedUserName={stage.assignedUser?.name || null}
        dueDate={stage.dueDate}
        rightSlot={(
          <Button 
            onClick={() => setShowActivityLog(!showActivityLog)}
            variant="outline"
          >
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </Button>
        )}
        settingsSlot={(
          <PhaseSettingsMenu 
            stageId={stage.id}
            stageName="3D Rendering"
            isNotApplicable={isNotApplicable}
            onReset={fetchRenderingVersions}
            onMarkNotApplicable={fetchRenderingVersions}
            onMarkApplicable={fetchRenderingVersions}
          />
        )}
      />

      {/* Main Content with Sidebar Layout */}
      <div className="flex">
        {/* Main Workspace */}
        <div className="flex-1 p-6">
          {/* 3D Renderings Content */}
          <div>
        {/* Create New Version Button */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Rendering Versions</h3>
          <div className="flex items-center space-x-3">
            <Button
              onClick={createNewVersion}
              disabled={creatingVersion}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {creatingVersion ? 'Creating...' : 'New Version'}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading versions...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && renderingVersions.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No rendering versions yet</h4>
            <p className="text-gray-500 mb-4">Create your first version to start uploading renderings</p>
            <Button
              onClick={createNewVersion}
              disabled={creatingVersion}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {creatingVersion ? 'Creating...' : 'Create First Version'}
            </Button>
          </div>
        )}

        {/* Version Cards */}
        {renderingVersions.map((version) => {
          const isExpanded = expandedVersions.has(version.id)
          const statusConfig = getStatusConfig(version.status)
          const isPushedToClient = version.status === 'PUSHED_TO_CLIENT'
          
          return (
            <div key={version.id} className="border border-gray-200 rounded-lg mb-4 overflow-hidden">
              {/* Version Header */}
              <div 
                className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleVersion(version.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-lg font-medium text-gray-900">
                          {version.customName || version.version}
                        </h4>
                        {version.customName && (
                          <span className="text-sm text-gray-500">({version.version})</span>
                        )}
                        <Badge className={statusConfig.color}>
                          {statusConfig.label}
                        </Badge>
                        {version.clientApprovalVersion?.clientDecision === 'REVISION_REQUESTED' && (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Revision Requested
                          </Badge>
                        )}
                        {version.clientApprovalVersion && version.clientApprovalVersion.clientDecision !== 'REVISION_REQUESTED' && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                            <Eye className="w-3 h-3 mr-1" />
                            In Client Approval
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Created by {version.createdBy.name} • {new Date(version.createdAt).toLocaleDateString()} • {version.assets.length} file{version.assets.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Resync to Dropbox button - always available if there are assets */}
                    {version.assets.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          syncToDropbox(version.id)
                        }}
                        disabled={syncingVersionId === version.id}
                        className="border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
                        title="Re-sync files to Dropbox folder"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${syncingVersionId === version.id ? 'animate-spin' : ''}`} />
                        {syncingVersionId === version.id ? 'Syncing...' : 'Resync'}
                      </Button>
                    )}
                    {version.status === 'IN_PROGRESS' && (
                      <>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            updateVersion(version.id, 'complete')
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteVersion(version.id, version.customName || version.version)
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                    {version.status === 'COMPLETED' && !isPushedToClient && (
                      <>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            pushToClient(version.id)
                          }}
                          disabled={pushingToClientId === version.id}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Send className={`w-4 h-4 mr-1 ${pushingToClientId === version.id ? 'animate-pulse' : ''}`} />
                          {pushingToClientId === version.id ? 'Pushing...' : 'Push to Client Approval'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteVersion(version.id, version.customName || version.version)
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Version Content (when expanded) */}
              {isExpanded && (
                <div className="p-4">
                  {/* Revision Details (if revision requested) */}
                  {version.clientApprovalVersion?.clientDecision === 'REVISION_REQUESTED' && (
                    <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div className="flex-1">
                          <h5 className="font-semibold text-orange-900 mb-2">Client Revision Request</h5>
                          {version.clientApprovalVersion.clientMessage ? (
                            <div className="bg-white rounded-md p-3 border border-orange-200">
                              <p className="text-gray-900 whitespace-pre-wrap">{version.clientApprovalVersion.clientMessage}</p>
                            </div>
                          ) : (
                            <p className="text-orange-800">Client requested revisions without specific notes.</p>
                          )}
                          <p className="text-sm text-orange-700 mt-2">
                            Requested on {new Date(version.clientApprovalVersion.clientDecidedAt!).toLocaleDateString()} at {new Date(version.clientApprovalVersion.clientDecidedAt!).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Source Max File Section */}
                  <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileBox className="w-5 h-5 text-orange-600" />
                        <h5 className="font-medium text-gray-900">Source Max File</h5>
                      </div>
                      {!version.sourceFilePath && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowSourceFileDialog(version.id)}
                          className="border-orange-300 text-orange-600 hover:bg-orange-50"
                        >
                          <Link2 className="w-4 h-4 mr-1" />
                          Link Max File
                        </Button>
                      )}
                    </div>
                    
                    {version.sourceFilePath ? (
                      <div className="bg-white border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <HardDrive className="w-5 h-5 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate" title={version.sourceFileName || ''}>
                              {version.sourceFileName || 'Max File'}
                            </p>
                            <p className="text-xs text-gray-500 truncate" title={version.sourceFilePath}>
                              {version.sourceFilePath}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-3">
                          <a
                            href={`https://www.dropbox.com/home${version.sourceFilePath.replace(/\/[^/]+$/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:text-orange-700 p-1"
                            title="Open folder in Dropbox"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => unlinkSourceFile(version.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Unlink file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Link the source 3ds Max file from Dropbox for this rendering version
                      </p>
                    )}
                  </div>

                  {/* Upload Area */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-gray-900">Files ({version.assets.length})</h5>
                      {!isPushedToClient && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRefs.current[version.id]?.click()}
                          disabled={uploading}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          {uploading ? 'Uploading...' : 'Add Files'}
                        </Button>
                      )}
                      {isPushedToClient && (
                        <div className="text-sm text-gray-500 italic">
                          Version pushed to client - editing locked
                        </div>
                      )}
                    </div>
                    
                    <input
                      ref={(el) => {
                        fileInputRefs.current[version.id] = el
                      }}
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          uploadFiles(version.id, e.target.files)
                        }
                      }}
                      className="hidden"
                    />

                    {/* File Gallery */}
                    {version.assets.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {version.assets.map((asset) => (
                          <div key={asset.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden group/asset">
                            <div className="aspect-video bg-gray-100 relative">
                              {(asset.type === 'RENDER' || asset.type === 'IMAGE') && (
                                <img
                                  src={asset.temporaryUrl || `/api/assets/${asset.id}/view`}
                                  alt={asset.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              {asset.type === 'PDF' && (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400" />
                                </div>
                              )}
                              {/* Delete button - only show when not pushed to client */}
                              {!isPushedToClient && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="absolute top-2 right-2 opacity-0 group-hover/asset:opacity-100 transition-opacity h-8 w-8 p-0 bg-red-600 hover:bg-red-700"
                                  onClick={() => deleteAsset(asset.id, asset.title, isPushedToClient)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <div className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h6 className="font-medium text-gray-900 truncate">{asset.title}</h6>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatFileSize(asset.size)} • {new Date(asset.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Asset Description */}
                              <div className="mt-2">
                                {!isPushedToClient && editingDescriptions.has(asset.id) ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      id={`desc-${asset.id}`}
                                      placeholder="Add a description..."
                                      defaultValue={asset.description || ''}
                                      className="text-sm"
                                      rows={2}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey) {
                                          const textarea = e.currentTarget
                                          updateAssetDescription(asset.id, textarea.value)
                                          setEditingDescriptions(prev => {
                                            const newSet = new Set(prev)
                                            newSet.delete(asset.id)
                                            return newSet
                                          })
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs text-gray-500">Press Ctrl+Enter to save</p>
                                      <div className="flex space-x-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingDescriptions(prev => {
                                              const newSet = new Set(prev)
                                              newSet.delete(asset.id)
                                              return newSet
                                            })
                                          }}
                                        >
                                          <X className="w-3 h-3 mr-1" />
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            const textarea = document.getElementById(`desc-${asset.id}`) as HTMLTextAreaElement
                                            if (textarea) {
                                              updateAssetDescription(asset.id, textarea.value)
                                              setEditingDescriptions(prev => {
                                                const newSet = new Set(prev)
                                                newSet.delete(asset.id)
                                                return newSet
                                              })
                                            }
                                          }}
                                        >
                                          <Save className="w-3 h-3 mr-1" />
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="group relative">
                                    <div
                                      className={`text-sm text-gray-600 min-h-[1.5rem] rounded px-2 py-1 -mx-2 -my-1 ${
                                        !isPushedToClient 
                                          ? 'cursor-pointer hover:text-gray-800 border border-transparent hover:border-gray-200' 
                                          : 'cursor-not-allowed opacity-60'
                                      }`}
                                      onClick={() => {
                                        if (!isPushedToClient) {
                                          setEditingDescriptions(prev => new Set([...prev, asset.id]))
                                        }
                                      }}
                                    >
                                      {asset.description || (
                                        <span className="text-gray-400 italic">
                                          {!isPushedToClient ? 'Click to add description...' : 'No description'}
                                        </span>
                                      )}
                                    </div>
                                    {!isPushedToClient && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingDescriptions(prev => new Set([...prev, asset.id]))
                                        }}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No files uploaded yet</p>
                      </div>
                    )}
                  </div>

                  {/* Notes Section */}
                  <div className="border-t pt-4">
                    <h5 className="font-medium text-gray-900 mb-3">Notes ({version.notes.length})</h5>
                    
                    {/* Add Note */}
                    {!isPushedToClient ? (
                      <div className="flex space-x-2 mb-4">
                        <Textarea
                          placeholder="Add a note..."
                          value={newNotes[version.id] || ''}
                          onChange={(e) => setNewNotes(prev => ({ ...prev, [version.id]: e.target.value }))}
                          className="flex-1"
                          rows={2}
                        />
                        <Button
                          onClick={() => addNote(version.id)}
                          disabled={!newNotes[version.id]?.trim()}
                          size="sm"
                          className="self-end"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Post
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-500 text-center italic">
                          Version pushed to client approval - notes are locked
                        </p>
                      </div>
                    )}

                    {/* Notes Feed */}
                    <div className="space-y-3">
                      {version.notes.map((note) => (
                        <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">{note.content}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {note.author.name} • {new Date(note.createdAt).toLocaleDateString()}
                                {note.updatedAt !== note.createdAt && ' (edited)'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {version.notes.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
                      )}
                    </div>
                  </div>

                  {/* Version Activity Timeline */}
                  <div className="border-t pt-4 mt-4">
                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Activity className="w-4 h-4 mr-2" />
                      Version Activity
                    </h5>
                    <div className="space-y-3">
                      {/* Version Created */}
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{version.createdBy.name}</span> created {version.version}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(version.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Version Completed */}
                      {version.completedAt && (
                        <div className="flex items-start space-x-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">{version.completedBy?.name || 'System'}</span> marked as complete
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(version.completedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Pushed to Client */}
                      {version.pushedToClientAt && (
                        <div className="flex items-start space-x-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              Pushed to <span className="font-medium text-purple-600">Client Approval</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(version.pushedToClientAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Client Approval Activities */}
                      {version.clientApprovalVersion && (
                        <>
                          {/* Aaron's Approval */}
                          {version.clientApprovalVersion.aaronApprovedAt && (
                            <div className="flex items-start space-x-3">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">
                                  <span className="font-medium text-indigo-600">Aaron approved</span> for client review
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(version.clientApprovalVersion.aaronApprovedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Sent to Client */}
                          {version.clientApprovalVersion.sentToClientAt && (
                            <div className="flex items-start space-x-3">
                              <div className="w-2 h-2 bg-cyan-500 rounded-full mt-2 flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">
                                  <span className="font-medium text-cyan-600">Email sent to client</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(version.clientApprovalVersion.sentToClientAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Email Opened */}
                          {version.clientApprovalVersion.emailOpenedAt && (
                            <div className="flex items-start space-x-3">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">
                                  <span className="font-medium text-yellow-600">Client opened email</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(version.clientApprovalVersion.emailOpenedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Follow-up Completed */}
                          {version.clientApprovalVersion.followUpCompletedAt && (
                            <div className="flex items-start space-x-3">
                              <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">
                                  <span className="font-medium text-teal-600">Client follow-up completed</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(version.clientApprovalVersion.followUpCompletedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {version.clientApprovalVersion.followUpNotes && (
                                  <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                    {version.clientApprovalVersion.followUpNotes}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Client Decision */}
                          {version.clientApprovalVersion.clientDecidedAt && (
                            <div className="flex items-start space-x-3">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                version.clientApprovalVersion.clientDecision === 'APPROVED' 
                                  ? 'bg-green-500' 
                                  : 'bg-red-500'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">
                                  <span className={`font-medium ${
                                    version.clientApprovalVersion.clientDecision === 'APPROVED'
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}>
                                    Client {version.clientApprovalVersion.clientDecision === 'APPROVED' ? 'approved' : 'requested revisions'}
                                  </span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(version.clientApprovalVersion.clientDecidedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {version.clientApprovalVersion.clientMessage && (
                                  <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                    "{version.clientApprovalVersion.clientMessage}"
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Version Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      {version.status === 'COMPLETED' && !isPushedToClient && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateVersion(version.id, 'reopen')}
                        >
                          Reopen for Editing
                        </Button>
                      )}
                      {version.clientApprovalVersion?.clientDecision === 'REVISION_REQUESTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateVersion(version.id, 'reopen')}
                          className="border-orange-300 text-orange-600 hover:bg-orange-50"
                        >
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Address Revision Request
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteVersion(version.id, version.customName || version.version)}
                        className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete Version
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-96 border-l border-gray-200 bg-gray-50">
          <PhaseChat
            stageId={stage.id}
            stageName={`3D - ${room.name || room.type}`}
            className="h-full"
          />
        </div>
      </div>

      {/* Source File Link Dialog */}
      <Dialog 
        open={showSourceFileDialog !== null} 
        onOpenChange={(open) => !open && setShowSourceFileDialog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileBox className="w-5 h-5 text-orange-600" />
              <span>Link Source Max File from Dropbox</span>
            </DialogTitle>
          </DialogHeader>
          
          {showSourceFileDialog && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select the 3ds Max (.max) source file for this rendering version. The browser starts from the project's linked Dropbox folder.
              </p>
              <DropboxFileBrowser
                roomId={null}
                projectId={project.id}
                sectionType="RENDERING"
                sectionName="Source Max File"
                onFileSelected={(file) => {
                  linkSourceFile(showSourceFileDialog, file.path, file.name)
                }}
                allowedExtensions={['.max', '.3ds']}
                mode="select"
                variant="settings"
                allowMultiple={false}
              />
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSourceFileDialog(null)}
                  disabled={linkingSourceFile}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
