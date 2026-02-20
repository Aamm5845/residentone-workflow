'use client'

import { Search, X, List, LayoutGrid, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FilterPill, { type FilterOption } from './FilterPill'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FilesToolbarProps {
  // Search
  searchValue: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void

  // Filters
  sectionOptions: FilterOption[]
  selectedSectionId: string | null
  onSectionChange: (value: string | null) => void
  onAddSection?: () => void

  floorOptions: FilterOption[]
  selectedFloorId: string | null
  onFloorChange: (value: string | null) => void

  statusOptions: FilterOption[]
  selectedStatus: string | null
  onStatusChange: (value: string | null) => void

  hasActiveFilters: boolean
  onClearFilters: () => void

  // View mode
  viewMode: 'table' | 'cards'
  onViewModeChange: (mode: 'table' | 'cards') => void

  // Add drawing
  onAddDrawing: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FilesToolbar({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  sectionOptions,
  selectedSectionId,
  onSectionChange,
  onAddSection,
  floorOptions,
  selectedFloorId,
  onFloorChange,
  statusOptions,
  selectedStatus,
  onStatusChange,
  hasActiveFilters,
  onClearFilters,
  viewMode,
  onViewModeChange,
  onAddDrawing,
}: FilesToolbarProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search drawings..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
          className="h-8 w-52 rounded-lg border border-gray-200 bg-white pl-8 pr-8 text-sm
            text-gray-700 placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300
            transition-all"
        />
        {searchValue && (
          <button
            onClick={() => { onSearchChange(''); onSearchSubmit() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-200" />

      {/* Filter pills */}
      <FilterPill
        label="Section"
        value={selectedSectionId}
        options={sectionOptions}
        onChange={onSectionChange}
        onAdd={onAddSection}
        addLabel="Add Section"
      />
      <FilterPill
        label="Floor"
        value={selectedFloorId}
        options={floorOptions}
        onChange={onFloorChange}
      />
      <FilterPill
        label="Status"
        value={selectedStatus}
        options={statusOptions}
        onChange={onStatusChange}
      />

      {/* Clear all filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 text-[11px] text-gray-400
            hover:text-gray-600 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* View mode toggle */}
      <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
        <button
          onClick={() => onViewModeChange('table')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'table'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title="Table view"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('cards')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'cards'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title="Card view"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>

      {/* Add drawing */}
      <Button size="sm" onClick={onAddDrawing} className="h-8">
        <Plus className="w-4 h-4 mr-1" />
        Add Drawing
      </Button>
    </div>
  )
}
