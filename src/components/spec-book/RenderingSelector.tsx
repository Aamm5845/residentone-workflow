'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Check, X, ExternalLink, Loader2, AlertCircle, ImageIcon, Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface RenderingSelectorProps {
  roomId: string
  projectId: string
  onChange?: (selectedUrls: string[]) => void
  allowManualUpload?: boolean
}

interface ApprovedAsset {
  id: string
  url: string
  filename: string
  mimeType?: string
  fileSize: number
  source: 'APPROVED' | 'MANUAL'
}

interface RenderingData {
  success: boolean
  roomId: string
  source: 'APPROVED' | 'MANUAL' | 'NONE'
  approved?: {
    versionId: string
    version: string
    clientDecidedAt?: string
    assets: ApprovedAsset[]
  }
  renderings?: ApprovedAsset[]
}

export function RenderingSelector({ 
  roomId, 
  projectId,
  onChange,
  allowManualUpload = false 
}: RenderingSelectorProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RenderingData | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previousUrlsRef = useRef<string>('')

  // Fetch approved renderings
  useEffect(() => {
    loadRenderings()
  }, [roomId])

  // Notify parent of selection changes
  useEffect(() => {
    if (data && onChange) {
      const assets = data.approved?.assets || data.renderings || []
      const selectedUrls = assets
        .filter(asset => selectedAssets.has(asset.id))
        .map(asset => asset.url)
      
      // Only call onChange if URLs actually changed
      const currentUrlsString = JSON.stringify(selectedUrls.sort())
      if (currentUrlsString !== previousUrlsRef.current) {
        previousUrlsRef.current = currentUrlsString
        onChange(selectedUrls)
      }
    }
    // Intentionally omitting onChange from deps to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssets, data])

  const loadRenderings = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/spec-books/room-renderings?roomId=${roomId}`)
      const result = await response.json()
      
      if (result.success) {
        setData(result)
        
        // Pre-select all approved assets by default
        if (result.approved?.assets) {
          const assetIds = new Set(result.approved.assets.map((a: ApprovedAsset) => a.id))
          setSelectedAssets(assetIds)
        } else if (result.renderings) {
          // Pre-select manual renderings too
          const assetIds = new Set(result.renderings.map((r: ApprovedAsset) => r.id))
          setSelectedAssets(assetIds)
        }
      } else {
        setError(result.error || 'Failed to load renderings')
      }
    } catch (err) {
      console.error('Error loading renderings:', err)
      setError('Failed to load renderings')
    } finally {
      setLoading(false)
    }
  }

  const toggleAsset = (assetId: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(assetId)) {
        newSet.delete(assetId)
      } else {
        newSet.add(assetId)
      }
      return newSet
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Upload to blob storage
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'room-rendering')
        formData.append('roomId', roomId)

        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData
        })

        const uploadResult = await uploadResponse.json()

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed')
        }

        // Save the URL to the spec book section
        const saveResponse = await fetch('/api/spec-books/room-renderings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomId,
            imageUrl: uploadResult.url
          })
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save rendering URL')
        }
      }

      // Reload renderings to show the new uploads
      await loadRenderings()
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteRendering = async (assetId: string) => {
    if (!confirm('Remove this rendering image?')) return

    try {
      const response = await fetch('/api/spec-books/room-renderings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renderingId: assetId,
          roomId: roomId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to delete rendering')
      }

      // Reload renderings
      await loadRenderings()
    } catch (error) {
      console.error('Delete error:', error)
      alert(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Rendering Images</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div 
              key={i} 
              className="aspect-square rounded-xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Rendering Images</h4>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error loading renderings</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadRenderings}
                className="mt-3"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const assets = data?.approved?.assets || data?.renderings || []
  const selectedCount = selectedAssets.size
  const isApproved = data?.source === 'APPROVED'

  // Empty state - no approved renderings
  if (data?.source === 'NONE' || assets.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Rendering Images</h4>
        </div>
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
          <h5 className="text-sm font-medium text-gray-900 mb-1">
            No client-approved renderings yet
          </h5>
          <p className="text-sm text-gray-500 mb-4">
            Upload renderings in the 3D Rendering phase, then request client approval.
          </p>
          <Link href={`/projects/${projectId}`}>
            <Button size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Go to 3D Rendering
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-700">Rendering Images</h4>
          {selectedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedCount} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isApproved && data.approved?.clientDecidedAt && (
            <div className="text-xs text-gray-500">
              Approved {formatDate(data.approved.clientDecidedAt)}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleManualUpload}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {/* Info banner */}
      {isApproved && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <p className="text-xs text-emerald-700">
            Using latest client-approved images from 3D Rendering (version {data.approved?.version})
          </p>
        </div>
      )}
      {data?.source === 'MANUAL' && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-xs text-blue-700">
            Using manually uploaded images (overrides approved 3D renderings)
          </p>
        </div>
      )}

      {/* Asset grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {assets.map((asset) => {
          const isSelected = selectedAssets.has(asset.id)
          return (
            <div
              key={asset.id}
              className="group relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer hover:shadow-md"
              style={{
                borderColor: isSelected ? 'rgb(16, 185, 129)' : 'rgb(229, 231, 235)'
              }}
              onClick={() => toggleAsset(asset.id)}
            >
              {/* Image */}
              <img
                src={asset.url}
                alt={asset.filename}
                className="w-full h-full object-cover"
              />
              
              {/* Selection overlay */}
              <div 
                className={`absolute inset-0 transition-opacity ${
                  isSelected 
                    ? 'bg-emerald-500/20' 
                    : 'bg-black/0 group-hover:bg-black/10'
                }`}
              />
              
              {/* Check icon */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              
              {/* Delete button for manual uploads */}
              {asset.source === 'MANUAL' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteRendering(asset.id)
                  }}
                  className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove this image"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
              
              {/* Badge */}
              <div className="absolute top-2 left-2">
                <Badge 
                  className={
                    asset.source === 'APPROVED'
                      ? 'bg-emerald-500 text-white text-xs'
                      : 'bg-blue-500 text-white text-xs'
                  }
                >
                  {asset.source === 'APPROVED' ? 'Client Approved' : 'Manual'}
                </Badge>
              </div>
              
              {/* Hover actions */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white font-medium truncate">
                  {asset.filename}
                </p>
                <p className="text-xs text-white/80">
                  {formatFileSize(asset.fileSize)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA and help text */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-gray-500">
          {isApproved ? (
            <span>Images from approved 3D renderings. Click Upload to use different images.</span>
          ) : data?.source === 'MANUAL' ? (
            <span>Using manually uploaded images. These override approved 3D renderings.</span>
          ) : (
            <Link 
              href={`/projects/${projectId}`}
              className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Manage renderings in 3D Rendering phase
            </Link>
          )}
        </div>
        
        {selectedCount === 0 && (
          <p className="text-xs text-amber-600">
            ⚠ No images selected for this room
          </p>
        )}
      </div>

      {/* Image viewer modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-5xl max-h-full">
            <img
              src={viewingImage}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setViewingImage(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
