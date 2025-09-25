'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronRight, Check, X, Clock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type FFEItemState, type FFEItemTemplate, type FFECategory } from '@/lib/constants/room-ffe-config'

interface FFEQAChecklistProps {
  roomId: string
  roomType: string
  categories: FFECategory[]
  itemStatuses: Record<string, {
    state: FFEItemState
    isCustomExpanded: boolean
    subItemStates: Record<string, string>
    notes?: string
    confirmedAt?: Date
  }>
  onItemStateChange: (itemId: string, state: FFEItemState, notes?: string) => void
  onCustomExpand: (itemId: string, expanded: boolean) => void
  onSubItemStateChange: (itemId: string, subItemId: string, state: FFEItemState) => void
  onAddCustomItem: () => void
  readonly?: boolean
}

export default function FFEQAChecklist({
  roomId,
  roomType,
  categories,
  itemStatuses,
  onItemStateChange,
  onCustomExpand,
  onSubItemStateChange,
  onAddCustomItem,
  readonly = false
}: FFEQAChecklistProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})

  // Calculate overall progress
  const calculateProgress = () => {
    let totalItems = 0
    let completedItems = 0

    // Add defensive programming - ensure categories is an array
    if (!Array.isArray(categories)) {
      return {
        total: 0,
        completed: 0,
        percentage: 0
      }
    }

    categories.forEach(category => {
      category.items.forEach(item => {
        // Check if item should be shown based on conditional logic
        if (item.conditionalOn && item.conditionalOn.length > 0) {
          const shouldShow = item.conditionalOn.some(conditionItemId => {
            const conditionStatus = itemStatuses[conditionItemId]
            return conditionStatus && conditionStatus.state === 'confirmed'
          })
          if (!shouldShow) return
        }

        totalItems++
        const status = itemStatuses[item.id]
        if (status && (status.state === 'confirmed' || status.state === 'not_needed')) {
          completedItems++
        }
      })
    })

    return {
      total: totalItems,
      completed: completedItems,
      percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
    }
  }

  const progress = calculateProgress()

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const handleItemStateChange = (itemId: string, newState: FFEItemState) => {
    onItemStateChange(itemId, newState, itemNotes[itemId])
  }

  const handleNotesChange = (itemId: string, notes: string) => {
    setItemNotes(prev => ({ ...prev, [itemId]: notes }))
  }

  const handleNotesBlur = (itemId: string) => {
    const currentStatus = itemStatuses[itemId]
    if (currentStatus) {
      onItemStateChange(itemId, currentStatus.state, itemNotes[itemId])
    }
  }

  const getStateIcon = (state: FFEItemState) => {
    switch (state) {
      case 'confirmed':
        return <Check className="h-4 w-4 text-green-600" />
      case 'not_needed':
        return <X className="h-4 w-4 text-gray-400" />
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-amber-500" />
    }
  }

  const getStateColor = (state: FFEItemState) => {
    switch (state) {
      case 'confirmed':
        return 'border-green-200 bg-green-50'
      case 'not_needed':
        return 'border-gray-200 bg-gray-50 opacity-60'
      case 'pending':
      default:
        return 'border-amber-200 bg-amber-50'
    }
  }

  const renderSubItems = (item: FFEItemTemplate, isExpanded: boolean) => {
    if (!item.subItems || item.isStandard || !isExpanded) return null

    const itemStatus = itemStatuses[item.id]
    const subItemStates = itemStatus?.subItemStates || {}

    return (
      <div className="ml-6 mt-3 space-y-2 border-l-2 border-gray-200 pl-4">
        {item.subItems.map(subItem => {
          const subState = subItemStates[subItem.id] || 'pending'
          
          return (
            <div key={subItem.id} className={cn(
              "flex items-center justify-between p-2 rounded-md border",
              getStateColor(subState as FFEItemState)
            )}>
              <div className="flex items-center space-x-3">
                {getStateIcon(subState as FFEItemState)}
                <div>
                  <span className={cn(
                    "text-sm font-medium",
                    subState === 'not_needed' && "line-through text-gray-500"
                  )}>
                    {subItem.name}
                  </span>
                  {subItem.required && (
                    <Badge variant="secondary" className="ml-2 text-xs">Required</Badge>
                  )}
                </div>
              </div>

              {!readonly && (
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant={subState === 'confirmed' ? 'default' : 'outline'}
                    onClick={() => onSubItemStateChange(item.id, subItem.id, 'confirmed')}
                    className="h-7 px-2 text-xs"
                  >
                    ✓
                  </Button>
                  <Button
                    size="sm"
                    variant={subState === 'not_needed' ? 'secondary' : 'outline'}
                    onClick={() => onSubItemStateChange(item.id, subItem.id, 'not_needed')}
                    className="h-7 px-2 text-xs"
                  >
                    Skip
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const renderItem = (item: FFEItemTemplate) => {
    // Check conditional logic
    if (item.conditionalOn && item.conditionalOn.length > 0) {
      const shouldShow = item.conditionalOn.some(conditionItemId => {
        const conditionStatus = itemStatuses[conditionItemId]
        return conditionStatus && conditionStatus.state === 'confirmed'
      })
      if (!shouldShow) return null
    }

    const status = itemStatuses[item.id]
    const currentState = status?.state || 'pending'
    const isExpanded = status?.isCustomExpanded || false
    const currentNotes = itemNotes[item.id] || status?.notes || ''

    return (
      <Card key={item.id} className={cn(
        "mb-3 transition-all",
        getStateColor(currentState)
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {getStateIcon(currentState)}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className={cn(
                    "font-medium text-sm",
                    currentState === 'not_needed' && "line-through text-gray-500"
                  )}>
                    {item.name}
                  </h4>
                  
                  {item.isRequired && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                  
                  {!item.isStandard && (
                    <Badge variant="outline" className="text-xs">Custom</Badge>
                  )}
                  
                  {status?.confirmedAt && (
                    <Badge variant="secondary" className="text-xs">
                      {new Date(status.confirmedAt).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
                
                {/* Custom item expansion */}
                {!item.isStandard && item.subItems && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCustomExpand(item.id, !isExpanded)}
                    className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                    disabled={readonly}
                  >
                    {isExpanded ? (
                      <><ChevronDown className="h-3 w-3 mr-1" /> Hide Details</>
                    ) : (
                      <><ChevronRight className="h-3 w-3 mr-1" /> Show Details</>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {!readonly && (
              <div className="flex space-x-1 ml-3">
                <Button
                  size="sm"
                  variant={currentState === 'confirmed' ? 'default' : 'outline'}
                  onClick={() => handleItemStateChange(item.id, 'confirmed')}
                  className="h-8 px-3 text-xs"
                >
                  ✅ Confirmed
                </Button>
                <Button
                  size="sm"
                  variant={currentState === 'not_needed' ? 'secondary' : 'outline'}
                  onClick={() => handleItemStateChange(item.id, 'not_needed')}
                  className="h-8 px-3 text-xs"
                >
                  🚫 Not Needed
                </Button>
              </div>
            )}
          </div>

          {/* Sub-items for custom items */}
          {renderSubItems(item, isExpanded)}

          {/* Notes section */}
          {(currentNotes || currentState === 'confirmed') && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <Textarea
                placeholder="Add notes about this item..."
                value={currentNotes}
                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                onBlur={() => handleNotesBlur(item.id)}
                className="min-h-[60px] text-xs"
                disabled={readonly}
              />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderCategory = (category: FFECategory) => {
    const isExpanded = expandedCategories.has(category.id)
    const categoryItems = category.items.filter(item => {
      // Apply conditional logic filtering
      if (item.conditionalOn && item.conditionalOn.length > 0) {
        const shouldShow = item.conditionalOn.some(conditionItemId => {
          const conditionStatus = itemStatuses[conditionItemId]
          return conditionStatus && conditionStatus.state === 'confirmed'
        })
        return shouldShow
      }
      return true
    })

    if (categoryItems.length === 0) return null

    // Calculate category progress
    const categoryProgress = {
      total: categoryItems.length,
      completed: categoryItems.filter(item => {
        const status = itemStatuses[item.id]
        return status && (status.state === 'confirmed' || status.state === 'not_needed')
      }).length
    }

    return (
      <Card key={category.id} className="mb-4">
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 pb-3"
          onClick={() => toggleCategory(category.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-base font-semibold">
                {category.name}
              </CardTitle>
              <Badge variant="outline">
                {categoryProgress.completed}/{categoryProgress.total}
              </Badge>
            </div>
            
            <Progress 
              value={(categoryProgress.completed / categoryProgress.total) * 100} 
              className="w-24 h-2"
            />
          </div>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="pt-0">
            {categoryItems.map(renderItem)}
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with overall progress */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                FFE Checklist - {roomType.charAt(0).toUpperCase() + roomType.slice(1).replace('-', ' ')}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Quality assurance checklist to ensure no FFE items are forgotten
              </p>
            </div>
            
            {!readonly && (
              <Button
                onClick={onAddCustomItem}
                size="sm"
                variant="outline"
                className="ml-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Item
              </Button>
            )}
          </div>
          
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Progress</span>
                <span className="font-semibold">
                  {progress.completed}/{progress.total} ({progress.percentage}%)
                </span>
              </div>
              <Progress value={progress.percentage} className="h-3" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Categories */}
      {Array.isArray(categories) && categories
        .sort((a, b) => a.order - b.order)
        .map(renderCategory)}
        
      {(!Array.isArray(categories) || categories.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <p>No FFE configuration found for this room type.</p>
            <p className="text-sm mt-2">Contact your administrator to set up the FFE checklist.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}