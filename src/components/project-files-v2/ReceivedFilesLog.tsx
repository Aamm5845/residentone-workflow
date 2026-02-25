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
  FolderOpen,
  ChevronRight,
  FileText,
  Paperclip,
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

interface ReceivedGroup {
  key: string
  senderName: string
  senderCompany: string | null
  senderEmail: string | null
  receivedDate: string
  creator: { id: string; name: string | null } | null
  files: ReceivedFileData[]
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

function formatDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getFolderForFile(rf: ReceivedFileData): string {
  const filePath = rf.dropboxPath || rf.drawing?.dropboxPath || null
  if (filePath) return filePath.split('/').slice(0, -1).join('/')
  if (rf.section?.name) {
    const dateStr = toDateKey(rf.receivedDate)
    return `6- Documents/${rf.section.name}/${dateStr}`
  }
  return ''
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // ── Selection state ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const hasActiveFilters = filterSearch !== '' || filterDateFrom !== '' || filterDateTo !== ''

  const clearAllFilters = useCallback(() => {
    setFilterSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /** Toggle selection of a group (all files in that group) */
  const toggleSelectGroup = useCallback((group: ReceivedGroup) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = group.files.every(f => prev.has(f.id))
      if (allSelected) {
        group.files.forEach(f => next.delete(f.id))
      } else {
        group.files.forEach(f => next.add(f.id))
      }
      return next
    })
  }, [])

  /** Toggle selection of a single file */
  const toggleSelect = useCallback((rowId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])

  /** Delete selected received files */
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return

    const count = selectedIds.size
    const msg = `Delete ${count} received file${count !== 1 ? 's' : ''}? This cannot be undone.`
    if (!confirm(msg)) return

