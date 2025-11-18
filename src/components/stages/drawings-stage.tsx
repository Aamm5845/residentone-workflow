'use client'

import { useState, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import FilePreviewModal from '@/components/ui/file-preview-modal'
import { useDrawingsWorkspace } from '@/hooks/useDrawingsWorkspace'
import { DrawingAsset, DrawingChecklistItem, DropboxFileLink } from '@/types/drawings'
import { PhaseChat } from '../chat/PhaseChat'
import PhaseSettingsMenu from './PhaseSettingsMenu'
import { DropboxFileBrowser } from '../spec-book/DropboxFileBrowser'
import {
  CheckCircle,
  PencilRuler,
  User,
  Calendar,
  Upload,
  FileImage,
  FileText,
  File,
  Eye,
  Edit2,
  Trash2,
  Download,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  Plus,
  HardDrive,
  X,
  Link2,
  ExternalLink
} from 'lucide-react'

interface DrawingsWorkspaceProps {
  stage: any
  room: any
  project: any
  onComplete: () => void
}

// File type icons
const getFileTypeIcon = (asset: DrawingAsset) => {
  if (asset.type === 'IMAGE') return <FileImage className="w-4 h-4" />
  if (asset.type === 'PDF') return <FileText className="w-4 h-4" />
  if (asset.mimeType?.includes('dwg') || asset.filename?.toLowerCase().endsWith('.dwg')) {
    return <File className="w-4 h-4" />
  }
  return <File className="w-4 h-4" />
}

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return ''
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function DrawingsWorkspace({ 
  stage, 
  room, 
  project, 
  onComplete 
}: DrawingsWorkspaceProps) {
  const [selectedChecklistItem, setSelectedChecklistItem] = useState<string | null>(null)
  const [previewAsset, setPreviewAsset] = useState<DrawingAsset | null>(null)
  const [editingDescriptions, setEditingDescriptions] = useState<Set<string>>(new Set())
  const [showActivity, setShowActivity] = useState(false)
  const [draggedOver, setDraggedOver] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  
  // Custom section dialog state
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [customSectionName, setCustomSectionName] = useState('')
  
  // Dropbox linking dialog state
  const [showDropboxDialog, setShowDropboxDialog] = useState<string | null>(null)
  const [unlinkingFile, setUnlinkingFile] = useState<string | null>(null)
  
  const {
    data,
    isLoading,
    error,
    uploadFiles,
    toggleChecklistItem,
    updateAssetDescription,
    deleteAsset,
    completeStage,
    addCustomChecklistItem,
    deleteChecklistItem,
    linkDropboxFiles,
    unlinkDropboxFile,
    uploading,
    completing,
    linking,
    getProgressPercentage,
    canComplete
  } = useDrawingsWorkspace(stage.id)

  // Handle file drag and drop
  const handleDragOver = (e: React.DragEvent, checklistItemId: string) => {
    e.preventDefault()
    setDraggedOver(checklistItemId)
  }

  const handleDragLeave = () => {
    setDraggedOver(null)
  }

  const handleDrop = (e: React.DragEvent, checklistItemId: string) => {
    e.preventDefault()
    setDraggedOver(null)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      uploadFiles(checklistItemId, files)
    }
  }

  const handleFileSelect = (checklistItemId: string, files: FileList | null) => {
    if (files && files.length > 0) {
      uploadFiles(checklistItemId, files)
    }
  }

  const handleDescriptionSave = async (assetId: string, description: string) => {
    await updateAssetDescription(assetId, description)
    setEditingDescriptions(prev => {
      const newSet = new Set(prev)
      newSet.delete(assetId)
      return newSet
    })
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (window.confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      await deleteAsset(assetId)
    }
  }

  const [isAddingSection, setIsAddingSection] = useState(false)

  const handleAddCustomSection = async () => {
    if (!customSectionName.trim() || isAddingSection) return
    
    setIsAddingSection(true)
    try {
      await addCustomChecklistItem(customSectionName.trim())
      setCustomSectionName('')
      setShowAddSectionDialog(false)
    } catch (error) {
      console.error('Failed to add custom section:', error)
    } finally {
      setIsAddingSection(false)
    }
  }

  const handleDeleteSection = async (item: DrawingChecklistItem) => {
    // Check if section has files
    if (item.assets.length > 0 || (item.dropboxFiles && item.dropboxFiles.length > 0)) {
      toast.error('Cannot delete section with files. Please remove all files first.')
      return
    }

    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return
    
    try {
      await deleteChecklistItem(item.id)
    } catch (error) {
      console.error('Failed to delete section:', error)
    }
  }

  const handleDropboxFileSelected = async (file: any) => {
    if (!showDropboxDialog) return
    
    try {
      // Convert single file selection to array format expected by linkDropboxFiles
      const files = [{
        path: file.path,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        id: file.id
      }]
      
      await linkDropboxFiles(showDropboxDialog, files)
      // Don't close dialog immediately - let user select more files if they want
    } catch (error) {
      console.error('Failed to link Dropbox file:', error)
    }
  }

  const handleUnlinkDropboxFile = async (checklistItemId: string, dropboxPath: string) => {
    if (!window.confirm('Are you sure you want to unlink this file?')) return
    
    setUnlinkingFile(dropboxPath)
    try {
      await unlinkDropboxFile(checklistItemId, dropboxPath)
    } catch (error) {
      console.error('Failed to unlink file:', error)
    } finally {
      setUnlinkingFile(null)
    }
  }

  // Ensure this component only renders for DRAWINGS stages
  if (stage.type !== 'DRAWINGS') {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-500 mb-2">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-semibold">Invalid Stage Type</h3>
        </div>
        <p className="text-gray-600">Drawings Workspace can only be used for Drawings stages.</p>
        <p className="text-sm text-gray-500 mt-1">Current stage type: {stage.type}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading drawings workspace...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-500 mb-2">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-semibold">Error Loading Workspace</h3>
        </div>
        <p className="text-gray-600 mb-4">Failed to load the drawings workspace. Please try refreshing the page.</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Refresh Page
        </Button>
      </div>
    )
  }

  if (!data) return null

  const progress = getProgressPercentage()

  const isNotApplicable = stage.status === 'NOT_APPLICABLE'
  
  return (
    <div className={`border border-gray-200 rounded-lg ${
      isNotApplicable 
        ? 'bg-gray-100 border-gray-300 opacity-75' 
        : 'bg-white'
    }`}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <PencilRuler className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Drawings Workspace</h2>
              <p className="text-gray-600">{room.name || room.type} - {project.name}</p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
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
                <Badge 
                  className={`${
                    stage.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    stage.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {stage.status === 'NOT_STARTED' ? 'Not Started' :
                   stage.status === 'IN_PROGRESS' ? 'In Progress' :
                   stage.status === 'COMPLETED' ? 'Completed' : stage.status}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => setShowActivity(!showActivity)}
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </Button>
            <Button 
              onClick={() => setShowActivity(!showActivity)}
              variant="outline"
              size="sm"
              className="sm:hidden"
              aria-label="Toggle activity log"
            >
              <Activity className="w-4 h-4" />
            </Button>
            <Button 
              onClick={completeStage}
              disabled={!canComplete() || completing}
              className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300"
              size="sm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{completing ? 'Completing...' : 'Complete Workspace'}</span>
              <span className="sm:hidden">{completing ? 'Completing...' : 'Complete'}</span>
            </Button>
            <PhaseSettingsMenu 
              stageId={stage.id}
              stageName="Drawings"
              isNotApplicable={isNotApplicable}
              onReset={() => window.location.reload()}
              onMarkNotApplicable={() => window.location.reload()}
              onMarkApplicable={() => window.location.reload()}
            />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">{progress}% complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div 
            className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Main Content with Sidebar Layout */}
      <div className="flex">
        {/* Main Workspace */}
        <div className="flex-1 p-4 sm:p-6">
        {/* Drawings Content */}
        
        {/* CAD Files Section */}
        <div className="border border-gray-200 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">CAD Files from Dropbox</h3>
              <p className="text-sm text-gray-500">
                Link CAD files from Dropbox for this room's drawings
              </p>
            </div>
          </div>
          
          <DropboxFileBrowser 
            roomId={room.id}
            projectId={project.id}
            sectionType="DRAWINGS"
            sectionName={`${room.name || room.type} - Drawings`}
          />
        </div>
        
        {/* Checklist Items */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Drawing Categories</h3>
            <Button
              onClick={() => setShowAddSectionDialog(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Section
            </Button>
          </div>

          {data.checklistItems.map((item: DrawingChecklistItem) => (
            <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Checklist Item Header */}
              <div className="p-4 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleChecklistItem(item.id, !item.completed)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      item.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-green-500'
                    }`}
                  >
                    {item.completed && <CheckCircle className="w-4 h-4" />}
                  </button>
                  
                  <div>
                    <h4 className={`font-medium ${
                      item.completed ? 'text-green-800 line-through' : 'text-gray-900'
                    }`}>
                      {item.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {item.assets.length} file{item.assets.length !== 1 ? 's' : ''}
                      {item.completedAt && (
                        <span className="ml-2">• Completed {formatDate(item.completedAt)}</span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDropboxDialog(item.id)}
                    disabled={linking}
                  >
                    <HardDrive className="w-4 h-4 mr-2" />
                    {linking ? 'Linking...' : 'Link from Dropbox'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRefs.current[item.id]?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Files'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSection(item)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={(el) => {
                  fileInputRefs.current[item.id] = el
                }}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.dwg"
                onChange={(e) => handleFileSelect(item.id, e.target.files)}
                className="hidden"
              />

              {/* Upload Drop Zone */}
              <div 
                className={`m-4 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                  draggedOver === item.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-300 hover:border-orange-400 hover:bg-gray-50'
                }`}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item.id)}
                onClick={() => fileInputRefs.current[item.id]?.click()}
                role="button"
                tabIndex={0}
                aria-label={`Upload files for ${item.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRefs.current[item.id]?.click()
                  }
                }}
              >
                <Upload className={`w-8 h-8 mx-auto mb-2 ${
                  draggedOver === item.id ? 'text-orange-500' : 'text-gray-400'
                }`} />
                <p className="text-sm font-medium text-gray-600">
                  {draggedOver === item.id ? 'Drop files here' : 'Drop files here or click to upload'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, JPG, PNG, WebP, DWG files - Max 10MB each
                </p>
              </div>

              {/* Linked Dropbox Files */}
              {item.dropboxFiles && item.dropboxFiles.length > 0 && (
                <div className="p-4 bg-blue-50 border-t border-blue-100">
                  <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                    <Link2 className="w-4 h-4 mr-2" />
                    Linked from Dropbox ({item.dropboxFiles.length})
                  </h5>
                  <div className="space-y-2">
                    {item.dropboxFiles.map((file: DropboxFileLink) => (
                      <div key={file.id} className="bg-white border border-blue-200 rounded-lg p-3 flex items-center justify-between hover:border-blue-300 transition-colors">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                            <HardDrive className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate" title={file.fileName}>
                              {file.fileName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {file.fileSize ? formatFileSize(file.fileSize) : ''}
                              {file.lastModified && ` • ${formatDate(file.lastModified.toString())}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <a
                            href={`https://www.dropbox.com/home${file.dropboxPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                            title="View in Dropbox"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleUnlinkDropboxFile(item.id, file.dropboxPath)}
                            disabled={unlinkingFile === file.dropboxPath}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                            title="Unlink file"
                          >
                            {unlinkingFile === file.dropboxPath ? (
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Grid */}
              {item.assets.length > 0 && (
                <div className="p-4 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {item.assets.map((asset: DrawingAsset) => (
                      <div key={asset.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* File Preview */}
                        <div 
                          className="aspect-video bg-gray-100 relative cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={() => setPreviewAsset(asset)}
                        >
                          {asset.type === 'IMAGE' ? (
                            <img
                              src={asset.url}
                              alt={asset.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {getFileTypeIcon(asset)}
                              <span className="ml-2 text-sm font-medium text-gray-600">
                                {asset.filename?.split('.').pop()?.toUpperCase()}
                              </span>
                            </div>
                          )}
                          
                          {/* Preview overlay */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <Eye className="w-6 h-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        
                        {/* File Info */}
                        <div className="p-3">
                          <h6 className="font-medium text-gray-900 truncate" title={asset.title}>
                            {asset.title}
                          </h6>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatFileSize(asset.size)} • {formatDate(asset.createdAt)}
                          </p>
                          <p className="text-xs text-gray-500">by {asset.uploadedByUser?.name || 'Unknown'}</p>
                          
                          {/* Description */}
                          <div className="mt-2">
                            {editingDescriptions.has(asset.id) ? (
                              <Textarea
                                placeholder="Add description..."
                                defaultValue={asset.description || ''}
                                className="text-sm min-h-[60px]"
                                rows={2}
                                onBlur={(e) => handleDescriptionSave(asset.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.ctrlKey) {
                                    e.currentTarget.blur()
                                  }
                                }}
                                autoFocus
                              />
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
                          
                          {/* Actions */}
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setEditingDescriptions(prev => new Set([...prev, asset.id]))
                                }}
                                className="text-gray-400 hover:text-gray-600"
                                title="Edit description"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <a
                                href={asset.url}
                                download={asset.filename || asset.title}
                                className="text-gray-400 hover:text-gray-600"
                                title="Download"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                              <button
                                onClick={() => handleDeleteAsset(asset.id)}
                                className="text-gray-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Activity Log */}
        {showActivity && (
          <div className="mt-8 border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActivity(false)}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {data.activity.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No activity yet</p>
              ) : (
                data.activity.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        {log.actor && (
                          <span className="text-sm font-medium text-gray-900">{log.actor.name}</span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {log.action === 'UPLOAD_DRAWING' && log.details?.fileName && (
                          <>uploaded <strong>{log.details.fileName}</strong> to {log.details?.checklistItem}</>
                        )}
                        {log.action === 'TOGGLE_CHECKLIST_ITEM' && (
                          <>{log.details?.action === 'marked_complete' ? 'completed' : 'reopened'} <strong>{log.details?.checklistItemName}</strong></>
                        )}
                        {log.action === 'COMPLETE_DRAWINGS_STAGE' && (
                          <>completed the drawings stage with {log.details?.completedItems} items and {log.details?.totalFiles} files</>
                        )}
                        {!['UPLOAD_DRAWING', 'TOGGLE_CHECKLIST_ITEM', 'COMPLETE_DRAWINGS_STAGE'].includes(log.action) && log.action}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        </div>

        {/* Chat Sidebar */}
        <div className="w-96 border-l border-gray-200 bg-gray-50">
          <PhaseChat
            stageId={stage.id}
            stageName={`Drawings - ${room.name || room.type}`}
            className="h-full"
          />
        </div>
      </div>

      {/* File Preview Modal */}
      {previewAsset && (
        <FilePreviewModal
          file={{
            ...previewAsset,
            originalName: previewAsset.filename || previewAsset.title,
            uploadedAt: previewAsset.createdAt,
            uploadedBy: previewAsset.uploader,
            size: previewAsset.size || 0
          }}
          isOpen={!!previewAsset}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      {/* Add Custom Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Drawing Section</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label htmlFor="section-name" className="block text-sm font-medium text-gray-700 mb-2">
              Section Name
            </label>
            <Input
              id="section-name"
              type="text"
              placeholder="e.g., Custom Details, Specifications, etc."
              value={customSectionName}
              onChange={(e) => setCustomSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customSectionName.trim()) {
                  handleAddCustomSection()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSectionDialog(false)
                setCustomSectionName('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomSection}
              disabled={!customSectionName.trim() || isAddingSection}
            >
              {isAddingSection ? 'Adding...' : 'Add Section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dropbox File Browser Dialog */}
      <Dialog 
        open={showDropboxDialog !== null} 
        onOpenChange={(open) => !open && setShowDropboxDialog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Link Files from Dropbox - {data?.checklistItems.find(item => item.id === showDropboxDialog)?.name}
            </DialogTitle>
          </DialogHeader>
          
          {showDropboxDialog && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Click on files to link them to this section. You can select multiple files.
              </p>
              <DropboxFileBrowser
                roomId={null}
                projectId={project.id}
                sectionType="DRAWINGS"
                sectionName={data?.checklistItems.find(item => item.id === showDropboxDialog)?.name || 'Drawing Section'}
                onFileSelected={handleDropboxFileSelected}
                mode="select"
                variant="settings"
                allowMultiple={true}
              />
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setShowDropboxDialog(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
