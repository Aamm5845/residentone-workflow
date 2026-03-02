'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, ChevronDown } from 'lucide-react'

export interface ActivityFilterState {
  types: string[]
  users: string[]
  startDate?: string
  endDate?: string
  category?: string
}

// Category tab definitions — maps UI tabs to activity categories
export const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'projects', label: 'Projects', categories: ['Projects', 'Rooms', 'Workflow'] },
  { id: 'procurement', label: 'Procurement', categories: ['Procurement', 'Deliveries'] },
  { id: 'design', label: 'Design', categories: ['Design', 'Renderings', 'Drawings', 'FFE', 'Approvals'] },
  { id: 'team', label: 'Team', categories: ['Team', 'Contractors'] },
  { id: 'billing', label: 'Billing', categories: ['Billing'] },
  { id: 'files', label: 'Files', categories: ['Files', 'Assets'] },
] as const

interface ActivityFiltersProps {
  onFilterChange: (filters: ActivityFilterState) => void
  currentFilters: ActivityFilterState
}

function formatDateForDisplay(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
}

export function ActivityFilters({ onFilterChange, currentFilters }: ActivityFiltersProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const activeCategory = currentFilters.category || 'all'

  const handleCategoryChange = (categoryId: string) => {
    onFilterChange({
      ...currentFilters,
      category: categoryId === 'all' ? undefined : categoryId,
    })
  }

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    onFilterChange({
      ...currentFilters,
      [field]: value || undefined,
    })
  }

  const startDisplay = formatDateForDisplay(currentFilters.startDate)
  const endDisplay = formatDateForDisplay(currentFilters.endDate)

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Category Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleCategoryChange(tab.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeCategory === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Range Picker */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="text-sm gap-2"
        >
          <Calendar className="w-4 h-4" />
          {startDisplay && endDisplay ? (
            <span>{startDisplay} to {endDisplay}</span>
          ) : (
            <span>Last 7 days</span>
          )}
          <ChevronDown className="w-3 h-3" />
        </Button>

        {showDatePicker && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[280px]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">From</label>
                <input
                  type="date"
                  value={currentFilters.startDate || ''}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">To</label>
                <input
                  type="date"
                  value={currentFilters.endDate || ''}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  onFilterChange({ ...currentFilters, startDate: undefined, endDate: undefined })
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Reset to default
              </button>
              <Button
                size="sm"
                onClick={() => setShowDatePicker(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
