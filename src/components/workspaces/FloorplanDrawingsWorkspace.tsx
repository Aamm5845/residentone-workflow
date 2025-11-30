'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  FileImage,
  Trash2,
  Loader2,
  Plus,
  AlertCircle,
  Eye,
  Send,
  FolderOpen,
  Edit2,
  User,
  Activity,
  ChevronDown,
  ChevronUp,
  Box
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'react-hot-toast'
import EnhancedFilePreviewModal from '@/components/ui/enhanced-file-preview-modal'
import CreateVersionModal from '@/components/modals/CreateVersionModal'
import { FloorplanChat } from '@/components/chat/FloorplanChat'

interface FloorplanDrawingsWorkspaceProps {
  project: any
  assignedUser?: {
    id: string
    name: string
    email: string
    role: string
    image?: string | null
  } | null
}

interface FloorplanVersion {
  id: string
  version: string
  status: string
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
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown size'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; color: string }> = {
    'DRAFT': { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
    'READY_FOR_CLIENT': { label: 'Pushed to Approval', color: 'bg-purple-100 text-purple-800' },
    'SENT_TO_CLIENT': { label: 'Sent to Client', color: 'bg-purple-100 text-purple-800' },
    'CLIENT_APPROVED': { label: 'Client Approved', color: 'bg-green-100 text-green-800' },
    'REVISION_REQUESTED': { label: 'Revision Requested', color: 'bg-red-100 text-red-800' }
  }
  return configs[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
}

export default function FloorplanDrawingsWorkspace({
  project,
  assignedUser
}: FloorplanDrawingsWorkspaceProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [versions, setVersions] = useState<FloorplanVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
  const [creatingVersion, setCreatingVersion] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  
  // PDF preview modal state
  const [selectedFile, setSelectedFile] = useState<{
    id: string
    name: string
    originalName: string
    type: 'image' | 'pdf' | 'document'
    url: string
    size: number
    uploadedAt: string
    uploadedBy: { name: string }
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

  // Fetch floorplan versions from API
  useEffect(() => {
    fetchVersions()
  }, [project.id])

  const fetchVersions = async () => {
    try {
      setFetchError(null)
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`)
      if (response.ok) {
        const data = await response.json()
        setVersions(data.versions || [])
        
        // Calculate next version number
        const nextVersionNum = `v${(data.versions?.length || 0) + 1}`
        setNextVersionNumber(nextVersionNum)
        
        // Auto-expand first version if exists
        if (data.versions?.length > 0 && expandedVersions.size === 0) {
          setExpandedVersions(new Set([data.versions[0].id]))
        }
      } else if (response.status === 404) {
        setVersions([])
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setFetchError(`Failed to load data: ${errorData.error || 'Server error'}`)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setFetchError('Network error occurred. Please try again.')
    } finally {
      setIsInitialLoading(false)
    }
  }

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

  const createNewVersion = async (versionNotes: string) => {
    setCreatingVersion(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: versionNotes })
      })

      if (response.ok) {
        const data = await response.json()
        await fetchVersions()
        setExpandedVersions(new Set([data.version.id]))
        toast.success(`Version ${data.version.version} created!`)
      } else {
        const error = await response.json()
        toast.error(`Failed: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to create version')
    } finally {
      setCreatingVersion(false)
    }
  }

  const handleFileUpload = async (versionId: string, files: FileList) => {
    setUploading(true)
    setUploadProgress(0)

    try {
      const filesArray = Array.from(files)
      let successCount = 0
      
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('versionId', versionId)

        const response = await fetch(`/api/projects/${project.id}/floorplan-assets`, {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          successCount++
          setUploadProgress(Math.round(((i + 1) / filesArray.length) * 100))
        } else {
          const error = await response.json()
          toast.error(`Upload failed for ${file.name}: ${error.error}`)
        }
      }
      
      if (successCount > 0) {
        await fetchVersions()
        toast.success(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`)
      }
      
      setTimeout(() => setUploadProgress(0), 1000)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAsset = async (versionId: string, assetId: string, assetTitle: string) => {
    const version = versions.find(v => v.id === versionId)
    if (version?.status !== 'DRAFT') {
      toast.error('Cannot delete files from versions that have been pushed to approval')
      return
    }

    if (!confirm(`Delete "${assetTitle}"? This cannot be undone.`)) return

    setDeletingAssetId(assetId)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-assets?assetId=${assetId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchVersions()
        toast.success('File deleted')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to delete')
    } finally {
      setDeletingAssetId(null)
    }
  }

  // Push version to approval phase
  const pushToApproval = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId)
    if (!version?.assets?.length) {
      toast.error('Cannot push to approval without any files')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          versionId,
          action: 'push_to_approval'
        })
      })

      if (response.ok) {
        toast.success('Version pushed to approval!')
        // Refresh to show updated status
        window.location.reload()
      } else {
        const error = await response.json()
        toast.error(`Failed: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to push to approval')
    } finally {
      setLoading(false)
    }
  }

  const deleteVersion = async (versionId: string, versionName: string) => {
    const version = versions.find(v => v.id === versionId)
    const isPushed = version?.status !== 'DRAFT'
    
    let msg = `Delete ${versionName}? This cannot be undone.`
    if (isPushed) {
      msg = `WARNING: ${versionName} has been pushed to approval. Delete anyway?`
    }
    
    if (!confirm(msg)) return

    try {
      const response = await fetch(`/api/projects/${project.id}/floorplan-approvals?versionId=${versionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchVersions()
        toast.success('Version deleted')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to delete')
    }
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading floorplan drawings...</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Unable to Load</h3>
          <p className="text-gray-600 mb-4">{fetchError}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="border border-gray-200 rounded-lg bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="icon">
                <Link href={`/projects/${project.id}/floorplan`}>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">Floorplan Drawings Workspace</h1>
                  <Badge className="bg-blue-100 text-blue-800">Phase 1</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <span>{project.name}</span>
                </div>
                {assignedUser && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <User className="w-3 h-3" /> Assigned to {assignedUser.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex">
          {/* Workspace */}
          <div className="flex-1 p-6">
            {/* Create New Version Button */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Floorplan Versions</h3>
              <Button
                onClick={() => setShowCreateVersionModal(true)}
                disabled={creatingVersion}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                {creatingVersion ? 'Creating...' : 'New Version'}
              </Button>
            </div>

            {/* Empty State */}
            {versions.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No versions yet</h4>
                <p className="text-gray-500 mb-4">Create your first version to start uploading floorplans</p>
                <Button
                  onClick={() => setShowCreateVersionModal(true)}
                  disabled={creatingVersion}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Version
                </Button>
              </div>
            )}

            {/* Version Cards */}
            {versions.map((version) => {
              const isExpanded = expandedVersions.has(version.id)
              const statusConfig = getStatusConfig(version.status)
              const isPushed = version.status !== 'DRAFT'
              
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
                              {version.version}
                            </h4>
                            <Badge className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                            {isPushed && (
                              <Badge className="bg-purple-100 text-purple-800">
                                <Eye className="w-3 h-3 mr-1" />
                                In Approval
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(version.createdAt).toLocaleDateString()} • {version.assets?.length || 0} file{(version.assets?.length || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                        {/* Push to Approval - only for DRAFT versions with files */}
                        {version.status === 'DRAFT' && version.assets?.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => pushToApproval(version.id)}
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Push to Approval
                          </Button>
                        )}
                        
                        {/* Delete Button - available for ALL versions */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteVersion(version.id, version.version)}
                          className={isPushed 
                            ? "border-red-400 text-red-700 hover:bg-red-50 bg-red-50/50" 
                            : "border-red-300 text-red-600 hover:bg-red-50"
                          }
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Version Content (Expanded) */}
                  {isExpanded && (
                    <div className="p-6 border-t border-gray-200">
                      {/* Upload Area - only for DRAFT versions */}
                      {version.status === 'DRAFT' ? (
                        <div className="mb-6">
                          <input
                            ref={(el) => { fileInputRefs.current[version.id] = el }}
                            type="file"
                            multiple
                            accept=".pdf,.dwg,.dxf"
                            onChange={(e) => {
                              if (e.target.files?.length) {
                                handleFileUpload(version.id, e.target.files)
                              }
                            }}
                            className="hidden"
                            disabled={uploading}
                          />
                          <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                            onClick={() => fileInputRefs.current[version.id]?.click()}
                          >
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">
                              {uploading ? 'Uploading...' : 'Click to upload files (PDF, DWG, DXF)'}
                            </p>
                            {uploadProgress > 0 && uploadProgress < 100 && (
                              <div className="mt-3 max-w-xs mx-auto">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all" 
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-sm text-purple-700">
                            <Eye className="w-4 h-4 inline mr-1" />
                            Version pushed to approval - editing locked
                          </p>
                        </div>
                      )}

                      {/* Files Grid */}
                      {version.assets && version.assets.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {version.assets.map((assetItem) => {
                            const isPDF = assetItem.asset.type === 'FLOORPLAN_PDF'
                            
                            return (
                              <div 
                                key={assetItem.id}
                                className="group/asset relative border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                              >
                                <div 
                                  className="cursor-pointer"
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
                                  <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center mb-3">
                                    {isPDF ? (
                                      <FileText className="w-12 h-12 text-red-400" />
                                    ) : (
                                      <FileImage className="w-12 h-12 text-blue-400" />
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {assetItem.asset.title}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatFileSize(assetItem.asset.size)}
                                  </p>
                                </div>
                                
                                {/* Delete button - only for DRAFT */}
                                {version.status === 'DRAFT' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="absolute top-2 right-2 opacity-0 group-hover/asset:opacity-100 transition-opacity h-8 w-8 p-0"
                                    onClick={() => handleDeleteAsset(version.id, assetItem.asset.id, assetItem.asset.title)}
                                    disabled={deletingAssetId === assetItem.asset.id}
                                  >
                                    {deletingAssetId === assetItem.asset.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p>No files uploaded yet</p>
                        </div>
                      )}

                      {/* Notes */}
                      {version.notes && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Notes</h5>
                          <p className="text-sm text-gray-600">{version.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Chat Sidebar */}
          <div className="w-96 border-l border-gray-200 bg-gray-50">
            <FloorplanChat
              projectId={project.id}
              phaseName="Floorplan Drawings"
              className="h-full"
            />
          </div>
        </div>
      </div>
      
      {/* Modals */}
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
      
      <CreateVersionModal
        isOpen={showCreateVersionModal}
        onClose={() => setShowCreateVersionModal(false)}
        onConfirm={createNewVersion}
        loading={creatingVersion}
        versionNumber={nextVersionNumber}
      />
    </>
  )
}
