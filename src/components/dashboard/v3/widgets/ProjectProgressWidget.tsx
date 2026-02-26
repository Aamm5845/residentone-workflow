'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ProjectReport {
  id: string
  name: string
  clientName: string
  status: string
  overallCompletion: number
  roomCount: number
}

interface ReportsResponse {
  projects: ProjectReport[]
  summary: {
    totalProjects: number
    totalRooms: number
    overallCompletion: number
  }
}

export default function ProjectProgressWidget() {
  const { data, error } = useSWR<ReportsResponse>(
    '/api/reports?status=IN_PROGRESS',
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load projects</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-8 bg-gray-200 rounded" />
            </div>
            <div className="h-2 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  const projects = data.projects || []

  if (projects.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">No active projects</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Project progress will appear here</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      {/* Overall completion */}
      {data.summary && (
        <div className="px-4 pb-3 mb-1 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.08em] font-medium text-gray-400">Overall</span>
            <span className="text-[13px] font-semibold text-gray-900">{Math.round(data.summary.overallCompletion)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1A8CA3] rounded-full transition-all"
              style={{ width: `${data.summary.overallCompletion}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {projects.slice(0, 6).map((project, idx) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className={`group block px-4 py-2.5 hover:bg-gray-50 transition-colors ${
              idx > 0 ? 'border-t border-gray-100' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-[12px] font-medium text-gray-800 truncate group-hover:text-[#1A8CA3] transition-colors">
                {project.name}
              </h4>
              <span className="text-[11px] font-semibold text-gray-600 flex-shrink-0 ml-2">
                {Math.round(project.overallCompletion)}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${project.overallCompletion}%`,
                  backgroundColor: project.overallCompletion >= 80 ? '#22c55e' : project.overallCompletion >= 40 ? '#1A8CA3' : '#f6762e',
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {project.clientName} · {project.roomCount} rooms
            </p>
          </Link>
        ))}
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 flex items-center justify-end">
        <Link
          href="/reports"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          Full Report <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
