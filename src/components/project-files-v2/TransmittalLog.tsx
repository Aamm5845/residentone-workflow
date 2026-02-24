'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Send,
  Plus,
  Search,
  X,
  Calendar,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import LatestFilesBySection, { useLatestFilesBySection } from './LatestFilesBySection'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionData {
  id: string
  name: string
  shortName: string
  color: string
}

interface TransmittalData {
  id: string
  transmittalNumber: string
  subject: string | null
  recipientName: string
  recipientEmail: string | null
  recipientCompany: string | null
  recipientType: string | null
  method: string
  status: string
  notes: string | null
  sentAt: string | null
  emailOpenedAt: string | null
  createdAt: string
  combinedPdfPath?: string | null
  creator: { id: string; name: string | null }
  sentByUser: { id: string; name: string | null } | null
  items: Array<{
    id: string
    revisionNumber: number | null
    purpose: string | null
    notes: string | null
    drawing: {
      id: string
      drawingNumber: string
      title: string
      section: SectionData | null
      dropboxPath: string | null
      dropboxUrl: string | null
      fileName: string | null
      pageNo: string | null
      reviewNo: string | null
    }
    revision: {
      id: string
      revisionNumber: number
      description: string | null
      dropboxPath: string | null
      dropboxUrl: string | null
      fileName: string | null
    } | null
  }>
}

type SortField = 'sent' | 'recipient' | 'title'
type SortDir = 'asc' | 'desc'

interface TransmittalLogProps {
  projectId: string
  dropboxFolder: string | null
  transmittals: TransmittalData[]
  isLoading: boolean
  onCreateNew: () => void
  onOpenInFiles?: (folderPath: string) => void
  mutateTransmittals?: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(date: string): { date: string; time: string } {
  const d = new Date(date)
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

const RECIPIENT_TYPE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  CONTRACTOR: 'Contractor',
  SUBCONTRACTOR: 'Sub',
  CONSULTANT: 'Consultant',
  TEAM: 'Team',
  OTHER: '',
}

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'sent', label: 'Date Sent' },
  { field: 'recipient', label: 'Recipient' },
  { field: 'title', label: 'Title' },
]

