'use client'

import { X } from 'lucide-react'

interface FilterState {
  phases: string[]
  rooms: string[]
  statuses: string[]
}

interface Props {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  availableRooms: { id: string; name: string }[]
}

const PHASE_OPTIONS = [
  { key: 'DESIGN_CONCEPT', label: 'Design Concept', color: 'bg-purple-500' },
  { key: 'THREE_D', label: '3D Rendering', color: 'bg-orange-500' },
  { key: 'DRAWINGS', label: 'Drawings', color: 'bg-indigo-500' },
  { key: 'FFE', label: 'FFE', color: 'bg-pink-500' }
]

const STATUS_OPTIONS = [
  { key: 'COMPLETED', label: 'Completed', color: 'bg-green-500' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'PENDING', label: 'Pending', color: 'bg-orange-500' },
  { key: 'NOT_STARTED', label: 'Not Started', color: 'bg-gray-500' }
]

export function ReportFilters({ filters, onFiltersChange, availableRooms }: Props) {
  const togglePhase = (phase: string) => {
    const newPhases = filters.phases.includes(phase)
      ? filters.phases.filter(p => p !== phase)
      : [...filters.phases, phase]
    onFiltersChange({ ...filters, phases: newPhases })
  }

  const toggleStatus = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status]
    onFiltersChange({ ...filters, statuses: newStatuses })
  }

  const toggleRoom = (roomId: string) => {
    const newRooms = filters.rooms.includes(roomId)
      ? filters.rooms.filter(r => r !== roomId)
      : [...filters.rooms, roomId]
    onFiltersChange({ ...filters, rooms: newRooms })
  }

  const clearAllFilters = () => {
    onFiltersChange({ phases: [], rooms: [], statuses: [] })
  }

  const activeFilterCount = filters.phases.length + filters.rooms.length + filters.statuses.length

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Phase Filters */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Phases</label>
        <div className="flex flex-wrap gap-2">
          {PHASE_OPTIONS.map(option => (
            <button
              key={option.key}
              onClick={() => togglePhase(option.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.phases.includes(option.key)
                  ? `${option.color} text-white shadow-md`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filters */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Status</label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(option => (
            <button
              key={option.key}
              onClick={() => toggleStatus(option.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.statuses.includes(option.key)
                  ? `${option.color} text-white shadow-md`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Room Filters */}
      {availableRooms.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-700 mb-2 block">Rooms</label>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {availableRooms.map(room => (
              <label
                key={room.id}
                className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 p-1 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.rooms.includes(room.id)}
                  onChange={() => toggleRoom(room.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="truncate">{room.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
