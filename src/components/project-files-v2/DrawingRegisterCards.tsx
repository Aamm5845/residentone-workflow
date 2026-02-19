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

// ─── Discipline display order ────────────────────────────────────────────────

const DISCIPLINE_ORDER: string[] = [
  'ARCHITECTURAL',
  'INTERIOR_DESIGN',
  'ELECTRICAL',
  'RCP',
  'PLUMBING',
  'MECHANICAL',
]

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

interface DrawingRegisterCardsProps {
  projectId: string
  drawings: Drawing[]
  onSelectDrawing: (drawing: Drawing) => void
  onEditDrawing: (drawing: Drawing) => void
  onNewRevision: (drawing: Drawing) => void
  onAddToTransmittal: (drawing: Drawing) => void
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

interface DisciplineGroup {
  key: string
  config: (typeof DISCIPLINE_CONFIG)[string] | null
  label: string
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
  selectedDrawingId,
}: DrawingRegisterCardsProps) {
  // Track which discipline groups are expanded (all expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // ── Group drawings by discipline ─────────────────────────────────────────

  const groups: DisciplineGroup[] = useMemo(() => {
    const groupMap = new Map<string, Drawing[]>()

    for (const drawing of drawings) {
      const key = drawing.discipline
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
      }
      groupMap.get(key)!.push(drawing)
    }

    // Sort drawings within each group by drawingNumber
    Array.from(groupMap.values()).forEach((groupDrawings) => {
      groupDrawings.sort((a, b) => a.drawingNumber.localeCompare(b.drawingNumber))
    })

    // Build ordered group list: known disciplines first, then unknown
    const result: DisciplineGroup[] = []

    for (const disciplineKey of DISCIPLINE_ORDER) {
      const groupDrawings = groupMap.get(disciplineKey)
      if (groupDrawings && groupDrawings.length > 0) {
        result.push({
          key: disciplineKey,
          config: DISCIPLINE_CONFIG[disciplineKey] ?? null,
          label: DISCIPLINE_CONFIG[disciplineKey]?.label ?? disciplineKey,
          drawings: groupDrawings,
        })
        groupMap.delete(disciplineKey)
      }
    }

    // Any remaining disciplines not in the predefined order
    Array.from(groupMap.entries()).forEach(([disciplineKey, groupDrawings]) => {
      if (groupDrawings.length > 0) {
        result.push({
          key: disciplineKey,
          config: DISCIPLINE_CONFIG[disciplineKey] ?? null,
          label: DISCIPLINE_CONFIG[disciplineKey]?.label ?? disciplineKey,
          drawings: groupDrawings,
        })
      }
    })

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
        const barColor = group.config?.color ?? 'bg-gray-400'
        const bgColor = group.config?.bgColor ?? 'bg-gray-50'
        const textColor = group.config?.textColor ?? 'text-gray-700'

        return (
          <div key={group.key} className="space-y-3">
            {/* ── Group header ─────────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="flex w-full items-center gap-3 group"
            >
              {/* Colored bar accent */}
              <div className={cn('h-8 w-1 rounded-full', barColor)} />

              <Layers className={cn('h-4 w-4', textColor)} />

              <span className={cn('text-sm font-semibold', textColor)}>
                {group.label}
              </span>

              {/* Count badge */}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  bgColor,
                  textColor
                )}
              >
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
                    disciplineConfig={group.config}
                    isSelected={selectedDrawingId === drawing.id}
                    onSelect={() => onSelectDrawing(drawing)}
                    onEdit={() => onEditDrawing(drawing)}
                    onNewRevision={() => onNewRevision(drawing)}
                    onAddToTransmittal={() => onAddToTransmittal(drawing)}
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
  disciplineConfig: (typeof DISCIPLINE_CONFIG)[string] | null
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onNewRevision: () => void
  onAddToTransmittal: () => void
}

function DrawingCard({
  projectId,
  drawing,
  disciplineConfig,
  isSelected,
  onSelect,
  onEdit,
  onNewRevision,
  onAddToTransmittal,
}: DrawingCardProps) {
  const status = STATUS_CONFIG[drawing.status]
  const typeLabel = DRAWING_TYPE_LABELS[drawing.drawingType] ?? drawing.drawingType
  const barColor = disciplineConfig?.color ?? 'bg-gray-400'

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
      <div className={cn('h-1 w-full', barColor)} />

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
          <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {typeLabel}
          </span>

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
