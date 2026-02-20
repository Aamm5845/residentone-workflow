'use client'

import { useState, useMemo } from 'react'
import {
  MoreVertical,
  ArrowUpDown,
  Pencil,
  Send,
  GitBranch,
  Archive,
  FileText,
} from 'lucide-react'
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

interface DrawingTableProps {
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

type SortColumn = 'drawingNumber' | 'title' | 'section' | 'revision' | 'status'
type SortDir = 'asc' | 'desc'

// ─── Component ──────────────────────────────────────────────────────────────

export default function DrawingTable({
  drawings,
  onSelectDrawing,
  onEditDrawing,
  onNewRevision,
  onAddToTransmittal,
  onArchiveDrawing,
  selectedDrawingId,
}: DrawingTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('drawingNumber')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...drawings]
    const dir = sortDir === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      switch (sortColumn) {
        case 'drawingNumber':
          return dir * a.drawingNumber.localeCompare(b.drawingNumber)
        case 'title':
          return dir * a.title.localeCompare(b.title)
        case 'section':
          return dir * (a.section?.name ?? '').localeCompare(b.section?.name ?? '')
        case 'revision':
          return dir * ((a.currentRevision ?? 0) - (b.currentRevision ?? 0))
        case 'status':
          return dir * a.status.localeCompare(b.status)
        default:
          return 0
      }
    })
    return copy
  }, [drawings, sortColumn, sortDir])

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
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table className="w-full border-collapse text-sm">
        {/* Header */}
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <SortableHeader label="Drawing #" column="drawingNumber" current={sortColumn} dir={sortDir} onSort={handleSort} className="w-[120px]" />
            <SortableHeader label="Title" column="title" current={sortColumn} dir={sortDir} onSort={handleSort} />
            <SortableHeader label="Section" column="section" current={sortColumn} dir={sortDir} onSort={handleSort} className="w-[110px]" />
            <SortableHeader label="Rev" column="revision" current={sortColumn} dir={sortDir} onSort={handleSort} className="w-[60px] text-center" />
            <SortableHeader label="Status" column="status" current={sortColumn} dir={sortDir} onSort={handleSort} className="w-[100px]" />
            <th className="w-[44px] px-2 py-2.5" />
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-gray-50">
          {sorted.map((drawing) => {
            const status = STATUS_CONFIG[drawing.status]
            const isSelected = selectedDrawingId === drawing.id

            return (
              <tr
                key={drawing.id}
                onClick={() => onSelectDrawing(drawing)}
                className={cn(
                  'group cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-gray-50'
                    : 'hover:bg-gray-50/80'
                )}
              >
                {/* Drawing # */}
                <td className="px-4 py-3">
                  <span className="font-mono text-[13px] font-semibold text-gray-900">
                    {drawing.drawingNumber}
                  </span>
                </td>

                {/* Title */}
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 truncate block max-w-[300px]">
                    {drawing.title}
                  </span>
                </td>

                {/* Section */}
                <td className="px-4 py-3">
                  {drawing.section ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-700 border border-gray-100">
                      <span className={cn('w-1.5 h-1.5 rounded-full', drawing.section.color)} />
                      {drawing.section.shortName}
                    </span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>

                {/* Revision */}
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-medium text-gray-500">
                    {drawing.currentRevision}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {status ? (
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                      status.bg, status.color
                    )}>
                      {status.label}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{drawing.status}</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-2 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity
                          h-7 w-7 flex items-center justify-center rounded-md
                          hover:bg-gray-100 text-gray-400 hover:text-gray-600"
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Sortable Header ────────────────────────────────────────────────────────

function SortableHeader({
  label,
  column,
  current,
  dir,
  onSort,
  className,
}: {
  label: string
  column: SortColumn
  current: SortColumn
  dir: SortDir
  onSort: (col: SortColumn) => void
  className?: string
}) {
  const isActive = current === column
  return (
    <th
      onClick={() => onSort(column)}
      className={cn(
        'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors',
        isActive ? 'text-gray-700' : 'text-gray-400 hover:text-gray-600',
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn('w-3 h-3', isActive ? 'opacity-100' : 'opacity-0')} />
      </span>
    </th>
  )
}
