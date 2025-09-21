'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Tag, 
  Plus, 
  X, 
  Check, 
  Loader2, 
  Search,
  Palette
} from 'lucide-react'
import { toast } from 'sonner'

interface TagOption {
  id: string
  name: string
  type: 'MUST_HAVE' | 'OPTIONAL' | 'EXPLORE' | 'CUSTOM'
  color: string
  description?: string
  usageCount?: number
}

interface TagSelectorProps {
  targetId: string
  targetType: 'asset' | 'comment'
  selectedTags: TagOption[]
  onTagsChange: (tags: TagOption[]) => void
  className?: string
}

// Color preset options for custom tags
const COLOR_PRESETS = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#EAB308'  // Yellow
]

// Default tag configurations
const DEFAULT_TAG_CONFIGS = {
  MUST_HAVE: {
    name: 'Must Have',
    color: '#EF4444',
    description: 'Essential items that must be included'
  },
  OPTIONAL: {
    name: 'Optional', 
    color: '#F59E0B',
    description: 'Nice-to-have items to consider'
  },
  EXPLORE: {
    name: 'Explore',
    color: '#10B981',
    description: 'Ideas to explore and develop further'
  }
}

export function TagSelector({ 
  targetId, 
  targetType, 
  selectedTags, 
  onTagsChange, 
  className = '' 
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableTags, setAvailableTags] = useState<TagOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(COLOR_PRESETS[0])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load available tags
  useEffect(() => {
    if (isOpen) {
      loadAvailableTags()
    }
  }, [isOpen])

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsCreatingTag(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const loadAvailableTags = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/tags')
      const result = await response.json()
      
      if (result.success) {
        setAvailableTags(result.tags)
      } else {
        throw new Error('Failed to load tags')
      }
    } catch (error) {
      toast.error('Failed to load tags')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTag = async (tag: TagOption) => {
    const isSelected = selectedTags.some(t => t.id === tag.id)
    
    try {
      const response = await fetch('/api/design/tags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagId: tag.id,
          targetType,
          targetId,
          action: isSelected ? 'remove' : 'add'
        })
      })

      if (response.ok) {
        const updatedTags = isSelected 
          ? selectedTags.filter(t => t.id !== tag.id)
          : [...selectedTags, tag]
        
        onTagsChange(updatedTags)
        toast.success(isSelected ? 'Tag removed' : 'Tag added')
      } else {
        throw new Error('Failed to toggle tag')
      }
    } catch (error) {
      toast.error('Failed to toggle tag')
    }
  }

  const createCustomTag = async () => {
    if (!newTagName.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/design/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
          description: `Custom tag: ${newTagName.trim()}`
        })
      })

      const result = await response.json()

      if (result.success) {
        const newTag = result.tag
        
        // Add to available tags
        setAvailableTags(prev => [...prev, newTag])
        
        // Automatically apply to current target
        await toggleTag(newTag)
        
        // Reset form
        setNewTagName('')
        setNewTagColor(COLOR_PRESETS[0])
        setIsCreatingTag(false)
        
        toast.success('Custom tag created and applied')
      } else {
        throw new Error(result.error || 'Failed to create tag')
      }
    } catch (error) {
      toast.error('Failed to create custom tag')
    } finally {
      setIsLoading(false)
    }
  }

  // Filter tags based on search
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group tags by type
  const groupedTags = {
    default: filteredTags.filter(t => ['MUST_HAVE', 'OPTIONAL', 'EXPLORE'].includes(t.type)),
    custom: filteredTags.filter(t => t.type === 'CUSTOM')
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Tag Display & Trigger */}
      <div className="flex flex-wrap gap-2 items-center">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              border: `1px solid ${tag.color}40`
            }}
            onClick={() => toggleTag(tag)}
            title={`Click to remove • ${tag.description || ''}`}
          >
            {tag.name}
            <X className="w-3 h-3 ml-1" />
          </span>
        ))}
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs h-6 px-2"
        >
          <Tag className="w-3 h-3 mr-1" />
          Add Tag
        </Button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreatingTag(!isCreatingTag)}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                New
              </Button>
            </div>
          </div>

          {/* Create New Tag */}
          {isCreatingTag && (
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="space-y-3">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name..."
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                <div className="flex items-center space-x-2">
                  <Palette className="w-4 h-4 text-gray-500" />
                  <div className="flex flex-wrap gap-1">
                    {COLOR_PRESETS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={`w-5 h-5 rounded border-2 transition-all ${
                          newTagColor === color ? 'border-gray-700' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => {
                      setIsCreatingTag(false)
                      setNewTagName('')
                      setNewTagColor(COLOR_PRESETS[0])
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <Button
                    size="sm"
                    onClick={createCustomTag}
                    disabled={!newTagName.trim() || isLoading}
                    className="text-xs h-6"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Create'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tags List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                <span className="ml-2 text-sm text-gray-600">Loading tags...</span>
              </div>
            ) : (
              <>
                {/* Default Tags */}
                {groupedTags.default.length > 0 && (
                  <div className="p-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Preset Tags
                    </h4>
                    <div className="space-y-1">
                      {groupedTags.default.map(tag => {
                        const isSelected = selectedTags.some(t => t.id === tag.id)
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag)}
                            className="w-full flex items-center justify-between p-2 text-left rounded hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="text-sm font-medium">{tag.name}</span>
                              {tag.description && (
                                <span className="text-xs text-gray-500">{tag.description}</span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Tags */}
                {groupedTags.custom.length > 0 && (
                  <div className="p-3 border-t border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Custom Tags
                    </h4>
                    <div className="space-y-1">
                      {groupedTags.custom.map(tag => {
                        const isSelected = selectedTags.some(t => t.id === tag.id)
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag)}
                            className="w-full flex items-center justify-between p-2 text-left rounded hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="text-sm font-medium">{tag.name}</span>
                              {tag.usageCount && tag.usageCount > 0 && (
                                <span className="text-xs text-gray-400">
                                  ({tag.usageCount} uses)
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* No tags found */}
                {filteredTags.length === 0 && searchQuery && (
                  <div className="p-8 text-center">
                    <Tag className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No tags found for "{searchQuery}"</p>
                    <p className="text-xs text-gray-500 mt-1">Try creating a custom tag</p>
                  </div>
                )}

                {/* Empty state */}
                {availableTags.length === 0 && !searchQuery && !isLoading && (
                  <div className="p-8 text-center">
                    <Tag className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No tags available</p>
                    <p className="text-xs text-gray-500 mt-1">Create your first custom tag</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
