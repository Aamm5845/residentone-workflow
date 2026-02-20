'use client'

import { useMemo } from 'react'
import { FileText, MoreVertical, Pencil, Send, GitBranch, Archive } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Drawing {
  id: string
  drawingNumber: string
  title: string
  status: string
  currentRevision: number
  section?: { id: string; name: string; shortName: string; color: string } | null
  floor?: { id: string; name: string; shortName: string } | null
  [key: string]: any
}

interface DrawingCardsProps {
  drawings: Drawing[]
  onSelectDrawing: (drawing: Drawing) => void
  onEditDrawing: (drawing: Drawing) => void
  onNewRevision: (drawing: Drawing) => void
  onAddToTransmittal: (drawing: Drawing) => void
  onArchiveDrawing: (drawing: Drawing) => void
  selectedDrawingId: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  DRAFT: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  SUPERSEDED: { label: 'Superseded', color: 'text-amber-700', bg: 'bg-amber-50' },
  ARCHIVED: { label: 'Archived', color: 'text-red-600', bg: 'bg-red-50' },
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DrawingCards({
  drawings,
  onSelectDrawing,
  onEditDrawing,
  onNewRevision,
  onAddToTransmittal,
  onArchiveDrawing,
  selectedDrawingId,
}: DrawingCardsProps) {
  // Group by section
  const groups = useMemo(() => {
    const map = new Map<string, { section: Drawing['section']; drawings: Drawing[] }>()
    const noSection: Drawing[] = []

    for (const d of drawings) {
      if (d.section) {
        const key = d.section.id
        if (!map.has(key)) {
          map.set(key, { section: d.section, drawings: [] })
        }
        map.get(key)!.drawings.push(d)
      } else {
        noSection.push(d)
      }
    }

    const groups = Array.from(map.values())
    if (noSection.length > 0) {
      groups.push({ section: null, drawings: noSection })
    }
    return groups
  }, [drawings])

  if (drawings.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No drawings found</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Add your first drawing or adjust your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={group.section?.id ?? 'none'}>
          {/* Group header */}
          <div className="flex items-center gap-2 mb-3">
            {group.section ? (
              <>
                <span className={cn('w-2.5 h-2.5 rounded-full', group.section.color)} />
                <span className="text-sm font-semibold text-gray-900">{group.section.name}</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-400">Uncategorized</span>
            )}
            <span className="text-xs text-gray-400">({group.drawings.length})</span>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.drawings.map((drawing) => {
              const status = STATUS_CONFIG[drawing.status]
              const isSelected = selectedDrawingId === drawing.id

              return (
                <div
                  key={drawing.id}
                  onClick={() => onSelectDrawing(drawing)}
                  className={cn(
                    'group relative rounded-xl border bg-white p-4 cursor-pointer transition-all',
                    isSelected
                      ? 'border-gray-300 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  )}
                >
                  {/* Top line: drawing number + actions */}
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-gray-400">
                      {drawing.drawingNumber}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity
                            -mt-1 -mr-1 h-7 w-7 flex items-center justify-center
                            rounded-md hover:bg-gray-100 text-gray-400"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditDrawing(drawing) }}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNewRevision(drawing) }}>
                          <GitBranch className="mr-2 h-3.5 w-3.5" /> New Revision
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddToTransmittal(drawing) }}>
                          <Send className="mr-2 h-3.5 w-3.5" /> Send
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); onArchiveDrawing(drawing) }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-medium text-gray-900 mb-3 line-clamp-2">
                    {drawing.title}
                  </h3>

                  {/* Bottom: status + revision */}
                  <div className="flex items-center justify-between">
                    {status ? (
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                        status.bg, status.color
                      )}>
                        {status.label}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">{drawing.status}</span>
                    )}
                    <span className="text-[11px] text-gray-400">
                      Rev {drawing.currentRevision}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
