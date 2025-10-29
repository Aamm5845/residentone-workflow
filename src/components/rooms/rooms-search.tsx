'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RoomsSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [activeFilters, setActiveFilters] = useState({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || ''
  })

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    updateURL({ search: query })
  }

  const handleStatusFilter = (status: string) => {
    const newStatus = activeFilters.status === status ? '' : status
    setActiveFilters(prev => ({ ...prev, status: newStatus }))
    updateURL({ status: newStatus })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setActiveFilters({ status: '', search: '' })
    router.push('/rooms')
  }

  const updateURL = (updates: { status?: string, search?: string }) => {
    const current = new URLSearchParams(searchParams)
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        current.set(key, value)
      } else {
        current.delete(key)
      }
    })

    const search = current.toString()
    const query = search ? `?${search}` : ''
    router.push(`/rooms${query}`)
  }

  const hasActiveFilters = activeFilters.status || activeFilters.search

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search rooms, projects, or clients..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="text-gray-500"
          >
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">Filters:</span>
        </div>
        <Button
          variant={activeFilters.status === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStatusFilter('active')}
          className="text-xs"
        >
          Active Rooms
        </Button>
        <Button
          variant={activeFilters.status === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStatusFilter('completed')}
          className="text-xs"
        >
          Completed Rooms
        </Button>
      </div>

      {/* Active Filter Indicator */}
      {hasActiveFilters && (
        <div className="text-sm text-gray-600">
          {activeFilters.status && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mr-2">
              Status: {activeFilters.status}
            </span>
          )}
          {activeFilters.search && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Search: "{activeFilters.search}"
            </span>
          )}
        </div>
      )}
    </div>
  )
}
