'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus,
  ExternalLink,
  Heart,
  Download,
  Eye,
  Tag,
  X,
  Upload,
  Link,
  Image as ImageIcon,
  Search,
  Filter,
  Grid,
  MoreVertical,
  Trash2,
  Edit,
  Share,
  Copy
} from 'lucide-react'
import { toast } from 'sonner'
import { UploadZone } from './UploadZone'

// Types
interface Asset {
  id: string
  title: string
  url: string
  type: 'image' | 'link' | 'pdf' | 'other'
  userDescription?: string
  createdAt: string
  tags?: Array<{
    id: string
    name: string
    color: string
  }>
  section: {
    id: string
    type: string
  }
  thumbnail?: string
  likes?: number
  downloads?: number
  isLiked?: boolean
}

interface DesignSection {
  id: string
  type: 'GENERAL' | 'WALL_COVERING' | 'CEILING' | 'FLOOR'
  assets: Asset[]
}

interface ReferenceBoardProps {
  sections: DesignSection[]
  onUpdate: () => void
  stageId: string
  onAddImage?: () => void
}

// Section type configuration
const SECTION_CONFIG = {
  GENERAL: {
    name: 'General',
    icon: '✨',
    color: 'from-[#a657f0] to-[#a657f0]',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  WALL_COVERING: {
    name: 'Wall Covering',
    icon: '🎨',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  CEILING: {
    name: 'Ceiling',
    icon: '⬆️',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  FLOOR: {
    name: 'Floor',
    icon: '⬇️',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200'
  }
}

export function ReferenceBoard({ sections, onUpdate, stageId, onAddImage }: ReferenceBoardProps) {
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [uploadSection, setUploadSection] = useState<string>('GENERAL')

  // Flatten all assets from all sections
  const allAssets = sections.reduce<Asset[]>((acc, section) => {
    return [...acc, ...section.assets.map(asset => ({ ...asset, section }))]
  }, [])

  // Filter assets based on selected section and search term
  const filteredAssets = allAssets.filter(asset => {
    const matchesSection = selectedSection === 'all' || asset.section.type === selectedSection
    const matchesSearch = !searchTerm || 
      asset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.userDescription?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSection && matchesSearch
  })

  // Handle asset interactions
  const handleLikeAsset = async (assetId: string) => {
    try {
      const response = await fetch('/api/design/assets/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      })

      if (response.ok) {
        onUpdate()
        toast.success('Added to favorites')
      }
    } catch (error) {
      toast.error('Failed to like asset')
    }
  }

  const handleDownloadAsset = async (asset: Asset) => {
    try {
      // Create a temporary link for download
      const a = document.createElement('a')
      a.href = asset.url
      a.download = asset.title
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Track download
      await fetch('/api/design/assets/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id })
      })

      onUpdate()
    } catch (error) {
      toast.error('Failed to download asset')
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this reference?')) return

    try {
      const response = await fetch(`/api/design/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onUpdate()
        toast.success('Reference deleted')
      }
    } catch (error) {
      toast.error('Failed to delete reference')
    }
  }

  const handleCopyLink = (asset: Asset) => {
    navigator.clipboard.writeText(asset.url)
    toast.success('Link copied to clipboard')
  }
  
  // Handle upload completion
  const handleUploadComplete = (asset: any) => {
    onUpdate() // Refresh the reference board
    toast.success('Reference uploaded successfully!')
  }
  
  const handleUploadError = (error: string) => {
    toast.error(error)
  }
  
  // Get or create design section
  const getOrCreateSectionId = async (sectionType: string): Promise<string> => {
    // First try to find existing section
    const existingSection = sections.find(s => s.type === sectionType)
    if (existingSection?.id) {
      return existingSection.id
    }
    
    // If no section exists, create one via API
    try {
      const response = await fetch('/api/design/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stageId,
          type: sectionType
        })
      })
      
      const result = await response.json()
      if (result.success) {
        return result.section.id
      } else {
        throw new Error(result.error || 'Failed to create section')
      }
    } catch (error) {
      console.error('Error creating section:', error)
      // Fallback to a default section ID format (this would need to be handled properly)
      return `${stageId}-${sectionType}`
    }
  }

  // Asset Card Component
  const AssetCard = ({ asset }: { asset: Asset }) => {
    const [isHovered, setIsHovered] = useState(false)
    const [showActions, setShowActions] = useState(false)
    const sectionConfig = SECTION_CONFIG[asset.section.type as keyof typeof SECTION_CONFIG]

    return (
      <div
        className={`group relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer break-inside-avoid mb-4 ${
          viewMode === 'masonry' ? 'break-inside-avoid' : 'aspect-square'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setSelectedAsset(asset)}
      >
        {/* Asset Preview */}
        <div className={`relative ${viewMode === 'masonry' ? 'aspect-auto' : 'aspect-square'}`}>
          {asset.type === 'image' ? (
            <img
              src={asset.thumbnail || asset.url}
              alt={asset.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : asset.type === 'link' ? (
            <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <div className="text-center">
                <ExternalLink className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600 truncate px-2">{asset.title}</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-blue-400" />
            </div>
          )}

          {/* Hover Overlay */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-200">
              <div className="absolute top-2 right-2 flex space-x-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-8 h-8 p-0 bg-white/90 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleLikeAsset(asset.id)
                  }}
                >
                  <Heart className={`w-4 h-4 ${asset.isLiked ? 'text-red-500 fill-current' : 'text-gray-600'}`} />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-8 h-8 p-0 bg-white/90 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownloadAsset(asset)
                  }}
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-8 h-8 p-0 bg-white/90 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowActions(!showActions)
                  }}
                >
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </Button>
              </div>

              {/* Actions Menu */}
              {showActions && (
                <div className="absolute top-10 right-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyLink(asset)
                      setShowActions(false)
                    }}
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Edit functionality
                      setShowActions(false)
                    }}
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAsset(asset.id)
                      setShowActions(false)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              )}

              {/* Quick Preview Button */}
              <div className="absolute bottom-2 left-2 right-2">
                <Button
                  size="sm"
                  className="w-full bg-white/90 hover:bg-white text-gray-800 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedAsset(asset)
                  }}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Quick View
                </Button>
              </div>
            </div>
          )}

          {/* Section Badge */}
          <div className="absolute top-2 left-2">
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${sectionConfig.bgColor} ${sectionConfig.borderColor} border`}>
              <span className="mr-1">{sectionConfig.icon}</span>
              {sectionConfig.name}
            </div>
          </div>

          {/* External Link Indicator */}
          {asset.type === 'link' && (
            <div className="absolute bottom-2 right-2">
              <ExternalLink className="w-4 h-4 text-white drop-shadow-sm" />
            </div>
          )}
        </div>

        {/* Asset Info */}
        <div className="p-3">
          <h3 className="font-medium text-gray-900 truncate mb-1">{asset.title}</h3>
          {asset.userDescription && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">{asset.userDescription}</p>
          )}

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {asset.tags.slice(0, 3).map(tag => (
                <span
                  key={tag.id}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white`}
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {asset.tags.length > 3 && (
                <span className="text-xs text-gray-500">+{asset.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              {asset.likes && (
                <span className="flex items-center space-x-1">
                  <Heart className="w-3 h-3" />
                  <span>{asset.likes}</span>
                </span>
              )}
              {asset.downloads && (
                <span className="flex items-center space-x-1">
                  <Download className="w-3 h-3" />
                  <span>{asset.downloads}</span>
                </span>
              )}
            </div>
            <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search references..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Section Filter */}
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          >
            <option value="all">All Sections</option>
            {Object.entries(SECTION_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.icon} {config.name}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')}
          >
            <Grid className="w-4 h-4 mr-1" />
            {viewMode === 'grid' ? 'Masonry' : 'Grid'}
          </Button>

          {/* Add Reference Button */}
          <Button
            onClick={() => onAddImage ? onAddImage() : setShowUploadModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Reference
          </Button>
        </div>
      </div>

      {/* Assets Grid */}
      {filteredAssets.length > 0 ? (
        <div className={`${
          viewMode === 'masonry' 
            ? 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4' 
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
        }`}>
          {filteredAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No references found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'Try adjusting your search or filters.' : 'Start building your reference board by adding images and links.'}
          </p>
          <Button
            onClick={() => onAddImage ? onAddImage() : setShowUploadModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add First Reference
          </Button>
        </div>
      )}

      {/* Asset Preview Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{selectedAsset.title}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAsset(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Asset Content */}
              <div className="space-y-4">
                {selectedAsset.type === 'image' ? (
                  <img
                    src={selectedAsset.url}
                    alt={selectedAsset.title}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : (
                  <div className="p-6 bg-gray-50 rounded-lg text-center">
                    <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 mb-4">{selectedAsset.userDescription}</p>
                    <Button
                      onClick={() => window.open(selectedAsset.url, '_blank')}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Open Link
                    </Button>
                  </div>
                )}

                {selectedAsset.userDescription && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-700">{selectedAsset.userDescription}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Reference</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Section Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Design Section
              </label>
              <select
                value={uploadSection}
                onChange={(e) => setUploadSection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {Object.entries(SECTION_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Upload Zone */}
            <UploadZone
              sectionId={""} // Will be resolved dynamically
              stageId={stageId}
              sectionType={uploadSection}
              onResolveSectionId={getOrCreateSectionId}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              maxFiles={5}
              className="mb-4"
            />
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
