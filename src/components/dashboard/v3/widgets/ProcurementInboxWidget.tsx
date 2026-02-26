'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight, AlertTriangle, AlertCircle, Info } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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

interface ProcurementInboxResponse {
  projects: Array<{
    projectId: string
    projectName: string
    items: InboxItem[]
  }>
  totalCount: number
}

const priorityConfig = {
  urgent:  { icon: AlertTriangle, dot: 'bg-red-500',    bg: 'bg-red-50',   text: 'text-red-600' },
  warning: { icon: AlertCircle,   dot: 'bg-amber-400',  bg: 'bg-amber-50', text: 'text-amber-600' },
  normal:  { icon: Info,          dot: 'bg-gray-300',    bg: 'bg-gray-50',  text: 'text-gray-500' },
}

export default function ProcurementInboxWidget() {
  const { data, error } = useSWR<ProcurementInboxResponse>(
    '/api/procurement/inbox',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load inbox</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-3.5 w-3/4 bg-gray-200 rounded mb-1.5" />
              <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Flatten all items
  const allItems = data.projects.flatMap((p) =>
    p.items.map((item) => ({ ...item, projectName: p.projectName }))
  )

  if (allItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">Inbox clear</p>
        <p className="text-[12px] text-gray-400 mt-0.5">No pending procurement actions</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      <div className="flex-1 overflow-auto">
        {allItems.slice(0, 8).map((item, idx) => {
          const config = priorityConfig[item.priority] || priorityConfig.normal
          return (
            <Link
              key={`${item.id}-${idx}`}
              href={item.actionHref}
              className={`group flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                idx > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${config.dot}`} />
              <div className="flex-1 min-w-0">
                <h4 className="text-[12px] font-medium text-gray-800 truncate group-hover:text-[#1A8CA3] transition-colors">
                  {item.title}
                </h4>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">
                  {item.projectName} · {item.meta}
                </p>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${config.bg} ${config.text}`}>
                {item.priority}
              </span>
            </Link>
          )
        })}
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{data.totalCount} items</span>
        <Link
          href="/procurement"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          View All <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
