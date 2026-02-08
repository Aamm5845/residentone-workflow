'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FileText,
  Clock,
  DollarSign,
  Truck,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Eye,
  CreditCard,
  PackageCheck,
  Ban,
  FolderOpen,
  Inbox,
  AlertTriangle,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'

// Inbox item types
type InboxItemType =
  | 'quote_received'
  | 'quote_expiring'
  | 'supplier_declined'
  | 'invoice_viewed'
  | 'invoice_overdue'
  | 'payment_received'
  | 'partial_payment'
  | 'supplier_payment_pending'
  | 'order_overdue'
  | 'tracking_missing'
  | 'delivery_confirm'
  | 'delivery_exception'

interface InboxItem {
  id: string
  type: InboxItemType
  priority: 'urgent' | 'warning' | 'normal'
  title: string
  description: string
  meta: string
  actionLabel: string
  actionHref: string
  createdAt: string
  projectId: string
  projectName: string
}

interface ProjectGroup {
  projectId: string
  projectName: string
  items: InboxItem[]
}

// Category filter definitions
type CategoryFilter = 'all' | 'quotes' | 'invoices' | 'orders'

const categoryFilters: { key: CategoryFilter; label: string; types: InboxItemType[] }[] = [
  { key: 'all', label: 'All', types: [] },
  {
    key: 'quotes',
    label: 'Quotes & RFQs',
    types: ['quote_received', 'quote_expiring', 'supplier_declined'],
  },
  {
    key: 'invoices',
    label: 'Invoices & Payments',
    types: ['invoice_viewed', 'invoice_overdue', 'payment_received', 'partial_payment', 'supplier_payment_pending'],
  },
  {
    key: 'orders',
    label: 'Orders & Delivery',
    types: ['order_overdue', 'tracking_missing', 'delivery_confirm', 'delivery_exception'],
  },
]

// Priority colors
const priorityConfig = {
  urgent: {
    dot: 'bg-red-500',
    bg: 'hover:bg-red-50/50',
    border: 'border-l-red-500',
    iconBg: 'bg-red-50',
    iconText: 'text-red-600',
  },
  warning: {
    dot: 'bg-amber-500',
    bg: 'hover:bg-amber-50/50',
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
  },
  normal: {
    dot: 'bg-blue-500',
    bg: 'hover:bg-gray-50',
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
  },
}

// Item type icons
const typeIcons: Record<InboxItemType, any> = {
  quote_received: FileText,
  quote_expiring: Clock,
  supplier_declined: Ban,
  invoice_viewed: Eye,
  invoice_overdue: AlertCircle,
  payment_received: CheckCircle2,
  partial_payment: CreditCard,
  supplier_payment_pending: DollarSign,
  order_overdue: AlertCircle,
  tracking_missing: Truck,
  delivery_confirm: PackageCheck,
  delivery_exception: XCircle,
}

// Project tag colors (cycle through these)
const projectColors = [
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-emerald-50 text-emerald-700',
  'bg-orange-50 text-orange-700',
  'bg-pink-50 text-pink-700',
  'bg-cyan-50 text-cyan-700',
  'bg-indigo-50 text-indigo-700',
  'bg-teal-50 text-teal-700',
]

