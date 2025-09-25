'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle, 
  Circle, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  Info,
  Package,
  ExternalLink,
  Edit3,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  getRoomFFEConfig, 
  FFEItemTemplate, 
  FFESubItem, 
  FFECategory,
  calculateFFECompletionStatus 
} from '@/lib/constants/room-ffe-config'
import toast from 'react-hot-toast'

interface FFEItemStatus {
  id: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_NEEDED'
  confirmedAt?: Date
  confirmedBy?: string
  subItemsCompleted?: string[]
  notes?: string
  supplierLink?: string
  actualPrice?: number
  estimatedDelivery?: Date
}

interface RoomFFEChecklistProps {
  roomId: string
  roomType: string
  roomName: string
  onProgress: (progress: number, isComplete: boolean) => void
  className?: string
}

export default function RoomFFEChecklist({ 
  roomId, 
  roomType, 
  roomName, 
  onProgress, 
  className 
}: RoomFFEChecklistProps) {
  const [config, setConfig] = useState(getRoomFFEConfig(roomType))
  const [itemStatuses, setItemStatuses] = useState<Record<string, FFEItemStatus>>({})
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load existing FFE data for this room
  useEffect(() => {
    loadFFEData()
  }, [roomId])

  // Calculate and report progress whenever statuses change
  useEffect(() => {
    if (config) {
      const completedItems = Object.keys(itemStatuses).filter(
        itemId => itemStatuses[itemId]?.status === 'COMPLETED'
      )
      
      const completionStatus = calculateFFECompletionStatus(roomType, completedItems)
      onProgress(completionStatus.progress, completionStatus.isComplete)
    }
  }, [itemStatuses, config, roomType, onProgress])

  const loadFFEData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe/room/${roomId}/status`)
      if (response.ok) {
        const data = await response.json()
        setItemStatuses(data.itemStatuses || {})
      }
    } catch (error) {
      console.error('Failed to load FFE data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateItemStatus = async (itemId: string, updates: Partial<FFEItemStatus>) => {
    try {
      const currentStatus = itemStatuses[itemId] || { id: itemId, status: 'NOT_STARTED' }
      const newStatus = { ...currentStatus, ...updates }
      
      // Optimistic update
      setItemStatuses(prev => ({ ...prev, [itemId]: newStatus }))
      
      // API call
      const response = await fetch(`/api/ffe/room/${roomId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) {
        throw new Error('Failed to update item status')
      }
      
      const result = await response.json()
      setItemStatuses(prev => ({ ...prev, [itemId]: result.itemStatus }))
      
    } catch (error) {
      console.error('Failed to update item status:', error)
      // Revert optimistic update
      loadFFEData()
      toast.error('Failed to update item status')
    }
  }

  const toggleItemCompletion = (itemId: string) => {
    const currentStatus = itemStatuses[itemId]?.status || 'NOT_STARTED'
    const newStatus = currentStatus === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED'
    
    updateItemStatus(itemId, { 
      status: newStatus,
      confirmedAt: newStatus === 'COMPLETED' ? new Date() : undefined
    })
  }

  const toggleItemExpansion = (itemId: string) => {
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

  const getItemsByCategory = (categoryId: string): FFEItemTemplate[] => {
    return config?.items.filter(item => item.category === categoryId) || []
  }

  const getCategoryProgress = (categoryId: string): { completed: number; total: number; percentage: number } => {
    const items = getItemsByCategory(categoryId)
    const completed = items.filter(item => itemStatuses[item.id]?.status === 'COMPLETED').length
    const total = items.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return { completed, total, percentage }
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600'
      case 'IN_PROGRESS': return 'text-blue-600'
      case 'NOT_NEEDED': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'IN_PROGRESS': return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
      case 'NOT_NEEDED': return <Badge className="bg-gray-100 text-gray-600">Not Needed</Badge>
      default: return <Badge className="bg-gray-100 text-gray-600">Pending</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-4 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!config) {
    return (
      <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
        <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Room Configuration Not Found
        </h3>
        <p className="text-gray-600 mb-4">
          No FFE configuration found for room type: <code className="bg-gray-100 px-2 py-1 rounded">{roomType}</code>
        </p>
        <p className="text-sm text-gray-500">
          This room type may not have a predefined FFE template yet. You can still add custom items.
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{config.displayName} FFE Checklist</h2>
            <p className="text-gray-600 mt-1">{roomName} • Room-specific furniture, fixtures & equipment</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-600">
              {getCategoryProgress('ALL').percentage}%
            </div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
        </div>
        
        {config.completionCriteria.customMessage && (
          <div className="bg-white rounded-lg p-4 border border-emerald-200">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Completion Requirements</h4>
                <p className="text-sm text-gray-700">{config.completionCriteria.customMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Sections */}
      <div className="space-y-4">
        {config.categories.map(category => {
          const items = getItemsByCategory(category.id)
          const progress = getCategoryProgress(category.id)
          const isExpanded = expandedCategories.has(category.id)
          
          return (
            <div key={category.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Category Header */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleCategoryExpansion(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${category.color} rounded-lg flex items-center justify-center shadow-md`}>
                      <span className="text-xl text-white">{category.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {progress.completed}/{progress.total}
                      </div>
                      <div className="text-sm text-gray-600">
                        {progress.percentage}% complete
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-gradient-to-r ${category.color} transition-all duration-500`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Category Items */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-6 pt-0">
                  <div className="space-y-4 mt-6">
                    {items.map(item => (
                      <FFEItemCard
                        key={item.id}
                        item={item}
                        status={itemStatuses[item.id]}
                        isExpanded={expandedItems.has(item.id)}
                        onToggleCompletion={() => toggleItemCompletion(item.id)}
                        onToggleExpansion={() => toggleItemExpansion(item.id)}
                        onUpdateStatus={(updates) => updateItemStatus(item.id, updates)}
                      />
                    ))}
                    
                    {items.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No items defined for this category</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Individual FFE Item Component
interface FFEItemCardProps {
  item: FFEItemTemplate
  status?: FFEItemStatus
  isExpanded: boolean
  onToggleCompletion: () => void
  onToggleExpansion: () => void
  onUpdateStatus: (updates: Partial<FFEItemStatus>) => void
}

function FFEItemCard({
  item,
  status,
  isExpanded,
  onToggleCompletion,
  onToggleExpansion,
  onUpdateStatus
}: FFEItemCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({
    notes: status?.notes || '',
    supplierLink: status?.supplierLink || '',
    actualPrice: status?.actualPrice?.toString() || ''
  })

  const isCompleted = status?.status === 'COMPLETED'
  const isRequired = item.isRequired
  const hasSubItems = item.subItems && item.subItems.length > 0

  const handleSaveEdit = () => {
    onUpdateStatus({
      notes: editForm.notes || undefined,
      supplierLink: editForm.supplierLink || undefined,
      actualPrice: editForm.actualPrice ? parseFloat(editForm.actualPrice) : undefined
    })
    setEditMode(false)
  }

  const formatPrice = (price?: number) => {
    if (!price) return null
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  return (
    <div className={`rounded-lg border-2 transition-all duration-200 ${
      isCompleted 
        ? 'border-green-200 bg-green-50' 
        : isRequired 
        ? 'border-blue-200 bg-blue-50' 
        : 'border-gray-200 bg-white'
    }`}>
      {/* Item Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {/* Completion Toggle */}
            <button
              onClick={onToggleCompletion}
              className={`mt-1 transition-colors ${
                isCompleted ? 'text-green-600' : 'text-gray-400 hover:text-green-600'
              }`}
            >
              {isCompleted ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Circle className="w-5 h-5" />
              )}
            </button>

            {/* Item Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className={`font-medium ${
                  isCompleted ? 'text-green-900' : 'text-gray-900'
                }`}>
                  {item.name}
                </h4>
                {isRequired && (
                  <Badge className="bg-red-100 text-red-800 text-xs">Required</Badge>
                )}
                {item.priority === 'high' && (
                  <Badge className="bg-orange-100 text-orange-800 text-xs">High Priority</Badge>
                )}
              </div>
              
              {item.description && (
                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
              )}

              <div className="flex items-center space-x-4 text-xs text-gray-500">
                {item.estimatedPrice && (
                  <span className="flex items-center space-x-1">
                    <DollarSign className="w-3 h-3" />
                    <span>Est. {formatPrice(item.estimatedPrice)}</span>
                  </span>
                )}
                {item.leadTimeWeeks && (
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.leadTimeWeeks} weeks</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {status && (
              <div className="mr-2">
                {status.status === 'COMPLETED' ? (
                  <Badge className="bg-green-100 text-green-800">Completed</Badge>
                ) : status.status === 'IN_PROGRESS' ? (
                  <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-600">Pending</Badge>
                )}
              </div>
            )}

            {(hasSubItems || editMode) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpansion}
                className="text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditMode(!editMode)}
              className="text-gray-400 hover:text-gray-600"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Sub-items */}
          {hasSubItems && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Specifications Required:</h5>
              <div className="space-y-2">
                {item.subItems!.map(subItem => (
                  <div key={subItem.id} className="flex items-center space-x-2 text-sm">
                    <Circle className="w-3 h-3 text-gray-400" />
                    <span className={subItem.isRequired ? 'text-gray-900' : 'text-gray-600'}>
                      {subItem.name}
                      {subItem.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit Form */}
          {editMode && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes, specifications, or requirements..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier" className="text-sm font-medium text-gray-700">
                    Supplier Link
                  </Label>
                  <Input
                    id="supplier"
                    type="url"
                    value={editForm.supplierLink}
                    onChange={(e) => setEditForm(prev => ({ ...prev, supplierLink: e.target.value }))}
                    placeholder="https://supplier.com/product"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="price" className="text-sm font-medium text-gray-700">
                    Actual Price
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={editForm.actualPrice}
                    onChange={(e) => setEditForm(prev => ({ ...prev, actualPrice: e.target.value }))}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Existing Status Info */}
          {!editMode && (status?.notes || status?.supplierLink || status?.actualPrice) && (
            <div className="space-y-2">
              {status.notes && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Notes: </span>
                  <span className="text-sm text-gray-600">{status.notes}</span>
                </div>
              )}
              
              {status.supplierLink && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Supplier: </span>
                  <a
                    href={status.supplierLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <span>View Product</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              
              {status.actualPrice && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Actual Price: </span>
                  <span className="text-sm text-gray-900 font-medium">
                    {formatPrice(status.actualPrice)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}