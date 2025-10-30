'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Clock, Package } from 'lucide-react'
import { sortWorkspaceItems, groupItemsByState, getVisibleItems, getStateCounts, FFEWorkspaceItem } from '@/lib/ffe/workspace-utils'
import { cn } from '@/lib/utils'

interface FFEWorkspaceEnhancedProps {
  roomId: string
  sections: any[]
  onItemUpdate?: (itemId: string, updates: any) => void
}

/**
 * Enhanced FFE Workspace component with:
 * 1. Pending items sorted on top
 * 2. Visual separation of pending vs confirmed items
 * 3. Support for linked items display
 */
export default function FFEWorkspaceEnhanced({ 
  roomId, 
  sections,
  onItemUpdate 
}: FFEWorkspaceEnhancedProps) {
  const [allItems, setAllItems] = useState<FFEWorkspaceItem[]>([])

  useEffect(() => {
    // Flatten all items from all sections
    const items: FFEWorkspaceItem[] = []
    sections.forEach(section => {
      section.items?.forEach((item: any) => {
        items.push({
          ...item,
          sectionName: section.name
        })
      })
    })
    setAllItems(items)
  }, [sections])

  // Sort items with pending on top
  const sortedItems = sortWorkspaceItems(allItems)
  
  // Group items by state for better visualization
  const groupedItems = groupItemsByState(sortedItems)
  
  // Get counts for display
  const counts = getStateCounts(allItems)

  const handleItemStateChange = (itemId: string, newState: string) => {
    if (onItemUpdate) {
      onItemUpdate(itemId, { state: newState })
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{counts.pending}</div>
              <div className="text-xs text-gray-600">Pending & Undecided</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{counts.selected}</div>
              <div className="text-xs text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{counts.confirmed}</div>
              <div className="text-xs text-gray-600">Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-500">{counts.notNeeded}</div>
              <div className="text-xs text-gray-600">Not Needed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending & Undecided Section - Always on Top */}
      {groupedItems.pending.length > 0 && (
        <Card className="border-2 border-amber-300 bg-amber-50/50">
          <CardHeader className="bg-amber-100 border-b border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-lg">Pending & Undecided</CardTitle>
                <Badge variant="outline" className="bg-white">
                  {groupedItems.pending.length} items
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {groupedItems.pending.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-4 rounded-lg border border-amber-200 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {item.sectionName}
                      </Badge>
                      {item.customFields?.isLinkedItem && (
                        <Badge variant="outline" className="text-xs bg-blue-50">
                          <Package className="h-3 w-3 mr-1" />
                          Linked Item
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleItemStateChange(item.id, 'SELECTED')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Start Working
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleItemStateChange(item.id, 'NOT_NEEDED')}
                  >
                    Not Needed
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* In Progress Section */}
      {groupedItems.selected.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">In Progress</CardTitle>
              <Badge variant="outline">{groupedItems.selected.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {groupedItems.selected.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-4 rounded-lg border border-blue-200 bg-blue-50"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                    <Badge variant="secondary" className="text-xs mt-1">
                      {item.sectionName}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleItemStateChange(item.id, 'CONFIRMED')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Confirm
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Confirmed Section */}
      {groupedItems.confirmed.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Confirmed</CardTitle>
              <Badge variant="outline">{groupedItems.confirmed.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {groupedItems.confirmed.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                    <Badge variant="secondary" className="text-xs mt-1">
                      {item.sectionName}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleItemStateChange(item.id, 'SELECTED')}
                >
                  Undo
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {allItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No items in this workspace yet.</p>
            <p className="text-sm mt-2">Import a template or add items manually to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export { FFEWorkspaceEnhanced }
