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
  
  // Status dot colors
  const statusDot = {
    PENDING: 'bg-blue-500',
    UNDECIDED: 'bg-amber-500',
    COMPLETED: 'bg-emerald-500',
    SELECTED: 'bg-amber-500',
    CONFIRMED: 'bg-amber-500',
    NOT_NEEDED: 'bg-slate-400',
  }
  
  return (
    <div className={cn("group", isChild ? "px-3 py-2 bg-slate-50" : "px-3 py-2.5 hover:bg-slate-50/50")}>
      <div className="flex items-center gap-2">
        {/* Status Dot */}
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", statusDot[item.state] || statusDot.PENDING)} />
        
        {/* Expand Button */}
        {hasChildren && (
          <button onClick={onToggleExpanded} className="flex-shrink-0 p-0.5 hover:bg-slate-200 rounded">
            <ChevronRight className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", isExpanded && "rotate-90")} />
          </button>
        )}
        
        {/* Item Name */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={cn("font-medium text-slate-800 truncate", isChild ? "text-xs" : "text-sm")}>{item.name}</span>
          {item.isRequired && (
            <span className="text-[9px] px-1 py-0.5 bg-rose-100 text-rose-600 rounded font-medium">REQ</span>
          )}
          {item.quantity > 1 && (
            <span className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded">×{item.quantity}</span>
          )}
          {hasChildren && (
            <span className="text-[9px] px-1 py-0.5 bg-indigo-100 text-indigo-600 rounded">{children.length}</span>
          )}
        </div>
        
        {/* Status Badge - fades on hover */}
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded font-medium opacity-70 group-hover:opacity-0 transition-opacity",
          item.state === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
          item.state === 'UNDECIDED' || item.state === 'SELECTED' || item.state === 'CONFIRMED' ? 'bg-amber-100 text-amber-700' :
          'bg-blue-100 text-blue-700'
        )}>
          {item.state === 'COMPLETED' ? 'Done' : item.state === 'UNDECIDED' || item.state === 'SELECTED' || item.state === 'CONFIRMED' ? 'Undec' : 'Pend'}
        </span>
        
        {/* Action Buttons - Show on Hover */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="inline-flex rounded bg-slate-100 p-0.5">
            <button
              onClick={() => onStateChange('PENDING')}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-all",
                item.state === 'PENDING' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/60'
              )}
            >P</button>
            <button
              onClick={() => onStateChange('UNDECIDED')}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-all",
                item.state === 'UNDECIDED' || item.state === 'SELECTED' || item.state === 'CONFIRMED' 
                  ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:bg-white/60'
              )}
            >U</button>
            <button
              onClick={() => onStateChange('COMPLETED')}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-all",
                item.state === 'COMPLETED' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-white/60'
              )}
            >✓</button>
          </div>
          
          <button
            onClick={() => setIsEditingNotes(true)}
            className={cn(
              "p-1 rounded transition-all",
              item.notes ? "text-amber-500 bg-amber-50" : "text-slate-400 hover:bg-slate-100"
            )}
            title="Note"
          >
            <Edit3 className="h-3 w-3" />
          </button>
        </div>
      </div>
      
      {/* Notes Display */}
      {shouldShowNotes && item.notes && !isEditingNotes && (
        <div className="mt-1.5 ml-4 flex items-start gap-1.5 text-[11px] text-slate-600 bg-amber-50/50 rounded px-2 py-1">
          <StickyNote className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
          <span className="truncate">{item.notes}</span>
        </div>
      )}
      
      {/* Notes Editor */}
      {isEditingNotes && (
        <div className="mt-2 ml-4 space-y-1.5">
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add notes..."
            className="min-h-[50px] text-xs border-slate-200 rounded focus:border-blue-300 resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={handleCancelNotes} className="px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded">
              Cancel
            </button>
            <button onClick={handleSaveNotes} className="px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">
              Save
            </button>
          </div>
        </div>
      )}
      
      {/* Child Items */}
      {hasChildren && isExpanded && (
        <div className="mt-1 ml-4 border-l border-slate-200">
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
          const isComplete = progress.percentage === 100
          
          return (
            <div key={section.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Section Header */}
              <div 
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group",
                  isExpanded ? "bg-gradient-to-r from-slate-50 to-white border-b border-slate-100" : "hover:bg-slate-50/50"
                )}
                onClick={() => toggleSectionExpanded(section.id)}
                role="button"
                aria-expanded={isExpanded}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleSectionExpanded(section.id)}
              >
                {/* Expand Icon */}
                <ChevronRight className={cn(
                  "h-4 w-4 text-slate-400 transition-transform flex-shrink-0",
                  isExpanded && "rotate-90"
                )} />
                
                {/* Section Info */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800">{section.name}</h3>
                  <span className={cn(
                    "text-[11px] font-medium px-1.5 py-0.5 rounded",
                    isComplete 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-slate-100 text-slate-500"
                  )}>
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                
                {/* Progress Section */}
                <div className="flex items-center gap-2 w-36">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isComplete 
                          ? "bg-emerald-500" 
                          : "bg-blue-500"
                      )}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-xs font-semibold w-9 text-right",
                    isComplete ? "text-emerald-600" : "text-slate-600"
                  )}>
                    {Math.round(progress.percentage)}%
                  </span>
                </div>
              </div>
              
              {/* Section Content - Items wrapped in a visual container */}
              {isExpanded && (
                <div className="bg-slate-50/50 px-3 py-2">
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
                            <p className="text-xs text-slate-400">No items in this section</p>
                          </div>
                        )
                      }
                      
                      if (statusFilter !== 'all' && filteredParentItems.length === 0) {
                        return (
                          <div className="text-center py-6">
                            <p className="text-xs text-slate-400">No {statusFilter} items</p>
                          </div>
                        )
                      }
                      
                      return (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          {filteredParentItems
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map((item, index) => {
                              // Get children by parent name (not ID)
                              const children = childItemsMap.get(item.name) || []
                              const isItemExpanded = expandedItems.has(item.id)
                              const isLast = index === filteredParentItems.length - 1
                              
                              return (
                                <div key={item.id} className={cn(!isLast && "border-b border-slate-100")}>
                                  <ItemCard
                                    item={item}
                                    children={children} // eslint-disable-line react/no-children-prop
                                    isExpanded={isItemExpanded}
                                    onStateChange={(state, notes) => handleItemStateChange(item.id, state, notes)}
                                    onToggleExpanded={() => toggleItemExpanded(item.id)}
                                    onChildStateChange={handleItemStateChange}
                                  />
                                </div>
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
