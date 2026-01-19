'use client'

import { useState, useEffect, useMemo } from 'react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Search,
  Package,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  Truck,
  FileText,
  DollarSign,
  Send,
  ShoppingCart,
  Home,
  Hammer,
  Eye,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpecsBoardViewProps {
  projectId: string
  onItemClick?: (itemId: string) => void
}

interface BoardItem {
  id: string
  name: string
  image?: string
  category: string
  roomName?: string
  brand?: string
  quantity: number
  rrp?: number
  specStatus: string
}

// Define the procurement workflow columns
const BOARD_COLUMNS = [
  {
    id: 'SELECTED',
    label: 'Selected',
    color: 'bg-gray-100 border-gray-300',
    headerColor: 'bg-gray-500',
    icon: CheckCircle,
    description: 'Items confirmed for project'
  },
  {
    id: 'RFQ_SENT',
    label: 'RFQ Sent',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-500',
    icon: Send,
    description: 'Awaiting supplier quotes'
  },
  {
    id: 'QUOTE_RECEIVED',
    label: 'Quote Received',
    color: 'bg-indigo-50 border-indigo-200',
    headerColor: 'bg-indigo-500',
    icon: FileText,
    description: 'Quotes received from suppliers'
  },
  {
    id: 'QUOTE_APPROVED',
    label: 'Quote Approved',
    color: 'bg-violet-50 border-violet-200',
    headerColor: 'bg-violet-500',
    icon: CheckCircle,
    description: 'Ready for client invoice'
  },
  {
    id: 'INVOICED_TO_CLIENT',
    label: 'Invoiced',
    color: 'bg-amber-50 border-amber-200',
    headerColor: 'bg-amber-500',
    icon: DollarSign,
    description: 'Invoice sent to client'
  },
  {
    id: 'CLIENT_PAID',
    label: 'Client Paid',
    color: 'bg-emerald-50 border-emerald-200',
    headerColor: 'bg-emerald-500',
    icon: DollarSign,
    description: 'Payment received'
  },
  {
    id: 'ORDERED',
    label: 'Ordered',
    color: 'bg-cyan-50 border-cyan-200',
    headerColor: 'bg-cyan-500',
    icon: ShoppingCart,
    description: 'PO sent to supplier'
  },
  {
    id: 'SHIPPED',
    label: 'Shipped',
    color: 'bg-sky-50 border-sky-200',
    headerColor: 'bg-sky-500',
    icon: Truck,
    description: 'In transit'
  },
  {
    id: 'DELIVERED',
    label: 'Delivered',
    color: 'bg-teal-50 border-teal-200',
    headerColor: 'bg-teal-500',
    icon: Home,
    description: 'Received on site'
  },
  {
    id: 'INSTALLED',
    label: 'Installed',
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-500',
    icon: Hammer,
    description: 'Installation complete'
  },
  {
    id: 'COMPLETED',
    label: 'Completed',
    color: 'bg-green-100 border-green-300',
    headerColor: 'bg-green-600',
    icon: CheckCircle,
    description: 'Done',
    // Include these statuses in the completed column
    includeStatuses: ['CLOSED', 'CLIENT_TO_ORDER', 'CONTRACTOR_TO_ORDER']
  },
]

// Statuses to exclude from board (drafts, hidden, etc.)
const EXCLUDED_STATUSES = ['DRAFT', 'HIDDEN', 'ARCHIVED', 'OPTION', 'NEED_SAMPLE', 'ISSUE']

