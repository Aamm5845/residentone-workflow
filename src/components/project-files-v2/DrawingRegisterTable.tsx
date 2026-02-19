'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  FileText,
  MoreVertical,
  ArrowUpDown,
  Edit2,
  Plus,
  Send,
  ExternalLink,
  Archive,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import CadFreshnessBadge, { type CadFreshnessStatusType } from './CadFreshnessBadge'

// ─── Discipline config ───────────────────────────────────────────────────────

const DISCIPLINE_CONFIG: Record<
  string,
  {
    label: string
    shortLabel: string
    color: string
    bgColor: string
    textColor: string
    borderColor: string
  }
> = {
  ARCHITECTURAL: {
    label: 'Architectural',
    shortLabel: 'ARCH',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  ELECTRICAL: {
    label: 'Electrical',
    shortLabel: 'ELEC',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  RCP: {
    label: 'RCP',
    shortLabel: 'RCP',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
  },
  PLUMBING: {
    label: 'Plumbing',
    shortLabel: 'PLMB',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
  },
  MECHANICAL: {
    label: 'Mechanical',
    shortLabel: 'MECH',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
  INTERIOR_DESIGN: {
    label: 'Interior Design',
    shortLabel: 'INT',
    color: 'bg-pink-500',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200',
  },
}

const DRAWING_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan',
  REFLECTED_CEILING: 'Reflected Ceiling',
  ELEVATION: 'Elevation',
  DETAIL: 'Detail',
  SECTION: 'Section',
  TITLE_BLOCK: 'Title Block',
  XREF: 'XREF',
  SCHEDULE: 'Schedule',
  OTHER: 'Other',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  SUPERSEDED: { label: 'Superseded', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  ARCHIVED: { label: 'Archived', color: 'text-red-600', bgColor: 'bg-red-50' },
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Drawing {
  id: string
  drawingNumber: string
  title: string
  discipline: string
  drawingType: string
  status: string
  currentRevision: number
  description: string | null
  dropboxPath: string | null
  dropboxUrl: string | null
  fileName: string | null
  fileSize: number | null
  scale: string | null
  paperSize: string | null
  createdAt: string
  floor: { id: string; name: string; shortName: string } | null
  _count: { revisions: number; transmittalItems: number }
  lastTransmittal?: { sentAt: string; recipientName: string } | null
  cadSourceLink?: {
    id: string
    cadDropboxPath: string
    cadLayoutName: string | null
    cadFreshnessStatus: CadFreshnessStatusType
    plottedFromRevision: string | null
    plottedAt: string | null
  } | null
}

interface DrawingRegisterTableProps {
  drawings: Drawing[]
  onSelectDrawing: (drawing: Drawing) => void
  onEditDrawing: (drawing: Drawing) => void
  onNewRevision: (drawing: Drawing) => void
  onAddToTransmittal: (drawing: Drawing) => void
  selectedDrawingId?: string | null
}

// ─── Sorting helpers ─────────────────────────────────────────────────────────

type SortColumn =
  | 'drawingNumber'
  | 'title'
  | 'discipline'
  | 'floor'
  | 'drawingType'
  | 'currentRevision'
  | 'status'
  | 'cadStatus'
  | 'lastSent'

type SortDirection = 'asc' | 'desc'

function getSortValue(drawing: Drawing, column: SortColumn): string | number {
  switch (column) {
    case 'drawingNumber':
      return drawing.drawingNumber.toLowerCase()
    case 'title':
      return drawing.title.toLowerCase()
    case 'discipline':
      return (DISCIPLINE_CONFIG[drawing.discipline]?.label ?? drawing.discipline).toLowerCase()
    case 'floor':
      return (drawing.floor?.shortName ?? '').toLowerCase()
    case 'drawingType':
      return (DRAWING_TYPE_LABELS[drawing.drawingType] ?? drawing.drawingType).toLowerCase()
    case 'currentRevision':
      return drawing.currentRevision
    case 'status':
      return (STATUS_CONFIG[drawing.status]?.label ?? drawing.status).toLowerCase()
    case 'cadStatus':
      return drawing.cadSourceLink?.cadFreshnessStatus ?? 'UNKNOWN'
    case 'lastSent':
      return drawing.lastTransmittal?.sentAt ?? ''
    default:
      return ''
  }
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFileSize(size: number): string {
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

// ─── Column definitions ──────────────────────────────────────────────────────

interface ColumnDef {
  key: SortColumn
  label: string
  sortable: boolean
  className?: string
}

const COLUMNS: ColumnDef[] = [
  { key: 'drawingNumber', label: 'Drawing #', sortable: true, className: 'w-[120px]' },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'discipline', label: 'Discipline', sortable: true, className: 'w-[140px]' },
  { key: 'floor', label: 'Floor', sortable: true, className: 'w-[80px]' },
  { key: 'drawingType', label: 'Type', sortable: true, className: 'w-[140px]' },
  { key: 'currentRevision', label: 'Rev', sortable: true, className: 'w-[70px]' },
  { key: 'status', label: 'Status', sortable: true, className: 'w-[100px]' },
  { key: 'cadStatus', label: 'CAD', sortable: true, className: 'w-[110px]' },
  { key: 'lastSent', label: 'Last Sent', sortable: true, className: 'w-[180px]' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function DrawingRegisterTable({
  drawings,
  onSelectDrawing,
  onEditDrawing,
  onNewRevision,
  onAddToTransmittal,
  selectedDrawingId,
}: DrawingRegisterTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('drawingNumber')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // ── Sort handler ─────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortColumn(column)
        setSortDirection('asc')
      }
    },
    [sortColumn]
  )

  // ── Sorted drawings ─────────────────────────────────────────────────────

  const sortedDrawings = useMemo(() => {
    const sorted = [...drawings].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn)
      const bVal = getSortValue(b, sortColumn)

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return sorted
  }, [drawings, sortColumn, sortDirection])

  // ── Sort icon helper ─────────────────────────────────────────────────────

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-gray-400" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="ml-1 h-3.5 w-3.5 text-gray-700" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5 text-gray-700" />
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (drawings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No drawings yet</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Register your first drawing to start managing your project documents.
        </p>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full border-collapse text-sm">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/80">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500',
                  col.className,
                  col.sortable && 'cursor-pointer select-none hover:text-gray-700'
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  {col.sortable && renderSortIcon(col.key)}
                </span>
              </th>
            ))}
            {/* Actions column */}
            <th className="w-[52px] px-2 py-3" />
          </tr>
        </thead>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <tbody className="divide-y divide-gray-100">
          {sortedDrawings.map((drawing) => {
            const discipline = DISCIPLINE_CONFIG[drawing.discipline]
            const status = STATUS_CONFIG[drawing.status]
            const typeLabel = DRAWING_TYPE_LABELS[drawing.drawingType] ?? drawing.drawingType
            const isSelected = selectedDrawingId === drawing.id

            return (
              <tr
                key={drawing.id}
                onClick={() => onSelectDrawing(drawing)}
                className={cn(
                  'cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-blue-50/70 hover:bg-blue-50'
                    : 'hover:bg-gray-50/70'
                )}
              >
                {/* Drawing # */}
                <td className="px-4 py-3">
                  <span className="font-mono font-bold text-gray-900">
                    {drawing.drawingNumber}
                  </span>
                </td>

                {/* Title */}
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 truncate max-w-[300px]">
                      {drawing.title}
                    </span>
                    {drawing.fileName && (
                      <span className="text-xs text-gray-400 truncate max-w-[300px]">
                        {drawing.fileName}
                        {drawing.fileSize ? ` (${formatFileSize(drawing.fileSize)})` : ''}
                      </span>
                    )}
                  </div>
                </td>

                {/* Discipline */}
                <td className="px-4 py-3">
                  {discipline ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        discipline.bgColor,
                        discipline.textColor,
                        'border',
                        discipline.borderColor
                      )}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', discipline.color)}
                      />
                      {discipline.shortLabel}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{drawing.discipline}</span>
                  )}
                </td>

                {/* Floor */}
                <td className="px-4 py-3">
                  {drawing.floor ? (
                    <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {drawing.floor.shortName}
                    </span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>

                {/* Type */}
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{typeLabel}</span>
                </td>

                {/* Rev */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Rev {drawing.currentRevision}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {status ? (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        status.bgColor,
                        status.color
                      )}
                    >
                      {status.label}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{drawing.status}</span>
                  )}
                </td>

                {/* CAD Status */}
                <td className="px-4 py-3">
                  {drawing.cadSourceLink ? (
                    <CadFreshnessBadge
                      status={drawing.cadSourceLink.cadFreshnessStatus}
                      compact
                    />
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>

                {/* Last Sent */}
                <td className="px-4 py-3">
                  {drawing.lastTransmittal ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-700">
                        {formatDate(drawing.lastTransmittal.sentAt)}
                      </span>
                      <span className="text-xs text-gray-400 truncate max-w-[140px]">
                        {drawing.lastTransmittal.recipientName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-2 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 text-gray-400 hover:text-gray-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditDrawing(drawing)
                        }}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onNewRevision(drawing)
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Revision
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToTransmittal(drawing)
                        }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Add to Transmittal
                      </DropdownMenuItem>

                      {drawing.dropboxUrl && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(drawing.dropboxUrl!, '_blank')
                            }}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open in Dropbox
                          </DropdownMenuItem>
                        </>
                      )}

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => e.stopPropagation()}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
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
