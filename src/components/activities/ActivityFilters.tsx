'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Filter } from 'lucide-react'
import { ACTIVITY_TYPE_META } from '@/lib/activity-types'

interface ActivityFiltersProps {
  onFilterChange: (filters: ActivityFilterState) => void
  currentFilters: ActivityFilterState
}

export interface ActivityFilterState {
  types: string[]
  users: string[]
  startDate?: string
  endDate?: string
}

export function ActivityFilters({ onFilterChange, currentFilters }: ActivityFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<ActivityFilterState>(currentFilters)
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  
  // Fetch team members when component mounts
  useEffect(() => {
    const fetchTeamMembers = async () => {
      setLoadingMembers(true)
      try {
        const response = await fetch('/api/users')
        if (response.ok) {
          const users = await response.json()
          setTeamMembers(users)
        }
      } catch (error) {
        console.error('Failed to fetch team members:', error)
      } finally {
        setLoadingMembers(false)
      }
    }
    fetchTeamMembers()
  }, [])

  // Group activity types by category
  const categorizedTypes = Object.entries(ACTIVITY_TYPE_META).reduce((acc, [type, meta]) => {
    const category = meta.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push({ type, ...meta })
    return acc
  }, {} as Record<string, Array<{ type: string; label: string; icon: string; color: string }>>)

  const handleTypeToggle = (type: string) => {
    setLocalFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }))
  }
  
  const handleUserToggle = (userId: string) => {
    setLocalFilters(prev => ({
      ...prev,
      users: prev.users.includes(userId)
        ? prev.users.filter(u => u !== userId)
        : [...prev.users, userId]
    }))
  }

  const handleApply = () => {
    onFilterChange(localFilters)
    setIsOpen(false)
  }

  const handleClear = () => {
    const emptyFilters: ActivityFilterState = {
      types: [],
      users: [],
      startDate: undefined,
      endDate: undefined
    }
    setLocalFilters(emptyFilters)
    onFilterChange(emptyFilters)
  }

  const activeFilterCount = 
    localFilters.types.length + 
    localFilters.users.length + 
    (localFilters.startDate ? 1 : 0) + 
    (localFilters.endDate ? 1 : 0)

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="relative"
      >
        <Filter className="w-4 h-4 mr-2" />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-2 bg-purple-600 text-white text-xs rounded-full px-2 py-0.5">
            {activeFilterCount}
          </span>
        )}
      </Button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Filter Activities</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Team Member Filter */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Team Members</h4>
        {loadingMembers ? (
          <div className="text-xs text-gray-500 py-2">Loading team members...</div>
        ) : teamMembers.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">No team members found</div>
        ) : (
          <div className="space-y-1">
            {teamMembers.map((member) => (
              <label key={member.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={localFilters.users.includes(member.id)}
                  onChange={() => handleUserToggle(member.id)}
                  className="mr-2 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-700 font-medium">{member.name || member.email}</span>
                  {member.name && member.email && (
                    <span className="text-xs text-gray-500 block">{member.email}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
      
      {/* Date Range Filter */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Date Range</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-600 block mb-1">From</label>
            <input
              type="date"
              value={localFilters.startDate || ''}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">To</label>
            <input
              type="date"
              value={localFilters.endDate || ''}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Activity Type Filter */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Activity Types</h4>
        <div className="max-h-64 overflow-y-auto space-y-3">
          {Object.entries(categorizedTypes).map(([category, types]) => (
            <div key={category}>
              <h5 className="text-xs font-medium text-gray-600 mb-1">{category}</h5>
              <div className="space-y-1 ml-2">
                {types.map(({ type, label }) => (
                  <label key={type} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={localFilters.types.includes(type)}
                      onChange={() => handleTypeToggle(type)}
                      className="mr-2 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={activeFilterCount === 0}
        >
          Clear All
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