export default function SpecsBoardView({ projectId, onItemClick }: SpecsBoardViewProps) {
  const [items, setItems] = useState<BoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = useState<BoardItem | null>(null)

  useEffect(() => {
    loadItems()
  }, [projectId])

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/ffe-specs`)
      if (res.ok) {
        const data = await res.json()
        const boardItems: BoardItem[] = (data.items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          image: item.images?.[0] || null,
          category: item.category || item.sectionName || 'General',
          roomName: item.roomName,
          brand: item.brand,
          quantity: item.quantity || 1,
          rrp: item.rrp,
          specStatus: item.specStatus || 'DRAFT'
        }))
        setItems(boardItems)
      }
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.roomName?.toLowerCase().includes(query) ||
      item.brand?.toLowerCase().includes(query)
    )
  }, [items, searchQuery])

  // Group items by column and category
  const columnData = useMemo(() => {
    const columns: Record<string, { items: BoardItem[], byCategory: Record<string, BoardItem[]> }> = {}

    // Initialize columns
    BOARD_COLUMNS.forEach(col => {
      columns[col.id] = { items: [], byCategory: {} }
    })

    // Assign items to columns
    filteredItems.forEach(item => {
      if (EXCLUDED_STATUSES.includes(item.specStatus)) return

      // Find the column for this status
      let columnId = item.specStatus

      // Check if this status should be in the COMPLETED column
      const completedCol = BOARD_COLUMNS.find(c => c.includeStatuses?.includes(item.specStatus))
      if (completedCol) {
        columnId = completedCol.id
      }

      // Check if column exists
      if (!columns[columnId]) {
        // Put unknown statuses in SELECTED
        columnId = 'SELECTED'
      }

      columns[columnId].items.push(item)

      // Group by category
      if (!columns[columnId].byCategory[item.category]) {
        columns[columnId].byCategory[item.category] = []
      }
      columns[columnId].byCategory[item.category].push(item)
    })

    return columns
  }, [filteredItems])

  const toggleCategory = (columnId: string, category: string) => {
    const key = `${columnId}-${category}`
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleItemClick = (item: BoardItem) => {
    setSelectedItem(item)
    onItemClick?.(item.id)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-white">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-gray-500">
          {filteredItems.filter(i => !EXCLUDED_STATUSES.includes(i.specStatus)).length} items in workflow
        </div>
      </div>

      {/* Board */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max">
          {BOARD_COLUMNS.map(column => {
            const colData = columnData[column.id]
            const Icon = column.icon
            const itemCount = colData?.items.length || 0
            const categories = Object.keys(colData?.byCategory || {}).sort()

            return (
              <div
                key={column.id}
                className={cn(
                  'w-72 flex-shrink-0 rounded-xl border-2 flex flex-col max-h-[calc(100vh-200px)]',
                  column.color
                )}
              >
                {/* Column Header */}
                <div className={cn('p-3 rounded-t-lg text-white', column.headerColor)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{column.label}</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white border-0">
                      {itemCount}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/70 mt-1">{column.description}</p>
                </div>

                {/* Column Content */}
                <ScrollArea className="flex-1 p-2">
                  {itemCount === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No items
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {categories.map(category => {
                        const categoryItems = colData.byCategory[category]
                        const key = `${column.id}-${category}`
                        const isCollapsed = collapsedCategories.has(key)

                        return (
                          <div key={key}>
                            {/* Category Header */}
                            <button
                              onClick={() => toggleCategory(column.id, category)}
                              className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                              <span className="truncate">{category}</span>
                              <span className="text-gray-400 ml-auto">{categoryItems.length}</span>
                            </button>

                            {/* Category Items */}
                            {!isCollapsed && (
                              <div className="space-y-1.5 mt-1">
                                {categoryItems.map(item => (
                                  <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className={cn(
                                      'group bg-white rounded-lg border shadow-sm p-2 cursor-pointer',
                                      'hover:shadow-md hover:border-gray-300 transition-all',
                                      selectedItem?.id === item.id && 'ring-2 ring-blue-500 border-blue-300'
                                    )}
                                  >
                                    <div className="flex gap-2">
                                      {/* Image */}
                                      <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                                        {item.image ? (
                                          <img
                                            src={item.image}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-5 h-5 text-gray-300" />
                                          </div>
                                        )}
                                      </div>

                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                                          {item.name}
                                        </p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          {item.roomName && (
                                            <span className="text-xs text-gray-500 truncate">
                                              {item.roomName}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                          <span className="text-xs text-gray-400">
                                            Qty: {item.quantity}
                                          </span>
                                          {item.rrp && (
                                            <span className="text-xs font-medium text-emerald-600">
                                              {formatCurrency(item.rrp)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Item Quick View */}
      {selectedItem && (
        <div className="fixed bottom-4 right-4 w-80 bg-white rounded-xl shadow-2xl border p-4 z-50">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-medium text-gray-900">{selectedItem.name}</h3>
            <button
              onClick={() => setSelectedItem(null)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {selectedItem.image && (
            <div className="w-full h-40 rounded-lg overflow-hidden bg-gray-100 mb-3">
              <img
                src={selectedItem.image}
                alt={selectedItem.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <span className="font-medium">{selectedItem.category}</span>
            </div>
            {selectedItem.roomName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Room</span>
                <span className="font-medium">{selectedItem.roomName}</span>
              </div>
            )}
            {selectedItem.brand && (
              <div className="flex justify-between">
                <span className="text-gray-500">Brand</span>
                <span className="font-medium">{selectedItem.brand}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Quantity</span>
              <span className="font-medium">{selectedItem.quantity}</span>
            </div>
            {selectedItem.rrp && (
              <div className="flex justify-between">
                <span className="text-gray-500">Price (RRP)</span>
                <span className="font-medium text-emerald-600">{formatCurrency(selectedItem.rrp)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <Badge variant="secondary" className="text-xs">
                {selectedItem.specStatus.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>

          <Button
            className="w-full mt-4"
            onClick={() => onItemClick?.(selectedItem.id)}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </Button>
        </div>
      )}
    </div>
  )
}
