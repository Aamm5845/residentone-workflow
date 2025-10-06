'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Settings,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Minus,
  Edit3,
  Save,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FFEItemState } from '@prisma/client'
import { useFFERoomStore } from '@/stores/ffe-room-store'

interface FFEItem {
  id: string
  name: string
  description?: string
  state: FFEItemState
  isRequired: boolean
  isCustom: boolean
  notes?: string
  quantity: number
  unitCost?: number
  supplierName?: string
  supplierLink?: string
}

interface FFESection {
  id: string
  name: string
  description?: string
  order: number
  isExpanded: boolean
  isCompleted: boolean
  items: FFEItem[]
}

interface FFESectionAccordionProps {
  sections: FFESection[]
  onItemStateChange: (itemId: string, newState: FFEItemState, notes?: string) => void
}

const STATE_CONFIG = {
  PENDING: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Undecided' },
  COMPLETED: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
  // Legacy states (map to simplified states for backward compatibility)
  SELECTED: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Undecided' },
  CONFIRMED: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Undecided' },
  NOT_NEEDED: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Undecided' }
}

interface ItemCardProps {
  item: FFEItem
  onStateChange: (newState: FFEItemState, notes?: string) => void
}

function ItemCard({ item, onStateChange }: ItemCardProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.notes || '')
  
  const config = STATE_CONFIG[item.state]
  const IconComponent = config.icon
  
  const handleSaveNotes = () => {
    onStateChange(item.state, notesDraft)
    setIsEditingNotes(false)
  }
  
  const handleCancelNotes = () => {
    setNotesDraft(item.notes || '')
    setIsEditingNotes(false)
  }
  
  return (
    <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900">{item.name}</h4>
              {item.isRequired && (
                <Badge variant="destructive" className="h-5 text-xs">Required</Badge>
              )}
              {item.isCustom && (
                <Badge variant="outline" className="h-5 text-xs">Custom</Badge>
              )}
            </div>
            {item.description && (
              <p className="text-sm text-gray-600 mb-2">{item.description}</p>
            )}
          </div>
          
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", config.bg)}>
            <IconComponent className={cn("h-3 w-3", config.color)} />
            <span className={config.color}>{config.label}</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 mb-3">
          <Button
            size="sm" 
            variant={item.state === 'COMPLETED' ? 'default' : 'outline'}
            onClick={() => onStateChange('COMPLETED')}
            className="h-8"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Completed
          </Button>
          <Button
            size="sm" 
            variant={item.state !== 'COMPLETED' ? 'secondary' : 'outline'}
            onClick={() => onStateChange('PENDING')}
            className="h-8"
          >
            <Clock className="h-4 w-4 mr-1" />
            Undecided
          </Button>
          <Button
            size="sm" 
            variant="ghost"
            onClick={() => setIsEditingNotes(true)}
            className="h-8"
          >
            <Edit3 className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        </div>
        
        {/* Notes Section */}
        <div className="border-t border-gray-100 pt-3">
          {!isEditingNotes ? (
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {item.notes ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-gray-700">
                    {item.notes}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No notes added</div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingNotes(true)}
                className="ml-2 h-7 px-2"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add notes about this item..."
                className="min-h-[60px] text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={handleCancelNotes}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveNotes}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function FFESectionAccordion({ sections, onItemStateChange }: FFESectionAccordionProps) {
  const { 
    expandedSections, 
    toggleSectionExpanded, 
    getSectionProgress 
  } = useFFERoomStore()
  
  if (sections.length === 0) {
    return (
      <Card className="border border-dashed border-gray-300">
        <CardContent className="p-8 text-center">
          <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No Sections Yet</h3>
          <p className="text-sm text-gray-600 mb-4">
            This FFE instance doesn't have any sections yet. You can add sections manually or import from a template.
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-4">
      {sections
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const progress = getSectionProgress(section.id)
          
          return (
            <Card key={section.id} className="overflow-hidden">
              {/* Section Header */}
              <div 
                className="p-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleSectionExpanded(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{section.name}</h3>
                      {section.description && (
                        <p className="text-sm text-gray-600">{section.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Progress */}
                    <div className="text-sm text-gray-600">
                      {progress.completed}/{progress.total} items
                    </div>
                    
                    {/* Progress Badge */}
                    <Badge 
                      variant={progress.percentage === 100 ? "default" : "secondary"}
                      className="min-w-[60px] justify-center"
                    >
                      {progress.percentage}%
                    </Badge>
                  </div>
                </div>
                
                {/* Progress Bar */}
                {progress.total > 0 && (
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        progress.percentage === 100 ? "bg-green-500" : "bg-blue-500"
                      )}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                )}
              </div>
              
              {/* Section Content */}
              {isExpanded && (
                <CardContent className="p-4">
                  {section.items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Minus className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No items in this section</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {section.items
                        .sort((a, b) => a.order - b.order)
                        .map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            onStateChange={(state, notes) => onItemStateChange(item.id, state, notes)}
                          />
                        ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
    </div>
  )
}