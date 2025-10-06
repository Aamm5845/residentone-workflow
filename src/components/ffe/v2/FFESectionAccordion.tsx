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
  order?: number
  customFields?: {
    parentItemId?: string
    isLinkedItem?: boolean
    parentName?: string
    [key: string]: any
  }
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
  filterUndecided?: boolean
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
  children?: FFEItem[]
  isChild?: boolean
  isExpanded?: boolean
  onStateChange: (newState: FFEItemState, notes?: string) => void
  onToggleExpanded?: () => void
  onChildStateChange?: (itemId: string, newState: FFEItemState, notes?: string) => void
}

function ItemCard({ item, children = [], isChild = false, isExpanded = false, onStateChange, onToggleExpanded, onChildStateChange }: ItemCardProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.notes || '')
  
  const config = STATE_CONFIG[item.state]
  const IconComponent = config.icon
  const hasChildren = children.length > 0
  const isLinkedItem = item.customFields?.isLinkedItem === true
  
  const handleSaveNotes = () => {
    onStateChange(item.state, notesDraft)
    setIsEditingNotes(false)
  }
  
  const handleCancelNotes = () => {
    setNotesDraft(item.notes || '')
    setIsEditingNotes(false)
  }
  
  // Don't show auto-generated notes for linked items
  const shouldShowNotes = !isLinkedItem || (item.notes && !item.notes.includes('Imported from'))
  
  return (
    <div className={cn("space-y-2")}>
      <Card className={cn(
        "border transition-colors relative",
        isChild ? (
          "ml-6 border-gray-100 bg-gray-50/50 border-l-2 border-l-blue-300"
        ) : (
          "border-gray-200 hover:border-gray-300"
        ),
        isLinkedItem && "bg-blue-50/30"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {/* Expand/collapse button for parent items */}
                {hasChildren && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onToggleExpanded}
                    className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600 rounded-full mr-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                )}
                
                {/* Tree connector for child items */}
                {isChild && (
                  <div className="absolute -left-6 top-4 bottom-0">
                    <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300 rounded-bl-md"></div>
                  </div>
                )}
                
                <h4 className="font-medium text-gray-900">{item.name}</h4>
                
                {item.isRequired && (
                  <Badge variant="destructive" className="h-5 text-xs">Required</Badge>
                )}
                {item.isCustom && (
                  <Badge variant="outline" className="h-5 text-xs">Custom</Badge>
                )}
                {hasChildren && (
                  <Badge variant="secondary" className="h-5 text-xs">
                    {children.length} item{children.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {isLinkedItem && (
                  <Badge variant="outline" className="h-5 text-xs border-blue-200 text-blue-700">
                    Linked
                  </Badge>
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
          {shouldShowNotes && (
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
          )}
        </CardContent>
      </Card>
      
      {/* Child Items */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Parent connector line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          
          <div className="space-y-3 pt-2">
            {children
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((childItem, index) => (
                <div key={childItem.id} className="relative">
                  <ItemCard
                    item={childItem}
                    isChild={true}
                    onStateChange={(state, notes) => {
                      if (onChildStateChange) {
                        onChildStateChange(childItem.id, state, notes)
                      }
                    }}
                  />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FFESectionAccordion({ sections, onItemStateChange, filterUndecided = false }: FFESectionAccordionProps) {
  const { 
    expandedSections, 
    toggleSectionExpanded, 
    getSectionProgress 
  } = useFFERoomStore()
  
  // State to track expanded parent items
  const [expandedItems, setExpandedItems] = useState(new Set<string>())
  
  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }
  
  // Helper function to build item hierarchy
  const buildItemHierarchy = (items: FFEItem[]) => {
    const parentItems: FFEItem[] = []
    const childItemsMap = new Map<string, FFEItem[]>()
    
    // First pass: separate parent and child items
    items.forEach(item => {
      const parentItemId = item.customFields?.parentItemId
      if (parentItemId) {
        // This is a child item
        if (!childItemsMap.has(parentItemId)) {
          childItemsMap.set(parentItemId, [])
        }
        childItemsMap.get(parentItemId)!.push(item)
      } else {
        // This is a parent item
        parentItems.push(item)
      }
    })
    
    return { parentItems, childItemsMap }
  }
  
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
                    {/* Item count */}
                    <div className="text-sm text-gray-600">
                      {progress.total} items
                    </div>
                    
                    {/* Progress Percentage - Always rounded up */}
                    <Badge 
                      variant={progress.percentage === 100 ? "default" : "secondary"}
                      className="min-w-[60px] justify-center font-medium"
                    >
                      {Math.ceil(progress.percentage)}%
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Section Content */}
              {isExpanded && (
                <CardContent className="p-4">
                  {(() => {
                    const { parentItems, childItemsMap } = buildItemHierarchy(section.items)
                    
                    // Apply filtering
                    const filteredParentItems = parentItems.filter((item) => {
                      if (filterUndecided) {
                        return item.state === 'PENDING' || item.state === 'SELECTED' || item.state === 'CONFIRMED' || item.state === 'NOT_NEEDED'
                      }
                      return true
                    })
                    
                    if (section.items.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Minus className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No items in this section</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            <Plus className="h-3 w-3 mr-1" />
                            Add Item
                          </Button>
                        </div>
                      )
                    }
                    
                    if (filterUndecided && filteredParentItems.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No undecided items in this section</p>
                          <p className="text-xs text-gray-400 mt-1">All items have been completed</p>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="space-y-4">
                        {filteredParentItems
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((item) => {
                            const children = childItemsMap.get(item.id) || []
                            const isItemExpanded = expandedItems.has(item.id)
                            
                            return (
                              <ItemCard
                                key={item.id}
                                item={item}
                                children={children}
                                isExpanded={isItemExpanded}
                                onStateChange={(state, notes) => onItemStateChange(item.id, state, notes)}
                                onToggleExpanded={() => toggleItemExpanded(item.id)}
                                onChildStateChange={onItemStateChange}
                              />
                            )
                          })}
                      </div>
                    )
                  })()
                  }
                </CardContent>
              )}
            </Card>
          )
        })}
    </div>
  )
}
