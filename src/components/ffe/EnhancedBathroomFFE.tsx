'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  X, 
  Clock, 
  Settings,
  Save,
  Eye,
  EyeOff,
  Building2,
  Wrench,
  Lightbulb,
  Palette,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { 
  BATHROOM_TEMPLATE, 
  FFEItemTemplate, 
  FFESubItem, 
  FFEItemState,
  isItemVisible,
  getVisibleSubItems,
  validateItemConfiguration
} from '@/lib/ffe/bathroom-template'

// Enhanced interfaces for the three-state system
interface FFEItemStatus {
  itemId: string
  state: FFEItemState
  selectionType?: 'standard' | 'custom'
  standardProduct?: {
    selectedOption: string
    notes?: string
  }
  customOptions?: Record<string, any>
  isCustomExpanded?: boolean
  notes?: string
  confirmedAt?: string
  updatedAt?: string
}

interface FFERoomStatus {
  roomId: string
  roomType: string
  items: Record<string, FFEItemStatus>
  completionPercentage: number
  lastUpdated: string
}

interface EnhancedBathroomFFEProps {
  roomId: string
  roomType: string
  orgId: string
  projectId: string
  onStatusUpdate?: (status: FFERoomStatus) => void
}

// State icons and colors
const STATE_CONFIG = {
  pending: {
    icon: Timer,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    label: '⏳ Pending',
    description: 'Needs decision'
  },
  included: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
    label: '✅ Included',
    description: 'Will be provided'
  },
  not_needed: {
    icon: XCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    label: '🚫 Not Needed',
    description: 'Not required'
  },
  custom_expanded: {
    icon: Settings,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    label: '🔧 Custom',
    description: 'Custom specification'
  }
}

const CATEGORY_ICONS = {
  'Base Finishes': Building2,
  'Fixtures': Wrench,
  'Accessories': Palette,
  'Lighting': Lightbulb
}

