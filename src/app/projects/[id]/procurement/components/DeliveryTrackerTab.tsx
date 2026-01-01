'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Truck,
  Package,
  Factory,
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  List,
  ExternalLink,
  Calendar,
  ChevronRight
} from 'lucide-react'

interface DeliveryTrackerTabProps {
  projectId: string
  searchQuery: string
}

interface DeliveryItem {
  id: string
  supplierName: string
  itemsCount: number
  eta: string
  trackingNumber: string | null
  trackingUrl: string | null
  status: 'ORDERED' | 'IN_PRODUCTION' | 'SHIPPED' | 'DELIVERED'
}

const statusConfig = {
  ORDERED: {
    label: 'Ordered',
    color: 'text-gray-600',
    bgLight: 'bg-gray-50',
    bgDark: 'bg-gray-100',
    icon: Package,
  },
  IN_PRODUCTION: {
    label: 'In Production',
    color: 'text-amber-600',
    bgLight: 'bg-amber-50',
    bgDark: 'bg-amber-100',
    icon: Factory,
  },
  SHIPPED: {
    label: 'Shipped',
    color: 'text-blue-600',
    bgLight: 'bg-blue-50',
    bgDark: 'bg-blue-100',
    icon: Truck,
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
    bgDark: 'bg-emerald-100',
    icon: CheckCircle2,
  },
}

const statuses = ['ORDERED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED'] as const

export default function DeliveryTrackerTab({ projectId, searchQuery }: DeliveryTrackerTabProps) {
  const [items, setItems] = useState<DeliveryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  useEffect(() => {
    // TODO: Fetch real delivery items from API
    setLoading(false)
    setItems([])
  }, [projectId])

  // Filter items based on search
  const filteredItems = items.filter(item =>
    !searchQuery ||
    item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group items by status for kanban view
  const groupedItems = statuses.reduce((acc, status) => {
    acc[status] = filteredItems.filter(item => item.status === status)
    return acc
  }, {} as Record<typeof statuses[number], DeliveryItem[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {filteredItems.length} deliver{filteredItems.length !== 1 ? 'ies' : 'y'} to track
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 transition-colors ${viewMode === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card className="border-gray-200 border-dashed">
          <CardContent className="py-20">
            <div className="text-center max-w-sm mx-auto">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No deliveries to track
              </h3>
              <p className="text-sm text-gray-500">
                Deliveries will appear here when orders are placed with suppliers
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-4 gap-4">
          {statuses.map((status) => {
            const config = statusConfig[status]
            const Icon = config.icon
            const columnItems = groupedItems[status]

            return (
              <div key={status} className="flex flex-col min-h-[400px]">
                {/* Column Header */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-b-0 border-gray-200 ${config.bgLight}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  <span className="ml-auto text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded">
                    {columnItems.length}
                  </span>
                </div>

                {/* Column Content */}
                <div className="flex-1 p-2 border border-gray-200 rounded-b-lg bg-gray-50/50 space-y-2">
                  {columnItems.map((item) => (
                    <Card key={item.id} className="border-gray-200 bg-white hover:shadow-sm transition-shadow cursor-pointer">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {item.supplierName}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          {item.itemsCount} item{item.itemsCount !== 1 ? 's' : ''}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          ETA: {item.eta}
                        </div>
                        {item.trackingNumber && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-600 mt-1.5">
                            <span className="font-mono">{item.trackingNumber}</span>
                            {item.trackingUrl && (
                              <a href={item.trackingUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-1 mt-3 pt-2 border-t border-gray-100">
                          {status === 'ORDERED' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-gray-600">
                              Mark In Production
                            </Button>
                          )}
                          {status === 'IN_PRODUCTION' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-gray-600">
                              Mark Shipped
                            </Button>
                          )}
                          {status === 'SHIPPED' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-gray-600">
                                Add Tracking
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-emerald-600">
                                Mark Delivered
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <Card className="border-gray-200">
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Supplier</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Items</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">ETA</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Tracking</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const config = statusConfig[item.status]
                  return (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                      <td className="p-3 font-medium text-gray-900">{item.supplierName}</td>
                      <td className="p-3 text-gray-600">{item.itemsCount}</td>
                      <td className="p-3">
                        <Badge className={`${config.bgLight} ${config.color} border-0`}>
                          {config.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-600">{item.eta}</td>
                      <td className="p-3">
                        {item.trackingNumber ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-600">{item.trackingNumber}</span>
                            {item.trackingUrl && (
                              <a href={item.trackingUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 text-blue-600" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {item.status === 'ORDERED' && (
                            <Button variant="outline" size="sm" className="h-7 text-xs border-gray-300">Mark In Production</Button>
                          )}
                          {item.status === 'IN_PRODUCTION' && (
                            <Button variant="outline" size="sm" className="h-7 text-xs border-gray-300">Mark Shipped</Button>
                          )}
                          {item.status === 'SHIPPED' && (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-xs border-gray-300">Add Tracking</Button>
                              <Button variant="outline" size="sm" className="h-7 text-xs border-gray-300">Mark Delivered</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
