'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Download,
  Plus,
  Search,
  X,
  Calendar,
  Filter,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReceivedFileData {
  id: string
  senderName: string
  senderEmail: string | null
  senderCompany: string | null
  senderType: string | null
  receivedDate: string
  notes: string | null
  fileName: string
  fileSize: number | null
  title: string
  createdAt: string
  section: { id: string; name: string; shortName: string; color: string } | null
  dropboxPath: string | null
  dropboxUrl: string | null
  drawing: {
    id: string
    drawingNumber: string
    title: string
    currentRevision: number
    status: string
    dropboxPath: string | null
    dropboxUrl: string | null
    fileName: string | null
  } | null
  creator: { id: string; name: string | null } | null
}

interface ReceivedFilesLogProps {
  projectId: string
  receivedFiles: ReceivedFileData[]
  isLoading: boolean
  onReceiveNew: () => void
  onOpenInFiles?: (folderPath: string) => void
  mutateReceivedFiles?: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(date: string): { date: string; time: string } {
  const d = new Date(date)
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReceivedFilesLog({
  projectId,
  receivedFiles,
  isLoading,
  onReceiveNew,
  onOpenInFiles,
  mutateReceivedFiles,
}: ReceivedFilesLogProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // ── Selection state ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const hasActiveFilters = filterSearch !== '' || filterDateFrom !== '' || filterDateTo !== ''

  const clearAllFilters = useCallback(() => {
    setFilterSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }, [])

  /** Toggle selection of a single row */
  const toggleSelect = useCallback((rowId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])

  /** Toggle all visible rows */
  const toggleSelectAll = useCallback((rows: ReceivedFileData[]) => {
    setSelectedIds((prev) => {
      const allSelected = rows.every((r) => prev.has(r.id))
      if (allSelected) return new Set()
      return new Set(rows.map((r) => r.id))
    })
  }, [])

  /** Delete selected received files */
  const handleDeleteSelected = useCallback(async (rows: ReceivedFileData[]) => {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id))
    if (selectedRows.length === 0) return

    const count = selectedRows.length
    const msg = `Delete ${count} received file${count !== 1 ? 's' : ''}? This cannot be undone.`
    if (!confirm(msg)) return

    setIsDeleting(true)
    try {
      await Promise.all(
        selectedRows.map((rf) =>
          fetch(`/api/projects/${projectId}/project-files-v2/receive-files/${rf.id}`, {
            method: 'DELETE',
          })
        )
      )
      setSelectedIds(new Set())
      mutateReceivedFiles?.()
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete some received files. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }, [selectedIds, projectId, mutateReceivedFiles])

  // ── Filter received files ─────────────────────────────────────────────
  const filteredFiles = useMemo(() => {
    return receivedFiles.filter((rf) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        const senderMatch = rf.senderName.toLowerCase().includes(q)
        const companyMatch = rf.senderCompany?.toLowerCase().includes(q) ?? false
        const titleMatch = rf.title.toLowerCase().includes(q)
        const fileMatch = rf.fileName.toLowerCase().includes(q)
        if (!senderMatch && !companyMatch && !titleMatch && !fileMatch) return false
      }
      if (filterDateFrom) {
        if (new Date(rf.receivedDate) < new Date(filterDateFrom)) return false
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(rf.receivedDate) > to) return false
      }
      return true
    })
  }, [receivedFiles, filterSearch, filterDateFrom, filterDateTo])

  // ── Sort by received date descending ──────────────────────────────────
  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort(
      (a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime()
    )
  }, [filteredFiles])

  // ── Loading state ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-5 w-8 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-slate-100 px-4 py-3.5">
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (receivedFiles.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Received Files</h2>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-16 text-center">
          <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Download className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No files received yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
            Log files received from contractors, subs, or clients to keep track of everything.
          </p>
          <button
            onClick={onReceiveNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Receive Files
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Received Files</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {filteredFiles.length}{hasActiveFilters ? ` / ${receivedFiles.length}` : ''}
          </span>
        </div>
        <button
          onClick={onReceiveNew}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" /> Receive Files
        </button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search sender, title..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            title="From date"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            title="To date"
          />
        </div>

        {hasActiveFilters && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            {(filterDateFrom || filterDateTo) && (
              <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-700">
                <Calendar className="h-3 w-3 text-slate-400" />
                {filterDateFrom && filterDateTo
                  ? `${filterDateFrom} – ${filterDateTo}`
                  : filterDateFrom
                    ? `From ${filterDateFrom}`
                    : `To ${filterDateTo}`}
                <button onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          </>
        )}
      </div>

      {/* ── Filtered empty state ───────────────────────────────────── */}
      {filteredFiles.length === 0 && hasActiveFilters && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
          <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Filter className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">No results found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-3">
            No received files match your current filters.
          </p>
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* ── Floating action bar (when rows selected) ─────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-white shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-4 bg-slate-600" />
          <button
            onClick={() => handleDeleteSelected(sortedFiles)}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Deselect all
          </button>
        </div>
      )}

      {/* ── Flat table — one row per received file ──────────────────── */}
      {sortedFiles.length > 0 && (
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-3 py-3 text-center w-[40px]">
                  <input
                    type="checkbox"
                    checked={sortedFiles.length > 0 && sortedFiles.every((r) => selectedIds.has(r.id))}
                    onChange={() => toggleSelectAll(sortedFiles)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[100px]">
                  Section
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[160px]">
                  Sender
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[110px]">
                  Logged By
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[130px]">
                  Received
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[60px]">
                  File
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedFiles.map((rf) => {
                const dt = formatDateTime(rf.receivedDate)
                const filePath = rf.dropboxPath || rf.drawing?.dropboxPath || null
                return (
                  <tr key={rf.id} className={cn('transition-colors hover:bg-slate-50/70 align-top', selectedIds.has(rf.id) && 'bg-slate-50')}>
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center w-[40px]">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rf.id)}
                        onChange={() => toggleSelect(rf.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
                      />
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-slate-900 truncate">{rf.title}</span>
                        {rf.notes && (
                          <span className="text-xs text-slate-400 truncate mt-0.5 italic">
                            {rf.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Section */}
                    <td className="px-4 py-3">
                      {rf.section ? (
                        <span className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          'bg-slate-50 text-slate-700 ring-1 ring-slate-200'
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', rf.section.color || 'bg-slate-400')} />
                          {rf.section.name}
                        </span>
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      )}
                    </td>

                    {/* Sender */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{rf.senderName}</span>
                      {rf.senderCompany && (
                        <span className="block text-xs text-slate-400">{rf.senderCompany}</span>
                      )}
                    </td>

                    {/* Logged By */}
                    <td className="px-4 py-3">
                      {rf.creator?.name ? (
                        <span className="text-sm text-slate-600">{rf.creator.name}</span>
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      )}
                    </td>

                    {/* Received date */}
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm text-slate-700">{dt.date}</span>
                        <span className="block text-xs text-slate-400">{dt.time}</span>
                      </div>
                    </td>

                    {/* Open in All Files */}
                    <td className="px-4 py-3">
                      {(() => {
                        if (!filePath || !onOpenInFiles) return <span className="text-slate-300">&mdash;</span>
                        const folder = filePath.split('/').slice(0, -1).join('/')
                        return (
                          <button
                            onClick={() => onOpenInFiles(folder)}
                            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            Open
                          </button>
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
