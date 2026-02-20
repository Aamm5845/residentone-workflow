'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  FileText,
  MoreVertical,
  Edit2,
  Plus,
  Send,
  ExternalLink,
  Archive,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import CadFreshnessBadge, { type CadFreshnessStatusType } from './CadFreshnessBadge'

// ─── Shared Configs ─────────────────────────────────────────────────────────

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
  createdAt: string
  floor: { id: string; name: string; shortName: string } | null
  section: { id: string; name: string; shortName: string; color: string } | null
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

interface DrawingRegisterCardsProps {
  projectId: string
  drawings: Drawing[]
  onSelectDrawing: (drawing: Drawing) => void
  onEditDrawing: (drawing: Drawing) => void
  onNewRevision: (drawing: Drawing) => void
  onAddToTransmittal: (drawing: Drawing) => void
  onArchiveDrawing: (drawing: Drawing) => void
  selectedDrawingId?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Grouped data type ───────────────────────────────────────────────────────

interface SectionGroup {
  key: string
  label: string
  color: string
  drawings: Drawing[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DrawingRegisterCards({
  projectId,
  drawings,
  onSelectDrawing,
  onEditDrawing,
  onNewRevision,
  onAddToTransmittal,
  onArchiveDrawing,
  selectedDrawingId,
}: DrawingRegisterCardsProps) {
  // Track which section groups are expanded (all expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // ── Group drawings by section ─────────────────────────────────────────

  const groups: SectionGroup[] = useMemo(() => {
    const groupMap = new Map<string, Drawing[]>()

    for (const drawing of drawings) {
      const key = drawing.section?.id || '_UNCATEGORIZED'
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
      }
      groupMap.get(key)!.push(drawing)
    }

    // Sort drawings within each group by drawingNumber
    Array.from(groupMap.values()).forEach((groupDrawings) => {
      groupDrawings.sort((a, b) => a.drawingNumber.localeCompare(b.drawingNumber))
    })

    // Build ordered group list: sections first (by their data), then uncategorized last
    const result: SectionGroup[] = []

    Array.from(groupMap.entries()).forEach(([sectionKey, groupDrawings]) => {
      if (sectionKey === '_UNCATEGORIZED') return // handle last
      if (groupDrawings.length > 0) {
        const section = groupDrawings[0].section
        result.push({
          key: sectionKey,
          label: section?.name ?? sectionKey,
          color: section?.color ?? 'bg-gray-400',
          drawings: groupDrawings,
        })
      }
    })

    // Add uncategorized at the end
    const uncategorized = groupMap.get('_UNCATEGORIZED')
    if (uncategorized && uncategorized.length > 0) {
      result.push({
        key: '_UNCATEGORIZED',
        label: 'Uncategorized',
        color: 'bg-gray-400',
        drawings: uncategorized,
      })
    }

    return result
  }, [drawings])

  // ── Collapse toggle ──────────────────────────────────────────────────────

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
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
    <div className="space-y-6">
      {groups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.key)

        return (
          <div key={group.key} className="space-y-3">
            {/* ── Group header ─────────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="flex w-full items-center gap-3 group"
            >
              {/* Colored bar accent */}
              <div className={cn('h-8 w-1 rounded-full', group.color)} />

              <Layers className="h-4 w-4 text-gray-600" />

              <span className="text-sm font-semibold text-gray-700">
                {group.label}
              </span>

              {/* Count badge */}
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                {group.drawings.length}
              </span>

              {/* Spacer */}
              <div className="flex-1 border-b border-gray-100" />

              {/* Chevron */}
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              )}
            </button>

            {/* ── Card grid ────────────────────────────────────────────── */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                {group.drawings.map((drawing) => (
                  <DrawingCard
                    key={drawing.id}
                    projectId={projectId}
                    drawing={drawing}
                    sectionColor={group.color}
                    isSelected={selectedDrawingId === drawing.id}
                    onSelect={() => onSelectDrawing(drawing)}
                    onEdit={() => onEditDrawing(drawing)}
                    onNewRevision={() => onNewRevision(drawing)}
                    onAddToTransmittal={() => onAddToTransmittal(drawing)}
                    onArchive={() => onArchiveDrawing(drawing)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Drawing Card ────────────────────────────────────────────────────────────

interface DrawingCardProps {
  projectId: string
  drawing: Drawing
  sectionColor: string
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onNewRevision: () => void
  onAddToTransmittal: () => void
  onArchive: () => void
}

function DrawingCard({
  projectId,
  drawing,
  sectionColor,
  isSelected,
  onSelect,
  onEdit,
  onNewRevision,
  onAddToTransmittal,
  onArchive,
}: DrawingCardProps) {
  const status = STATUS_CONFIG[drawing.status]
  const typeLabel = drawing.drawingType ? (DRAWING_TYPE_LABELS[drawing.drawingType] ?? drawing.drawingType) : null

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500 border-blue-300 shadow-md'
      )}
    >
      {/* Top colored bar */}
      <div className={cn('h-1 w-full', sectionColor)} />

      {/* PDF Thumbnail preview */}
      <CardThumbnail projectId={projectId} dropboxPath={drawing.dropboxPath} />

      {/* Card content */}
      <div className="flex flex-col flex-1 p-4">
        {/* Drawing number */}
        <span className="font-mono text-lg font-bold text-gray-900 leading-tight">
          {drawing.drawingNumber}
        </span>

        {/* Title */}
        <p className="mt-1 text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
          {drawing.title}
        </p>

        {/* Chips row */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {/* Floor chip */}
          {drawing.floor && (
            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {drawing.floor.shortName}
            </span>
          )}

          {/* Type chip */}
          {typeLabel && (
            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {typeLabel}
            </span>
          )}

          {/* Rev chip */}
          <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Rev {drawing.currentRevision}
          </span>

          {/* CAD freshness badge */}
          {drawing.cadSourceLink && (
            <CadFreshnessBadge
              status={drawing.cadSourceLink.cadFreshnessStatus}
              compact
            />
          )}
        </div>

        {/* Bottom row: status + actions */}
        <div className="mt-auto pt-3 flex items-center justify-between">
          {/* Status badge */}
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

          {/* Actions dropdown */}
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
                  onEdit()
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onNewRevision()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Revision
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToTransmittal()
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
                  onArchive()
                }}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Last transmittal info */}
        {drawing.lastTransmittal && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Sent {formatDate(drawing.lastTransmittal.sentAt)} to{' '}
              <span className="text-gray-500">{drawing.lastTransmittal.recipientName}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card Thumbnail ─────────────────────────────────────────────────────────

function CardThumbnail({ projectId, dropboxPath }: { projectId: string; dropboxPath: string | null }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (!dropboxPath) {
    return (
      <div className="w-full aspect-[4/3] bg-gray-50 flex items-center justify-center border-b border-gray-100">
        <FileText className="w-10 h-10 text-gray-200" />
      </div>
    )
  }

  const src = `/api/projects/${projectId}/project-files-v2/pdf-thumbnail?path=${encodeURIComponent(dropboxPath)}`

  return (
    <div className="w-full aspect-[4/3] bg-white overflow-hidden border-b border-gray-100 relative">
      {!error ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 bg-gray-50 animate-pulse flex items-center justify-center">
              <FileText className="w-10 h-10 text-gray-200" />
            </div>
          )}
          <img
            src={src}
            alt="thumbnail"
            className={cn('w-full h-full object-contain', !loaded && 'opacity-0')}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <FileText className="w-10 h-10 text-gray-200" />
        </div>
      )}
    </div>
  )
}
