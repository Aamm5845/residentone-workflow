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
  X,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FFEItemState } from '@prisma/client'
import { useFFERoomStore } from '@/stores/ffe-room-store'

interface FFEItem {
  id: string
  name: string
  description?: string
  state: FFEItemState
  visibility?: 'VISIBLE' | 'HIDDEN'
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
  onItemVisibilityChange?: (itemId: string, newVisibility: 'VISIBLE' | 'HIDDEN') => void
  statusFilter?: 'all' | 'pending' | 'undecided' | 'completed'
}

const STATE_CONFIG = {
  PENDING: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Pending' },
  UNDECIDED: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Undecided' },
  COMPLETED: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
  // Legacy states (map to current workflow)
  SELECTED: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Undecided' },
  CONFIRMED: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Undecided' },
  NOT_NEEDED: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Not Needed' }
}

interface ItemCardProps {
  item: FFEItem
  children?: FFEItem[]
  isChild?: boolean
  isExpanded?: boolean
  onStateChange: (newState: FFEItemState, notes?: string) => void
  onToggleExpanded?: () => void
  onChildStateChange?: (itemId: string, newState: FFEItemState, notes?: string) => void
  onVisibilityChange?: (itemId: string, newVisibility: 'VISIBLE' | 'HIDDEN') => void
}

function ItemCard({ item, children = [], isChild = false, isExpanded = false, onStateChange, onToggleExpanded, onChildStateChange, onVisibilityChange }: ItemCardProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.notes || '')
  const [isToggling, setIsToggling] = useState(false)
  
  const config = STATE_CONFIG[item.state] || STATE_CONFIG.PENDING
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
  
  const handleVisibilityToggle = async () => {
    if (!onVisibilityChange || isToggling) return
    
    setIsToggling(true)
    const currentVisibility = item.visibility || 'VISIBLE'
    const newVisibility = currentVisibility === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE'
    
    try {
      await onVisibilityChange(item.id, newVisibility)
    } catch (error) {
      console.error('Failed to toggle visibility:', error)
    } finally {
      setIsToggling(false)
    }
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
          
          {/* Action Buttons - Workspace Flow: Pending → Undecided → Completed */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <Button
              size="sm" 
              variant={item.state === 'PENDING' ? 'default' : 'outline'}
              onClick={() => onStateChange('PENDING')}
              className="h-8"
            >
              <Clock className="h-4 w-4 mr-1" />
              Pending
            </Button>
            <Button
              size="sm" 
              variant={item.state === 'UNDECIDED' ? 'default' : 'outline'}
              onClick={() => onStateChange('UNDECIDED')}
              className="h-8"
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Undecided
            </Button>
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

export default function FFESectionAccordion({ sections, onItemStateChange, onItemVisibilityChange, statusFilter = 'all' }: FFESectionAccordionProps) {
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Settings className="h-10 w-10 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No Sections Yet</h3>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            This FFE workspace doesn't have any sections yet. Add sections and items through the Settings page to get started.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 text-sm text-blue-700">
              <Plus className="h-4 w-4" />
              <span className="font-medium">Tip:</span>
              <span>Use the Settings page to import templates or add custom sections</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {sections
        .sort((a, b) => a.order - b.order)
        .filter((section) => {
          // In workspace, only show sections with visible items
          const visibleItems = section.items.filter(item => (item.visibility || 'VISIBLE') === 'VISIBLE')
          return visibleItems.length > 0
        })
        .map((section) => {
          const isExpanded = expandedSections.has(section.id)
          const progress = getSectionProgress(section.id)
          
          return (
            <div key={section.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
              {/* Premium Section Header */}
              <div 
                className={`flex items-center justify-between p-6 cursor-pointer transition-all duration-300 ${
                  isExpanded 
                    ? 'bg-gradient-to-r from-blue-50 via-blue-50/50 to-transparent border-b border-blue-100' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleSectionExpanded(section.id)}
              >
                <div className="flex items-center space-x-4">
                  <button className={`p-2 rounded-xl transition-all duration-300 ${
                    isExpanded 
                      ? 'bg-blue-100 text-blue-600 shadow-sm' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>
                  
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{section.name}</h3>
                    {section.description && (
                      <p className="text-gray-600">{section.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  {/* Premium Progress Ring */}
                  <div className="relative w-16 h-16">
                    <svg className="transform -rotate-90 w-16 h-16">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="rgb(229 231 235)"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke={progress.percentage === 100 ? "rgb(34 197 94)" : "rgb(59 130 246)"}
                        strokeWidth="4"
                        fill="transparent"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress.percentage / 100)}`}
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-bold ${
                        progress.percentage === 100 ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        {Math.ceil(progress.percentage)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Item Count Badge */}
                  <div className="text-right">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      progress.percentage === 100 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {progress.completed}/{progress.total} items
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {progress.total - progress.completed} remaining
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Premium Section Content */}
              {isExpanded && (
                <div className="bg-gradient-to-b from-gray-50/30 to-white p-6">
                  {(() => {
                    // Filter items by visibility first
                    const visibleItems = section.items.filter(item => (item.visibility || 'VISIBLE') === 'VISIBLE')
                    const { parentItems, childItemsMap } = buildItemHierarchy(visibleItems)
                    
                    // Apply status filtering after visibility filter
                    const filteredParentItems = parentItems.filter((item) => {
                      if (statusFilter === 'all') return true
                      if (statusFilter === 'pending') return item.state === 'PENDING'
                      if (statusFilter === 'undecided') return item.state === 'UNDECIDED' || item.state === 'SELECTED' || item.state === 'CONFIRMED'
                      if (statusFilter === 'completed') return item.state === 'COMPLETED'
                      return true
                    })
                    
                    if (visibleItems.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Minus className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 text-lg mb-1">No items in this section yet</p>
                          <p className="text-gray-400 text-sm">Add items through the Settings page</p>
                        </div>
                      )
                    }
                    
                    if (statusFilter !== 'all' && filteredParentItems.length === 0) {
                      const statusLabels = {
                        pending: 'pending',
                        undecided: 'undecided',
                        completed: 'completed'
                      }
                      return (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 text-lg mb-1">No {statusLabels[statusFilter as keyof typeof statusLabels]} items</p>
                          <p className="text-gray-400 text-sm">Switch to 'All' to see other items</p>
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
                                onVisibilityChange={onItemVisibilityChange}
                              />
                            )
                          })}
                      </div>
                    )
                  })()
                  }
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}
