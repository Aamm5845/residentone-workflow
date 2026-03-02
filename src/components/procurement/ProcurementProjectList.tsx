'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Truck,
  CheckCircle2,
  Eye,
  CreditCard,
  PackageCheck,
  Ban,
  XCircle,
  Search,
  Inbox,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectItem {
  id: string
  name: string
  status: string
  client: { id: string; name: string }
  _count: {
    rfqs: number
    orders: number
    clientQuotes: number
  }
}

interface InboxItem {
  id: string
  type: string
  priority: 'urgent' | 'warning' | 'normal'
  title: string
  description: string
  meta: string
  actionLabel: string
  actionHref: string
  createdAt: string
}

interface InboxProject {
  projectId: string
  projectName: string
  items: InboxItem[]
}

interface ProcurementProjectListProps {
  projects: ProjectItem[]
}

type CategoryFilter = 'all' | 'quotes' | 'invoices' | 'orders'

const categoryFilters: { key: CategoryFilter; label: string; types: string[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'quotes', label: 'Quotes & RFQs', types: ['quote_received', 'quote_expiring', 'supplier_declined'] },
  { key: 'invoices', label: 'Invoices & Payments', types: ['invoice_viewed', 'invoice_overdue', 'payment_received', 'partial_payment', 'supplier_payment_pending'] },
  { key: 'orders', label: 'Orders & Delivery', types: ['order_overdue', 'tracking_missing', 'delivery_confirm', 'delivery_exception'] },
]

const priorityConfig = {
  urgent: { dot: 'bg-red-500', border: 'border-l-red-400', iconBg: 'bg-red-50', iconText: 'text-red-600', rowBg: 'hover:bg-red-50/40' },
  warning: { dot: 'bg-amber-400', border: 'border-l-amber-400', iconBg: 'bg-amber-50', iconText: 'text-amber-600', rowBg: 'hover:bg-amber-50/40' },
  normal: { dot: 'bg-blue-400', border: 'border-l-blue-400', iconBg: 'bg-blue-50', iconText: 'text-blue-600', rowBg: 'hover:bg-blue-50/40' },
}

const typeIcons: Record<string, any> = {
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

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : { projects: [], totalCount: 0 })

