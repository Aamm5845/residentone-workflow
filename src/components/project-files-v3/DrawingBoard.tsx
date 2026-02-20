'use client'

import { useMemo } from 'react'
import { Inbox } from 'lucide-react'
import { DrawingCard } from './DrawingCard'
import { DISCIPLINE_CONFIG } from './v3-constants'
import type { V3Drawing, V3Recipient } from './v3-types'

interface DrawingBoardProps {
  drawings: V3Drawing[]
  recipients: V3Recipient[]
  projectId: string
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onDrawingClick: (id: string) => void
  onSent: () => void
  search: string
  disciplineFilter: string | null
}

export function DrawingBoard({
  drawings,
  recipients,
  projectId,
  selectedIds,
  onSelect,
  onDrawingClick,
  onSent,
  search,
  disciplineFilter,
}: DrawingBoardProps) {
  // Filter
  const filtered = useMemo(() => {
    let result = drawings
    if (disciplineFilter) {
      result = result.filter((d) => d.discipline === disciplineFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (d) =>
          d.drawingNumber.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q)
      )
    }
    return result
  }, [drawings, disciplineFilter, search])

  // Group by discipline
  const grouped = useMemo(() => {
    const groups = new Map<string, V3Drawing[]>()
    for (const d of filtered) {
      const key = d.discipline || '_OTHER'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(d)
    }

    // Sort groups by discipline order
    const disciplineOrder = Object.keys(DISCIPLINE_CONFIG)
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const ai = disciplineOrder.indexOf(a)
      const bi = disciplineOrder.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [filtered])

  if (drawings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Inbox className="h-12 w-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">No drawings yet</p>
        <p className="text-sm mt-1">Add drawings from the All Files browser in V2</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <p className="text-sm">No drawings match your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {grouped.map(([discipline, items]) => {
        const config = DISCIPLINE_CONFIG[discipline]
        return (
          <div key={discipline}>
            {/* Discipline header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="h-8 w-1 rounded-full"
                style={{ backgroundColor: config?.hex || '#9CA3AF' }}
              />
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                {config?.label || 'Other'}
              </h3>
              <span className="text-xs text-gray-400">
                {items.length} drawing{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pl-2">
              {items.map((drawing) => (
                <DrawingCard
                  key={drawing.id}
                  drawing={drawing}
                  recipients={recipients}
                  projectId={projectId}
                  isSelected={selectedIds.has(drawing.id)}
                  onSelect={onSelect}
                  onClick={onDrawingClick}
                  onSent={onSent}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
