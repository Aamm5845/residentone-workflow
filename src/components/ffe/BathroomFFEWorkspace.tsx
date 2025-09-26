'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  CheckCircle, 
  Circle, 
  Plus, 
  Minus,
  Building2,
  Palette,
  Lightbulb,
  Wrench,
  Settings,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BATHROOM_TEMPLATE, getBathroomCategories, validateBathroomFFECompletion } from '@/lib/ffe/bathroom-template'
import ToiletSelectionLogic from './ToiletSelectionLogic'

interface ItemSelection {
  itemId: string
  selected: boolean
  quantity?: number
  variant?: string
  state: 'pending' | 'selected' | 'not_needed'
}

interface CategoryStatus {
  categoryId: string
  selections: ItemSelection[]
  isCompleted: boolean
  requiredCount: number
  selectedCount: number
}

interface BathroomFFEWorkspaceProps {
  roomId: string
  roomType: string
  onStatusUpdate?: (status: CategoryStatus[]) => void
  disabled?: boolean
}

const CATEGORY_ICONS = {
  'Flooring': Building2,
  'Wall': Palette,
  'Ceiling': Building2,
  'Doors and Handles': Wrench,
  'Moulding': Building2,
  'Lighting': Lightbulb,
  'Electric': Wrench,
  'Plumbing': Wrench,
  'Accessories': Settings
}

