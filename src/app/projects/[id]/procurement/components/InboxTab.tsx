'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Clock,
  DollarSign,
  Package,
  Truck,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface InboxTabProps {
  projectId: string
  searchQuery: string
  onNavigateToQuote?: (quoteId: string) => void
}

// Inbox item types
type InboxItemType =
  | 'quote_received'
  | 'quote_expiring'
  | 'invoice_viewed'
  | 'payment_received'
  | 'order_overdue'
  | 'tracking_missing'

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
  quoteId?: string
}

// Priority colors - more subtle and professional
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
const typeIcons = {
  quote_received: FileText,
  quote_expiring: Clock,
  invoice_viewed: DollarSign,
  payment_received: DollarSign,
  order_overdue: AlertCircle,
  tracking_missing: Truck,
}

export default function InboxTab({ projectId, searchQuery, onNavigateToQuote }: InboxTabProps) {
  const router = useRouter()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInbox = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/inbox`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setItems(data.items || [])
    } catch (error) {
      console.error('Error fetching inbox:', error)
      toast.error('Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInbox()
  }, [projectId])

  // Filter items based on search
  const filteredItems = items.filter(item =>
    !searchQuery ||
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleItemClick = (item: InboxItem) => {
    // If it's a quote and we have the callback, use it to switch tabs
    if (item.type === 'quote_received' && item.quoteId && onNavigateToQuote) {
      onNavigateToQuote(item.quoteId)
    } else {
      // Otherwise navigate to the href
      router.push(item.actionHref)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  // Empty state
  if (filteredItems.length === 0) {
    return (
      <Card className="border-gray-200 border-dashed">
        <CardContent className="py-20">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              All caught up
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              You have no pending actions. New items will appear here when suppliers respond to RFQs, clients view invoices, or orders need attention.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Inbox Summary */}
      <div className="flex items-center justify-between px-1 mb-4">
        <p className="text-sm text-gray-500">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} requiring action
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchInbox}
          className="h-8 text-gray-500"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Inbox Cards */}
      {filteredItems.map((item) => {
        const priority = priorityConfig[item.priority]
        const Icon = typeIcons[item.type]

        return (
          <Card
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={`border-gray-200 border-l-4 ${priority.border} ${priority.bg} transition-colors cursor-pointer`}
          >
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between gap-4">
                {/* Left: Content */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Title Row */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </h4>
                      <span className="text-xs text-gray-400 flex-shrink-0">{item.createdAt}</span>
                    </div>
                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-1 line-clamp-1">
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
  )
}
