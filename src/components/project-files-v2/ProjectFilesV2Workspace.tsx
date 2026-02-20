'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Plus,
  Search,
  LayoutGrid,
  List,
  X,
  FileText,
  Send,
  FolderTree,
  Camera,
} from 'lucide-react'

// Components
import DrawingRegisterTable from './DrawingRegisterTable'
import DrawingRegisterCards from './DrawingRegisterCards'
import DrawingDetailPanel from './DrawingDetailPanel'
import DrawingFormDialog from './DrawingFormDialog'
import NewRevisionDialog from './NewRevisionDialog'
import TransmittalLog from './TransmittalLog'
import NewTransmittalDialog from './NewTransmittalDialog'
import TransmittalDetail from './TransmittalDetail'
import FilterSidebar from './FilterSidebar'
import AllFilesBrowser from './AllFilesBrowser'
import PhotosGallery from './PhotosGallery'
import CadFreshnessSummary from './CadFreshnessSummary'
import CadSourceLinkDialog from './CadSourceLinkDialog'
import SendFileDialog from './SendFileDialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string
  name: string
  dropboxFolder: string | null
  client?: { id: string; name: string; email: string } | null
}

type TabValue = 'all-files' | 'drawings' | 'photos' | 'transmittals'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectFilesV2Workspace({ project }: { project: Project }) {
  // ---- State ----
  const [activeTab, setActiveTab] = useState<TabValue>('all-files')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [filters, setFilters] = useState<{
    sectionId: string | null
    floorId: string | null
    status: string | null
    search: string
  }>({
    sectionId: null,
    floorId: null,
    status: null,
    search: '',
  })
  const [searchInput, setSearchInput] = useState('')
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)

  // Dialog states
  const [showAddDrawing, setShowAddDrawing] = useState(false)
  const [editDrawing, setEditDrawing] = useState<any | null>(null)
  const [revisionDrawing, setRevisionDrawing] = useState<any | null>(null)
  const [showNewTransmittal, setShowNewTransmittal] = useState(false)
  const [transmittalPreSelectedDrawings, setTransmittalPreSelectedDrawings] = useState<any[]>([])
  const [viewTransmittal, setViewTransmittal] = useState<any | null>(null)
  const [cadLinkDrawing, setCadLinkDrawing] = useState<any | null>(null)
  const [showSendFile, setShowSendFile] = useState(false)
  const [prefillDrawing, setPrefillDrawing] = useState<{
    dropboxPath: string
    fileName: string
    fileSize?: number
    drawingNumber?: string
    title?: string
  } | null>(null)

  // ---- Derived filter params ----
  const filterParams = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.sectionId) params.set('sectionId', filters.sectionId)
    if (filters.floorId) params.set('floorId', filters.floorId)
    if (filters.status) params.set('status', filters.status)
    if (filters.search) params.set('search', filters.search)
    return params.toString()
  }, [filters])

  // ---- SWR Data ----
  // Always fetch drawings (needed by All Files tab for matching + Drawings tab for display)
  const { data: drawingsData, isLoading: drawingsLoading, mutate: mutateDrawings } = useSWR(
    (activeTab === 'drawings' || activeTab === 'all-files')
      ? `/api/projects/${project.id}/project-files-v2/drawings?${activeTab === 'drawings' ? filterParams : ''}`
      : null,
    fetcher
  )

  const { data: floorsData, mutate: mutateFloors } = useSWR(
    (activeTab === 'drawings' || activeTab === 'all-files')
      ? `/api/projects/${project.id}/project-files-v2/floors`
      : null,
    fetcher
  )

  const { data: sectionsData, mutate: mutateSections } = useSWR(
    (activeTab === 'drawings' || activeTab === 'all-files')
      ? `/api/projects/${project.id}/project-files-v2/sections`
      : null,
    fetcher
  )

  const { data: transmittalsData, isLoading: transmittalsLoading, mutate: mutateTransmittals } =
    useSWR(
      activeTab === 'transmittals' ? `/api/projects/${project.id}/project-files-v2/transmittals` : null,
      fetcher
    )

  // ---- Handlers ----
  const handleSearchSubmit = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput }))
  }, [searchInput])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearchSubmit()
    },
    [handleSearchSubmit]
  )

  const clearFilters = useCallback(() => {
    setFilters({ sectionId: null, floorId: null, status: null, search: '' })
    setSearchInput('')
  }, [])

  const hasActiveFilters = filters.sectionId || filters.floorId || filters.status || filters.search

  // ---- Derived data ----
  const drawings = drawingsData?.drawings ?? []
  const counts = drawingsData?.counts ?? { bySection: [], byFloor: [], byStatus: [] }
  const floors = Array.isArray(floorsData) ? floorsData : (floorsData?.floors ?? floorsData ?? [])
  const sections = Array.isArray(sectionsData) ? sectionsData : (sectionsData?.sections ?? sectionsData ?? [])
  const transmittals = transmittalsData?.transmittals ?? []

  // Build section counts map
  const sectionCounts: Record<string, number> = {}
  if (Array.isArray(counts.bySection)) {
    for (const c of counts.bySection) {
      if (c.sectionId) sectionCounts[c.sectionId] = c.count
    }
  }

  // Build floor counts map
  const floorCounts: Record<string, number> = {}
  if (Array.isArray(counts.byFloor)) {
    for (const c of counts.byFloor) {
      if (c.floorId) floorCounts[c.floorId] = c.count
    }
  }

  // Build status counts map
  const statusCounts: Record<string, number> = {}
  if (Array.isArray(counts.byStatus)) {
    for (const c of counts.byStatus) {
      if (c.status) statusCounts[c.status] = c.count
    }
  }

  // Refresh everything after mutations
  const refreshAll = useCallback(() => {
    mutateDrawings()
    mutateFloors()
    mutateSections()
  }, [mutateDrawings, mutateFloors, mutateSections])

  // Archive a drawing (soft delete via API)
  const handleArchiveDrawing = useCallback(async (drawing: any) => {
    if (!confirm(`Archive "${drawing.drawingNumber} — ${drawing.title}"? This will set the drawing status to Archived.`)) return
    try {
      const res = await fetch(`/api/projects/${project.id}/project-files-v2/drawings/${drawing.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to archive')
      refreshAll()
      if (selectedDrawingId === drawing.id) setSelectedDrawingId(null)
    } catch (err) {
      console.error('Archive error:', err)
      alert('Failed to archive drawing. Please try again.')
    }
  }, [project.id, refreshAll, selectedDrawingId])

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ---------------------------------------------------------------- */}
      {/* HEADER                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: back + title */}
            <div className="flex items-center gap-3">
              <Link href={`/projects/${project.id}`}>
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Project Files</h1>
                <p className="text-sm text-gray-500">{project.name}</p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-3">
              {/* Send Files button — always visible */}
              <button
                onClick={() => setShowSendFile(true)}
                className="group flex items-center gap-2.5 h-10 px-4 rounded-lg border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white active:scale-[0.98] transition-all duration-200"
              >
                <Send className="w-4 h-4" />
                <span className="text-sm font-medium">Send Files</span>
              </button>

              {/* Search + Add Drawing — drawings tab only */}
              {activeTab === 'drawings' && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search drawings..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="pl-9 w-64 h-9 text-sm"
                    />
                    {searchInput && (
                      <button
                        onClick={() => {
                          setSearchInput('')
                          setFilters((prev) => ({ ...prev, search: '' }))
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Button size="sm" onClick={() => setShowAddDrawing(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Drawing
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* BODY                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as TabValue)}
        >
          {/* Tab bar + view toggle */}
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="all-files" className="gap-1.5">
                <FolderTree className="w-4 h-4" />
                All Files
              </TabsTrigger>
              <TabsTrigger value="drawings" className="gap-1.5">
                <FileText className="w-4 h-4" />
                Drawings
              </TabsTrigger>
              <TabsTrigger value="photos" className="gap-1.5">
                <Camera className="w-4 h-4" />
                Photos
              </TabsTrigger>
              <TabsTrigger value="transmittals" className="gap-1.5">
                <Send className="w-4 h-4" />
                Sent
              </TabsTrigger>
            </TabsList>

            {/* View toggle - only for drawings tab */}
            {activeTab === 'drawings' && (
              <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Card view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* ======================================================= */}
          {/* ALL FILES TAB                                            */}
          {/* ======================================================= */}
          <TabsContent value="all-files">
            <AllFilesBrowser
              projectId={project.id}
              dropboxFolder={project.dropboxFolder}
              drawings={drawings.map((d: any) => ({
                id: d.id,
                drawingNumber: d.drawingNumber,
                title: d.title,
                dropboxPath: d.dropboxPath,
              }))}
              onRegisterAsDrawing={(file) => {
                // Extract drawing number and title from filename
                const nameWithoutExt = file.name.replace(/\.pdf$/i, '')
                const match = nameWithoutExt.match(/^([A-Z0-9][\w.-]*)[\s_-]+(.+)$/i)
                setPrefillDrawing({
                  dropboxPath: file.path,
                  fileName: file.name,
                  fileSize: file.size,
                  drawingNumber: match ? match[1] : '',
                  title: match ? match[2].replace(/_/g, ' ') : nameWithoutExt,
                })
                setShowAddDrawing(true)
              }}
              onSendTransmittal={(drawingInfo) => {
                const found = drawings.find((d: any) => d.id === drawingInfo.id)
                if (found) {
                  setTransmittalPreSelectedDrawings([found])
                  setShowNewTransmittal(true)
                }
              }}
            />
          </TabsContent>

          {/* ======================================================= */}
          {/* DRAWINGS TAB — sidebar INSIDE this tab content           */}
          {/* ======================================================= */}
          <TabsContent value="drawings">
            <div className="flex gap-6">
              {/* Filter Sidebar */}
              <FilterSidebar
                selectedSectionId={filters.sectionId}
                onSectionChange={(s) => setFilters((prev) => ({ ...prev, sectionId: s }))}
                sections={Array.isArray(sections) ? sections.map((s: any) => ({ id: s.id, name: s.name, shortName: s.shortName || '', color: s.color || 'bg-gray-500' })) : []}
                sectionCounts={sectionCounts}
                selectedFloorId={filters.floorId}
                onFloorChange={(f) => setFilters((prev) => ({ ...prev, floorId: f }))}
                floors={Array.isArray(floors) ? floors.map((f: any) => ({ id: f.id, name: f.name, shortName: f.shortName || f.name?.substring(0, 3)?.toUpperCase() || '' })) : []}
                floorCounts={floorCounts}
                selectedStatus={filters.status}
                onStatusChange={(s) => setFilters((prev) => ({ ...prev, status: s }))}
                statusCounts={statusCounts}
                projectId={project.id}
                onFloorAdded={() => mutateFloors()}
                onSectionAdded={() => mutateSections()}
              />

              {/* Drawing register */}
              <div className="flex-1 min-w-0">
                {/* CAD Freshness Summary */}
                <CadFreshnessSummary projectId={project.id} />

                {drawingsLoading ? (
                  <DrawingsLoadingSkeleton viewMode={viewMode} />
                ) : drawings.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-7 h-7 text-gray-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">No drawings found</h3>
                    <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                      {hasActiveFilters
                        ? 'No drawings match your current filters. Try adjusting or clearing your filters.'
                        : 'Get started by adding your first drawing to this project.'}
                    </p>
                    {hasActiveFilters ? (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setShowAddDrawing(true)}>
                        <Plus className="w-4 h-4 mr-1.5" />
                        Add Drawing
                      </Button>
                    )}
                  </div>
                ) : viewMode === 'table' ? (
                  <DrawingRegisterTable
                    projectId={project.id}
                    drawings={drawings}
                    onSelectDrawing={(d) => setSelectedDrawingId(d.id)}
                    onEditDrawing={(d) => { setEditDrawing(d); setShowAddDrawing(true) }}
                    onNewRevision={(d) => setRevisionDrawing(d)}
                    onAddToTransmittal={(d) => {
                      setTransmittalPreSelectedDrawings([d])
                      setShowNewTransmittal(true)
                    }}
                    onArchiveDrawing={handleArchiveDrawing}
                    selectedDrawingId={selectedDrawingId}
                  />
                ) : (
                  <DrawingRegisterCards
                    projectId={project.id}
                    drawings={drawings}
                    onSelectDrawing={(d) => setSelectedDrawingId(d.id)}
                    onEditDrawing={(d) => { setEditDrawing(d); setShowAddDrawing(true) }}
                    onNewRevision={(d) => setRevisionDrawing(d)}
                    onAddToTransmittal={(d) => {
                      setTransmittalPreSelectedDrawings([d])
                      setShowNewTransmittal(true)
                    }}
                    onArchiveDrawing={handleArchiveDrawing}
                    selectedDrawingId={selectedDrawingId}
                  />
                )}
              </div>

              {/* Drawing detail panel (slide-out, inside drawings flex) */}
              {selectedDrawingId && (
                <DrawingDetailPanel
                  projectId={project.id}
                  drawingId={selectedDrawingId}
                  onClose={() => setSelectedDrawingId(null)}
                  onEdit={() => {
                    const found = drawings.find((d: any) => d.id === selectedDrawingId)
                    if (found) {
                      setEditDrawing(found)
                      setShowAddDrawing(true)
                    }
                  }}
                  onNewRevision={() => {
                    const found = drawings.find((d: any) => d.id === selectedDrawingId)
                    if (found) setRevisionDrawing(found)
                  }}
                  onCreateTransmittal={() => {
                    const found = drawings.find((d: any) => d.id === selectedDrawingId)
                    if (found) {
                      setTransmittalPreSelectedDrawings([found])
                      setShowNewTransmittal(true)
                    }
                  }}
                  onLinkCadSource={() => {
                    const found = drawings.find((d: any) => d.id === selectedDrawingId)
                    if (found) setCadLinkDrawing(found)
                  }}
                />
              )}
            </div>
          </TabsContent>

          {/* ======================================================= */}
          {/* PHOTOS TAB                                               */}
          {/* ======================================================= */}
          <TabsContent value="photos">
            <PhotosGallery
              projectId={project.id}
              dropboxFolder={project.dropboxFolder}
            />
          </TabsContent>

          {/* ======================================================= */}
          {/* TRANSMITTALS TAB                                         */}
          {/* ======================================================= */}
          <TabsContent value="transmittals">
            <TransmittalLog
              transmittals={transmittals}
              isLoading={transmittalsLoading}
              onViewDetail={(t) => setViewTransmittal(t)}
              onCreateNew={() => setShowNewTransmittal(true)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* DIALOGS                                                          */}
      {/* ---------------------------------------------------------------- */}

      {/* Add / Edit Drawing Dialog */}
      <DrawingFormDialog
        projectId={project.id}
        open={showAddDrawing}
        onOpenChange={(open) => {
          setShowAddDrawing(open)
          if (!open) {
            setEditDrawing(null)
            setPrefillDrawing(null)
          }
        }}
        onSuccess={() => {
          refreshAll()
          setShowAddDrawing(false)
          setEditDrawing(null)
          setPrefillDrawing(null)
        }}
        editDrawing={editDrawing}
        floors={Array.isArray(floors) ? floors : []}
        sections={Array.isArray(sections) ? sections : []}
        prefillData={prefillDrawing}
      />

      {/* New Revision Dialog */}
      {revisionDrawing && (
        <NewRevisionDialog
          projectId={project.id}
          drawing={{
            id: revisionDrawing.id,
            drawingNumber: revisionDrawing.drawingNumber || revisionDrawing.number || '',
            title: revisionDrawing.title || '',
            currentRevision: revisionDrawing.currentRevision || 1,
          }}
          open={!!revisionDrawing}
          onOpenChange={(open) => {
            if (!open) setRevisionDrawing(null)
          }}
          onSuccess={() => {
            refreshAll()
            setRevisionDrawing(null)
          }}
        />
      )}

      {/* New Transmittal Dialog */}
      <NewTransmittalDialog
        projectId={project.id}
        open={showNewTransmittal}
        onOpenChange={(open) => {
          setShowNewTransmittal(open)
          if (!open) setTransmittalPreSelectedDrawings([])
        }}
        onSuccess={() => {
          mutateTransmittals()
          setShowNewTransmittal(false)
          setTransmittalPreSelectedDrawings([])
        }}
        preSelectedDrawings={transmittalPreSelectedDrawings}
      />

      {/* Transmittal Detail Dialog */}
      {viewTransmittal && (
        <TransmittalDetail
          transmittal={viewTransmittal}
          onClose={() => setViewTransmittal(null)}
          onResend={() => {
            mutateTransmittals()
            setViewTransmittal(null)
          }}
        />
      )}

      {/* Send File Dialog */}
      <SendFileDialog
        projectId={project.id}
        open={showSendFile}
        onOpenChange={setShowSendFile}
        onSuccess={() => setShowSendFile(false)}
      />

      {/* CAD Source Link Dialog */}
      {cadLinkDrawing && (
        <CadSourceLinkDialog
          projectId={project.id}
          drawing={{
            id: cadLinkDrawing.id,
            drawingNumber: cadLinkDrawing.drawingNumber || '',
            title: cadLinkDrawing.title || '',
          }}
          existingLink={cadLinkDrawing.cadSourceLink || null}
          open={!!cadLinkDrawing}
          onOpenChange={(open) => {
            if (!open) setCadLinkDrawing(null)
          }}
          onSuccess={() => {
            refreshAll()
            setCadLinkDrawing(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function DrawingsLoadingSkeleton({ viewMode }: { viewMode: 'table' | 'cards' }) {
  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="w-2.5 h-2.5 bg-gray-200 rounded-full" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="flex items-center justify-between">
              <div className="h-5 bg-gray-200 rounded-full w-14" />
              <div className="h-3 bg-gray-200 rounded w-10" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-3 bg-gray-200 rounded flex-1 max-w-xs" />
            <div className="h-5 bg-gray-200 rounded-full w-12" />
            <div className="h-3 bg-gray-200 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