export default function BathroomFFEWorkspace({ 
  roomId, 
  roomType, 
  onStatusUpdate,
  disabled = false 
}: BathroomFFEWorkspaceProps) {
  const [categoryStatuses, setCategoryStatuses] = useState<CategoryStatus[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Plumbing']))
  const [toiletStatus, setToiletStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Initialize category statuses from bathroom template
  useEffect(() => {
    const categories = Object.entries(BATHROOM_TEMPLATE.categories).map(([categoryName, items]) => ({
      categoryId: categoryName,
      selections: items.map(item => ({
        itemId: item.id,
        selected: false,
        quantity: item.allowMultiple ? 0 : undefined,
        state: 'pending' as const
      })),
      isCompleted: false,
      requiredCount: items.filter(item => item.isRequired).length,
      selectedCount: 0
    }))
    
    setCategoryStatuses(categories)
  }, [])

  // Update parent component when status changes
  useEffect(() => {
    if (onStatusUpdate) {
      onStatusUpdate(categoryStatuses)
    }
  }, [categoryStatuses, onStatusUpdate])

  const updateItemSelection = (categoryId: string, itemId: string, updates: Partial<ItemSelection>) => {
    setCategoryStatuses(prev => prev.map(category => {
      if (category.categoryId !== categoryId) return category
      
      const updatedSelections = category.selections.map(selection => {
        if (selection.itemId === itemId) {
          return { ...selection, ...updates }
        }
        return selection
      })
      
      const selectedCount = updatedSelections.filter(s => s.selected).length
      const isCompleted = selectedCount > 0 || category.requiredCount === 0
      
      return {
        ...category,
        selections: updatedSelections,
        selectedCount,
        isCompleted
      }
    }))
  }

  const toggleItemSelection = (categoryId: string, itemId: string) => {
    const category = categoryStatuses.find(c => c.categoryId === categoryId)
    const selection = category?.selections.find(s => s.itemId === itemId)
    
    if (!selection) return
    
    const newSelected = !selection.selected
    updateItemSelection(categoryId, itemId, {
      selected: newSelected,
      state: newSelected ? 'selected' : 'pending',
      quantity: newSelected && BATHROOM_TEMPLATE.categories[categoryId].find(item => item.id === itemId)?.allowMultiple ? 1 : undefined
    })
  }

  const updateItemQuantity = (categoryId: string, itemId: string, delta: number) => {
    const category = categoryStatuses.find(c => c.categoryId === categoryId)
    const selection = category?.selections.find(s => s.itemId === itemId)
    
    if (!selection || !selection.selected) return
    
    const newQuantity = Math.max(1, (selection.quantity || 1) + delta)
    updateItemSelection(categoryId, itemId, { quantity: newQuantity })
  }

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  const getCategoryIcon = (categoryId: string) => {
    const IconComponent = CATEGORY_ICONS[categoryId as keyof typeof CATEGORY_ICONS] || Building2
    return IconComponent
  }

  const getCategoryProgress = (category: CategoryStatus) => {
    const totalItems = category.selections.length
    const selectedItems = category.selectedCount
    return Math.round((selectedItems / totalItems) * 100)
  }

  const getOverallProgress = () => {
    const totalCategories = categoryStatuses.length
    const completedCategories = categoryStatuses.filter(c => c.isCompleted).length
    return Math.round((completedCategories / totalCategories) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">FFE Selection - {roomType.replace('_', ' ')}</h2>
          <p className="text-sm text-gray-600">
            Select the items needed for this bathroom from the preset categories
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{getOverallProgress()}%</div>
          <div className="text-xs text-gray-600">Overall Progress</div>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Category Progress</span>
            <span className="text-sm text-blue-700">
              {categoryStatuses.filter(c => c.isCompleted).length} of {categoryStatuses.length} categories completed
            </span>
          </div>
          <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${getOverallProgress()}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {Object.entries(BATHROOM_TEMPLATE.categories).map(([categoryName, items]) => {
        const categoryStatus = categoryStatuses.find(c => c.categoryId === categoryName)
        const isExpanded = expandedCategories.has(categoryName)
        const CategoryIcon = getCategoryIcon(categoryName)
        const progress = categoryStatus ? getCategoryProgress(categoryStatus) : 0

        return (
          <Card key={categoryName} className={cn(
            "transition-all duration-200",
            categoryStatus?.isCompleted && "border-green-200 bg-green-50"
          )}>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => toggleCategoryExpansion(categoryName)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CategoryIcon className="h-5 w-5 text-gray-600" />
                  <div>
                    <CardTitle className="text-base">{categoryName}</CardTitle>
                    <p className="text-sm text-gray-600">
                      {items.length} items • {categoryStatus?.selectedCount || 0} selected
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {categoryStatus?.isCompleted && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <div className="text-right">
                    <div className="text-sm font-medium">{progress}%</div>
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="border-t space-y-4">
                {items.map(item => {
                  const selection = categoryStatus?.selections.find(s => s.itemId === item.id)
                  
                  // Special handling for toilet
                  if (item.id === 'toilet') {
                    return (
                      <div key={item.id}>
                        <ToiletSelectionLogic
                          onStatusUpdate={setToiletStatus}
                          disabled={disabled}
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={item.id} className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      selection?.selected ? "border-blue-200 bg-blue-50" : "border-gray-200"
                    )}>
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={selection?.selected || false}
                          onCheckedChange={() => toggleItemSelection(categoryName, item.id)}
                          disabled={disabled}
                        />
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          {item.options && (
                            <p className="text-sm text-gray-600">
                              {item.options.slice(0, 3).join(', ')}
                              {item.options.length > 3 && ` + ${item.options.length - 3} more`}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 mt-1">
                            {item.isRequired && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                            {item.allowMultiple && (
                              <Badge variant="secondary" className="text-xs">
                                Multiple
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {selection?.selected && (
                        <div className="flex items-center space-x-3">
                          {/* Quantity controls for multiple selection items */}
                          {item.allowMultiple && (
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => updateItemQuantity(categoryName, item.id, -1)}
                                disabled={disabled || (selection.quantity || 1) <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">
                                {selection.quantity || 1}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => updateItemQuantity(categoryName, item.id, 1)}
                                disabled={disabled}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}

                          {/* Variant selection */}
                          {item.options && item.options.length > 0 && (
                            <Select
                              value={selection.variant || ''}
                              onValueChange={(value) => updateItemSelection(categoryName, item.id, { variant: value })}
                              disabled={disabled}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Choose variant..." />
                              </SelectTrigger>
                              <SelectContent>
                                {item.options.map(option => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Summary */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">Selection Summary</h4>
              <div className="text-sm text-blue-700 mt-2 space-y-1">
                <p>• Select items your team needs for this specific bathroom</p>
                <p>• Use quantity controls for items that support multiple selections</p>
                <p>• Toilet has special logic: choose freestanding (1 task) or wall-mount (4 tasks)</p>
                <p>• All selected items will appear in your project workflow</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