const SORT_LABELS: Record<SortField, string> = {
  sent: 'Date',
  recipient: 'Recipient',
  title: 'Title',
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TransmittalLog({
  projectId,
  dropboxFolder,
  transmittals,
  isLoading,
  onCreateNew,
  onOpenInFiles,
  mutateTransmittals,
}: TransmittalLogProps) {
  // ── Filter state ────────────────────────────────────────────────────────
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterSection, setFilterSection] = useState<string | null>(null)
  const [filterRecipient, setFilterRecipient] = useState<string | null>(null)

  // ── Sort state ────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('sent')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Dropdown visibility ───────────────────────────────────────────────
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // ── Selection state ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false)
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(field === 'sent' ? 'desc' : 'asc')
      return field
    })
    setShowSortDropdown(false)
  }, [])

  // ── Latest files by section (side panel) ────────────────────────────
  const sectionGroups = useLatestFilesBySection(transmittals)

  const hasActiveFilters = filterSearch !== '' || filterDateFrom !== '' || filterDateTo !== '' || filterSection !== null || filterRecipient !== null
  const activeFilterCount = [filterSection, filterRecipient, filterDateFrom, filterDateTo].filter(Boolean).length

  const clearAllFilters = useCallback(() => {
    setFilterSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterSection(null)
    setFilterRecipient(null)
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
  const toggleSelectAll = useCallback((rows: TransmittalData[]) => {
    setSelectedIds((prev) => {
      const allSelected = rows.every((r) => prev.has(r.id))
      if (allSelected) return new Set()
      return new Set(rows.map((r) => r.id))
    })
  }, [])

  /** Delete selected transmittals */
  const handleDeleteSelected = useCallback(async (rows: TransmittalData[]) => {
    const selectedRows = rows.filter((r) => selectedIds.has(r.id))
    if (selectedRows.length === 0) return

    const count = selectedRows.length
    const msg = `Delete ${count} transmittal${count !== 1 ? 's' : ''}? This cannot be undone.`
    if (!confirm(msg)) return

    setIsDeleting(true)
    try {
      await Promise.all(
        selectedRows.map((t) =>
          fetch(`/api/projects/${projectId}/project-files-v2/transmittals/${t.id}`, {
            method: 'DELETE',
          })
        )
      )
      setSelectedIds(new Set())
      mutateTransmittals?.()
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete some transmittals. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }, [selectedIds, projectId, mutateTransmittals])

  // ── Sort transmittals ───────────────────────────────────────────────
  const sortedTransmittals = useMemo(() => {
    const rows = [...transmittals]
    const dir = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      switch (sortField) {
        case 'sent': {
          const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0
          const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0
          return (dateA - dateB) * dir
        }
        case 'recipient':
          return a.recipientName.localeCompare(b.recipientName) * dir
        case 'title': {
          const titleA = a.subject || a.items[0]?.drawing.title || ''
          const titleB = b.subject || b.items[0]?.drawing.title || ''
          return titleA.localeCompare(titleB) * dir
        }
        default:
          return 0
      }
    })
    return rows
  }, [transmittals, sortField, sortDir])

  // ── Derive unique sections & recipients for filter dropdowns ──────────
  const uniqueSections = useMemo(() => {
    const map = new Map<string, SectionData>()
    for (const t of transmittals) {
      for (const item of t.items) {
        if (item.drawing.section && !map.has(item.drawing.section.id)) {
          map.set(item.drawing.section.id, item.drawing.section)
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [transmittals])

  const uniqueRecipients = useMemo(() => {
    const set = new Set<string>()
    for (const t of transmittals) set.add(t.recipientName)
    return Array.from(set).sort()
  }, [transmittals])

  // ── Filter rows ───────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return sortedTransmittals.filter((t) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        const subjectMatch = t.subject?.toLowerCase().includes(q) ?? false
        const recipientMatch = t.recipientName.toLowerCase().includes(q)
        const companyMatch = t.recipientCompany?.toLowerCase().includes(q) ?? false
        const titleMatch = t.items.some((item) => item.drawing.title.toLowerCase().includes(q))
        const numMatch = t.transmittalNumber.toLowerCase().includes(q)
        if (!subjectMatch && !recipientMatch && !companyMatch && !titleMatch && !numMatch) return false
      }
      if (filterDateFrom && t.sentAt) {
        if (new Date(t.sentAt) < new Date(filterDateFrom)) return false
      }
      if (filterDateTo && t.sentAt) {
        const to = new Date(filterDateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(t.sentAt) > to) return false
      }
      if (filterSection) {
        const hasSection = t.items.some((item) => item.drawing.section?.id === filterSection)
        if (!hasSection) return false
      }
      if (filterRecipient && t.recipientName !== filterRecipient) return false
      return true
    })
  }, [sortedTransmittals, filterSearch, filterDateFrom, filterDateTo, filterSection, filterRecipient])

  // Total items count for display
  const totalItemCount = useMemo(() => transmittals.reduce((sum, t) => sum + t.items.length, 0), [transmittals])

  // ── Loading state ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
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
  if (transmittals.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Sent Files</h2>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-16 text-center">
          <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Send className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Nothing sent yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
            Send drawings to contractors, subs, or clients and track everything here.
          </p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Send Files
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="space-y-4 min-w-0">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Sent Files</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {filteredRows.length}{hasActiveFilters ? ` / ${transmittals.length}` : ''}
          </span>
        </div>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" /> Send Files
        </button>
      </div>

      {/* ── Filter & Sort bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search title, recipient..."
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

        {/* Sort dropdown */}
        <div className="relative" ref={sortDropdownRef}>
          <button
            onClick={() => { setShowSortDropdown((v) => !v); setShowFilterDropdown(false) }}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm transition-all border',
              showSortDropdown
                ? 'bg-white text-slate-900 font-medium shadow-sm border-slate-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-transparent'
            )}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort
            {sortField !== 'sent' && (
              <span className="text-slate-400 font-normal text-[11px]">
                {SORT_LABELS[sortField]}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', showSortDropdown && 'rotate-180')} />
          </button>
          {showSortDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {SORT_OPTIONS.map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => handleSort(field)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>{label}</span>
                  <span className="flex items-center gap-1">
                    {sortField === field && (
                      <>
                        {sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />}
                        <Check className="h-3.5 w-3.5 text-slate-900" />
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter dropdown (includes section, recipient, date range) */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => { setShowFilterDropdown((v) => !v); setShowSortDropdown(false) }}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm transition-all border',
              showFilterDropdown || activeFilterCount > 0
                ? 'bg-white text-slate-900 font-medium shadow-sm border-slate-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-transparent'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-bold bg-slate-900 text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', showFilterDropdown && 'rotate-180')} />
          </button>
          {showFilterDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {/* Date range */}
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Date Range</span>
              </div>
              <div className="px-3 py-1.5 flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                    title="From date"
                  />
                </div>
                <span className="text-xs text-slate-400 shrink-0">to</span>
                <div className="flex-1">
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                    title="To date"
                  />
                </div>
              </div>

              <div className="my-1 border-t border-slate-100" />

              {/* Section filter */}
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Section</span>
              </div>
              <button
                onClick={() => setFilterSection(null)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>All Sections</span>
                {filterSection === null && <Check className="h-3.5 w-3.5 text-slate-900" />}
              </button>
              {uniqueSections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setFilterSection(filterSection === sec.id ? null : sec.id)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', sec.color || 'bg-slate-400')} />
                    <span className="truncate">{sec.name}</span>
                  </span>
                  {filterSection === sec.id && <Check className="h-3.5 w-3.5 text-slate-900" />}
                </button>
              ))}

              <div className="my-1 border-t border-slate-100" />

              {/* Recipient filter */}
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Recipient</span>
              </div>
              <button
                onClick={() => setFilterRecipient(null)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>All Recipients</span>
                {filterRecipient === null && <Check className="h-3.5 w-3.5 text-slate-900" />}
              </button>
              <div className="max-h-40 overflow-y-auto">
                {uniqueRecipients.map((name) => (
                  <button
                    key={name}
                    onClick={() => setFilterRecipient(filterRecipient === name ? null : name)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="truncate">{name}</span>
                    {filterRecipient === name && <Check className="h-3.5 w-3.5 text-slate-900" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            {filterSection && (
              <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-700">
                {uniqueSections.find(s => s.id === filterSection)?.name}
                <button onClick={() => setFilterSection(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterRecipient && (
              <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-700">
                {filterRecipient}
                <button onClick={() => setFilterRecipient(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
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
      {filteredRows.length === 0 && hasActiveFilters && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
          <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Filter className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">No results found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-3">
            No sent files match your current filters.
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
            onClick={() => handleDeleteSelected(filteredRows)}
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

      {/* ── Table — one row per transmittal ────────────────────── */}
      {filteredRows.length > 0 && (
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-3 py-3 text-center w-[40px]">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id))}
                    onChange={() => toggleSelectAll(filteredRows)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[90px]">
                  #
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('title')} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer select-none">
                    Drawings
                    {sortField === 'title' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[100px]">
                  Section
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[70px]">
                  Review
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[70px]">
                  Page
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('recipient')} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer select-none">
                    Recipient
                    {sortField === 'recipient' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[80px]">
                  Method
                </th>
                <th className="px-4 py-3 text-left w-[130px]">
                  <button onClick={() => handleSort('sent')} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer select-none">
                    Sent
                    {sortField === 'sent' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 w-[60px]">
                  PDF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((t) => {
                const firstItem = t.items[0]
                const hasMultiple = t.items.length > 1
                return (
                  <tr key={t.id} className={cn('transition-colors hover:bg-slate-50/70 align-top', selectedIds.has(t.id) && 'bg-slate-50')}>
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center w-[40px]">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 cursor-pointer"
                      />
                    </td>

                    {/* Transmittal # */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500">{t.transmittalNumber}</span>
                    </td>

                    {/* Drawings — title per line, plain text */}
                    <td className="px-4 py-3">
                      {t.items.map((item) => (
                        <div key={item.id} className="text-sm text-slate-900 leading-6 truncate">
                          {item.drawing.title}
                        </div>
                      ))}
                    </td>

                    {/* Section — one per line matching drawings */}
                    <td className="px-4 py-3">
                      {t.items.map((item) => (
                        <div key={item.id} className="text-sm text-slate-500 leading-6 truncate">
                          {item.drawing.section?.name || '—'}
                        </div>
                      ))}
                    </td>

                    {/* Review — one per line matching drawings */}
                    <td className="px-4 py-3">
                      {t.items.map((item) => {
                        const rev = item.drawing.reviewNo || (item.revision?.revisionNumber ?? item.revisionNumber)
                        return (
                          <div key={item.id} className="text-sm text-slate-500 leading-6">
                            {rev != null && rev !== '' ? rev : '—'}
                          </div>
                        )
                      })}
                    </td>

                    {/* Page — one per line matching drawings */}
                    <td className="px-4 py-3">
                      {t.items.map((item) => (
                        <div key={item.id} className="text-sm text-slate-500 leading-6">
                          {item.drawing.pageNo || '—'}
                        </div>
                      ))}
                    </td>

                    {/* Recipient */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{t.recipientName}</span>
                      {t.recipientCompany && (
                        <span className="block text-xs text-slate-400">{t.recipientCompany}</span>
                      )}
                    </td>

                    {/* Method — plain text */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500">{t.method === 'EMAIL' ? 'Email' : 'Manual'}</span>
                    </td>

                    {/* Sent */}
                    <td className="px-4 py-3">
                      {t.sentAt ? (
                        <div>
                          <span className="text-sm text-slate-700">{formatDateTime(t.sentAt).date}</span>
                          <span className="block text-xs text-slate-400">{formatDateTime(t.sentAt).time}</span>
                          {t.method === 'EMAIL' && (
                            <span className={cn(
                              'text-[11px]',
                              t.emailOpenedAt ? 'text-emerald-600' : 'text-slate-400'
                            )}>
                              {t.emailOpenedAt ? 'Opened' : 'Not opened'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      )}
                    </td>

                    {/* Combined PDF download */}
                    <td className="px-3 py-3 text-center">
                      {t.combinedPdfPath ? (
                        <button
                          onClick={() => window.open(`/api/projects/${projectId}/project-files-v2/transmittals/${t.id}/download`, '_blank')}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Open
                        </button>
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ── Side panel — latest files by section ──────────────── */}
    <LatestFilesBySection sectionGroups={sectionGroups} onOpenInFiles={onOpenInFiles} />
    </div>
  )
}