    setIsDeleting(true)
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/projects/${projectId}/project-files-v2/receive-files/${id}`, {
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

  // ── Group files by sender + received date ──────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, ReceivedGroup>()
    for (const rf of filteredFiles) {
      const dateKey = toDateKey(rf.receivedDate)
      const key = `${rf.senderName}|${rf.senderCompany || ''}|${dateKey}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          senderName: rf.senderName,
          senderCompany: rf.senderCompany,
          senderEmail: rf.senderEmail,
          receivedDate: rf.receivedDate,
          creator: rf.creator,
          files: [],
        })
      }
      map.get(key)!.files.push(rf)
    }
    // Sort groups by received date descending
    return Array.from(map.values()).sort(
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
            {groups.length} receipt{groups.length !== 1 ? 's' : ''}{hasActiveFilters ? ` · ${filteredFiles.length} files` : ''}
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
            onClick={handleDeleteSelected}
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

      {/* ── Grouped table ──────────────────────────────────────────── */}
      {groups.length > 0 && (
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-3 py-3 text-center w-[40px]" />
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[32px]" />
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Sender
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[80px]">
                  Files
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[160px]">
                  Section
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[110px]">
                  Logged By
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[130px]">
                  Received
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[100px]">
                  Location
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.key)
                const dateStr = formatDate(group.receivedDate)
                const allGroupSelected = group.files.every(f => selectedIds.has(f.id))
                const someGroupSelected = group.files.some(f => selectedIds.has(f.id))

                // Collect unique sections across files in this group
                const uniqueSections = new Map<string, { name: string; color: string }>()
                for (const f of group.files) {
                  if (f.section) uniqueSections.set(f.section.id, { name: f.section.name, color: f.section.color })
                }

                // Get folder for the first file (they're all in the same folder)
                const folder = getFolderForFile(group.files[0])

                return (
                  <GroupRows
                    key={group.key}
                    group={group}
                    isExpanded={isExpanded}
                    onToggle={() => toggleGroup(group.key)}
                    dateStr={dateStr}
                    allSelected={allGroupSelected}
                    someSelected={someGroupSelected}
                    onToggleSelect={() => toggleSelectGroup(group)}
                    onToggleFileSelect={toggleSelect}
                    selectedIds={selectedIds}
                    uniqueSections={uniqueSections}
                    folder={folder}
                    onOpenInFiles={onOpenInFiles}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Group Rows ─────────────────────────────────────────────────────────────

function GroupRows({
  group,
  isExpanded,
  onToggle,
  dateStr,
  allSelected,
  someSelected,
  onToggleSelect,
  onToggleFileSelect,
  selectedIds,
  uniqueSections,
  folder,
  onOpenInFiles,
}: {
  group: ReceivedGroup
  isExpanded: boolean
  onToggle: () => void
  dateStr: string
  allSelected: boolean
  someSelected: boolean
  onToggleSelect: () => void
  onToggleFileSelect: (id: string) => void
  selectedIds: Set<string>
  uniqueSections: Map<string, { name: string; color: string }>
  folder: string
  onOpenInFiles?: (folderPath: string) => void
}) {
  return (
    <>
      {/* Group header row */}
      <tr
        className={cn(
          'transition-colors hover:bg-slate-50/70 cursor-pointer',
          isExpanded && 'bg-slate-50/50',
          someSelected && 'bg-blue-50/30'
        )}
        onClick={onToggle}
      >
        {/* Checkbox */}
        <td className="px-3 py-3 text-center w-[40px]" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
          />
        </td>

        {/* Expand chevron */}
        <td className="px-4 py-3 w-[32px]">
          <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isExpanded && 'rotate-90')} />
        </td>

        {/* Sender */}
        <td className="px-4 py-3">
          <span className="text-sm font-medium text-slate-900">{group.senderName}</span>
          {group.senderCompany && (
            <span className="block text-xs text-slate-400">{group.senderCompany}</span>
          )}
        </td>

        {/* File count */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            <Paperclip className="w-3 h-3 text-slate-400" />
            {group.files.length}
          </span>
        </td>

        {/* Sections */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {Array.from(uniqueSections.values()).map((sec) => (
              <span
                key={sec.name}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-50 text-slate-700 ring-1 ring-slate-200"
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', sec.color || 'bg-slate-400')} />
                {sec.name}
              </span>
            ))}
          </div>
        </td>

        {/* Logged By */}
        <td className="px-4 py-3">
          {group.creator?.name ? (
            <span className="text-sm text-slate-600">{group.creator.name}</span>
          ) : (
            <span className="text-slate-300">&mdash;</span>
          )}
        </td>

        {/* Received date */}
        <td className="px-4 py-3">
          <span className="text-sm text-slate-700">{dateStr}</span>
        </td>

        {/* Open in All Files */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          {folder && onOpenInFiles ? (
            <button
              onClick={() => onOpenInFiles(folder)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <FolderOpen className="w-3 h-3" />
              Open
            </button>
          ) : (
            <span className="text-slate-300">&mdash;</span>
          )}
        </td>
      </tr>

      {/* Expanded file rows */}
      {isExpanded && group.files.map((rf) => (
        <tr key={rf.id} className={cn('bg-slate-50/30 hover:bg-slate-50/70 transition-colors', selectedIds.has(rf.id) && 'bg-blue-50/30')}>
          {/* Checkbox */}
          <td className="px-3 py-2.5 text-center w-[40px]">
            <input
              type="checkbox"
              checked={selectedIds.has(rf.id)}
              onChange={() => onToggleFileSelect(rf.id)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
            />
          </td>

          {/* Indent */}
          <td className="w-[32px]" />

          {/* Title + file name */}
          <td className="px-4 py-2.5" colSpan={2}>
            <div className="flex items-start gap-2 pl-2">
              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-sm text-slate-800">{rf.title}</span>
                <span className="block text-xs text-slate-400 truncate">{rf.fileName}</span>
                {rf.notes && (
                  <span className="block text-xs text-slate-400 italic mt-0.5">{rf.notes}</span>
                )}
              </div>
            </div>
          </td>

          {/* Section */}
          <td className="px-4 py-2.5">
            {rf.section ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-50 text-slate-600 ring-1 ring-slate-200">
                <span className={cn('h-1.5 w-1.5 rounded-full', rf.section.color || 'bg-slate-400')} />
                {rf.section.name}
              </span>
            ) : (
              <span className="text-slate-300">&mdash;</span>
            )}
          </td>

          {/* Empty cells for alignment */}
          <td className="px-4 py-2.5" />
          <td className="px-4 py-2.5" />

          {/* Open individual file */}
          <td className="px-4 py-2.5">
            {(() => {
              const fileFolder = getFolderForFile(rf)
              if (!fileFolder || !onOpenInFiles) return null
              return (
                <button
                  onClick={() => onOpenInFiles(fileFolder)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FolderOpen className="w-3 h-3" />
                  Open
                </button>
              )
            })()}
          </td>
        </tr>
      ))}
    </>
  )
}
