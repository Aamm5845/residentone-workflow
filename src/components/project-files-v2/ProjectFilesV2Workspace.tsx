'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  Search,
  LayoutGrid,
  List,
  X,
  FileText,
  Send,
  Download,
  FolderTree,
  Camera,
  Image as ImageIcon,
} from 'lucide-react'

// Components
import DrawingRegisterTable from './DrawingRegisterTable'
import DrawingRegisterCards from './DrawingRegisterCards'
import DrawingDetailPanel from './DrawingDetailPanel'
import DrawingFormDialog from './DrawingFormDialog'
import NewRevisionDialog from './NewRevisionDialog'
import TransmittalLog from './TransmittalLog'
import NewTransmittalDialog from './NewTransmittalDialog'
import FilterSidebar from './FilterSidebar'
import AllFilesBrowser from './AllFilesBrowser'
import PhotosGallery from './PhotosGallery'
import RenderingsGallery from './RenderingsGallery'
import SendFileDialog from './SendFileDialog'
import ReceiveFileDialog from './ReceiveFileDialog'
import ReceivedFilesLog from './ReceivedFilesLog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string
  name: string
  dropboxFolder: string | null
  client?: { id: string; name: string; email: string } | null
}

type TabValue = 'all-files' | 'drawings' | 'photos' | 'renderings' | 'transmittals' | 'received'

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
    status: string | null
    search: string
  }>({
    sectionId: null,
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
  const [showSendFile, setShowSendFile] = useState(false)
  const [showReceiveFile, setShowReceiveFile] = useState(false)
  const [sendFileInitialFiles, setSendFileInitialFiles] = useState<{
    name: string
    dropboxPath: string
    size?: number
    title?: string
    sectionId?: string
  }[]>([])
  const [prefillDrawing, setPrefillDrawing] = useState<{
    dropboxPath: string
    fileName: string
    fileSize?: number
    drawingNumber?: string
    title?: string
  } | null>(null)

  // Navigate All Files to a specific folder (used by Sent/Received tabs)
  const [allFilesNavigatePath, setAllFilesNavigatePath] = useState<string | null>(null)

  // ---- Derived filter params ----
  const filterParams = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.sectionId) params.set('sectionId', filters.sectionId)
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

  const { data: receivedData, isLoading: receivedLoading, mutate: mutateReceived } =
    useSWR(
      activeTab === 'received' ? `/api/projects/${project.id}/project-files-v2/receive-files` : null,
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
    setFilters({ sectionId: null, status: null, search: '' })
    setSearchInput('')
  }, [])

  const hasActiveFilters = filters.sectionId || filters.status || filters.search

  // ---- Derived data ----
  const drawings = drawingsData?.drawings ?? []
  const counts = drawingsData?.counts ?? { bySection: [], byStatus: [] }
  const sections = Array.isArray(sectionsData) ? sectionsData : (sectionsData?.sections ?? sectionsData ?? [])
  const transmittals = transmittalsData?.transmittals ?? []
  const receivedFiles = receivedData?.receivedFiles ?? []

  // Build section counts map
  const sectionCounts: Record<string, number> = {}
  if (Array.isArray(counts.bySection)) {
    for (const c of counts.bySection) {
      if (c.sectionId) sectionCounts[c.sectionId] = c.count
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
    mutateSections()
  }, [mutateDrawings, mutateSections])

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
    <div className="min-h-screen bg-slate-50">
      {/* ---------------------------------------------------------------- */}
      {/* HEADER                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: back + title */}
            <div className="flex items-center gap-3">
              <Link href={`/projects/${project.id}`}>
                <button className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Project Files</h1>
                <p className="text-sm text-slate-500">{project.name}</p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2.5">
              {/* Receive Files button — always visible */}
              <button
                onClick={() => setShowReceiveFile(true)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                <Download className="w-4 h-4" />
                Receive Files
              </button>

              {/* Send Files button — always visible */}
              <button
                onClick={() => setShowSendFile(true)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
              >
                <Send className="w-4 h-4" />
                Send Files
              </button>

              {/* Search + Add Drawing — drawings tab only */}
              {activeTab === 'drawings' && (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search drawings..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="h-9 w-64 rounded-xl border-slate-200 pl-9 text-sm"
                    />
                    {searchInput && (
                      <button
                        onClick={() => {
                          setSearchInput('')
                          setFilters((prev) => ({ ...prev, search: '' }))
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddDrawing(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Drawing
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* BODY                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="max-w-[1920px] mx-auto px-6 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as TabValue)}
        >
          {/* Tab bar + view toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1.5">
              {([
                { value: 'all-files' as TabValue, label: 'All Files', icon: FolderTree },
                { value: 'drawings' as TabValue, label: 'Drawings', icon: FileText },
                { value: 'photos' as TabValue, label: 'Photos', icon: Camera },
                { value: 'renderings' as TabValue, label: 'Renderings', icon: ImageIcon },
                { value: 'transmittals' as TabValue, label: 'Sent', icon: Send },
                { value: 'received' as TabValue, label: 'Received', icon: Download },
              ]).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all',
                    activeTab === value
                      ? 'bg-white text-slate-900 font-medium shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* View toggle - only for drawings tab */}
            {activeTab === 'drawings' && (
              <div className="inline-flex items-center gap-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'p-2 rounded-lg transition-all',
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  )}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'p-2 rounded-lg transition-all',
                    viewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  )}
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
              navigateToPath={allFilesNavigatePath}
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
                if (found && found.dropboxPath) {
                  const fileName = found.dropboxPath.split('/').pop() || found.drawingNumber || 'file.pdf'
                  setSendFileInitialFiles([{
                    name: fileName,
                    dropboxPath: found.dropboxPath,
                    size: 0,
                    title: found.title || drawingInfo.title,
                    sectionId: found.sectionId || undefined,
                  }])
                  setShowSendFile(true)
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
                sections={Array.isArray(sections) ? sections.map((s: any) => ({ id: s.id, name: s.name, shortName: s.shortName || '', color: s.color || 'bg-slate-500' })) : []}
                sectionCounts={sectionCounts}
                selectedStatus={filters.status}
                onStatusChange={(s) => setFilters((prev) => ({ ...prev, status: s }))}
                statusCounts={statusCounts}
                projectId={project.id}
                onSectionAdded={() => mutateSections()}
              />

              {/* Drawing register */}
              <div className="flex-1 min-w-0">
                {drawingsLoading ? (
                  <DrawingsLoadingSkeleton viewMode={viewMode} />
                ) : drawings.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
                    <div className="w-14 h-14 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <FileText className="w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-1">No drawings found</h3>
                    <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
                      {hasActiveFilters
                        ? 'No drawings match your current filters. Try adjusting or clearing your filters.'
                        : 'Get started by adding your first drawing to this project.'}
                    </p>
                    {hasActiveFilters ? (
                      <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                        Clear Filters
                      </button>
                    ) : (
                      <button onClick={() => setShowAddDrawing(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors">
                        <Plus className="w-4 h-4" />
                        Add Drawing
                      </button>
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
                      if (d.dropboxPath) {
                        const fileName = d.dropboxPath.split('/').pop() || d.drawingNumber || 'file.pdf'
                        setSendFileInitialFiles([{
                          name: fileName,
                          dropboxPath: d.dropboxPath,
                          size: 0,
                          title: d.title || '',
                          sectionId: d.sectionId || undefined,
                        }])
                        setShowSendFile(true)
                      }
                    }}
                    onArchiveDrawing={handleArchiveDrawing}
                    selectedDrawingId={selectedDrawingId}
                    mutateDrawings={refreshAll}
                  />
                ) : (
                  <DrawingRegisterCards
                    projectId={project.id}
                    drawings={drawings}
                    onSelectDrawing={(d) => setSelectedDrawingId(d.id)}
                    onEditDrawing={(d) => { setEditDrawing(d); setShowAddDrawing(true) }}
                    onNewRevision={(d) => setRevisionDrawing(d)}
                    onAddToTransmittal={(d) => {
                      if (d.dropboxPath) {
                        const fileName = d.dropboxPath.split('/').pop() || d.drawingNumber || 'file.pdf'
                        setSendFileInitialFiles([{
                          name: fileName,
                          dropboxPath: d.dropboxPath,
                          size: 0,
                          title: d.title || '',
                          sectionId: d.sectionId || undefined,
                        }])
                        setShowSendFile(true)
                      }
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
                    if (found && found.dropboxPath) {
                      const fileName = found.dropboxPath.split('/').pop() || found.drawingNumber || 'file.pdf'
                      setSendFileInitialFiles([{
                        name: fileName,
                        dropboxPath: found.dropboxPath,
                        size: 0,
                        title: found.title || '',
                        sectionId: found.sectionId || undefined,
                      }])
                      setShowSendFile(true)
                    }
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
          {/* RENDERINGS TAB                                           */}
          {/* ======================================================= */}
          <TabsContent value="renderings">
            <RenderingsGallery projectId={project.id} />
          </TabsContent>

          {/* ======================================================= */}
          {/* TRANSMITTALS TAB                                         */}
          {/* ======================================================= */}
          <TabsContent value="transmittals">
            <TransmittalLog
              projectId={project.id}
              dropboxFolder={project.dropboxFolder}
              transmittals={transmittals}
              isLoading={transmittalsLoading}
              onCreateNew={() => setShowNewTransmittal(true)}
              onOpenInFiles={(folderPath) => {
                setAllFilesNavigatePath(folderPath)
                setActiveTab('all-files')
              }}
              mutateTransmittals={mutateTransmittals}
            />
          </TabsContent>

          {/* ======================================================= */}
          {/* RECEIVED FILES TAB                                       */}
          {/* ======================================================= */}
          <TabsContent value="received">
            <ReceivedFilesLog
              receivedFiles={receivedFiles}
              isLoading={receivedLoading}
              onReceiveNew={() => setShowReceiveFile(true)}
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

      {/* Send File Dialog */}
      <SendFileDialog
        projectId={project.id}
        open={showSendFile}
        onOpenChange={(open) => {
          setShowSendFile(open)
          if (!open) setSendFileInitialFiles([])
        }}
        onSuccess={() => {
          setShowSendFile(false)
          setSendFileInitialFiles([])
        }}
        initialFiles={sendFileInitialFiles.length > 0 ? sendFileInitialFiles : undefined}
      />

      {/* Receive File Dialog */}
      <ReceiveFileDialog
        projectId={project.id}
        open={showReceiveFile}
        onOpenChange={setShowReceiveFile}
        onSuccess={() => {
          setShowReceiveFile(false)
          refreshAll()
          mutateReceived()
        }}
      />

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
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="w-2.5 h-2.5 bg-slate-200 rounded-full" />
            </div>
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
            <div className="flex items-center justify-between">
              <div className="h-5 bg-slate-200 rounded-full w-14" />
              <div className="h-3 bg-slate-200 rounded w-10" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-20" />
            <div className="h-3 bg-slate-200 rounded flex-1 max-w-xs" />
            <div className="h-5 bg-slate-200 rounded-full w-12" />
            <div className="h-3 bg-slate-200 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
