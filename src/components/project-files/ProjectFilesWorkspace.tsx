'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Camera, Send } from 'lucide-react'

// New components
import FilesTabContent from './FilesTabContent'
import SentTabContent from './SentTabContent'

// Reuse from v2
import DrawingFormDialog from '../project-files-v2/DrawingFormDialog'
import NewRevisionDialog from '../project-files-v2/NewRevisionDialog'
import NewTransmittalDialog from '../project-files-v2/NewTransmittalDialog'
import TransmittalDetail from '../project-files-v2/TransmittalDetail'
import SendFileDialog from '../project-files-v2/SendFileDialog'
import CadSourceLinkDialog from '../project-files-v2/CadSourceLinkDialog'
import PhotosGallery from '../project-files-v2/PhotosGallery'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  dropboxFolder: string | null
  client?: { id: string; name: string; email: string } | null
}

type TabValue = 'files' | 'photos' | 'sent'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProjectFilesWorkspace({ project }: { project: Project }) {
  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState<TabValue>('files')

  // ---- Filter state ----
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

  // ---- Dialog state ----
  const [showAddDrawing, setShowAddDrawing] = useState(false)
  const [editDrawing, setEditDrawing] = useState<any | null>(null)
  const [revisionDrawing, setRevisionDrawing] = useState<any | null>(null)
  const [showNewTransmittal, setShowNewTransmittal] = useState(false)
  const [transmittalPreSelectedDrawings, setTransmittalPreSelectedDrawings] = useState<any[]>([])
  const [viewTransmittal, setViewTransmittal] = useState<any | null>(null)
  const [cadLinkDrawing, setCadLinkDrawing] = useState<any | null>(null)
  const [showSendFile, setShowSendFile] = useState(false)
  const [prefillDrawing, setPrefillDrawing] = useState<{
    dropboxPath: string; fileName: string; fileSize?: number; drawingNumber?: string; title?: string
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
  const { data: drawingsData, isLoading: drawingsLoading, mutate: mutateDrawings } = useSWR(
    activeTab === 'files'
      ? `/api/projects/${project.id}/project-files-v2/drawings?${filterParams}`
      : null,
    fetcher
  )

  const { data: floorsData, mutate: mutateFloors } = useSWR(
    activeTab === 'files'
      ? `/api/projects/${project.id}/project-files-v2/floors`
      : null,
    fetcher
  )

  const { data: sectionsData, mutate: mutateSections } = useSWR(
    activeTab === 'files'
      ? `/api/projects/${project.id}/project-files-v2/sections`
      : null,
    fetcher
  )

  const { data: transmittalsData, isLoading: transmittalsLoading, mutate: mutateTransmittals } =
    useSWR(
      activeTab === 'sent'
        ? `/api/projects/${project.id}/project-files-v2/transmittals`
        : null,
      fetcher
    )

  // ---- Handlers ----
  const handleSearchSubmit = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput }))
  }, [searchInput])

  const clearFilters = useCallback(() => {
    setFilters({ sectionId: null, floorId: null, status: null, search: '' })
    setSearchInput('')
  }, [])

  const hasActiveFilters = !!(filters.sectionId || filters.floorId || filters.status || filters.search)

  // ---- Derived data ----
  const drawings = drawingsData?.drawings ?? []
  const counts = drawingsData?.counts ?? { bySection: [], byFloor: [], byStatus: [] }
  const floors = Array.isArray(floorsData) ? floorsData : (floorsData?.floors ?? floorsData ?? [])
  const sections = Array.isArray(sectionsData) ? sectionsData : (sectionsData?.sections ?? sectionsData ?? [])
  const transmittals = transmittalsData?.transmittals ?? []

  // Build count maps
  const sectionCounts: Record<string, number> = {}
  if (Array.isArray(counts.bySection)) {
    for (const c of counts.bySection) {
      if (c.sectionId) sectionCounts[c.sectionId] = c.count
    }
  }

  const floorCounts: Record<string, number> = {}
  if (Array.isArray(counts.byFloor)) {
    for (const c of counts.byFloor) {
      if (c.floorId) floorCounts[c.floorId] = c.count
    }
  }

  const statusCounts: Record<string, number> = {}
  if (Array.isArray(counts.byStatus)) {
    for (const c of counts.byStatus) {
      if (c.status) statusCounts[c.status] = c.count
    }
  }

  // Refresh
  const refreshAll = useCallback(() => {
    mutateDrawings()
    mutateFloors()
    mutateSections()
  }, [mutateDrawings, mutateFloors, mutateSections])

  // Archive handler
  const handleArchiveDrawing = useCallback(async (drawing: any) => {
    if (!confirm(`Archive "${drawing.drawingNumber} — ${drawing.title}"?`)) return
    try {
      const res = await fetch(`/api/projects/${project.id}/project-files-v2/drawings/${drawing.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to archive')
      refreshAll()
    } catch (err) {
      console.error('Archive error:', err)
      alert('Failed to archive drawing.')
    }
  }, [project.id, refreshAll])

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
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
            <button
              onClick={() => setShowSendFile(true)}
              className="group flex items-center gap-2.5 h-10 px-4 rounded-lg
                border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white
                active:scale-[0.98] transition-all duration-200"
            >
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">Send Files</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabValue)}>
          {/* Underline-style tabs */}
          <div className="border-b border-gray-200 mb-6">
            <TabsList className="bg-transparent rounded-none p-0 h-auto gap-0">
              <TabsTrigger
                value="files"
                className="rounded-none border-b-2 border-transparent px-4 pb-2.5 pt-1
                  text-sm font-medium text-gray-500 hover:text-gray-700
                  data-[state=active]:border-gray-900 data-[state=active]:text-gray-900
                  data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  transition-colors gap-1.5"
              >
                <FileText className="w-4 h-4" />
                Files
              </TabsTrigger>
              <TabsTrigger
                value="photos"
                className="rounded-none border-b-2 border-transparent px-4 pb-2.5 pt-1
                  text-sm font-medium text-gray-500 hover:text-gray-700
                  data-[state=active]:border-gray-900 data-[state=active]:text-gray-900
                  data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  transition-colors gap-1.5"
              >
                <Camera className="w-4 h-4" />
                Photos
              </TabsTrigger>
              <TabsTrigger
                value="sent"
                className="rounded-none border-b-2 border-transparent px-4 pb-2.5 pt-1
                  text-sm font-medium text-gray-500 hover:text-gray-700
                  data-[state=active]:border-gray-900 data-[state=active]:text-gray-900
                  data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  transition-colors gap-1.5"
              >
                <Send className="w-4 h-4" />
                Sent
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── FILES TAB ────────────────────────────────────────── */}
          <TabsContent value="files" className="mt-0">
            <FilesTabContent
              projectId={project.id}
              dropboxFolder={project.dropboxFolder}
              drawings={drawings}
              isLoading={drawingsLoading}
              sections={Array.isArray(sections) ? sections.map((s: any) => ({
                id: s.id, name: s.name, shortName: s.shortName || '', color: s.color || 'bg-gray-500'
              })) : []}
              floors={Array.isArray(floors) ? floors.map((f: any) => ({
                id: f.id, name: f.name, shortName: f.shortName || f.name?.substring(0, 3)?.toUpperCase() || ''
              })) : []}
              sectionCounts={sectionCounts}
              floorCounts={floorCounts}
              statusCounts={statusCounts}
              filters={filters}
              onFiltersChange={setFilters}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              onSearchSubmit={handleSearchSubmit}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              onAddDrawing={() => setShowAddDrawing(true)}
              onEditDrawing={(d) => { setEditDrawing(d); setShowAddDrawing(true) }}
              onNewRevision={(d) => setRevisionDrawing(d)}
              onAddToTransmittal={(d) => {
                setTransmittalPreSelectedDrawings([d])
                setShowNewTransmittal(true)
              }}
              onArchiveDrawing={handleArchiveDrawing}
              onCreateTransmittal={(d) => {
                setTransmittalPreSelectedDrawings([d])
                setShowNewTransmittal(true)
              }}
              onLinkCadSource={(d) => setCadLinkDrawing(d)}
              onRegisterAsDrawing={(file) => {
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
            />
          </TabsContent>

          {/* ── PHOTOS TAB ───────────────────────────────────────── */}
          <TabsContent value="photos" className="mt-0">
            <PhotosGallery
              projectId={project.id}
              dropboxFolder={project.dropboxFolder}
            />
          </TabsContent>

          {/* ── SENT TAB ─────────────────────────────────────────── */}
          <TabsContent value="sent" className="mt-0">
            <SentTabContent
              transmittals={transmittals}
              isLoading={transmittalsLoading}
              onViewDetail={(t) => setViewTransmittal(t)}
              onCreateNew={() => setShowNewTransmittal(true)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── DIALOGS ────────────────────────────────────────────────── */}

      <DrawingFormDialog
        projectId={project.id}
        open={showAddDrawing}
        onOpenChange={(open) => {
          setShowAddDrawing(open)
          if (!open) { setEditDrawing(null); setPrefillDrawing(null) }
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

      {revisionDrawing && (
        <NewRevisionDialog
          projectId={project.id}
          drawing={{
            id: revisionDrawing.id,
            drawingNumber: revisionDrawing.drawingNumber || '',
            title: revisionDrawing.title || '',
            currentRevision: revisionDrawing.currentRevision || 1,
          }}
          open={!!revisionDrawing}
          onOpenChange={(open) => { if (!open) setRevisionDrawing(null) }}
          onSuccess={() => { refreshAll(); setRevisionDrawing(null) }}
        />
      )}

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

      {viewTransmittal && (
        <TransmittalDetail
          transmittal={viewTransmittal}
          onClose={() => setViewTransmittal(null)}
          onResend={() => { mutateTransmittals(); setViewTransmittal(null) }}
        />
      )}

      <SendFileDialog
        projectId={project.id}
        open={showSendFile}
        onOpenChange={setShowSendFile}
        onSuccess={() => setShowSendFile(false)}
      />

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
          onOpenChange={(open) => { if (!open) setCadLinkDrawing(null) }}
          onSuccess={() => { refreshAll(); setCadLinkDrawing(null) }}
        />
      )}
    </div>
  )
}
