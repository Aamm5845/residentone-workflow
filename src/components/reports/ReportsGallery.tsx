'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { BarChart3, RefreshCw, Loader2, Search, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectGalleryCard } from '@/components/reports/ProjectGalleryCard'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

type SortOption = 'name' | 'completion' | 'updated'

export function ReportsGallery() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortOption>('updated')

  const { data, error, isLoading, mutate } = useSWR(
    `/api/reports?status=${statusFilter}`,
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true
    }
  )

  const projects = data?.projects || []
  const summary = data?.summary || null

  // Filter, search, and sort projects
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((project: any) => 
        project.name.toLowerCase().includes(query) ||
        project.clientName.toLowerCase().includes(query)
      )
    }
    
    // Sort
    const sorted = [...filtered].sort((a: any, b: any) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'completion':
          return b.overallCompletion - a.overallCompletion
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    })
    
    return sorted
  }, [projects, searchQuery, sortBy])

  const handleRefresh = () => {
    mutate()
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-10 h-10 text-indigo-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Project Reports</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredAndSortedProjects.length} {filteredAndSortedProjects.length === 1 ? 'project' : 'projects'} • {summary?.overallCompletion || 0}% overall completion
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="updated">Sort by: Last Updated</option>
              <option value="name">Sort by: Name</option>
              <option value="completion">Sort by: Completion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32">
            <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg text-gray-600 mb-2">Failed to load reports</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        ) : filteredAndSortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Grid3x3 className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg text-gray-600 mb-2">No projects found</p>
            <p className="text-sm text-gray-500">
              {searchQuery
                ? 'Try a different search term.'
                : statusFilter !== 'all' 
                ? 'Try changing the filter or create a new project to get started.'
                : 'Create a new project to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedProjects.map((project: any) => (
              <ProjectGalleryCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
