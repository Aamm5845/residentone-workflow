'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import {
  ArrowLeft,
  Search,
  Send,
  LayoutGrid,
  Grid3X3,
  Clock,
  FileUp,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { DrawingBoard } from './DrawingBoard'
import { DistributionMatrix } from './DistributionMatrix'
import { ActivityFeed } from './ActivityFeed'
import { ComposeTransmittal } from './ComposeTransmittal'
import { DrawingDetailSheet } from './DrawingDetailSheet'
import { RecipientDetail } from './RecipientDetail'
import { SendFileDialog } from './SendFileDialog'
import { StatusSummaryBar } from './StatusSummaryBar'
import { DISCIPLINE_CONFIG } from './v3-constants'
import type { V3Drawing, V3Recipient } from './v3-types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ViewTab = 'board' | 'matrix' | 'activity'

interface ProjectFilesV3WorkspaceProps {
  project: {
    id: string
    name: string
    dropboxFolder: string | null
    client: { id: string; name: string; email: string } | null
  }
}

export function ProjectFilesV3Workspace({ project }: ProjectFilesV3WorkspaceProps) {
  // View state
  const [activeView, setActiveView] = useState<ViewTab>('board')
  const [search, setSearch] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [composeOpen, setComposeOpen] = useState(false)

  // Panel state
  const [detailDrawingId, setDetailDrawingId] = useState<string | null>(null)
  const [detailRecipientEmail, setDetailRecipientEmail] = useState<string | null>(null)

  // Send File dialog
  const [sendFileOpen, setSendFileOpen] = useState(false)

  // Data
  const { data: drawingsData, isLoading: drawingsLoading, mutate: mutateDrawings } = useSWR<{ drawings: V3Drawing[] }>(
    `/api/projects/${project.id}/project-files-v3/drawings`,
    fetcher
  )

  const { data: recipients, mutate: mutateRecipients } = useSWR<V3Recipient[]>(
    `/api/projects/${project.id}/project-files-v3/recipients`,
    fetcher
  )

  const drawings = drawingsData?.drawings || []

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSent = useCallback(() => {
    mutateDrawings()
    mutateRecipients()
  }, [mutateDrawings, mutateRecipients])

  const handleDrawingClick = useCallback((id: string) => {
    setDetailDrawingId(id)
    setDetailRecipientEmail(null)
  }, [])

  const handleRecipientClick = useCallback((email: string) => {
    setDetailRecipientEmail(email)
    setDetailDrawingId(null)
  }, [])

  const handleSendFromDetail = useCallback((drawingId: string) => {
    setDetailDrawingId(null)
    setSelectedIds(new Set([drawingId]))
    setComposeOpen(true)
  }, [])

  const handleComposeFromSelection = useCallback(() => {
    if (selectedIds.size > 0) setComposeOpen(true)
  }, [selectedIds])

  const detailDrawing = detailDrawingId ? drawings.find((d) => d.id === detailDrawingId) : null

  const tabs: Array<{ key: ViewTab; label: string; icon: React.ReactNode }> = [
    { key: 'board', label: 'Drawings', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { key: 'matrix', label: 'Distribution', icon: <Grid3X3 className="h-3.5 w-3.5" /> },
    { key: 'activity', label: 'Activity', icon: <Clock className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-3">
        {/* First row: back + title + actions */}
        <div className="flex items-center gap-4 mb-3">
          <Link
            href={`/projects/${project.id}`}
            className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{project.name}</h1>
            <StatusSummaryBar drawings={drawings} />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setSendFileOpen(true)}
            >
              <FileUp className="h-3.5 w-3.5" />
              Send File
            </Button>

            {selectedIds.size > 0 && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleComposeFromSelection}
              >
                <Send className="h-3.5 w-3.5" />
                Send {selectedIds.size} Drawing{selectedIds.size !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>

        {/* Second row: tabs + filters */}
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeView === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Search (board view only) */}
          {activeView === 'board' && (
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search drawings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          )}

          {/* Discipline filter */}
          {(activeView === 'board' || activeView === 'matrix') && (
            <Select
              value={disciplineFilter || '_all'}
              onValueChange={(v) => setDisciplineFilter(v === '_all' ? null : v)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="All Disciplines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all" className="text-xs">All Disciplines</SelectItem>
                {Object.entries(DISCIPLINE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: config.hex }}
                      />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {drawingsLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {activeView === 'board' && (
              <DrawingBoard
                drawings={drawings}
                recipients={recipients || []}
                projectId={project.id}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onDrawingClick={handleDrawingClick}
                onSent={handleSent}
                search={search}
                disciplineFilter={disciplineFilter}
              />
            )}

            {activeView === 'matrix' && (
              <DistributionMatrix
                projectId={project.id}
                disciplineFilter={disciplineFilter}
              />
            )}

            {activeView === 'activity' && (
              <ActivityFeed
                projectId={project.id}
                onRecipientClick={handleRecipientClick}
              />
            )}
          </>
        )}
      </div>

      {/* Compose panel (Gmail-style bottom slide-up) */}
      {composeOpen && (
        <ComposeTransmittal
          drawings={drawings}
          selectedDrawingIds={selectedIds}
          recipients={recipients || []}
          projectId={project.id}
          onClose={() => {
            setComposeOpen(false)
            setSelectedIds(new Set())
          }}
          onSent={handleSent}
        />
      )}

      {/* Drawing detail sheet (right slide-in) */}
      {detailDrawing && (
        <DrawingDetailSheet
          drawing={detailDrawing}
          projectId={project.id}
          onClose={() => setDetailDrawingId(null)}
          onSendClick={handleSendFromDetail}
        />
      )}

      {/* Recipient detail sheet (right slide-in) */}
      {detailRecipientEmail && (
        <RecipientDetail
          projectId={project.id}
          recipientEmail={detailRecipientEmail}
          onClose={() => setDetailRecipientEmail(null)}
        />
      )}

      {/* Send File dialog */}
      <SendFileDialog
        open={sendFileOpen}
        onOpenChange={setSendFileOpen}
        projectId={project.id}
        recipients={recipients || []}
        onSent={handleSent}
      />
    </div>
  )
}
