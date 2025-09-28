'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  AlertTriangle,
  RefreshCw,
  Clock,
  Target,
  Edit3,
  Save,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BATHROOM_TEMPLATE, getBathroomCategories, validateBathroomFFECompletion } from '@/lib/ffe/bathroom-template'
import ToiletSelectionLogic from './ToiletSelectionLogic'
import toast from 'react-hot-toast'

interface FFEItemStatus {
  itemId: string
  state: 'pending' | 'included' | 'not_needed' | 'confirmed'
  selectionType?: 'standard' | 'custom'
  customOptions?: any
  standardProduct?: any
  notes?: string
  quantity?: number
  variant?: string
  isCustomItem?: boolean
  customName?: string
  category?: string
  updatedAt: string
}

interface BathroomFFEWorkspaceProps {
  roomId: string
  roomType: string
  orgId?: string
  projectId?: string
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
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
  orgId,
  projectId,
  onProgressUpdate,
  disabled = false 
}: BathroomFFEWorkspaceProps) {
  const [itemStatuses, setItemStatuses] = useState<Record<string, FFEItemStatus>>({})
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Plumbing']))
  const [currentPhase, setCurrentPhase] = useState<'selection' | 'completion'>('selection')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showToiletLogic, setShowToiletLogic] = useState(false)
  const [showVanityLogic, setShowVanityLogic] = useState(false)
  const [addingCustomItem, setAddingCustomItem] = useState<string | null>(null)
  const [customItemName, setCustomItemName] = useState('')
  const [customItems, setCustomItems] = useState<Record<string, any>>({})

  // Load FFE data and statuses
  useEffect(() => {
    loadFFEData()
  }, [roomId, roomType])

  const loadFFEData = async () => {
    try {
      setLoading(true)
      
      // Load current FFE item statuses
      const response = await fetch(`/api/ffe/room-status?roomId=${roomId}`)
      if (response.ok) {
        const data = await response.json()
        
        // Convert array to object keyed by itemId
        const statusMap: Record<string, FFEItemStatus> = {}
        data.statuses?.forEach((status: FFEItemStatus) => {
          statusMap[status.itemId] = status
        })
        setItemStatuses(statusMap)
        
        // Determine which phase we're in based on existing selections
        const hasSelections = Object.values(statusMap).some(status => 
          status.state === 'included' || status.state === 'confirmed'
        )
        setCurrentPhase(hasSelections ? 'completion' : 'selection')
      } else {
        // Initialize empty statuses if none exist yet
        setItemStatuses({})
        setCurrentPhase('selection')
      }
    } catch (error) {
      console.error('Error loading FFE data:', error)
      toast.error('Failed to load FFE data')
    } finally {
      setLoading(false)
    }
  }

  const handleItemStatusUpdate = async (itemId: string, updates: any) => {
    try {
      setSaving(true)
      
      const response = await fetch('/api/ffe/room-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          itemId,
          ...updates
        })
      })

      if (response.ok) {
        setItemStatuses(prev => ({
          ...prev,
          [itemId]: {
            itemId,
            ...updates,
            updatedAt: new Date().toISOString()
          }
        }))
        
        // Save to general settings if this is a template that should be remembered
        if (orgId) {
          await saveToGeneralSettings(itemId, updates)
        }
      } else {
        throw new Error('Failed to update item status')
      }
    } catch (error) {
      console.error('Error updating item status:', error)
      toast.error('Failed to update item status')
    } finally {
      setSaving(false)
    }
  }

  const saveToGeneralSettings = async (itemId: string, updates: any) => {
    try {
      // Only save certain updates to general settings for future projects
      if (updates.selectionType || updates.customOptions || updates.standardProduct) {
        await fetch('/api/ffe/general-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            roomType,
            itemId,
            settings: {
              selectionType: updates.selectionType,
              customOptions: updates.customOptions,
              standardProduct: updates.standardProduct
            }
          })
        })
      }
    } catch (error) {
      console.error('Error saving to general settings:', error)
      // Don't show error to user - this is background functionality
    }
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

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return
    
    const currentStatus = itemStatuses[itemId]
    await handleItemStatusUpdate(itemId, {
      ...currentStatus,
      quantity: newQuantity
    })
  }

  const handleToiletSelection = async (selectionType: 'standard' | 'custom', options?: any) => {
    const toiletUpdate: any = {
      state: 'included',
      selectionType,
      quantity: 1
    }

    if (selectionType === 'standard') {
      toiletUpdate.standardProduct = options?.standardProduct || 'Standard Two-Piece Toilet'
    } else if (selectionType === 'custom') {
      toiletUpdate.customOptions = options || {}
      
      // Auto-add the 4 wall-mount sub-items for completion phase
      const subItems = ['carrier', 'bowl', 'seat', 'flush_plate']
      subItems.forEach(subItemId => {
        const fullItemId = `toilet_${subItemId}`
        if (!itemStatuses[fullItemId]) {
          handleItemStatusUpdate(fullItemId, {
            state: 'included',
            quantity: 1,
            isCustomItem: true,
            customName: `Toilet ${subItemId.charAt(0).toUpperCase() + subItemId.slice(1)}`,
            category: 'Plumbing'
          })
        }
      })
    }

    await handleItemStatusUpdate('toilet', toiletUpdate)
    setShowToiletLogic(false)
  }

  const handleVanitySelection = async (selectionType: 'standard' | 'custom', options?: any) => {
    const vanityUpdate: any = {
      state: 'included',
      selectionType,
      quantity: 1
    }

    if (selectionType === 'standard') {
      vanityUpdate.standardProduct = options?.standardProduct || 'Single Sink Vanity'
    } else if (selectionType === 'custom') {
      vanityUpdate.customOptions = options || {}
      
      // Auto-add the 4 vanity sub-items for completion phase
      const subItems = ['cabinet', 'counter', 'handle', 'paint']
      subItems.forEach(subItemId => {
        const fullItemId = `vanity_${subItemId}`
        if (!itemStatuses[fullItemId]) {
          handleItemStatusUpdate(fullItemId, {
            state: 'included',
            quantity: 1,
            isCustomItem: true,
            customName: `Vanity ${subItemId.charAt(0).toUpperCase() + subItemId.slice(1)}`,
            category: 'Plumbing'
          })
        }
      })
    }

    await handleItemStatusUpdate('vanity', vanityUpdate)
    setShowVanityLogic(false)
  }

  // Helper function to generate quantity-based items for completion phase
  const generateQuantityItems = (item: any, status: FFEItemStatus) => {
    const items = []
    const quantity = status.quantity || 1
    
    for (let i = 1; i <= quantity; i++) {
      items.push({
        id: `${item.id}_qty_${i}`,
        name: quantity > 1 ? `${item.name} #${i}` : item.name,
        originalId: item.id,
        quantityIndex: i,
        ...item
      })
    }
    
    return items
  }

  const handleAddCustomItem = async (categoryId: string) => {
    if (!customItemName.trim()) {
      toast.error('Please enter an item name')
      return
    }

    const customId = `custom_${Date.now()}`
    const customItem = {
      state: 'included',
      quantity: 1,
      isCustomItem: true,
      customName: customItemName.trim(),
      category: categoryId
    }

    // Add to local custom items state
    setCustomItems(prev => ({
      ...prev,
      [customId]: {
        id: customId,
        name: customItemName.trim(),
        category: categoryId,
        isCustom: true
      }
    }))

    await handleItemStatusUpdate(customId, customItem)
    
    setCustomItemName('')
    setAddingCustomItem(null)
    toast.success('Custom item added successfully')
  }

  const getCompletionStats = () => {
    const allItems = Object.values(BATHROOM_TEMPLATE.categories).flat()
    let total = 0
    let included = 0
    let confirmed = 0
    let notNeeded = 0
    let pending = 0
    
    allItems.forEach(item => {
      const status = itemStatuses[item.id]
      if (status?.state === 'included' || status?.state === 'confirmed') {
        // Generate quantity-based items for stats calculation
        const quantityItems = generateQuantityItems(item, status)
        total += quantityItems.length
        
        quantityItems.forEach(qtyItem => {
          const qtyStatus = itemStatuses[qtyItem.id]
          if (qtyStatus?.state === 'confirmed') confirmed++
          else if (qtyStatus?.state === 'not_needed') notNeeded++
          else if (status.state === 'included') included++
        })
      } else {
        total++
        if (status?.state === 'not_needed') notNeeded++
        else pending++
      }
    })
    
    // Add custom items to stats
    Object.entries(customItems).forEach(([customId, customItem]) => {
      const status = itemStatuses[customId]
      if (status?.state === 'included' || status?.state === 'confirmed') {
        const quantityItems = generateQuantityItems(customItem, status)
        total += quantityItems.length
        
        quantityItems.forEach(qtyItem => {
          const qtyStatus = itemStatuses[qtyItem.id]
          if (qtyStatus?.state === 'confirmed') confirmed++
          else if (qtyStatus?.state === 'not_needed') notNeeded++
          else if (status.state === 'included') included++
        })
      } else {
        total++
        if (status?.state === 'not_needed') notNeeded++
        else pending++
      }
    })
    
    return { total, included, confirmed, notNeeded, pending }
  }

  const stats = getCompletionStats()
  
  // Update progress when stats change
  useEffect(() => {
    if (onProgressUpdate && stats.total > 0) {
      const progress = Math.round(((stats.confirmed + stats.notNeeded) / stats.total) * 100)
      const isComplete = progress === 100
      onProgressUpdate(progress, isComplete)
    }
  }, [stats, onProgressUpdate])

  const proceedToCompletionPhase = () => {
    const hasSelections = stats.included > 0
    if (!hasSelections) {
      toast.error('Please select some items before proceeding to completion phase')
      return
    }
    setCurrentPhase('completion')
  }

  const backToSelectionPhase = () => {
    setCurrentPhase('selection')
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
      {/* Header with Phase Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-4 mb-2">
            <h2 className="text-xl font-bold">FFE - {roomType.replace('_', ' ')}</h2>
            <Badge 
              variant={currentPhase === 'selection' ? 'default' : 'secondary'}
              className="flex items-center gap-1"
            >
              {currentPhase === 'selection' ? (
                <><Target className="w-3 h-3" /> Phase 1: Selection</>
              ) : (
                <><CheckCircle className="w-3 h-3" /> Phase 2: Completion</>
              )}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            {currentPhase === 'selection' 
              ? 'Select which items will be included in this bathroom'
              : 'Complete the selected items for this bathroom'
            }
          </p>
        </div>
        <div className="text-right">
          {saving && (
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          )}
          <div className="text-2xl font-bold text-blue-600">
            {Math.round(((stats.confirmed + stats.notNeeded) / stats.total) * 100) || 0}%
          </div>
          <div className="text-xs text-gray-600">Overall Progress</div>
        </div>
      </div>

      {/* Phase Controls */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-4 gap-4 flex-1">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-600">Total Items</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{stats.included}</div>
                <div className="text-xs text-gray-600">Selected</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{stats.confirmed}</div>
                <div className="text-xs text-gray-600">Confirmed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-500">{stats.notNeeded}</div>
                <div className="text-xs text-gray-600">Not Needed</div>
              </div>
            </div>
            
            <div className="w-px bg-gray-300 h-8 mx-4"></div>
            
            <div className="flex items-center gap-3">
              {currentPhase === 'selection' ? (
                <Button 
                  onClick={proceedToCompletionPhase}
                  disabled={stats.included === 0 || disabled}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Proceed to Completion
                </Button>
              ) : (
                <Button 
                  onClick={backToSelectionPhase}
                  variant="outline"
                  disabled={disabled}
                >
                  <Target className="w-4 h-4 mr-2" />
                  Back to Selection
                </Button>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          {stats.total > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Completion Progress</span>
                <span>{Math.round(((stats.confirmed + stats.notNeeded) / stats.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((stats.confirmed + stats.notNeeded) / stats.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories - Selection Phase */}
      {currentPhase === 'selection' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Items for Room</h3>
            <Button 
              variant="outline" 
              onClick={loadFFEData}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          
          {Object.entries(BATHROOM_TEMPLATE.categories).map(([categoryName, items]) => {
            const isExpanded = expandedCategories.has(categoryName)
            const CategoryIcon = getCategoryIcon(categoryName)
            const categoryItems = items.filter(item => {
              const status = itemStatuses[item.id]
              return !status || status.state === 'pending' || status.state === 'included'
            })
            
            // Add custom items for this category
            const categoryCustomItems = Object.entries(customItems)
              .filter(([_, item]) => item.category === categoryName)
              .filter(([customId, _]) => {
                const status = itemStatuses[customId]
                return status?.state === 'included' || status?.state === 'pending'
              })
            
            if (categoryItems.length === 0 && categoryCustomItems.length === 0) return null

            return (
              <Card key={categoryName}>
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
                          {categoryItems.length + categoryCustomItems.length} items available
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      {isExpanded ? 'Click to collapse' : 'Click to expand'}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t space-y-3">
                    {/* Regular Template Items */}
                    {categoryItems.map(item => {
                      const status = itemStatuses[item.id]
                      const isIncluded = status?.state === 'included'

                      // Special handling for toilet
                      if (item.id === 'toilet') {
                        return (
                          <div key={item.id} className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                            isIncluded ? "border-blue-200 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                          )}>
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={isIncluded}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setShowToiletLogic(true)
                                  } else {
                                    handleItemStatusUpdate(item.id, {
                                      state: 'pending'
                                    })
                                  }
                                }}
                                disabled={disabled}
                              />
                              <div className="flex-1">
                                <h4 className="font-medium">{item.name}</h4>
                                <p className="text-sm text-gray-600">
                                  Click to select freestanding or wall-mount option
                                </p>
                                <div className="flex items-center space-x-2 mt-1">
                                  {item.isRequired && (
                                    <Badge variant="destructive" className="text-xs">
                                      Required
                                    </Badge>
                                  )}
                                  {status?.selectionType && (
                                    <Badge variant="outline" className="text-xs">
                                      {status.selectionType === 'standard' ? 'Freestanding' : 'Wall Mount'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isIncluded && (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              </div>
                            )}
                          </div>
                        )
                      }

                      // Special handling for vanity
                      if (item.id === 'vanity') {
                        return (
                          <div key={item.id} className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                            isIncluded ? "border-blue-200 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                          )}>
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={isIncluded}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setShowVanityLogic(true)
                                  } else {
                                    handleItemStatusUpdate(item.id, {
                                      state: 'pending'
                                    })
                                  }
                                }}
                                disabled={disabled}
                              />
                              <div className="flex-1">
                                <h4 className="font-medium">{item.name}</h4>
                                <p className="text-sm text-gray-600">
                                  Click to select standard or custom vanity option
                                </p>
                                <div className="flex items-center space-x-2 mt-1">
                                  {item.isRequired && (
                                    <Badge variant="destructive" className="text-xs">
                                      Required
                                    </Badge>
                                  )}
                                  {status?.selectionType && (
                                    <Badge variant="outline" className="text-xs">
                                      {status.selectionType === 'standard' ? 'Standard' : 'Custom Build'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isIncluded && (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              </div>
                            )}
                          </div>
                        )
                      }

                      return (
                        <div key={item.id} className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          isIncluded ? "border-blue-200 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        )}>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={isIncluded}
                              onCheckedChange={(checked) => {
                                handleItemStatusUpdate(item.id, {
                                  state: checked ? 'included' : 'pending',
                                  quantity: item.allowMultiple ? 1 : undefined
                                })
                              }}
                              disabled={disabled}
                            />
                            <div className="flex-1">
                              <h4 className="font-medium">{item.name}</h4>
                              {item.options && (
                                <p className="text-sm text-gray-600">
                                  Options: {item.options.slice(0, 3).join(', ')}
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

                          {isIncluded && (
                            <div className="flex items-center space-x-2">
                              {item.allowMultiple && (
                                <div className="flex items-center space-x-2 bg-white rounded border px-2 py-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuantityChange(item.id, (status?.quantity || 1) - 1)}
                                    disabled={disabled || (status?.quantity || 1) <= 1}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="font-medium min-w-8 text-center">{status?.quantity || 1}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuantityChange(item.id, (status?.quantity || 1) + 1)}
                                    disabled={disabled}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Custom Items */}
                    {categoryCustomItems.map(([customId, customItem]) => {
                      const status = itemStatuses[customId]
                      const isIncluded = status?.state === 'included'

                      return (
                        <div key={customId} className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          isIncluded ? "border-blue-200 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        )}>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={isIncluded}
                              onCheckedChange={(checked) => {
                                handleItemStatusUpdate(customId, {
                                  state: checked ? 'included' : 'pending',
                                  quantity: 1,
                                  isCustomItem: true,
                                  customName: customItem.name,
                                  category: categoryName
                                })
                              }}
                              disabled={disabled}
                            />
                            <div className="flex-1">
                              <h4 className="font-medium">{customItem.name}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                                  Custom Item
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {isIncluded && (
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-2 bg-white rounded border px-2 py-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleQuantityChange(customId, (status?.quantity || 1) - 1)}
                                  disabled={disabled || (status?.quantity || 1) <= 1}
                                  className="h-6 w-6 p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="font-medium min-w-8 text-center">{status?.quantity || 1}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleQuantityChange(customId, (status?.quantity || 1) + 1)}
                                  disabled={disabled}
                                  className="h-6 w-6 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Add Custom Item Button */}
                    <div className="border-t pt-3">
                      {addingCustomItem === categoryName ? (
                        <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                          <Input
                            placeholder="Enter custom item name..."
                            value={customItemName}
                            onChange={(e) => setCustomItemName(e.target.value)}
                            className="flex-1"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddCustomItem(categoryName)
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleAddCustomItem(categoryName)}
                            disabled={!customItemName.trim()}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAddingCustomItem(null)
                              setCustomItemName('')
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAddingCustomItem(categoryName)}
                          disabled={disabled}
                          className="w-full border-dashed"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Custom Item
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}

          {/* Toilet Selection Logic Modal */}
          {showToiletLogic && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Select Toilet Type</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowToiletLogic(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full p-4 h-auto text-left"
                    onClick={() => handleToiletSelection('standard')}
                  >
                    <div>
                      <div className="font-medium mb-2">Freestanding Toilet</div>
                      <div className="text-sm text-gray-600">Simple selection with 1 task</div>
                      <div className="text-xs text-blue-600 mt-1">Standard two-piece, one-piece, comfort height, etc.</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full p-4 h-auto text-left"
                    onClick={() => handleToiletSelection('custom')}
                  >
                    <div>
                      <div className="font-medium mb-2">Wall-Mount Toilet</div>
                      <div className="text-sm text-gray-600">Complete system with 4 tasks</div>
                      <div className="text-xs text-blue-600 mt-1">Includes: Carrier, Bowl, Seat, Flush Plate</div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Vanity Selection Logic Modal */}
          {showVanityLogic && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Select Vanity Type</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVanityLogic(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full p-4 h-auto text-left"
                    onClick={() => handleVanitySelection('standard')}
                  >
                    <div>
                      <div className="font-medium mb-2">Standard Vanity</div>
                      <div className="text-sm text-gray-600">Simple selection with 1 task</div>
                      <div className="text-xs text-blue-600 mt-1">Single/double sink, floating, traditional, etc.</div>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full p-4 h-auto text-left"
                    onClick={() => handleVanitySelection('custom')}
                  >
                    <div>
                      <div className="font-medium mb-2">Custom Vanity</div>
                      <div className="text-sm text-gray-600">Complete build with 4 tasks</div>
                      <div className="text-xs text-blue-600 mt-1">Includes: Cabinet, Counter, Handle, Paint</div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categories - Completion Phase */}
      {currentPhase === 'completion' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Complete Selected Items</h3>
            <div className="text-sm text-gray-600">
              Work through each selected item to mark as confirmed or not needed
            </div>
          </div>
          
          {Object.entries(BATHROOM_TEMPLATE.categories).map(([categoryName, items]) => {
            const CategoryIcon = getCategoryIcon(categoryName)
            const categoryItems = items.filter(item => {
              const status = itemStatuses[item.id]
              return status?.state === 'included' || status?.state === 'confirmed'
            })
            
            // Add custom items for this category in completion phase
            const categoryCustomItems = Object.entries(customItems)
              .filter(([_, item]) => item.category === categoryName)
              .filter(([customId, _]) => {
                const status = itemStatuses[customId]
                return status?.state === 'included' || status?.state === 'confirmed'
              })
            
            if (categoryItems.length === 0 && categoryCustomItems.length === 0) return null

            return (
              <Card key={categoryName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CategoryIcon className="h-5 w-5 text-gray-600" />
                      <CardTitle className="text-base">{categoryName}</CardTitle>
                      <Badge variant="outline">
                        {categoryItems.filter(item => itemStatuses[item.id]?.state === 'confirmed').length + 
                         categoryCustomItems.filter(([customId, _]) => itemStatuses[customId]?.state === 'confirmed').length} of {categoryItems.length + categoryCustomItems.length} confirmed
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Regular Template Items - with quantity expansion */}
                  {categoryItems.map(item => {
                    const status = itemStatuses[item.id]
                    if (!status) return null

                    // Generate quantity-based items if quantity > 1
                    const quantityItems = generateQuantityItems(item, status)

                    return quantityItems.map((qtyItem, index) => {
                      const qtyItemId = qtyItem.id
                      const qtyStatus = itemStatuses[qtyItemId] || {
                        ...status,
                        itemId: qtyItemId,
                        state: status.state,
                        updatedAt: status.updatedAt
                      }
                      const isConfirmed = qtyStatus?.state === 'confirmed'

                      return (
                        <div key={qtyItemId} className={cn(
                          "flex items-center justify-between p-4 rounded-lg border",
                          isConfirmed ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"
                        )}>
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              isConfirmed ? "bg-green-600" : "bg-blue-600"
                            )}>
                              {isConfirmed ? (
                                <CheckCircle className="h-5 w-5 text-white" />
                              ) : (
                                <Clock className="h-5 w-5 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{qtyItem.name}</h4>
                              {status.selectionType && (item.id === 'toilet' || item.id === 'vanity') && (
                                <p className="text-sm text-blue-600">
                                  Type: {status.selectionType === 'standard' ? 
                                    (item.id === 'toilet' ? 'Freestanding' : 'Standard') : 
                                    (item.id === 'toilet' ? 'Wall Mount' : 'Custom Build')
                                  }
                                </p>
                              )}
                              <div className="flex items-center space-x-2 mt-1">
                                {item.isRequired && (
                                  <Badge variant="destructive" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                                {quantityItems.length > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {index + 1} of {quantityItems.length}
                                  </Badge>
                                )}
                                {qtyStatus?.state === 'confirmed' && (
                                  <Badge className="text-xs bg-green-100 text-green-800">
                                    Confirmed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant={isConfirmed ? "secondary" : "default"}
                              onClick={() => handleItemStatusUpdate(qtyItemId, {
                                state: isConfirmed ? 'included' : 'confirmed',
                                originalId: item.id,
                                quantityIndex: qtyItem.quantityIndex,
                                isQuantityItem: quantityItems.length > 1
                              })}
                              disabled={disabled}
                            >
                              {isConfirmed ? (
                                <><Clock className="w-4 h-4 mr-1" />Undo</>
                              ) : (
                                <><CheckCircle className="w-4 h-4 mr-1" />Confirm</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleItemStatusUpdate(qtyItemId, {
                                state: 'not_needed',
                                originalId: item.id,
                                quantityIndex: qtyItem.quantityIndex,
                                isQuantityItem: quantityItems.length > 1
                              })}
                              disabled={disabled}
                              className="text-gray-600"
                            >
                              Not Needed
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  })}

                  {/* Custom Items in Completion Phase */}
                  {categoryCustomItems.map(([customId, customItem]) => {
                    const status = itemStatuses[customId]
                    const isConfirmed = status?.state === 'confirmed'

                    return (
                      <div key={customId} className={cn(
                        "flex items-center justify-between p-4 rounded-lg border",
                        isConfirmed ? "border-green-200 bg-green-50" : "border-purple-200 bg-purple-50"
                      )}>
                        <div className="flex items-center space-x-3 flex-1">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            isConfirmed ? "bg-green-600" : "bg-purple-600"
                          )}>
                            {isConfirmed ? (
                              <CheckCircle className="h-5 w-5 text-white" />
                            ) : (
                              <Clock className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{customItem.name}</h4>
                            {status?.quantity && status.quantity > 1 && (
                              <p className="text-sm text-gray-600">Quantity: {status.quantity}</p>
                            )}
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                                Custom Item
                              </Badge>
                              {status?.state === 'confirmed' && (
                                <Badge className="text-xs bg-green-100 text-green-800">
                                  Confirmed
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant={isConfirmed ? "secondary" : "default"}
                            onClick={() => handleItemStatusUpdate(customId, {
                              state: isConfirmed ? 'included' : 'confirmed'
                            })}
                            disabled={disabled}
                          >
                            {isConfirmed ? (
                              <><Clock className="w-4 h-4 mr-1" />Undo</>
                            ) : (
                              <><CheckCircle className="w-4 h-4 mr-1" />Confirm</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleItemStatusUpdate(customId, {
                              state: 'not_needed'
                            })}
                            disabled={disabled}
                            className="text-gray-600"
                          >
                            Not Needed
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Summary */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">
                {currentPhase === 'selection' ? 'Selection Phase Instructions' : 'Completion Phase Instructions'}
              </h4>
              <div className="text-sm text-blue-700 mt-2 space-y-1">
                {currentPhase === 'selection' ? (
                  <>
                    <p>• Select items your team needs for this specific bathroom</p>
                    <p>• Required items must be included or marked as not needed</p>
                    <p>• Use checkboxes to include items in your project scope</p>
                    <p>• Once selections are complete, proceed to completion phase</p>
                  </>
                ) : (
                  <>
                    <p>• Work through each selected item to confirm or mark as not needed</p>
                    <p>• Confirm items that will be sourced and installed</p>
                    <p>• Mark items as "Not Needed" if plans have changed</p>
                    <p>• All items must be confirmed or marked not needed to complete FFE phase</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
