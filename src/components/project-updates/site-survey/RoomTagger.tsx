'use client'

import React, { useState } from 'react'
import { Check, Plus, X, Home, Tag, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Preset tags for quick selection
export const TAG_PRESETS = [
  { value: 'pre-work', label: 'Pre-Work', color: 'bg-blue-100 text-blue-700' },
  { value: 'existing-damage', label: 'Existing Damage', color: 'bg-red-100 text-red-700' },
  { value: 'site-conditions', label: 'Site Conditions', color: 'bg-gray-100 text-gray-700' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'issue', label: 'Issue', color: 'bg-orange-100 text-orange-700' },
  { value: 'needs-review', label: 'Needs Review', color: 'bg-purple-100 text-purple-700' },
  { value: 'for-invoice', label: 'For Invoice', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'change-order', label: 'Change Order', color: 'bg-pink-100 text-pink-700' },
  { value: 'before', label: 'Before', color: 'bg-slate-100 text-slate-700' },
  { value: 'after', label: 'After', color: 'bg-emerald-100 text-emerald-700' },
]

// Trade categories for construction work
export const TRADE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'millwork', label: 'Millwork' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'painting', label: 'Painting' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'tile', label: 'Tile' },
  { value: 'cabinetry', label: 'Cabinetry' },
  { value: 'countertops', label: 'Countertops' },
  { value: 'appliances', label: 'Appliances' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'fixtures', label: 'Fixtures' },
  { value: 'windows-doors', label: 'Windows & Doors' },
  { value: 'insulation', label: 'Insulation' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'demolition', label: 'Demolition' },
  { value: 'framing', label: 'Framing' },
]

export interface Room {
  id: string
  name: string
  type?: string
}

interface RoomTaggerProps {
  rooms: Room[]
  selectedRoom: string | null
  selectedTags: string[]
  selectedTradeCategory: string | null
  customArea: string
  onRoomChange: (roomId: string | null) => void
  onTagsChange: (tags: string[]) => void
  onTradeCategoryChange: (category: string | null) => void
  onCustomAreaChange: (area: string) => void
  compact?: boolean
}

export default function RoomTagger({
  rooms,
  selectedRoom,
  selectedTags,
  selectedTradeCategory,
  customArea,
  onRoomChange,
  onTagsChange,
  onTradeCategoryChange,
  onCustomAreaChange,
  compact = false
}: RoomTaggerProps) {
  const [roomOpen, setRoomOpen] = useState(false)
  const [tradeOpen, setTradeOpen] = useState(false)
  const [customTagInput, setCustomTagInput] = useState('')

  const selectedRoomData = rooms.find(r => r.id === selectedRoom)
  const selectedTradeData = TRADE_CATEGORIES.find(t => t.value === selectedTradeCategory)

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const addCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag])
      setCustomTagInput('')
    }
  }

  const getTagColor = (tag: string) => {
    const preset = TAG_PRESETS.find(p => p.value === tag)
    return preset?.color || 'bg-gray-100 text-gray-700'
  }

  const getTagLabel = (tag: string) => {
    const preset = TAG_PRESETS.find(p => p.value === tag)
    return preset?.label || tag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Compact Room Selection */}
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-gray-400" />
          <Popover open={roomOpen} onOpenChange={setRoomOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="justify-start h-8 text-xs"
              >
                {selectedRoomData?.name || customArea || 'Select Room'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search rooms..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty>No room found.</CommandEmpty>
                  <CommandGroup>
                    {rooms.map((room) => (
                      <CommandItem
                        key={room.id}
                        value={room.name}
                        onSelect={() => {
                          onRoomChange(room.id)
                          onCustomAreaChange('')
                          setRoomOpen(false)
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3",
                            selectedRoom === room.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {room.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Compact Tags */}
        <div className="flex flex-wrap gap-1">
          {selectedTags.map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn("text-xs cursor-pointer", getTagColor(tag))}
              onClick={() => toggleTag(tag)}
            >
              {getTagLabel(tag)}
              <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 px-2 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Add Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex flex-wrap gap-1">
                {TAG_PRESETS.map(preset => (
                  <Badge
                    key={preset.value}
                    variant="secondary"
                    className={cn(
                      "text-xs cursor-pointer transition-opacity",
                      preset.color,
                      selectedTags.includes(preset.value) && "opacity-50"
                    )}
                    onClick={() => toggleTag(preset.value)}
                  >
                    {preset.label}
                  </Badge>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Room/Area Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Home className="w-4 h-4" />
          Room / Area
        </Label>
        
        <Popover open={roomOpen} onOpenChange={setRoomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={roomOpen}
              className="w-full justify-between"
            >
              {selectedRoomData?.name || 'Select a room...'}
              <Home className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search rooms..." />
              <CommandList>
                <CommandEmpty>No room found.</CommandEmpty>
                <CommandGroup heading="Project Rooms">
                  {rooms.map((room) => (
                    <CommandItem
                      key={room.id}
                      value={room.name}
                      onSelect={() => {
                        onRoomChange(room.id === selectedRoom ? null : room.id)
                        onCustomAreaChange('')
                        setRoomOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedRoom === room.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{room.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Custom Area Input */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">or</span>
          <Input
            placeholder="Enter custom area (e.g., Hallway, Exterior)"
            value={customArea}
            onChange={(e) => {
              onCustomAreaChange(e.target.value)
              if (e.target.value) onRoomChange(null)
            }}
            className="flex-1"
          />
        </div>
      </div>

      {/* Tags Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Tag className="w-4 h-4" />
          Tags
        </Label>
        
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className={cn("cursor-pointer hover:opacity-80", getTagColor(tag))}
                onClick={() => toggleTag(tag)}
              >
                {getTagLabel(tag)}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}

        {/* Preset Tags */}
        <div className="space-y-2">
          <span className="text-xs text-gray-500">Quick tags:</span>
          <div className="flex flex-wrap gap-2">
            {TAG_PRESETS.map(preset => (
              <Badge
                key={preset.value}
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all",
                  selectedTags.includes(preset.value) 
                    ? cn(preset.color, "border-transparent") 
                    : "hover:bg-gray-50"
                )}
                onClick={() => toggleTag(preset.value)}
              >
                {selectedTags.includes(preset.value) && (
                  <Check className="w-3 h-3 mr-1" />
                )}
                {preset.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Custom Tag Input */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add custom tag..."
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomTag()
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomTag}
            disabled={!customTagInput.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Trade Category Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="w-4 h-4" />
          Trade Category
        </Label>
        
        <Popover open={tradeOpen} onOpenChange={setTradeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={tradeOpen}
              className="w-full justify-between"
            >
              {selectedTradeData?.label || 'Select trade category...'}
              <Wrench className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search trades..." />
              <CommandList>
                <CommandEmpty>No trade found.</CommandEmpty>
                <CommandGroup>
                  {TRADE_CATEGORIES.map((trade) => (
                    <CommandItem
                      key={trade.value}
                      value={trade.label}
                      onSelect={() => {
                        onTradeCategoryChange(trade.value === selectedTradeCategory ? null : trade.value)
                        setTradeOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedTradeCategory === trade.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {trade.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
