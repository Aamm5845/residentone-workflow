'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  FileText,
  FolderOpen,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Search,
  ShoppingCart,
  Receipt,
  Inbox,
  Package,
} from 'lucide-react'

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

interface ProcurementProjectListProps {
  projects: ProjectItem[]
}

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : { projects: [], totalCount: 0 })

export default function ProcurementProjectList({ projects }: ProcurementProjectListProps) {
  const [search, setSearch] = useState('')

  // Fetch inbox data for alert counts per project
  const { data: inboxData } = useSWR('/api/procurement/inbox', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: true,
  })

  const inboxProjects: { projectId: string; projectName: string; items: any[] }[] = inboxData?.projects || []

  // Build a map of projectId -> inbox items
  const inboxByProject = useMemo(() => {
    const map = new Map<string, { total: number; urgent: number; warning: number }>()
    for (const p of inboxProjects) {
      const urgent = p.items.filter((i: any) => i.priority === 'urgent').length
      const warning = p.items.filter((i: any) => i.priority === 'warning').length
      map.set(p.projectId, { total: p.items.length, urgent, warning })
    }
    return map
  }, [inboxProjects])

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.client.name.toLowerCase().includes(q)
    )
  }, [projects, search])

  const totalInboxCount = inboxData?.totalCount || 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement</h1>
          <p className="text-gray-600 mt-0.5">
            Manage procurement per project — RFQs, quotes, orders, and deliveries
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
              <p className="text-xs text-gray-500">Active Projects</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
              <Inbox className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalInboxCount}</p>
              <p className="text-xs text-gray-500">Action Items</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Array.from(inboxByProject.values()).reduce((sum, p) => sum + p.urgent, 0)}
              </p>
              <p className="text-xs text-gray-500">Urgent</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Array.from(inboxByProject.values()).reduce((sum, p) => sum + p.warning, 0)}
              </p>
              <p className="text-xs text-gray-500">Warnings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Project Cards */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-dashed p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {search ? 'No matching projects' : 'No active projects'}
          </h3>
          <p className="text-sm text-gray-500">
            {search
              ? 'Try a different search term.'
              : 'Create a project to start managing procurement.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map(project => {
            const inbox = inboxByProject.get(project.id)
            const hasActivity = project._count.rfqs > 0 || project._count.orders > 0 || project._count.clientQuotes > 0

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}/procurement`}
                className="block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
              >
                <div className="p-4 flex items-center justify-between">
                  {/* Left: Project info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-amber-50 transition-colors">
                      <FolderOpen className="w-5 h-5 text-gray-500 group-hover:text-amber-600 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {project.name}
                        </h3>
                        {inbox && inbox.urgent > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            <AlertCircle className="w-3 h-3" />
                            {inbox.urgent} urgent
                          </span>
                        )}
                        {inbox && inbox.warning > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            {inbox.warning} warning
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{project.client.name}</p>
                    </div>
                  </div>

                  {/* Middle: Counts */}
                  <div className="flex items-center gap-4 flex-shrink-0 mx-4">
                    {project._count.rfqs > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500" title="RFQs">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{project._count.rfqs}</span>
                      </div>
                    )}
                    {project._count.clientQuotes > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500" title="Client Quotes">
                        <Receipt className="w-3.5 h-3.5" />
                        <span>{project._count.clientQuotes}</span>
                      </div>
                    )}
                    {project._count.orders > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500" title="Orders">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>{project._count.orders}</span>
                      </div>
                    )}
                    {!hasActivity && (
                      <span className="text-xs text-gray-400">No procurement yet</span>
                    )}
                  </div>

                  {/* Right: Inbox badge + arrow */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {inbox && inbox.total > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-500 text-white px-2.5 py-1 rounded-full">
                        <Inbox className="w-3 h-3" />
                        {inbox.total}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-amber-500 transition-colors" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
