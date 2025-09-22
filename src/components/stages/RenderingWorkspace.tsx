'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  FileText
} from 'lucide-react'

interface RenderingVersion {
  id: string
  version: string
  customName: string | null
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PUSHED_TO_CLIENT'
  createdAt: string
  completedAt: string | null
  pushedToClientAt: string | null
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
  const [completingPhase, setCompletingPhase] = useState(false)
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
        alert(`Failed to create version: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating version:', error)
      alert('Failed to create version')
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
        alert(`Upload failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Upload failed')
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
        alert(`Failed to update version: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating version:', error)
      alert('Failed to update version')
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
        alert(`Failed to add note: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Failed to add note')
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
        alert(`Failed to update description: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating description:', error)
      alert('Failed to update description')
    }
  }

  // Push version to client approval
  const pushToClient = async (versionId: string) => {
    if (!window.confirm('Push this version to Client Approval? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/renderings/${versionId}/push-to-client`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        
        // Show success message with phase transition info
        let message = '🎉 Successfully pushed to Client Approval!'
        
        if (result.phaseTransitions && result.phaseTransitions.length > 0) {
          message += '\n\n✅ The Client Approval phase has been automatically started and is ready for processing.'
        } else {
          message += '\n\n✅ Version is now available in the Client Approval workspace.'
        }
        
        message += '\n\n👉 The page will refresh to show the updated phase status.'
        
        alert(message)
        
        // Force page refresh to ensure phase status is updated throughout the UI
        // This is especially important because the push-to-client triggers automatic
        // phase transitions that need to be reflected in the room phase board
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to push to client: ${error.error}`)
      }
    } catch (error) {
      console.error('Error pushing to client:', error)
      alert('Failed to push to client')
    }
  }

  // Delete version
  const deleteVersion = async (versionId: string, versionName: string) => {
    const version = renderingVersions.find(v => v.id === versionId)
    const isPushedToClient = version?.status === 'PUSHED_TO_CLIENT'
    
    let confirmMessage = `Are you sure you want to delete ${versionName}?\n\nThis will permanently delete:\n• The version and all its files\n• All notes and comments\n• Version history\n\nThis action cannot be undone.`
    
    if (isPushedToClient) {
      confirmMessage = `⚠️ WARNING: ${versionName} has been pushed to client approval!\n\nDeleting this version will:\n• Remove it from the client approval process\n• Permanently delete all files and data\n• Potentially disrupt the client review\n\nAre you absolutely sure you want to proceed?\n\nThis action cannot be undone.`
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
        alert('Version deleted successfully')
      } else {
        const error = await response.json()
        alert(`Failed to delete version: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting version:', error)
      alert('Failed to delete version')
    }
  }

  // Complete the entire 3D Rendering phase
  const handleCompletePhase = async () => {
    if (!window.confirm('Mark the entire 3D Rendering phase as complete? This will move the project to the next stage.')) {
      return
    }

    setCompletingPhase(true)
    try {
      const response = await fetch(`/api/stages/${stage.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        alert('3D Rendering phase completed successfully! The project has moved to the next stage.')
        // Call the parent complete handler to refresh the project view
        onComplete()
      } else {
        const error = await response.json()
        alert(`Failed to complete phase: ${error.error}`)
      }
    } catch (error) {
      console.error('Error completing phase:', error)
      alert('Failed to complete phase')
    } finally {
      setCompletingPhase(false)
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

  // Ensure this component only renders for THREE_D stages
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Box className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900">3D Rendering Workspace</h2>
              <p className="text-gray-600">{room.name || room.type} - {project.name}</p>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center text-sm text-gray-500">
                  <User className="w-4 h-4 mr-1" />
                  {stage.assignedUser?.name || 'Unassigned'}
                </div>
                {stage.dueDate && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    Due {new Date(stage.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => setShowActivityLog(!showActivityLog)}
              variant="outline"
            >
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Create New Version Button */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Rendering Versions</h3>
          <div className="flex items-center space-x-3">
            {stage.status === 'IN_PROGRESS' && renderingVersions.some(v => v.status === 'COMPLETED') && (
              <Button
                onClick={handleCompletePhase}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Phase Complete
              </Button>
            )}
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
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Push to Client Approval
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
                          <div key={asset.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="aspect-video bg-gray-100 relative">
                              {(asset.type === 'RENDER' || asset.type === 'IMAGE') && (
                                <img
                                  src={asset.url}
                                  alt={asset.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              {asset.type === 'PDF' && (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <h6 className="font-medium text-gray-900 truncate">{asset.title}</h6>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatFileSize(asset.size)} • {new Date(asset.createdAt).toLocaleDateString()}
                              </p>
                              
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

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h4 className="font-semibold text-blue-900 mb-2">📝 How to Use</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Create versions (V1, V2, etc.) to organize different iterations</li>
            <li>• Upload multiple images per version with individual descriptions</li>
            <li>• Use the notes section to communicate with your team</li>
            <li>• Mark Complete individual versions when they&apos;re ready</li>
            <li>• Push to Client Approval to send completed versions for client review</li>
            <li>• <strong>Once pushed to client approval, versions become locked</strong> - no further editing allowed</li>
            <li>• <strong>Delete versions</strong> if needed - this permanently removes the version and all its files</li>
            <li>• Revision requests will reopen the version for further editing</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
