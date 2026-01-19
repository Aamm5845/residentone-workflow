'use client'

import { useState, useEffect, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Search,
  Package,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpecsBoardViewProps {
  projectId: string
  onItemClick?: (itemId: string) => void
  refreshTrigger?: number
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
  clientApproved: boolean
}

// Define the procurement workflow columns - consolidated
const BOARD_COLUMNS = [
  { id: 'SELECTED', label: 'Selected' },
  { id: 'RFQ_SENT', label: 'RFQ Sent' },
  { id: 'QUOTED', label: 'Quoted', includeStatuses: ['QUOTE_RECEIVED', 'BUDGET_SENT'] },
  { id: 'QUOTE_APPROVED', label: 'Approved' },
  { id: 'INVOICED_TO_CLIENT', label: 'Invoiced' },
  { id: 'CLIENT_PAID', label: 'Paid' },
  { id: 'ORDERED', label: 'Ordered' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'INSTALLED', label: 'Installed' },
  { id: 'COMPLETED', label: 'Done', includeStatuses: ['CLOSED', 'CLIENT_TO_ORDER', 'CONTRACTOR_TO_ORDER'] },
]

// Statuses to exclude from board
const EXCLUDED_STATUSES = ['DRAFT', 'HIDDEN', 'ARCHIVED', 'OPTION', 'NEED_SAMPLE', 'ISSUE']

export default function SpecsBoardView({ projectId, onItemClick, refreshTrigger }: SpecsBoardViewProps) {
  const [items, setItems] = useState<BoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadItems()
  }, [projectId, refreshTrigger])

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
          specStatus: item.specStatus || 'DRAFT',
          clientApproved: item.clientApproved || false
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

    BOARD_COLUMNS.forEach(col => {
      columns[col.id] = { items: [], byCategory: {} }
    })

    filteredItems.forEach(item => {
      if (EXCLUDED_STATUSES.includes(item.specStatus)) return

      let columnId = item.specStatus
      const completedCol = BOARD_COLUMNS.find(c => c.includeStatuses?.includes(item.specStatus))
      if (completedCol) {
        columnId = completedCol.id
      }
      if (!columns[columnId]) {
        columnId = 'SELECTED'
      }

      columns[columnId].items.push(item)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-white">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
        <span className="text-xs text-gray-400">
          {filteredItems.filter(i => !EXCLUDED_STATUSES.includes(i.specStatus)).length} items
        </span>
      </div>

      {/* Board - Fixed columns */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {BOARD_COLUMNS.map(column => {
            const colData = columnData[column.id]
            const itemCount = colData?.items.length || 0
            const categories = Object.keys(colData?.byCategory || {}).sort()

            return (
              <div
                key={column.id}
                className="flex-1 min-w-0 flex flex-col border-r border-gray-200 last:border-r-0"
              >
                {/* Column Header */}
                <div className="px-2 py-1.5 bg-gray-100 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide truncate">
                      {column.label}
                    </span>
                    {itemCount > 0 && (
                      <span className="text-[10px] text-gray-400 ml-1">
                        {itemCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto p-1">
                  {itemCount === 0 ? (
                    <div className="text-center py-4 text-gray-300 text-[10px]">
                      —
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {categories.map(category => {
                        const categoryItems = colData.byCategory[category]
                        const key = `${column.id}-${category}`
                        const isCollapsed = collapsedCategories.has(key)

                        return (
                          <div key={key}>
                            {/* Category Header */}
                            <button
                              onClick={() => toggleCategory(column.id, category)}
                              className="w-full flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-2.5 h-2.5 flex-shrink-0" />
                              )}
                              <span className="truncate">{category}</span>
                              <span className="text-gray-400 ml-auto flex-shrink-0">{categoryItems.length}</span>
                            </button>

                            {/* Category Items */}
                            {!isCollapsed && (
                              <div className="space-y-0.5 ml-2">
                                {categoryItems.map(item => (
                                  <div
                                    key={item.id}
                                    onClick={() => onItemClick?.(item.id)}
                                    className={cn(
                                      "flex items-center gap-1 p-1 bg-white rounded border cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all",
                                      item.clientApproved ? "border-emerald-200 bg-emerald-50/50" : "border-gray-100"
                                    )}
                                  >
                                    {/* Tiny Image */}
                                    <div className="w-6 h-6 rounded overflow-hidden bg-gray-50 flex-shrink-0 relative">
                                      {item.image ? (
                                        <img
                                          src={item.image}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Package className="w-3 h-3 text-gray-300" />
                                        </div>
                                      )}
                                      {item.clientApproved && (
                                        <div className="absolute -top-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5">
                                          <CheckCircle2 className="w-2 h-2 text-white" />
                                        </div>
                                      )}
                                    </div>
                                    {/* Name */}
                                    <span className="text-[10px] text-gray-700 truncate flex-1 leading-tight">
                                      {item.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
