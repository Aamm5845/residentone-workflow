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
        await fetchRenderingVersions()
        alert('Successfully pushed to Client Approval!')
      } else {
        const error = await response.json()
        alert(`Failed to push to client: ${error.error}`)
      }
    } catch (error) {
      console.error('Error pushing to client:', error)
      alert('Failed to push to client')
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
            <Button 
              onClick={onComplete}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Stage
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Create New Version Button */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Rendering Versions</h3>
          <Button
            onClick={createNewVersion}
            disabled={creatingVersion}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {creatingVersion ? 'Creating...' : 'New Version'}
          </Button>
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
                        {version.clientApprovalVersion && (
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
                    {version.status === 'COMPLETED' && !isPushedToClient && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          pushToClient(version.id)
                        }}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Push to Client
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Version Content (when expanded) */}
              {isExpanded && (
                <div className="p-4">
                  {/* Upload Area */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-gray-900">Files ({version.assets.length})</h5>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRefs.current[version.id]?.click()}
                        disabled={uploading}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        {uploading ? 'Uploading...' : 'Add Files'}
                      </Button>
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
                                {editingDescriptions.has(asset.id) ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      placeholder="Add a description..."
                                      defaultValue={asset.description || ''}
                                      className="text-sm"
                                      rows={2}
                                      onBlur={(e) => {
                                        updateAssetDescription(asset.id, e.target.value)
                                        setEditingDescriptions(prev => {
                                          const newSet = new Set(prev)
                                          newSet.delete(asset.id)
                                          return newSet
                                        })
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey) {
                                          e.currentTarget.blur()
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <p className="text-xs text-gray-500">Press Ctrl+Enter to save</p>
                                  </div>
                                ) : (
                                  <div
                                    className="text-sm text-gray-600 cursor-pointer hover:text-gray-800 min-h-[1.5rem] border border-transparent hover:border-gray-200 rounded px-2 py-1 -mx-2 -my-1"
                                    onClick={() => {
                                      setEditingDescriptions(prev => new Set([...prev, asset.id]))
                                    }}
                                  >
                                    {asset.description || (
                                      <span className="text-gray-400 italic">Click to add description...</span>
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

                  {/* Version Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      {version.status === 'IN_PROGRESS' && (
                        <Button
                          size="sm"
                          onClick={() => updateVersion(version.id, 'complete')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark Complete
                        </Button>
                      )}
                      {version.status === 'COMPLETED' && !isPushedToClient && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateVersion(version.id, 'reopen')}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {version.completedAt && (
                        <span className="text-sm text-gray-500">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Completed {new Date(version.completedAt).toLocaleDateString()}
                        </span>
                      )}
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
            <li>• Mark versions complete when ready, then push to Client Approval</li>
            <li>• After pushing to client, you can still add files and notes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}