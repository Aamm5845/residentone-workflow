'use client'

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
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
  EyeOff,
  StickyNote
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
    hasChildren?: boolean
    [key: string]: unknown
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
}

function ItemCard({ item, children = [], isChild = false, isExpanded = false, onStateChange, onToggleExpanded, onChildStateChange }: ItemCardProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.notes || '')
  
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
  
  // Don't show auto-generated notes for linked items
  const shouldShowNotes = !isLinkedItem || (item.notes && !item.notes.includes('Imported from'))
  
  const statusColors = {
    PENDING: { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'border-l-blue-500', icon: 'text-blue-600' },
    UNDECIDED: { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'border-l-amber-500', icon: 'text-amber-600' },
    COMPLETED: { bg: 'bg-green-50', border: 'border-green-200', accent: 'border-l-green-500', icon: 'text-green-600' },
    SELECTED: { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'border-l-amber-500', icon: 'text-amber-600' },
    CONFIRMED: { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'border-l-amber-500', icon: 'text-amber-600' },
    NOT_NEEDED: { bg: 'bg-gray-50', border: 'border-gray-200', accent: 'border-l-gray-400', icon: 'text-gray-600' },
  }
  const statusColor = statusColors[item.state] || statusColors.PENDING
  
  return (
    <div className="mb-2">
      <div className={`bg-white rounded-lg border ${statusColor.border} border-l-4 ${statusColor.accent} p-3 hover:shadow-md transition-all`}>
        <div className="flex items-start gap-3">
          {/* Item Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {hasChildren && (
                <button
                  onClick={onToggleExpanded}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              
              <IconComponent className={`h-4 w-4 ${statusColor.icon} flex-shrink-0`} />
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                {item.isRequired && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">Required</span>
                )}
                {item.quantity && item.quantity > 1 && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">{item.quantity}x</span>
                )}
                {hasChildren && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">{children.length} items</span>
                )}
              </div>
            </div>
            {item.description && (
              <p className="text-xs text-gray-600 ml-10 mt-1">{item.description}</p>
            )}
          </div>
          
          {/* Status and Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onStateChange('PENDING')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  item.state === 'PENDING'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300'
                )}
                title="Mark as Pending"
              >
                Pending
              </button>
              <button
                onClick={() => onStateChange('UNDECIDED')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  item.state === 'UNDECIDED' || item.state === 'SELECTED' || item.state === 'CONFIRMED'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-amber-300'
                )}
                title="Mark as Undecided"
              >
                Undecided
              </button>
              <button
                onClick={() => onStateChange('COMPLETED')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  item.state === 'COMPLETED'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-green-300'
                )}
                title="Mark as Completed"
              >
                Completed
              </button>
              <button
                onClick={() => setIsEditingNotes(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Add Note"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        {shouldShowNotes && item.notes && !isEditingNotes && (
          <div className="mt-3 ml-10 px-3 py-2 bg-amber-50 border-l-2 border-amber-400 rounded text-xs text-gray-700">
            <div className="flex items-start gap-2">
              <StickyNote className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
              <span>{item.notes}</span>
            </div>
          </div>
        )}
        
        {isEditingNotes && (
          <div className="mt-3 ml-10 space-y-2">
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Add notes about this item..."
              className="min-h-[60px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelNotes}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md shadow-sm transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Child Items */}
      {hasChildren && isExpanded && (
        <div className="mt-2 ml-8 pl-4 border-l-2 border-gray-300 space-y-2">
          {children
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((childItem) => (
              <ItemCard
                key={childItem.id}
                item={childItem}
                isChild={true}
                onStateChange={(state, notes) => {
                  if (onChildStateChange) {
                    onChildStateChange(childItem.id, state, notes)
                  }
                }}
              />
            ))}
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
  
  // Scroll position management
  const scrollPositionRef = useRef<number>(0)
  const isUpdatingRef = useRef<boolean>(false)
  
  // Restore scroll position after sections update
  useLayoutEffect(() => {
    if (isUpdatingRef.current) {
      // Use double requestAnimationFrame to ensure all DOM updates and layout calculations are complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPositionRef.current)
          isUpdatingRef.current = false
        })
      })
    }
  }, [sections])
  
  // Wrap onItemStateChange to save scroll position
  const handleItemStateChange = (itemId: string, newState: FFEItemState, notes?: string) => {
    scrollPositionRef.current = window.scrollY
    isUpdatingRef.current = true
    onItemStateChange(itemId, newState, notes)
  }
  
  // Get roomId from sections for sessionStorage key
  const roomId = sections[0]?.instance?.roomId || sections[0]?.items?.[0]?.section?.instance?.roomId || 'unknown'
  const storageKey = `ffe:workspace:expanded:${roomId}`
  
  // Load expanded state from sessionStorage on mount
  const loadExpandedState = (): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = sessionStorage.getItem(storageKey)
      if (stored) {
        return new Set(JSON.parse(stored))
      }
    } catch (error) {
      console.warn('Failed to load expanded state from sessionStorage:', error)
    }
    // Default: expand all parent items on first load
    const parentIds = new Set<string>()
    sections.forEach(section => {
      section.items?.forEach(item => {
        if (item.customFields?.hasChildren === true) {
          parentIds.add(item.id)
        }
      })
    })
    return parentIds
  }
  
  // State to track expanded parent items with sessionStorage persistence
  const [expandedItems, setExpandedItems] = useState<Set<string>>(loadExpandedState)
  
  // Save expanded state to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(Array.from(expandedItems)))
    } catch (error) {
      console.warn('Failed to save expanded state to sessionStorage:', error)
    }
  }, [expandedItems, storageKey])
  
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
  
  // Helper function to build item hierarchy based on customFields
  const buildItemHierarchy = (items: FFEItem[]) => {
    const parentItems: FFEItem[] = []
    const childItemsMap = new Map<string, FFEItem[]>()
    
    // First pass: separate parent and child items using customFields
    items.forEach(item => {
      // Check if this is a linked child item
      if (item.customFields?.isLinkedItem === true && item.customFields?.parentName) {
        // This is a child item - group by parent name
        const parentName = item.customFields.parentName
        if (!childItemsMap.has(parentName)) {
          childItemsMap.set(parentName, [])
        }
        childItemsMap.get(parentName)!.push(item)
      } else {
        // This is a parent item (or standalone item)
        parentItems.push(item)
      }
    })
    
    return { parentItems, childItemsMap }
  }
  
  if (sections.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <Settings className="h-8 w-8 text-gray-400 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-900 mb-1">No Sections Yet</h3>
        <p className="text-xs text-gray-500">
          Add sections and items through the Settings page to get started.
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
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
            <div key={section.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {/* Section Header - Clean with good hierarchy */}
              <div 
                className={`flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-all group ${
                  isExpanded ? 'bg-gray-50 border-b border-gray-200' : ''
                }`}
                onClick={() => toggleSectionExpanded(section.id)}
                role="button"
                aria-expanded={isExpanded}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleSectionExpanded(section.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`transition-transform ${
                    isExpanded ? 'rotate-0' : '-rotate-90'
                  }`}>
                    <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="text-base font-semibold text-gray-900">{section.name}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 max-w-xs bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            progress.percentage === 100 
                              ? 'bg-gradient-to-r from-green-500 to-green-600' 
                              : 'bg-gradient-to-r from-blue-500 to-blue-600'
                          }`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 w-10 text-right">
                        {Math.ceil(progress.percentage)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Section Content */}
              {isExpanded && (
                <div className="p-4 bg-gray-50">
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
                        <div className="text-center py-6">
                          <p className="text-xs text-gray-500">No items in this section</p>
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
                        <div className="text-center py-6">
                          <p className="text-xs text-gray-500">No {statusLabels[statusFilter as keyof typeof statusLabels]} items</p>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="divide-y divide-gray-100">
                        {filteredParentItems
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((item) => {
                            // Get children by parent name (not ID)
                            const children = childItemsMap.get(item.name) || []
                            const isItemExpanded = expandedItems.has(item.id)
                            
                            return (
                              <ItemCard
                                key={item.id}
                                item={item}
                                children={children} // eslint-disable-line react/no-children-prop
                                isExpanded={isItemExpanded}
                                onStateChange={(state, notes) => handleItemStateChange(item.id, state, notes)}
                                onToggleExpanded={() => toggleItemExpanded(item.id)}
                                onChildStateChange={handleItemStateChange}
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
