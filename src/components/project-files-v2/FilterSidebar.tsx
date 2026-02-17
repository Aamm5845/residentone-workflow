'use client'

import { useState } from 'react'
import { Plus, X, Loader2, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterSidebarProps {
  // Discipline filter
  selectedDiscipline: string | null
  onDisciplineChange: (discipline: string | null) => void
  disciplineCounts: Record<string, number>

  // Floor filter
  selectedFloorId: string | null
  onFloorChange: (floorId: string | null) => void
  floors: Array<{ id: string; name: string; shortName: string }>
  floorCounts: Record<string, number>

  // Status filter
  selectedStatus: string | null
  onStatusChange: (status: string | null) => void
  statusCounts: Record<string, number>

  // Floor management
  projectId: string
  onFloorAdded: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISCIPLINES = [
  { value: 'ARCHITECTURAL', label: 'Architectural', shortLabel: 'ARCH', dotColor: 'bg-blue-500' },
  { value: 'ELECTRICAL', label: 'Electrical', shortLabel: 'ELEC', dotColor: 'bg-amber-500' },
  { value: 'RCP', label: 'RCP', shortLabel: 'RCP', dotColor: 'bg-purple-500' },
  { value: 'PLUMBING', label: 'Plumbing', shortLabel: 'PLMB', dotColor: 'bg-green-500' },
  { value: 'MECHANICAL', label: 'Mechanical', shortLabel: 'MECH', dotColor: 'bg-orange-500' },
  { value: 'INTERIOR_DESIGN', label: 'Interior Design', shortLabel: 'INT', dotColor: 'bg-pink-500' },
]

const STATUSES = [
  { value: 'ACTIVE', label: 'Active', dotColor: 'bg-emerald-500' },
  { value: 'DRAFT', label: 'Draft', dotColor: 'bg-gray-400' },
  { value: 'SUPERSEDED', label: 'Superseded', dotColor: 'bg-amber-500' },
  { value: 'ARCHIVED', label: 'Archived', dotColor: 'bg-red-400' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FilterSidebar({
  selectedDiscipline,
  onDisciplineChange,
  disciplineCounts,
  selectedFloorId,
  onFloorChange,
  floors,
  floorCounts,
  selectedStatus,
  onStatusChange,
  statusCounts,
  projectId,
  onFloorAdded,
}: FilterSidebarProps) {
  // ---- Local state for inline add floor form ----
  const [addFloorExpanded, setAddFloorExpanded] = useState(false)
  const [floorName, setFloorName] = useState('')
  const [floorShortName, setFloorShortName] = useState('')
  const [saving, setSaving] = useState(false)

  // ---- Derived ----
  const hasActiveFilters =
    selectedDiscipline !== null || selectedFloorId !== null || selectedStatus !== null

  const totalCount = Object.values(disciplineCounts).reduce((sum, c) => sum + c, 0)
  const totalStatusCount = Object.values(statusCounts).reduce((sum, c) => sum + c, 0)

  // ---- Handlers ----
  const clearFilters = () => {
    onDisciplineChange(null)
    onFloorChange(null)
    onStatusChange(null)
  }

  const handleSaveFloor = async () => {
    if (!floorName.trim() || !floorShortName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/project-files-v2/floors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: floorName.trim(),
          shortName: floorShortName.trim(),
        }),
      })
      if (res.ok) {
        setFloorName('')
        setFloorShortName('')
        setAddFloorExpanded(false)
        onFloorAdded()
      }
    } catch (err) {
      console.error('Failed to add floor:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelFloor = () => {
    setAddFloorExpanded(false)
    setFloorName('')
    setFloorShortName('')
  }

  // ---- Render ----
  return (
    <aside className="w-60 flex-shrink-0 border-r border-gray-200 sticky top-0 overflow-y-auto max-h-screen">
      <div className="p-4">
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* DISCIPLINE                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-6">
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Discipline
          </h4>
          <div className="space-y-0.5">
            {/* All option */}
            <RadioFilterItem
              label="All"
              dotColor="bg-gray-400"
              count={totalCount}
              isSelected={selectedDiscipline === null}
              onClick={() => onDisciplineChange(null)}
            />

            {DISCIPLINES.map((disc) => (
              <RadioFilterItem
                key={disc.value}
                label={disc.label}
                dotColor={disc.dotColor}
                count={disciplineCounts[disc.value] ?? 0}
                isSelected={selectedDiscipline === disc.value}
                onClick={() =>
                  onDisciplineChange(
                    selectedDiscipline === disc.value ? null : disc.value
                  )
                }
              />
            ))}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* FLOOR                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-6">
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Floor
          </h4>
          <div className="space-y-0.5">
            {/* All option */}
            <button
              onClick={() => onFloorChange(null)}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                selectedFloorId === null
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <span className="flex items-center gap-2">
                <RadioDot isSelected={selectedFloorId === null} color="bg-gray-400" />
                All
              </span>
            </button>

            {floors.map((floor) => {
              const count = floorCounts[floor.id] ?? 0
              return (
                <button
                  key={floor.id}
                  onClick={() =>
                    onFloorChange(selectedFloorId === floor.id ? null : floor.id)
                  }
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                    selectedFloorId === floor.id
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <RadioDot
                      isSelected={selectedFloorId === floor.id}
                      color="bg-gray-400"
                    />
                    {floor.name}
                  </span>
                  {count > 0 && (
                    <span className="text-xs text-gray-400">({count})</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Add Floor */}
          <div className="mt-2">
            {!addFloorExpanded ? (
              <button
                onClick={() => setAddFloorExpanded(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors px-2.5 py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Floor
              </button>
            ) : (
              <div className="space-y-2 px-2.5 pt-2 pb-1 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-1 duration-150">
                <Input
                  placeholder="Floor name"
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelFloor()
                  }}
                />
                <Input
                  placeholder="Short name (e.g. GF, L1)"
                  value={floorShortName}
                  onChange={(e) => setFloorShortName(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveFloor()
                    if (e.key === 'Escape') handleCancelFloor()
                  }}
                />
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={handleSaveFloor}
                    disabled={saving || !floorName.trim() || !floorShortName.trim()}
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={handleCancelFloor}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* STATUS                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Status
          </h4>
          <div className="space-y-0.5">
            {/* All option */}
            <RadioFilterItem
              label="All"
              dotColor="bg-gray-400"
              count={totalStatusCount}
              isSelected={selectedStatus === null}
              onClick={() => onStatusChange(null)}
            />

            {STATUSES.map((status) => (
              <RadioFilterItem
                key={status.value}
                label={status.label}
                dotColor={status.dotColor}
                count={statusCounts[status.value] ?? 0}
                isSelected={selectedStatus === status.value}
                onClick={() =>
                  onStatusChange(
                    selectedStatus === status.value ? null : status.value
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>

    </aside>
  )
}

// ---------------------------------------------------------------------------
// RadioDot - Custom radio button visual
// ---------------------------------------------------------------------------

function RadioDot({ isSelected, color }: { isSelected: boolean; color: string }) {
  return (
    <span
      className={cn(
        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        isSelected ? 'border-gray-700' : 'border-gray-300'
      )}
    >
      {isSelected && <span className={cn('w-2 h-2 rounded-full', color)} />}
    </span>
  )
}

// ---------------------------------------------------------------------------
// RadioFilterItem - Reusable radio-style filter row
// ---------------------------------------------------------------------------

function RadioFilterItem({
  label,
  dotColor,
  count,
  isSelected,
  onClick,
}: {
  label: string
  dotColor: string
  count: number
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors',
        isSelected
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-600 hover:bg-gray-50'
      )}
    >
      <span className="flex items-center gap-2">
        <RadioDot isSelected={isSelected} color={dotColor} />
        {label}
      </span>
      <span className="text-xs text-gray-400">({count})</span>
    </button>
  )
}
