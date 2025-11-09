'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

// Common icons for design/interior items
const COMMON_ICONS = [
  'Sofa', 'Armchair', 'Lamp', 'Lightbulb', 'Bed', 'Bath', 'Droplet',
  'Flame', 'Wind', 'Thermometer', 'Clock', 'Mirror', 'Frame', 'Image',
  'Sparkles', 'Flower', 'Trees', 'Leaf', 'Table', 'Chair', 'Dresser',
  'Tv', 'Monitor', 'Tablet', 'Phone', 'Speaker', 'Music', 'Radio',
  'Coffee', 'Wine', 'UtensilsCrossed', 'CookingPot', 'Refrigerator',
  'WashingMachine', 'Microwave', 'Fan', 'AirVent', 'Sun', 'Moon',
  'Star', 'Home', 'Building', 'Door', 'DoorOpen', 'DoorClosed',
  'Window', 'Blinds', 'Fence', 'Pillar', 'Columns', 'Ruler',
  'Pencil', 'PenTool', 'Palette', 'Paintbrush', 'Pipette', 'Hammer',
  'Wrench', 'Settings', 'Package', 'Box', 'Archive', 'FolderOpen',
  'Flower2', 'Heart', 'Gift', 'Trophy', 'Crown', 'Diamond', 'Gem',
  'Circle', 'Square', 'Triangle', 'Hexagon', 'Pentagon', 'Octagon',
  'Shirt', 'Briefcase', 'Backpack', 'ShoppingBag', 'ShoppingCart',
  'Wallpaper', 'Baseline', 'PaintBucket', 'Brush', 'Stamp', 'Sticker'
]

interface Props {
  value: string
  onChange: (iconName: string) => void
  onClose: () => void
}

export default function IconSelector({ value, onChange, onClose }: Props) {
  const [search, setSearch] = useState('')

  // Get all available icons from lucide-react
  const allIconNames = useMemo(() => {
    return Object.keys(LucideIcons).filter(
      name => name !== 'createLucideIcon' && 
              name !== 'default' &&
              typeof (LucideIcons as any)[name] === 'function'
    )
  }, [])

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!search) {
      return COMMON_ICONS.filter(name => allIconNames.includes(name))
    }
    return allIconNames.filter(name =>
      name.toLowerCase().includes(search.toLowerCase())
    )
  }, [search, allIconNames])

  const renderIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName]
    if (!IconComponent) return null
    return <IconComponent className="w-6 h-6" />
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Select Icon</h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search icons... (e.g., sofa, lamp, bed)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {filteredIcons.length} icons • Browse all at{' '}
            <a 
              href="https://lucide.dev/icons" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              lucide.dev
            </a>
          </div>
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredIcons.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No icons found matching "{search}"</p>
              <p className="text-sm mt-2">Try searching for: sofa, lamp, bed, table, etc.</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {filteredIcons.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => {
                    onChange(iconName)
                    onClose()
                  }}
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-lg
                    border-2 transition-all hover:border-indigo-500 hover:bg-indigo-50
                    ${value === iconName 
                      ? 'border-indigo-600 bg-indigo-100' 
                      : 'border-gray-200 bg-white'
                    }
                  `}
                  title={iconName}
                >
                  {renderIcon(iconName)}
                  <span className="text-xs mt-1 truncate w-full text-center text-gray-600">
                    {iconName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {value ? (
                <span className="flex items-center gap-2">
                  Selected: <span className="font-medium">{value}</span>
                  {renderIcon(value)}
                </span>
              ) : (
                'No icon selected'
              )}
            </div>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
