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
  Trash2,
  X,
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

// ─── Shared Configs ─────────────────────────────────────────────────────────

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
  discipline: string | null
  drawingType: string | null
  status: string
  currentRevision: number
  description: string | null
  dropboxPath: string | null
  dropboxUrl: string | null
  fileName: string | null
  fileSize: number | null
  scale: string | null
  paperSize: string | null
  drawnBy: string | null
  reviewNo: string | null
  pageNo: string | null
  sectionId: string | null
  createdAt: string
  floor: { id: string; name: string; shortName: string } | null
  section: { id: string; name: string; shortName: string; color: string } | null
  _count: { revisions: number; transmittalItems: number }
  lastTransmittal?: { sentAt: string; recipientName: string } | null
}

interface DrawingRegisterTableProps {
  projectId: string
  drawings: Drawing[]
  onSelectDrawing: (drawing: Drawing) => void
  onEditDrawing: (drawing: Drawing) => void
  onNewRevision: (drawing: Drawing) => void
  onAddToTransmittal: (drawing: Drawing) => void
  onArchiveDrawing: (drawing: Drawing) => void
  selectedDrawingId?: string | null
  mutateDrawings?: () => void
}

// ─── Sorting helpers ─────────────────────────────────────────────────────────

type SortColumn =
  | 'drawingNumber'
  | 'title'
  | 'drawnBy'
  | 'pageNo'
  | 'reviewNo'
  | 'section'
  | 'status'
  | 'lastSent'

type SortDirection = 'asc' | 'desc'

function getSortValue(drawing: Drawing, column: SortColumn): string | number {
  switch (column) {
    case 'drawingNumber':
      return drawing.drawingNumber.toLowerCase()
    case 'title':
      return drawing.title.toLowerCase()
    case 'drawnBy':
      return (drawing.drawnBy ?? '').toLowerCase() || 'zzz'
    case 'pageNo':
      return (drawing.pageNo ?? '').toLowerCase() || 'zzz'
    case 'reviewNo':
      return (drawing.reviewNo ?? '').toLowerCase() || 'zzz'
    case 'section':
      return (drawing.section?.name ?? '').toLowerCase() || 'zzz'
    case 'status':
      return (STATUS_CONFIG[drawing.status]?.label ?? drawing.status).toLowerCase()
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
  { key: 'drawnBy', label: 'Drawn By', sortable: true, className: 'w-[110px]' },
  { key: 'pageNo', label: 'Page #', sortable: true, className: 'w-[80px]' },
  { key: 'reviewNo', label: 'Review', sortable: true, className: 'w-[80px]' },
  { key: 'section', label: 'Section', sortable: true, className: 'w-[140px]' },
  { key: 'status', label: 'Status', sortable: true, className: 'w-[100px]' },
  { key: 'lastSent', label: 'Last Sent', sortable: true, className: 'w-[180px]' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function DrawingRegisterTable({
  projectId,
  drawings,
  onSelectDrawing,
  onEditDrawing,
  onNewRevision,
  onAddToTransmittal,
  onArchiveDrawing,
  selectedDrawingId,
  mutateDrawings,
}: DrawingRegisterTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('drawingNumber')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Selection handlers ─────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === drawings.length ? new Set() : new Set(drawings.map((d) => d.id))
    )
  }, [drawings])

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return
    const count = selectedIds.size
    if (!confirm(`Archive ${count} drawing${count > 1 ? 's' : ''}? This will set them to ARCHIVED status.`)) return

    setIsDeleting(true)
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/projects/${projectId}/project-files-v2/drawings/${id}`, { method: 'DELETE' })
      )
      await Promise.all(promises)
      setSelectedIds(new Set())
      mutateDrawings?.()
    } catch (err) {
      console.error('Bulk archive error:', err)
      alert('Failed to archive some drawings.')
    } finally {
      setIsDeleting(false)
    }
  }, [selectedIds, projectId, mutateDrawings])

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
    <div className="relative">
      {/* ── Floating action bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 mb-2 flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-2.5 text-white shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-gray-600" />
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? 'Archiving...' : 'Archive'}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Deselect
          </button>
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              {/* Checkbox column */}
              <th className="w-[40px] px-2 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === drawings.length && drawings.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 cursor-pointer"
                />
              </th>
              {/* Thumbnail column */}
              <th className="w-[52px] px-2 py-3" />
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
            const section = drawing.section
            const status = STATUS_CONFIG[drawing.status]
            const isDetailSelected = selectedDrawingId === drawing.id
            const isChecked = selectedIds.has(drawing.id)

            return (
              <tr
                key={drawing.id}
                onClick={() => onSelectDrawing(drawing)}
                className={cn(
                  'cursor-pointer transition-colors',
                  isChecked
                    ? 'bg-slate-50'
                    : isDetailSelected
                      ? 'bg-blue-50/70 hover:bg-blue-50'
                      : 'hover:bg-gray-50/70'
                )}
              >
                {/* Checkbox */}
                <td className="px-2 py-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleSelect(drawing.id)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 cursor-pointer"
                  />
                </td>

                {/* Thumbnail */}
                <td className="px-2 py-2">
                  <DrawingThumbnail
                    projectId={projectId}
                    dropboxPath={drawing.dropboxPath}
                  />
                </td>

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

                {/* Drawn By */}
                <td className="px-4 py-3">
                  {drawing.drawnBy ? (
                    <span className="text-sm text-gray-600 truncate max-w-[90px] block">{drawing.drawnBy}</span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>

                {/* Page */}
                <td className="px-4 py-3">
                  {drawing.pageNo ? (
                    <span className="text-sm text-gray-600">{drawing.pageNo}</span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>

                {/* Review */}
                <td className="px-4 py-3">
                  {drawing.reviewNo ? (
                    <span className="text-sm text-gray-600">{drawing.reviewNo}</span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>

                {/* Section */}
                <td className="px-4 py-3">
                  {section ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        'bg-gray-50 text-gray-700 border border-gray-200'
                      )}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', section.color || 'bg-gray-400')}
                      />
                      {section.name}
                    </span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
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
                        Send Drawing
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
                        onClick={(e) => {
                          e.stopPropagation()
                          onArchiveDrawing(drawing)
                        }}
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
    </div>
  )
}

// ─── Thumbnail helper ─────────────────────────────────────────────────────────

function DrawingThumbnail({ projectId, dropboxPath }: { projectId: string; dropboxPath: string | null }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (!dropboxPath) {
    return (
      <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
        <FileText className="w-4 h-4 text-gray-300" />
      </div>
    )
  }

  const src = `/api/projects/${projectId}/project-files-v2/pdf-thumbnail?path=${encodeURIComponent(dropboxPath)}`

  return (
    <div className="w-10 h-10 rounded border border-gray-200 bg-white overflow-hidden">
      {!error ? (
        <>
          {!loaded && (
            <div className="w-full h-full bg-gray-50 animate-pulse flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-300" />
            </div>
          )}
          <img
            src={src}
            alt="thumbnail"
            className={cn('w-full h-full object-contain', !loaded && 'hidden')}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <FileText className="w-4 h-4 text-gray-300" />
        </div>
      )}
    </div>
  )
}