export default function ProcurementProjectList({ projects }: ProcurementProjectListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['__all__']))
  const [showAllProjects, setShowAllProjects] = useState(false)

  const { data: inboxData, isValidating, mutate } = useSWR<{ projects: InboxProject[]; totalCount: number }>(
    '/api/procurement/inbox',
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )

  const inboxProjects = inboxData?.projects || []
  const isLoading = !inboxData && !isValidating

  // Apply category filter to inbox projects
  const filteredInboxProjects = useMemo(() => {
    let filtered = inboxProjects

    // Category filter
    if (activeCategory !== 'all') {
      const cat = categoryFilters.find(c => c.key === activeCategory)
      if (cat) {
        filtered = filtered
          .map(p => ({ ...p, items: p.items.filter(i => cat.types.includes(i.type)) }))
          .filter(p => p.items.length > 0)
      }
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(p =>
        p.projectName.toLowerCase().includes(q) ||
        p.items.some(i =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
        )
      )
    }

    return filtered
  }, [inboxProjects, activeCategory, search])

  // Stats
  const stats = useMemo(() => {
    const allItems = inboxProjects.flatMap(p => p.items)
    return {
      total: allItems.length,
      urgent: allItems.filter(i => i.priority === 'urgent').length,
      warning: allItems.filter(i => i.priority === 'warning').length,
      projects: inboxProjects.length,
    }
  }, [inboxProjects])

  // Category counts
  const categoryCounts = useMemo(() => {
    const allItems = inboxProjects.flatMap(p => p.items)
    const counts: Record<CategoryFilter, number> = { all: allItems.length, quotes: 0, invoices: 0, orders: 0 }
    for (const item of allItems) {
      for (const cat of categoryFilters) {
        if (cat.key !== 'all' && cat.types.includes(item.type)) {
          counts[cat.key]++
        }
      }
    }
    return counts
  }, [inboxProjects])

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  // Projects without inbox items (for "Browse All" section)
  const projectsWithoutInbox = useMemo(() => {
    const inboxProjectIds = new Set(inboxProjects.map(p => p.projectId))
    return projects.filter(p => !inboxProjectIds.has(p.id))
  }, [projects, inboxProjects])

  // Initialize all projects as expanded on first load
  useMemo(() => {
    if (inboxProjects.length > 0 && expandedProjects.has('__all__')) {
      setExpandedProjects(new Set(inboxProjects.map(p => p.projectId)))
    }
  }, [inboxProjects])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Procurement Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">Action items across all your projects</p>
      </div>

      {/* Stat Pills */}
      {stats.total > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm">
            <Inbox className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-900">{stats.total}</span>
            <span className="text-gray-500">items</span>
          </div>
          {stats.urgent > 0 && (
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-2 text-sm">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-red-700">{stats.urgent}</span>
              <span className="text-red-600">urgent</span>
            </div>
          )}
          {stats.warning > 0 && (
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-700">{stats.warning}</span>
              <span className="text-amber-600">warnings</span>
            </div>
          )}
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm">
            <FolderOpen className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-900">{stats.projects}</span>
            <span className="text-gray-500">{stats.projects === 1 ? 'project' : 'projects'}</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {categoryFilters.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'px-3.5 py-1.5 text-sm rounded-lg transition-colors',
                activeCategory === cat.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {cat.label}
              {categoryCounts[cat.key] > 0 && (
                <span className={cn(
                  'ml-1.5 text-xs rounded-full px-1.5 py-0.5',
                  activeCategory === cat.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                )}>
                  {categoryCounts[cat.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-48 pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-colors"
            />
          </div>
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', isValidating && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {!inboxData && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
              <div className="space-y-3">
                <div className="h-10 bg-gray-100 rounded" />
                <div className="h-10 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {inboxData && filteredInboxProjects.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 border-dashed p-16 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {search || activeCategory !== 'all' ? 'No matching items' : 'All caught up'}
          </h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            {search || activeCategory !== 'all'
              ? 'Try adjusting your filters or search.'
              : 'No pending procurement actions across any project. Items will appear here when they need your attention.'}
          </p>
        </div>
      )}

      {/* Inbox Projects */}
      {inboxData && filteredInboxProjects.length > 0 && (
        <div className="space-y-4">
          {filteredInboxProjects.map(project => {
            const isExpanded = expandedProjects.has(project.projectId)
            const urgentCount = project.items.filter(i => i.priority === 'urgent').length
            const warningCount = project.items.filter(i => i.priority === 'warning').length

            return (
              <div key={project.projectId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Project Header */}
                <button
                  onClick={() => toggleProject(project.projectId)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-semibold text-gray-900">{project.projectName}</span>
                    <span className="text-xs text-gray-400 font-normal">{project.items.length} {project.items.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {urgentCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {urgentCount} urgent
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {warningCount} warning
                      </span>
                    )}
                    <Link
                      href={`/projects/${project.projectId}/procurement`}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-gray-400 hover:text-gray-700 ml-2 transition-colors"
                    >
                      Open project →
                    </Link>
                  </div>
                </button>

                {/* Inbox Items */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {project.items.map((item, idx) => {
                      const config = priorityConfig[item.priority] || priorityConfig.normal
                      const Icon = typeIcons[item.type] || FileText

                      return (
                        <div
                          key={item.id}
                          onClick={() => router.push(item.actionHref)}
                          className={cn(
                            'flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors border-l-3',
                            config.border,
                            config.rowBg,
                            idx > 0 && 'border-t border-gray-50'
                          )}
                        >
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', config.iconBg)}>
                            <Icon className={cn('w-3.5 h-3.5', config.iconText)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                            <p className="text-xs text-gray-500 truncate">{item.description} · {item.meta}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-gray-400">{item.createdAt}</span>
                            <span className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors">
                              {item.actionLabel} →
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Browse All Projects */}
      {projectsWithoutInbox.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowAllProjects(prev => !prev)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            {showAllProjects ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span>{projectsWithoutInbox.length} {projectsWithoutInbox.length === 1 ? 'project' : 'projects'} with no action items</span>
          </button>

          {showAllProjects && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {projectsWithoutInbox.map(project => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/procurement`}
                  className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all group"
                >
                  <FolderOpen className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{project.name}</p>
                    <p className="text-xs text-gray-400 truncate">{project.client.name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
