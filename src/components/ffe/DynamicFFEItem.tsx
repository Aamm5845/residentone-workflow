'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  X, 
  Settings2,
  Palette,
  Save,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FFEItemTemplate, FFESubItem, getVisibleSubItems } from '@/lib/ffe/room-templates'

interface DynamicFFEItemProps {
  item: FFEItemTemplate
  roomId: string
  currentStatus?: {
    state: string
    selectionType?: string
    customOptions?: any
    standardProduct?: any
    notes?: string
  }
  onStatusUpdate: (itemId: string, updates: any) => Promise<void>
  isExpanded?: boolean
  onToggleExpanded?: () => void
}

interface SubItemValue {
  [key: string]: string | string[]
}

export default function DynamicFFEItem({ 
  item, 
  roomId, 
  currentStatus,
  onStatusUpdate,
  isExpanded = false,
  onToggleExpanded 
}: DynamicFFEItemProps) {
  const [state, setState] = useState(currentStatus?.state || 'pending')
  const [selectionType, setSelectionType] = useState<'standard' | 'custom' | null>(
    currentStatus?.selectionType as 'standard' | 'custom' || null
  )
  const [standardSelection, setStandardSelection] = useState(
    currentStatus?.standardProduct?.selection || ''
  )
  const [customValues, setCustomValues] = useState<SubItemValue>(
    currentStatus?.customOptions || {}
  )
  const [notes, setNotes] = useState(currentStatus?.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  // Track what sub-items should be visible based on dependencies
  const visibleSubItems = item.customConfig ? 
    getVisibleSubItems(item, customValues.material as string) : []

  const handleStateChange = async (newState: string) => {
    setState(newState)
    await saveUpdates({ state: newState })
  }

  const handleSelectionTypeChange = async (type: 'standard' | 'custom') => {
    setSelectionType(type)
    
    // Clear the opposite selection when switching types
    if (type === 'standard') {
      setCustomValues({})
    } else {
      setStandardSelection('')
    }
    
    await saveUpdates({ 
      selectionType: type,
      customOptions: type === 'custom' ? customValues : {},
      standardProduct: type === 'standard' ? { selection: standardSelection } : {}
    })
  }

  const handleStandardSelectionChange = async (value: string) => {
    setStandardSelection(value)
    await saveUpdates({
      selectionType: 'standard',
      standardProduct: { selection: value }
    })
  }

  const handleCustomValueChange = async (subItemId: string, value: string | string[]) => {
    const newCustomValues = { ...customValues, [subItemId]: value }
    setCustomValues(newCustomValues)
    
    await saveUpdates({
      selectionType: 'custom',
      customOptions: newCustomValues
    })
  }

  const handleNotesChange = async (value: string) => {
    setNotes(value)
    // Debounce notes saving
    setTimeout(async () => {
      await saveUpdates({ notes: value })
    }, 1000)
  }

  const saveUpdates = async (updates: any) => {
    setIsSaving(true)
    try {
      await onStatusUpdate(item.id, {
        state,
        selectionType,
        customOptions: selectionType === 'custom' ? customValues : {},
        standardProduct: selectionType === 'standard' ? { selection: standardSelection } : {},
        notes,
        ...updates
      })
    } catch (error) {
      console.error('Error saving FFE item updates:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const getStateColor = (currentState: string) => {
    switch (currentState) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200'
      case 'not_needed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const renderSubItem = (subItem: FFESubItem) => {
    const value = customValues[subItem.id]

    switch (subItem.type) {
      case 'selection':
        return (
          <div key={subItem.id} className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {subItem.name}
              {subItem.isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Select 
              value={value as string || ''} 
              onValueChange={(newValue) => handleCustomValueChange(subItem.id, newValue)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Select ${subItem.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {subItem.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case 'color':
        return (
          <div key={subItem.id} className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {subItem.name}
              {subItem.isRequired && <span className="text-red-500">*</span>}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={value as string || '#000000'}
                onChange={(e) => handleCustomValueChange(subItem.id, e.target.value)}
                className="w-20 h-10 p-1 rounded-md border"
              />
              <Input
                type="text"
                value={value as string || ''}
                onChange={(e) => handleCustomValueChange(subItem.id, e.target.value)}
                placeholder="Color name or hex"
                className="flex-1"
              />
            </div>
          </div>
        )

      case 'checkbox':
        return (
          <div key={subItem.id} className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              {subItem.name}
              {subItem.isRequired && <span className="text-red-500">*</span>}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {subItem.options?.map((option) => {
                const selectedOptions = (value as string[]) || []
                const isChecked = selectedOptions.includes(option)
                
                return (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${subItem.id}-${option}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const currentSelected = (value as string[]) || []
                        const newSelected = checked
                          ? [...currentSelected, option]
                          : currentSelected.filter(item => item !== option)
                        handleCustomValueChange(subItem.id, newSelected)
                      }}
                    />
                    <Label 
                      htmlFor={`${subItem.id}-${option}`}
                      className="text-sm cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>
        )

      case 'input':
        return (
          <div key={subItem.id} className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {subItem.name}
              {subItem.isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Input
              value={value as string || ''}
              onChange={(e) => handleCustomValueChange(subItem.id, e.target.value)}
              placeholder={subItem.placeholder}
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className={cn(
      "transition-all duration-200 border",
      state === 'confirmed' && "border-green-200 bg-green-50",
      state === 'not_needed' && "border-gray-200 bg-gray-50",
      isExpanded && "ring-2 ring-blue-200"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpanded}
              className="p-1 h-8 w-8"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {item.name}
                {item.isRequired && (
                  <Badge variant="outline" className="text-xs">
                    Required
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-gray-600">{item.category}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSaving && (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
            
            <Badge className={getStateColor(state)}>
              {state.charAt(0).toUpperCase() + state.slice(1).replace('_', ' ')}
            </Badge>

            {/* State Action Buttons */}
            <div className="flex gap-1">
              <Button
                variant={state === 'confirmed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStateChange('confirmed')}
                className="px-2 h-7"
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button
                variant={state === 'not_needed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStateChange('not_needed')}
                className="px-2 h-7"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Standard/Custom Selection for applicable items */}
          {item.itemType === 'standard_or_custom' && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Selection Type</Label>
              <div className="flex gap-2">
                {item.hasStandardOption && (
                  <Button
                    variant={selectionType === 'standard' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSelectionTypeChange('standard')}
                    className="flex-1"
                  >
                    Standard
                  </Button>
                )}
                {item.hasCustomOption && (
                  <Button
                    variant={selectionType === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSelectionTypeChange('custom')}
                    className="flex-1"
                  >
                    <Settings2 className="w-4 h-4 mr-1" />
                    Custom
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Standard Option Selection */}
          {selectionType === 'standard' && item.standardConfig && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-sm font-semibold">Standard Options</Label>
              <p className="text-sm text-gray-600">{item.standardConfig.description}</p>
              
              <Select value={standardSelection} onValueChange={handleStandardSelectionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {item.standardConfig.options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Option Configuration */}
          {selectionType === 'custom' && item.customConfig && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                <Label className="text-sm font-semibold">Custom Configuration</Label>
              </div>
              <p className="text-sm text-gray-600">{item.customConfig.description}</p>
              
              <div className="space-y-4">
                {visibleSubItems.map(renderSubItem)}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add any additional notes or specifications..."
              className="min-h-[80px]"
            />
          </div>

          {/* Validation Messages */}
          {state === 'confirmed' && selectionType && (
            <div className="space-y-2">
              {selectionType === 'standard' && !standardSelection && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Please select a standard option to complete this item.
                </div>
              )}
              {selectionType === 'custom' && visibleSubItems.some(subItem => 
                subItem.isRequired && !customValues[subItem.id]
              ) && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Please complete all required custom fields.
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}