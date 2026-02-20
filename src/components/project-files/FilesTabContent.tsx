'use client'

import { useState, useMemo } from 'react'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import FilesToolbar from './FilesToolbar'
import DrawingTable from './DrawingTable'
import DrawingCards from './DrawingCards'
import type { FilterOption } from './FilterPill'

// Reuse from v2
import DrawingDetailPanel from '../project-files-v2/DrawingDetailPanel'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Section {
  id: string
  name: string
  shortName: string
  color: string
}

interface Floor {
  id: string
  name: string
  shortName: string
}

interface Drawing {
  id: string
  drawingNumber: string
  title: string
  status: string
  currentRevision: number
  dropboxPath?: string | null
  section?: { id: string; name: string; shortName: string; color: string } | null
  floor?: { id: string; name: string; shortName: string } | null
  [key: string]: any
}

interface FilesTabContentProps {
  projectId: string
  drawings: Drawing[]
  isLoading: boolean
  sections: Section[]
  floors: Floor[]
  sectionCounts: Record<string, number>
  floorCounts: Record<string, number>
  statusCounts: Record<string, number>

  // Filters
  filters: {
    sectionId: string | null
    floorId: string | null
    status: string | null
    search: string
  }
  onFiltersChange: (filters: any) => void
  searchInput: string
  onSearchInputChange: (val: string) => void
  onSearchSubmit: () => void
  onClearFilters: () => void
  hasActiveFilters: boolean

  // Actions
  onAddDrawing: () => void
  onEditDrawing: (drawing: any) => void
  onNewRevision: (drawing: any) => void
  onAddToTransmittal: (drawing: any) => void
  onArchiveDrawing: (drawing: any) => void
  onCreateTransmittal: (drawing: any) => void
  onLinkCadSource: (drawing: any) => void
}

// ─── Status options ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'ACTIVE', label: 'Active', dot: 'bg-emerald-500' },
  { value: 'DRAFT', label: 'Draft', dot: 'bg-gray-400' },
  { value: 'SUPERSEDED', label: 'Superseded', dot: 'bg-amber-500' },
  { value: 'ARCHIVED', label: 'Archived', dot: 'bg-red-500' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export default function FilesTabContent({
  projectId,
  drawings,
  isLoading,
  sections,
  floors,
  sectionCounts,
  floorCounts,
  statusCounts,
  filters,
  onFiltersChange,
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  onClearFilters,
  hasActiveFilters,
  onAddDrawing,
  onEditDrawing,
  onNewRevision,
  onAddToTransmittal,
  onArchiveDrawing,
  onCreateTransmittal,
  onLinkCadSource,
}: FilesTabContentProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)

  // Build filter options
  const sectionOptions: FilterOption[] = useMemo(
    () => sections
      .filter((s) => (sectionCounts[s.id] ?? 0) > 0)
      .map((s) => ({
        value: s.id,
        label: s.name,
        dot: s.color,
        count: sectionCounts[s.id] ?? 0,
      })),
    [sections, sectionCounts]
  )

  const floorOptions: FilterOption[] = useMemo(
    () => floors
      .filter((f) => (floorCounts[f.id] ?? 0) > 0)
      .map((f) => ({
        value: f.id,
        label: f.name,
        count: floorCounts[f.id] ?? 0,
      })),
    [floors, floorCounts]
  )

  const statusOptionsWithCounts: FilterOption[] = useMemo(
    () => STATUS_OPTIONS.map((s) => ({
      ...s,
      count: statusCounts[s.value] ?? 0,
    })).filter((s) => s.count > 0),
    [statusCounts]
  )

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-52 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-7 w-20 animate-pulse rounded-md bg-gray-200" />
          <div className="h-7 w-16 animate-pulse rounded-md bg-gray-200" />
          <div className="h-7 w-16 animate-pulse rounded-md bg-gray-200" />
          <div className="flex-1" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse border-b border-gray-50">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-3 bg-gray-200 rounded flex-1 max-w-xs" />
              <div className="h-5 bg-gray-200 rounded-full w-12" />
              <div className="h-3 bg-gray-200 rounded w-8" />
              <div className="h-5 bg-gray-200 rounded-full w-14" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <FilesToolbar
        searchValue={searchInput}
        onSearchChange={onSearchInputChange}
        onSearchSubmit={onSearchSubmit}
        sectionOptions={sectionOptions}
        selectedSectionId={filters.sectionId}
        onSectionChange={(v) => onFiltersChange({ ...filters, sectionId: v })}
        floorOptions={floorOptions}
        selectedFloorId={filters.floorId}
        onFloorChange={(v) => onFiltersChange({ ...filters, floorId: v })}
        statusOptions={statusOptionsWithCounts}
        selectedStatus={filters.status}
        onStatusChange={(v) => onFiltersChange({ ...filters, status: v })}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddDrawing={onAddDrawing}
      />

      {/* Main content */}
      <div>
          {drawings.length === 0 && !hasActiveFilters ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No drawings yet</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
                Get started by adding your first drawing to this project.
              </p>
              <Button size="sm" onClick={onAddDrawing}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Drawing
              </Button>
            </div>
          ) : viewMode === 'table' ? (
            <DrawingTable
              drawings={drawings}
              onSelectDrawing={(d) => setSelectedDrawingId(d.id)}
              onEditDrawing={onEditDrawing}
              onNewRevision={onNewRevision}
              onAddToTransmittal={onAddToTransmittal}
              onArchiveDrawing={onArchiveDrawing}
              selectedDrawingId={selectedDrawingId}
            />
          ) : (
            <DrawingCards
              drawings={drawings}
              onSelectDrawing={(d) => setSelectedDrawingId(d.id)}
              onEditDrawing={onEditDrawing}
              onNewRevision={onNewRevision}
              onAddToTransmittal={onAddToTransmittal}
              onArchiveDrawing={onArchiveDrawing}
              selectedDrawingId={selectedDrawingId}
            />
          )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedDrawingId} onOpenChange={(open) => !open && setSelectedDrawingId(null)}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 overflow-y-auto">
          <VisuallyHidden.Root>
            <SheetTitle>Drawing Details</SheetTitle>
          </VisuallyHidden.Root>
          {selectedDrawingId && (
            <DrawingDetailPanel
              projectId={projectId}
              drawingId={selectedDrawingId}
              onClose={() => setSelectedDrawingId(null)}
              onEdit={() => {
                const found = drawings.find((d) => d.id === selectedDrawingId)
                if (found) onEditDrawing(found)
              }}
              onNewRevision={() => {
                const found = drawings.find((d) => d.id === selectedDrawingId)
                if (found) onNewRevision(found)
              }}
              onCreateTransmittal={() => {
                const found = drawings.find((d) => d.id === selectedDrawingId)
                if (found) onCreateTransmittal(found)
              }}
              onLinkCadSource={() => {
                const found = drawings.find((d) => d.id === selectedDrawingId)
                if (found) onLinkCadSource(found)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
