'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FileText,
  Clock,
  DollarSign,
  Package,
  Truck,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Eye,
  CreditCard,
  ShoppingCart,
  PackageCheck,
  Ban,
  FolderOpen,
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

// Priority colors
const priorityConfig = {
  urgent: {
    dot: 'bg-red-500',
    bg: 'hover:bg-red-50/50',
    border: 'border-l-red-500',
  },
  warning: {
    dot: 'bg-amber-500',
    bg: 'hover:bg-amber-50/50',
    border: 'border-l-amber-500',
  },
  normal: {
    dot: 'bg-blue-500',
    bg: 'hover:bg-gray-50',
    border: 'border-l-blue-500',
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

export default function ProcurementInbox() {
  const router = useRouter()
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  const fetchInbox = async () => {
    setLoading(true)
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
    }
  }

  useEffect(() => {
    fetchInbox()
  }, [])

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

  // Calculate summary stats
  const urgentCount = projectGroups.reduce(
    (sum, g) => sum + g.items.filter(i => i.priority === 'urgent').length, 0
  )
  const warningCount = projectGroups.reduce(
    (sum, g) => sum + g.items.filter(i => i.priority === 'warning').length, 0
  )

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
      {/* Summary Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {urgentCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-700 font-medium">{urgentCount} urgent</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-700 font-medium">{warningCount} warning</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-500">{totalCount} total across {projectGroups.length} project{projectGroups.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchInbox}
          className="h-8 text-gray-500"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Project Groups */}
      {projectGroups.map((group) => {
        const isCollapsed = collapsedProjects.has(group.projectId)
        const groupUrgent = group.items.filter(i => i.priority === 'urgent').length

        return (
          <div key={group.projectId} className="space-y-2">
            {/* Project Header */}
            <button
              onClick={() => toggleProject(group.projectId)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
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
                  "text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center",
                  groupUrgent > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                )}>
                  {group.items.length}
                </span>
              </div>
            </button>

            {/* Project Items */}
            {!isCollapsed && (
              <div className="space-y-2 pl-2">
                {group.items.map((item) => {
                  const priority = priorityConfig[item.priority]
                  const Icon = typeIcons[item.type]

                  return (
                    <Card
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`border-gray-200 border-l-4 ${priority.border} ${priority.bg} transition-colors cursor-pointer`}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: Content */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Title Row */}
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {item.title}
                                </h4>
                                <span className="text-xs text-gray-400 flex-shrink-0">{item.createdAt}</span>
                              </div>
                              {/* Description */}
                              <p className="text-sm text-gray-600 mb-0.5 line-clamp-1">
                                {item.description}
                              </p>
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
                              handleItemClick(item)
                            }}
                          >
                            {item.actionLabel}
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