export default function EnhancedBathroomFFE({
  roomId,
  roomType,
  orgId,
  projectId,
  onStatusUpdate
}: EnhancedBathroomFFEProps) {
  const [roomStatus, setRoomStatus] = useState<FFERoomStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('Base Finishes')

  const template = BATHROOM_TEMPLATE
  const categoryNames = Object.keys(template.categories)

  // Load room status
  useEffect(() => {
    loadRoomStatus()
  }, [roomId])

  // Auto-expand first category
  useEffect(() => {
    if (categoryNames.length > 0) {
      setExpandedCategories(new Set([categoryNames[0]]))
      setActiveTab(categoryNames[0])
    }
  }, [categoryNames])

  const loadRoomStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe/room-status?roomId=${roomId}&orgId=${orgId}`)
      
      if (response.ok) {
        const data = await response.json()
        setRoomStatus(data.status || initializeRoomStatus())
      } else {
        // Initialize new room status
        setRoomStatus(initializeRoomStatus())
      }
    } catch (error) {
      console.error('Error loading room status:', error)
      toast.error('Failed to load room data')
      setRoomStatus(initializeRoomStatus())
    } finally {
      setLoading(false)
    }
  }

  const initializeRoomStatus = (): FFERoomStatus => {
    const items: Record<string, FFEItemStatus> = {}
    
    // Initialize all items from template
    Object.values(template.categories).flat().forEach(item => {
      items[item.id] = {
        itemId: item.id,
        state: item.defaultState || 'pending',
        notes: '',
        updatedAt: new Date().toISOString()
      }
    })

    return {
      roomId,
      roomType,
      items,
      completionPercentage: 0,
      lastUpdated: new Date().toISOString()
    }
  }

  const updateItemStatus = async (itemId: string, updates: Partial<FFEItemStatus>) => {
    if (!roomStatus) return

    const updatedItems = {
      ...roomStatus.items,
      [itemId]: {
        ...roomStatus.items[itemId],
        ...updates,
        updatedAt: new Date().toISOString(),
        confirmedAt: updates.state === 'included' || updates.state === 'custom_expanded' 
          ? new Date().toISOString() 
          : undefined
      }
    }

    const newStatus = {
      ...roomStatus,
      items: updatedItems,
      completionPercentage: calculateCompletion(updatedItems),
      lastUpdated: new Date().toISOString()
    }

    setRoomStatus(newStatus)
    
    // Debounced save
    await saveRoomStatus(newStatus)
  }

  const saveRoomStatus = async (status: FFERoomStatus) => {
    try {
      setSaving(true)
      const response = await fetch('/api/ffe/room-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          orgId,
          projectId,
          status
        })
      })

      if (response.ok) {
        onStatusUpdate?.(status)
        toast.success('Progress saved', { duration: 2000 })
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      console.error('Error saving room status:', error)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const calculateCompletion = (items: Record<string, FFEItemStatus>): number => {
    const allItems = Object.values(template.categories).flat()
    const requiredItems = allItems.filter(item => item.isRequired)
    
    const completedRequired = requiredItems.filter(item => {
      const status = items[item.id]
      return status && (status.state === 'included' || status.state === 'custom_expanded')
    }).length
    
    return requiredItems.length > 0 ? Math.round((completedRequired / requiredItems.length) * 100) : 0
  }

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const handleStateChange = (itemId: string, newState: FFEItemState) => {
    const item = Object.values(template.categories).flat().find(i => i.id === itemId)
    if (!item) return

    const updates: Partial<FFEItemStatus> = { state: newState }
    
    // Reset selection data when changing states
    if (newState === 'pending') {
      updates.selectionType = undefined
      updates.standardProduct = undefined
      updates.customOptions = undefined
      updates.isCustomExpanded = false
    } else if (newState === 'included' && item.hasStandardOption) {
      updates.selectionType = 'standard'
      updates.isCustomExpanded = false
    } else if (newState === 'custom_expanded') {
      updates.selectionType = 'custom'
      updates.isCustomExpanded = true
      updates.customOptions = {}
    }

    updateItemStatus(itemId, updates)
    
    // Auto-expand item if it becomes custom
    if (newState === 'custom_expanded') {
      setExpandedItems(prev => new Set([...prev, itemId]))
    }
  }

  const handleSelectionTypeChange = (itemId: string, selectionType: 'standard' | 'custom') => {
    const updates: Partial<FFEItemStatus> = {
      selectionType,
      state: selectionType === 'standard' ? 'included' : 'custom_expanded',
      isCustomExpanded: selectionType === 'custom'
    }

    if (selectionType === 'standard') {
      updates.customOptions = undefined
    } else {
      updates.standardProduct = undefined
      updates.customOptions = {}
    }

    updateItemStatus(itemId, updates)
    
    if (selectionType === 'custom') {
      setExpandedItems(prev => new Set([...prev, itemId]))
    }
  }

  const handleStandardSelection = (itemId: string, selectedOption: string) => {
    updateItemStatus(itemId, {
      standardProduct: { selectedOption },
      state: 'included'
    })
  }

  const handleCustomOptionChange = (itemId: string, subItemId: string, value: any) => {
    if (!roomStatus) return
    
    const currentCustomOptions = roomStatus.items[itemId]?.customOptions || {}
    
    updateItemStatus(itemId, {
      customOptions: {
        ...currentCustomOptions,
        [subItemId]: value
      }
    })
  }

  const validateAndShowErrors = () => {
    if (!roomStatus) return
    
    const errors: string[] = []
    const allItems = Object.values(template.categories).flat()
    
    allItems.forEach(item => {
      const status = roomStatus.items[item.id]
      const itemErrors = validateItemConfiguration(item, status)
      errors.push(...itemErrors)
    })
    
    if (errors.length > 0) {
      toast.error(`Please complete required items: ${errors.join(', ')}`)
    } else {
      toast.success('All required items are complete!')
    }
  }

  const getFilteredItems = (categoryName: string) => {
    const items = template.categories[categoryName] || []
    
    return items.filter(item => {
      if (!roomStatus) return true
      
      // Show all items if showCompleted is true
      if (showCompleted) return true
      
      // Otherwise only show pending/incomplete items
      const status = roomStatus.items[item.id]
      return !status || status.state === 'pending'
    })
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!roomStatus) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Failed to load room data</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Header with Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                {template.name} FFE Checklist
              </CardTitle>
              <p className="text-gray-600 mt-1">
                Furniture, Fixtures & Equipment specification
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {roomStatus.completionPercentage}%
                </div>
                <div className="text-sm text-gray-500">Complete</div>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                    fill="transparent"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    fill="transparent"
                    strokeDasharray={`${roomStatus.completionPercentage * 0.88} 88`}
                    className="transition-all duration-500"
                  />
                </svg>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center space-x-2"
              >
                {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span>{showCompleted ? 'Hide Completed' : 'Show All'}</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={validateAndShowErrors}
                className="flex items-center space-x-2"
              >
                <AlertCircle className="h-4 w-4" />
                <span>Validate</span>
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              {saving && (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                  Saving...
                </div>
              )}
              <div className="text-sm text-gray-500">
                Last updated: {new Date(roomStatus.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          {categoryNames.map(categoryName => {
            const CategoryIcon = CATEGORY_ICONS[categoryName as keyof typeof CATEGORY_ICONS] || Building2
            const categoryItems = getFilteredItems(categoryName)
            const completedItems = categoryItems.filter(item => {
              const status = roomStatus.items[item.id]
              return status && (status.state === 'included' || status.state === 'custom_expanded')
            })
            
            return (
              <TabsTrigger key={categoryName} value={categoryName} className="flex items-center space-x-2">
                <CategoryIcon className="h-4 w-4" />
                <span>{categoryName}</span>
                <Badge variant="secondary" className="ml-1">
                  {completedItems.length}/{categoryItems.length}
                </Badge>
              </TabsTrigger>
            )
          })}
        </TabsList>
        
        {categoryNames.map(categoryName => (
          <TabsContent key={categoryName} value={categoryName}>
            <div className="space-y-4">
              {getFilteredItems(categoryName).map(item => (
                <FFEItemCard
                  key={item.id}
                  item={item}
                  status={roomStatus.items[item.id]}
                  isExpanded={expandedItems.has(item.id)}
                  onToggleExpansion={() => toggleItemExpansion(item.id)}
                  onStateChange={(state) => handleStateChange(item.id, state)}
                  onSelectionTypeChange={(type) => handleSelectionTypeChange(item.id, type)}
                  onStandardSelection={(option) => handleStandardSelection(item.id, option)}
                  onCustomOptionChange={(subId, value) => handleCustomOptionChange(item.id, subId, value)}
                  onNotesChange={(notes) => updateItemStatus(item.id, { notes })}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

// Individual FFE Item Card Component
interface FFEItemCardProps {
  item: FFEItemTemplate
  status: FFEItemStatus
  isExpanded: boolean
  onToggleExpansion: () => void
  onStateChange: (state: FFEItemState) => void
  onSelectionTypeChange: (type: 'standard' | 'custom') => void
  onStandardSelection: (option: string) => void
  onCustomOptionChange: (subItemId: string, value: any) => void
  onNotesChange: (notes: string) => void
}

function FFEItemCard({
  item,
  status,
  isExpanded,
  onToggleExpansion,
  onStateChange,
  onSelectionTypeChange,
  onStandardSelection,
  onCustomOptionChange,
  onNotesChange
}: FFEItemCardProps) {
  const stateConfig = STATE_CONFIG[status.state]
  const StateIcon = stateConfig.icon
  
  const canExpand = (item.hasStandardOption && item.hasCustomOption) || 
                   (status.state === 'custom_expanded' && item.customConfig)
  
  const visibleSubItems = item.customConfig 
    ? getVisibleSubItems(item, status.customOptions) 
    : []

  return (
    <Card className={cn('transition-all duration-200', stateConfig.borderColor)}>
      <CardContent className="p-0">
        {/* Main Item Header */}
        <div className={cn('p-4', stateConfig.bgColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <StateIcon className={cn('h-5 w-5', stateConfig.color)} />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  {item.isRequired && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {stateConfig.description}
                </p>
              </div>
            </div>
            
            {/* State Selection Buttons */}
            <div className="flex items-center space-x-2">
              <div className="flex bg-white rounded-lg border p-1">
                {(['pending', 'included', 'not_needed'] as FFEItemState[]).map(state => {
                  const config = STATE_CONFIG[state]
                  const Icon = config.icon
                  return (
                    <button
                      key={state}
                      onClick={() => onStateChange(state)}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                        status.state === state
                          ? `${config.color} bg-opacity-20 ${config.bgColor}`
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                      title={config.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
              
              {canExpand && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpansion}
                  className="p-1 h-8 w-8"
                >
                  {isExpanded ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Expanded Content */}
        {isExpanded && (status.state === 'included' || status.state === 'custom_expanded') && (
          <div className="border-t bg-white p-4 space-y-4">
            {/* Standard vs Custom Choice */}
            {item.hasStandardOption && item.hasCustomOption && (
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">
                    Configuration Type:
                  </label>
                  <div className="flex space-x-2">
                    <Button
                      variant={status.selectionType === 'standard' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onSelectionTypeChange('standard')}
                    >
                      Standard
                    </Button>
                    <Button
                      variant={status.selectionType === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onSelectionTypeChange('custom')}
                    >
                      Custom
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Standard Options */}
            {status.selectionType === 'standard' && item.standardConfig && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  {item.standardConfig.description}
                </label>
                <Select
                  value={status.standardProduct?.selectedOption || ''}
                  onValueChange={onStandardSelection}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {item.standardConfig.options?.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Custom Options */}
            {status.selectionType === 'custom' && item.customConfig && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  {item.customConfig.description}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleSubItems.map(subItem => (
                    <SubItemField
                      key={subItem.id}
                      subItem={subItem}
                      value={status.customOptions?.[subItem.id]}
                      onChange={(value) => onCustomOptionChange(subItem.id, value)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Notes
              </label>
              <Textarea
                value={status.notes || ''}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Additional notes or specifications..."
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Sub-item field component
interface SubItemFieldProps {
  subItem: FFESubItem
  value: any
  onChange: (value: any) => void
}

function SubItemField({ subItem, value, onChange }: SubItemFieldProps) {
  const renderField = () => {
    switch (subItem.type) {
      case 'selection':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {subItem.options?.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'color':
        return (
          <div className="flex space-x-2">
            <Input
              type="color"
              value={value?.hex || '#000000'}
              onChange={(e) => onChange({ hex: e.target.value, name: value?.name || '' })}
              className="w-16 h-10 p-1 rounded"
            />
            <Input
              type="text"
              value={value?.name || ''}
              onChange={(e) => onChange({ hex: value?.hex || '#000000', name: e.target.value })}
              placeholder="Color name"
              className="flex-1"
            />
          </div>
        )
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {subItem.options?.map(option => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  checked={(value || []).includes(option)}
                  onCheckedChange={(checked) => {
                    const currentValues = value || []
                    if (checked) {
                      onChange([...currentValues, option])
                    } else {
                      onChange(currentValues.filter((v: string) => v !== option))
                    }
                  }}
                />
                <label className="text-sm">{option}</label>
              </div>
            ))}
          </div>
        )
      
      case 'measurement':
        return (
          <div className="flex space-x-2">
            <Input
              type="number"
              value={value?.amount || ''}
              onChange={(e) => onChange({ amount: e.target.value, unit: subItem.unit })}
              placeholder={subItem.placeholder || '0'}
              className="flex-1"
            />
            <div className="flex items-center px-3 bg-gray-50 rounded-md border border-gray-300">
              <span className="text-sm text-gray-600">{subItem.unit}</span>
            </div>
          </div>
        )
      
      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={subItem.placeholder}
          />
        )
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
        <span>{subItem.name}</span>
        {subItem.isRequired && (
          <span className="text-red-500 text-xs">*</span>
        )}
      </label>
      {renderField()}
    </div>
  )
}