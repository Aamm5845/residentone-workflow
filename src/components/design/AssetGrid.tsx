'use client'

import React, { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Eye, 
  Download, 
  Edit3, 
  Trash2, 
  Pin, 
  PinOff,
  FileText,
  Image as ImageIcon,
  Save,
  X,
  ExternalLink,
  Calendar,
  User
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface Asset {
  id: string
  title: string
  filename?: string
  url: string
  type: 'IMAGE' | 'PDF' | 'DOCUMENT'
  size?: number
  mimeType?: string
  userDescription?: string
  createdAt: string
  uploadedBy: {
    id: string
    name: string
    email: string
  }
  tags: Array<{
    id: string
    name: string
    type: string
    color: string
    taggedBy: {
      id: string
      name: string
    }
  }>
  isPinned: boolean
  pinnedBy?: {
    id: string
    name: string
  }
}

interface AssetGridProps {
  assets: Asset[]
  onAssetUpdate: () => void
  onAssetDelete: (assetId: string) => void
  onPinToggle: (assetId: string, isPinned: boolean) => void
  onDescriptionUpdate: (assetId: string, description: string) => void
  showPinnedFirst?: boolean
  className?: string
}

interface FileCardProps {
  asset: Asset
  onUpdate: () => void
  onDelete: (assetId: string) => void
  onPinToggle: (assetId: string, isPinned: boolean) => void
  onDescriptionUpdate: (assetId: string, description: string) => void
}

// FileCard component
const FileCard = memo(({ 
  asset, 
  onUpdate, 
  onDelete, 
  onPinToggle, 
  onDescriptionUpdate 
}: FileCardProps) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [description, setDescription] = useState(asset.userDescription || '')
  const [isUpdatingDescription, setIsUpdatingDescription] = useState(false)
  const [isPinning, setIsPinning] = useState(false)

  // Handle description save
  const saveDescription = async () => {
    if (description.trim() === (asset.userDescription || '')) {
      setIsEditingDescription(false)
      return
    }

    setIsUpdatingDescription(true)
    try {
      const response = await fetch(`/api/assets/${asset.id}/description`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: description.trim()
        })
      })

      if (response.ok) {
        onDescriptionUpdate(asset.id, description.trim())
        setIsEditingDescription(false)
        toast.success('Description updated')
      } else {
        throw new Error('Failed to update description')
      }
    } catch (error) {
      toast.error('Failed to update description')
      setDescription(asset.userDescription || '') // Reset
    } finally {
      setIsUpdatingDescription(false)
    }
  }

  // Handle pin toggle
  const handlePinToggle = async () => {
    setIsPinning(true)
    try {
      const response = await fetch('/api/design/pins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetType: 'asset',
          targetId: asset.id,
          action: asset.isPinned ? 'unpin' : 'pin'
        })
      })

      if (response.ok) {
        onPinToggle(asset.id, !asset.isPinned)
        toast.success(asset.isPinned ? 'Unpinned file' : 'Pinned file')
      } else {
        throw new Error('Failed to toggle pin')
      }
    } catch (error) {
      toast.error('Failed to toggle pin')
    } finally {
      setIsPinning(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${asset.title}"?`)) return

    try {
      const response = await fetch(`/api/design/upload?assetId=${asset.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onDelete(asset.id)
        toast.success('File deleted')
      } else {
        throw new Error('Failed to delete file')
      }
    } catch (error) {
      toast.error('Failed to delete file')
    }
  }

  // Get file icon
  const getFileIcon = () => {
    switch (asset.type) {
      case 'IMAGE':
        return <ImageIcon className="w-5 h-5 text-blue-600" />
      case 'PDF':
        return <FileText className="w-5 h-5 text-red-600" />
      default:
        return <FileText className="w-5 h-5 text-gray-600" />
    }
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className={`relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 ${
      asset.isPinned ? 'ring-2 ring-amber-200 border-amber-300' : ''
    }`}>
      {/* Pin indicator */}
      {asset.isPinned && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium flex items-center">
            <Pin className="w-3 h-3 mr-1" />
            Pinned
          </div>
        </div>
      )}

      {/* File preview/thumbnail */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center relative overflow-hidden">
        {asset.type === 'IMAGE' ? (
          <img
            src={`/api/assets/${asset.id}/view`}
            alt={asset.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center space-y-2">
            {getFileIcon()}
            <span className="text-xs font-medium text-gray-600 uppercase">
              {asset.type}
            </span>
          </div>
        )}

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white bg-opacity-90 hover:bg-opacity-100"
              onClick={() => window.open(`/api/assets/${asset.id}/view`, '_blank')}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white bg-opacity-90 hover:bg-opacity-100"
              onClick={() => {
                const link = document.createElement('a')
                link.href = `/api/assets/${asset.id}/view`
                link.download = asset.filename || asset.title
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* File info */}
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate" title={asset.title}>
              {asset.title}
            </h4>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs text-gray-500">
                {formatFileSize(asset.size)}
              </span>
              {asset.size && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={handlePinToggle}
              disabled={isPinning}
              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                asset.isPinned ? 'text-amber-600' : 'text-gray-400'
              }`}
              title={asset.isPinned ? 'Unpin file' : 'Pin file'}
            >
              {asset.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="mb-3">
          {isEditingDescription ? (
            <div className="space-y-2">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for this file..."
                className="w-full text-xs px-2 py-1 border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
                disabled={isUpdatingDescription}
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => {
                    setDescription(asset.userDescription || '')
                    setIsEditingDescription(false)
                  }}
                  className="text-xs text-gray-600 hover:text-gray-800"
                  disabled={isUpdatingDescription}
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  onClick={saveDescription}
                  disabled={isUpdatingDescription}
                  className="text-xs h-6"
                >
                  {isUpdatingDescription ? (
                    <>
                      <Save className="w-3 h-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingDescription(true)}
              className="min-h-[2rem] p-2 bg-gray-50 rounded text-xs text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              {asset.userDescription ? (
                <p>{asset.userDescription}</p>
              ) : (
                <p className="text-gray-500 italic">Click to add description...</p>
              )}
            </div>
          )}
        </div>

        {/* Tags */}
        {asset.tags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {asset.tags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <User className="w-3 h-3" />
            <span>{asset.uploadedBy.name}</span>
            {asset.isPinned && asset.pinnedBy && (
              <>
                <span>•</span>
                <Pin className="w-3 h-3" />
                <span>Pinned by {asset.pinnedBy.name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

FileCard.displayName = 'FileCard'

// Main AssetGrid component
export function AssetGrid({ 
  assets, 
  onAssetUpdate, 
  onAssetDelete, 
  onPinToggle, 
  onDescriptionUpdate,
  showPinnedFirst = true,
  className = ''
}: AssetGridProps) {
  // Sort assets: pinned first, then by creation date
  const sortedAssets = [...assets].sort((a, b) => {
    if (showPinnedFirst) {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  if (assets.length === 0) {
    return (
      <div className={`text-center py-8 px-4 bg-gray-50 rounded-lg ${className}`}>
        <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600 font-medium">No files uploaded yet</p>
        <p className="text-sm text-gray-500">Upload images or PDFs to get started</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedAssets.map(asset => (
          <FileCard
            key={asset.id}
            asset={asset}
            onUpdate={onAssetUpdate}
            onDelete={onAssetDelete}
            onPinToggle={onPinToggle}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        ))}
      </div>
    </div>
  )
}
