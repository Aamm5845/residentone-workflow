'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Check, X, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface RenderingSelectorProps {
  roomId: string
  projectId: string
  onChange?: (selectedUrls: string[]) => void
}

interface ApprovedAsset {
  id: string
  url: string
  filename: string
  mimeType?: string
  fileSize: number
  source: 'APPROVED'
}

interface RenderingData {
  success: boolean
  roomId: string
  source: 'APPROVED' | 'NONE'
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
  onChange
}: RenderingSelectorProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RenderingData | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [viewingImage, setViewingImage] = useState<string | null>(null)
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading renderings...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span>{error}</span>
        <Button variant="link" size="sm" onClick={loadRenderings} className="p-0 h-auto">
          Retry
        </Button>
      </div>
    )
  }

  const assets = data?.approved?.assets || data?.renderings || []
  const selectedCount = selectedAssets.size
  const isApproved = data?.source === 'APPROVED'

  // Empty state - no approved renderings
  if (data?.source === 'NONE' || assets.length === 0) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">No approved renderings</span>
        <Link href={`/projects/${projectId}`}>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
            <ExternalLink className="w-3 h-3" />
            Go to 3D Rendering
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{assets.length} {assets.length === 1 ? 'rendering' : 'renderings'}</span>
          </div>
          {selectedCount > 0 && selectedCount !== assets.length && (
            <Badge variant="secondary" className="text-xs">
              {selectedCount} selected
            </Badge>
          )}
        </div>
        {isApproved && data.approved?.clientDecidedAt && (
          <div className="text-xs text-gray-500">
            Approved {formatDate(data.approved.clientDecidedAt)}
          </div>
        )}
      </div>

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
              
              {/* Hover info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white font-medium truncate">
                  {asset.filename}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {selectedCount === 0 && (
        <p className="text-xs text-amber-600">
          ⚠ No images selected for this room
        </p>
      )}

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
