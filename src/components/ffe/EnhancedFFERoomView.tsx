'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Settings,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import DynamicFFEItem from './DynamicFFEItem'
import { FFERoomTemplate, getTemplateForRoomType } from '@/lib/ffe/room-templates'
import FFEPagination from './FFEPagination'
import toast from 'react-hot-toast'

interface EnhancedFFERoomViewProps {
  roomId: string
  roomType: string
  orgId: string
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
}

interface FFEItemStatus {
  itemId: string
  state: string
  selectionType?: string
  customOptions?: any
  standardProduct?: any
  notes?: string
  updatedAt: string
}

export default function EnhancedFFERoomView({ 
  roomId, 
  roomType,
  orgId,
  onProgressUpdate 
}: EnhancedFFERoomViewProps) {
  const [template, setTemplate] = useState<FFERoomTemplate | null>(null)
  const [itemStatuses, setItemStatuses] = useState<Record<string, FFEItemStatus>>({})
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Load room template and current statuses
  useEffect(() => {
    loadFFEData()
  }, [roomId, roomType])

  const loadFFEData = async () => {
    try {
      setLoading(true)
      
      // Get template for room type
      const roomTemplate = getTemplateForRoomType(roomType)
      if (!roomTemplate) {
        throw new Error(`No template found for room type: ${roomType}`)
      }
      setTemplate(roomTemplate)
      
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
      } else {
        // Initialize empty statuses if none exist yet
        setItemStatuses({})
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
        const updatedStatus = await response.json()
        
        setItemStatuses(prev => ({
          ...prev,
          [itemId]: {
            itemId,
            ...updates,
            updatedAt: new Date().toISOString()
          }
        }))
        
        // Save to general settings if this is a template that should be remembered
        await saveToGeneralSettings(itemId, updates)
        
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

  const getCompletionStats = () => {
    if (!template) return { total: 0, confirmed: 0, notNeeded: 0, pending: 0 }
    
    const allItems = Object.values(template.categories).flat()
    const total = allItems.length
    let confirmed = 0
    let notNeeded = 0
    let pending = 0
    
    allItems.forEach(item => {
      const status = itemStatuses[item.id]
      if (status?.state === 'confirmed') confirmed++
      else if (status?.state === 'not_needed') notNeeded++
      else pending++
    })
    
    return { total, confirmed, notNeeded, pending }
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Template Available
        </h3>
        <p className="text-gray-600">
          No FFE template is configured for room type: {roomType}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            FFE - {template.name}
          </h2>
          <p className="text-gray-600">
            Furniture, Fixtures & Equipment configuration
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {saving && (
            <div className="flex items-center gap-2 text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          )}
          
          <Button
            variant="outline"
            onClick={loadFFEData}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Completion Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progress Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
              <div className="text-sm text-gray-600">Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.notNeeded}</div>
              <div className="text-sm text-gray-600">Not Needed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
          
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

      {/* FFE Categories and Items */}
      <div className="space-y-6">
        {Object.entries(template.categories).map(([categoryName, items]) => {
          // Pagination logic for each category
          const totalItems = items.length
          const totalPages = Math.ceil(totalItems / itemsPerPage)
          const startIndex = (currentPage - 1) * itemsPerPage
          const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage)
          
          return (
            <Card key={categoryName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {categoryName}
                    <Badge variant="outline" className="ml-2">
                      {items.length} items
                    </Badge>
                  </CardTitle>
                  
                  {/* View mode toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                    >
                      Grid
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      List
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'
                )}>
                  {paginatedItems.map((item) => (
                    <DynamicFFEItem
                      key={item.id}
                      item={item}
                      roomId={roomId}
                      currentStatus={itemStatuses[item.id]}
                      onStatusUpdate={handleItemStatusUpdate}
                      isExpanded={expandedItems.has(item.id)}
                      onToggleExpanded={() => toggleItemExpanded(item.id)}
                    />
                  ))}
                </div>
                
                {/* Pagination for this category */}
                {totalItems > itemsPerPage && (
                  <FFEPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-3 pt-6">
        <Button
          variant="outline"
          onClick={() => {
            const allItemIds = Object.values(template.categories).flat().map(item => item.id)
            setExpandedItems(new Set(allItemIds))
          }}
        >
          Expand All
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setExpandedItems(new Set())}
        >
          Collapse All
        </Button>
        
        {stats.confirmed + stats.notNeeded === stats.total && (
          <Button className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete FFE Phase
          </Button>
        )}
      </div>
    </div>
  )
}