export default function ProcurementInbox() {
  const router = useRouter()
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [groupByProject, setGroupByProject] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  const fetchInbox = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const res = await fetch('/api/procurement/inbox')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setProjectGroups(data.projects || [])
      setTotalCount(data.totalCount || 0)
    } catch (error) {
      console.error('Error fetching procurement inbox:', error)
      toast.error('Failed to load procurement inbox')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchInbox()
  }, [])

  // Flatten all items from all project groups
  const allItems = useMemo(() => {
    const items: InboxItem[] = []
    for (const group of projectGroups) {
      items.push(...group.items)
    }
    // Sort by priority then by date
    const priorityOrder = { urgent: 0, warning: 1, normal: 2 }
    items.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
    return items
  }, [projectGroups])

  // Apply category filter
  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return allItems
    const cat = categoryFilters.find(c => c.key === activeCategory)
    if (!cat) return allItems
    return allItems.filter(item => cat.types.includes(item.type))
  }, [allItems, activeCategory])

  // Build filtered project groups for grouped view
  const filteredProjectGroups = useMemo(() => {
    if (activeCategory === 'all') return projectGroups
    const cat = categoryFilters.find(c => c.key === activeCategory)
    if (!cat) return projectGroups
    return projectGroups
      .map(g => ({
        ...g,
        items: g.items.filter(item => cat.types.includes(item.type)),
      }))
      .filter(g => g.items.length > 0)
  }, [projectGroups, activeCategory])

  // Build a stable color map for project names
  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>()
    const uniqueProjects = [...new Set(allItems.map(i => i.projectName))]
    uniqueProjects.forEach((name, idx) => {
      map.set(name, projectColors[idx % projectColors.length])
    })
    return map
  }, [allItems])

  // Calculate summary stats
  const urgentCount = allItems.filter(i => i.priority === 'urgent').length
  const warningCount = allItems.filter(i => i.priority === 'warning').length
  const projectCount = projectGroups.length

  const toggleProject = (projectId: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const handleItemClick = (item: InboxItem) => {
    router.push(item.actionHref)
  }

  // Category counts for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = { all: allItems.length, quotes: 0, invoices: 0, orders: 0 }
    for (const item of allItems) {
      for (const cat of categoryFilters) {
        if (cat.key !== 'all' && cat.types.includes(item.type)) {
          counts[cat.key]++
        }
      }
    }
    return counts
  }, [allItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  // Empty state
  if (projectGroups.length === 0) {
    return (
      <Card className="border-gray-200 border-dashed">
        <CardContent className="py-20">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              All caught up across all projects
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              You have no pending procurement actions. New items will appear here when suppliers respond to RFQs, clients view invoices, or orders need attention.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
              <Inbox className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-xs text-gray-500">Total Items</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{urgentCount}</p>
              <p className="text-xs text-gray-500">Urgent</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{warningCount}</p>
              <p className="text-xs text-gray-500">Warnings</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
              <Layers className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{projectCount}</p>
              <p className="text-xs text-gray-500">Projects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {categoryFilters.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'px-4 py-2 text-sm rounded-lg transition-colors',
                activeCategory === cat.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {cat.label}
              {categoryCounts[cat.key] > 0 && (
                <span className={cn(
                  'ml-2 text-xs rounded-full px-1.5 py-0.5',
                  activeCategory === cat.key
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-500'
                )}>
                  {categoryCounts[cat.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right side: group toggle + refresh */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={groupByProject}
              onChange={e => setGroupByProject(e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
            />
            Group by project
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchInbox(true)}
            disabled={refreshing}
            className="h-8 text-gray-500"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Item List */}
      {groupByProject ? (
        /* Grouped View */
        <div className="space-y-6">
          {filteredProjectGroups.map(group => {
            const isCollapsed = collapsedProjects.has(group.projectId)
            const groupUrgent = group.items.filter(i => i.priority === 'urgent').length

            return (
              <div key={group.projectId} className="space-y-3">
                {/* Project Header */}
                <button
                  onClick={() => toggleProject(group.projectId)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <FolderOpen className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900">{group.projectName}</span>
                    <span className={cn(
                      'text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center',
                      groupUrgent > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    )}>
                      {group.items.length}
                    </span>
                  </div>
                </button>

                {/* Project Items */}
                {!isCollapsed && (
                  <div className="space-y-3 pl-2">
                    {group.items.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        showProjectTag={false}
                        projectColorMap={projectColorMap}
                        onItemClick={handleItemClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Flat View */
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              No items in this category.
            </div>
          ) : (
            filteredItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                showProjectTag={true}
                projectColorMap={projectColorMap}
                onItemClick={handleItemClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** Individual item card component */
function ItemCard({
  item,
  showProjectTag,
  projectColorMap,
  onItemClick,
}: {
  item: InboxItem
  showProjectTag: boolean
  projectColorMap: Map<string, string>
  onItemClick: (item: InboxItem) => void
}) {
  const priority = priorityConfig[item.priority]
  const Icon = typeIcons[item.type]
  const projectColor = projectColorMap.get(item.projectName) || 'bg-gray-100 text-gray-600'

  return (
    <div
      onClick={() => onItemClick(item)}
      className={cn(
        'bg-white rounded-lg border border-gray-200 border-l-4 hover:shadow-md transition-all duration-200 cursor-pointer',
        priority.border,
        priority.bg
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Icon + Content */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
              priority.iconBg
            )}>
              <Icon className={cn('w-4 h-4', priority.iconText)} />
            </div>
            <div className="flex-1 min-w-0">
              {/* Title Row */}
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {item.title}
                </h4>
                <span className="text-xs text-gray-400 flex-shrink-0">{item.createdAt}</span>
              </div>
              {/* Description + Project Tag */}
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-600 truncate">
                  {item.description}
                </p>
                {showProjectTag && (
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                    projectColor
                  )}>
                    {item.projectName}
                  </span>
                )}
              </div>
              {/* Meta */}
              <p className="text-xs text-gray-400">
                {item.meta}
              </p>
            </div>
          </div>

          {/* Right: Action Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-gray-600 hover:text-gray-900 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onItemClick(item)
            }}
          >
            {item.actionLabel}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
