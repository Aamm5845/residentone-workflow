'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Send,
  Plus,
  Mail,
  Search,
  X,
  Calendar,
  Filter,
  ExternalLink,
  FileText,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Eye,
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

/** Flattened row — one per file sent */
interface SentFileRow {
  id: string // unique key: transmittalId-itemId
  title: string
  revisionNumber: number | null
  reviewNo: string | null
  pageNo: string | null
  section: SectionData | null
  recipientName: string
  recipientCompany: string | null
  recipientType: string | null
  method: string
  sentAt: string | null
  emailOpenedAt: string | null
  fileUrl: string | null
  fileName: string | null
  dropboxPath: string | null
}

type SortField = 'sent' | 'recipient' | 'section' | 'title'
type SortDir = 'asc' | 'desc'

interface TransmittalLogProps {
  projectId: string
  dropboxFolder: string | null
  transmittals: TransmittalData[]
  isLoading: boolean
  onCreateNew: () => void
  onOpenInFiles?: (folderPath: string) => void
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
  { field: 'section', label: 'Section' },
  { field: 'title', label: 'Title' },
]

const SORT_LABELS: Record<SortField, string> = {
  sent: 'Date',
  recipient: 'Recipient',
  section: 'Section',
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
  const activeFilterCount = [filterSection, filterRecipient].filter(Boolean).length

  const clearAllFilters = useCallback(() => {
    setFilterSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterSection(null)
    setFilterRecipient(null)
  }, [])

  /** Navigate to the file's folder in the All Files tab */
  const handleOpenFile = useCallback((row: SentFileRow) => {
    if (!row.dropboxPath) return
    // Build the folder path by removing the filename
    const parts = row.dropboxPath.split('/')
    parts.pop() // remove filename
    const folderRelative = parts.join('/')
    onOpenInFiles?.(folderRelative)
  }, [onOpenInFiles])

  // ── Flatten: one row per file sent ────────────────────────────────────
  const allRows = useMemo(() => {
    const rows: SentFileRow[] = []
    for (const t of transmittals) {
      for (const item of t.items) {
        rows.push({
          id: `${t.id}-${item.id}`,
          title: item.drawing.title,
          revisionNumber: item.revision?.revisionNumber ?? item.revisionNumber ?? null,
          reviewNo: item.drawing.reviewNo ?? null,
          pageNo: item.drawing.pageNo ?? null,
          section: item.drawing.section,
          recipientName: t.recipientName,
          recipientCompany: t.recipientCompany,
          recipientType: t.recipientType,
          method: t.method,
          sentAt: t.sentAt,
          emailOpenedAt: t.emailOpenedAt,
          fileUrl: item.revision?.dropboxUrl || item.drawing.dropboxUrl || null,
          fileName: item.revision?.fileName || item.drawing.fileName || null,
          dropboxPath: item.revision?.dropboxPath || item.drawing.dropboxPath || null,
        })
      }
    }
    // Sort rows
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
        case 'section': {
          const secA = a.section?.name ?? ''
          const secB = b.section?.name ?? ''
          return secA.localeCompare(secB) * dir
        }
        case 'title':
          return a.title.localeCompare(b.title) * dir
        default:
          return 0
      }
    })
    return rows
  }, [transmittals, sortField, sortDir])

  // ── Derive unique sections & recipients for filter dropdowns ──────────
  const uniqueSections = useMemo(() => {
    const map = new Map<string, SectionData>()
    for (const row of allRows) {
      if (row.section && !map.has(row.section.id)) map.set(row.section.id, row.section)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allRows])

  const uniqueRecipients = useMemo(() => {
    const set = new Set<string>()
    for (const row of allRows) set.add(row.recipientName)
    return Array.from(set).sort()
  }, [allRows])

  // ── Filter rows ───────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        const titleMatch = row.title.toLowerCase().includes(q)
        const recipientMatch = row.recipientName.toLowerCase().includes(q)
        const companyMatch = row.recipientCompany?.toLowerCase().includes(q) ?? false
        const fileMatch = row.fileName?.toLowerCase().includes(q) ?? false
        if (!titleMatch && !recipientMatch && !companyMatch && !fileMatch) return false
      }
      if (filterDateFrom && row.sentAt) {
        if (new Date(row.sentAt) < new Date(filterDateFrom)) return false
      }
      if (filterDateTo && row.sentAt) {
        const to = new Date(filterDateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(row.sentAt) > to) return false
      }
      if (filterSection && row.section?.id !== filterSection) return false
      if (filterRecipient && row.recipientName !== filterRecipient) return false
      return true
    })
  }, [allRows, filterSearch, filterDateFrom, filterDateTo, filterSection, filterRecipient])

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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-4 min-w-0">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Sent Files</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {filteredRows.length}{hasActiveFilters ? ` / ${allRows.length}` : ''}
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search title, recipient..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="h-8 w-52 rounded-xl border border-slate-200 bg-white pl-8 pr-7 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            title="From date"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            title="To date"
          />
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Sort dropdown */}
        <div className="relative" ref={sortDropdownRef}>
          <button
            onClick={() => { setShowSortDropdown((v) => !v); setShowFilterDropdown(false) }}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all border',
              showSortDropdown
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800'
            )}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort
            {sortField !== 'sent' && (
              <span className="ml-0.5 text-[10px] opacity-70">
                ({SORT_LABELS[sortField]})
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

        {/* Filter dropdown */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => { setShowFilterDropdown((v) => !v); setShowSortDropdown(false) }}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all border',
              showFilterDropdown || activeFilterCount > 0
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-bold bg-white text-slate-900">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', showFilterDropdown && 'rotate-180')} />
          </button>
          {showFilterDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
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

        {/* Active filter/sort chips */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            {filterSection && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-slate-100 text-[11px] font-medium text-slate-700">
                {uniqueSections.find(s => s.id === filterSection)?.name}
                <button onClick={() => setFilterSection(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterRecipient && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-slate-100 text-[11px] font-medium text-slate-700">
                {filterRecipient}
                <button onClick={() => setFilterRecipient(null)} className="text-slate-400 hover:text-slate-600">
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

      {/* ── Table — one row per file ─────────────────────────────── */}
      {filteredRows.length > 0 && (
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[30%]" />   {/* Title */}
              <col className="w-[5%]" />    {/* Rev */}
              <col className="w-[7%]" />    {/* Page No */}
              <col className="w-[14%]" />   {/* Section */}
              <col className="w-[14%]" />   {/* Recipient */}
              <col className="w-[8%]" />    {/* Method */}
              <col className="w-[14%]" />   {/* Sent */}
              <col className="w-[8%]" />    {/* File */}
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('title')} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer select-none">
                    Title
                    {sortField === 'title' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Rev
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Page No
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('section')} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer select-none">
                    Section
                    {sortField === 'section' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('recipient')} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer select-none">
                    Recipient
                    {sortField === 'recipient' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Method
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('sent')} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-700 transition-colors cursor-pointer select-none">
                    Sent
                    {sortField === 'sent' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-slate-900" /> : <ArrowDown className="h-3 w-3 text-slate-900" />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  File
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/70">
                  {/* Title */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900 truncate block">
                      {row.title}
                    </span>
                  </td>

                  {/* Revision — show reviewNo (user-entered) or revisionNumber */}
                  <td className="px-3 py-3 text-center">
                    {(row.reviewNo || row.revisionNumber != null) ? (
                      <span className="text-sm font-medium text-slate-700">
                        {row.reviewNo || row.revisionNumber}
                      </span>
                    ) : (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>

                  {/* Page No */}
                  <td className="px-3 py-3">
                    {row.pageNo ? (
                      <span className="text-sm text-slate-700">{row.pageNo}</span>
                    ) : (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>

                  {/* Section — show full name with color dot */}
                  <td className="px-4 py-3">
                    {row.section ? (
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                        'bg-slate-50 text-slate-700 ring-1 ring-slate-200'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', row.section.color || 'bg-slate-400')} />
                        <span className="truncate">{row.section.name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>

                  {/* Recipient */}
                  <td className="px-4 py-3">
                    <div className="truncate">
                      {row.recipientType && RECIPIENT_TYPE_LABELS[row.recipientType] ? (
                        <>
                          <span className="text-xs text-slate-400">{RECIPIENT_TYPE_LABELS[row.recipientType]}</span>
                          <span className="text-xs text-slate-300 mx-1">–</span>
                        </>
                      ) : null}
                      <span className="text-sm text-slate-700">{row.recipientName}</span>
                    </div>
                  </td>

                  {/* Method */}
                  <td className="px-3 py-3 text-center">
                    {row.method === 'EMAIL' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
                        <Mail className="h-3 w-3" />
                        Email
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                        <FileText className="h-3 w-3" />
                        Manual
                      </span>
                    )}
                  </td>

                  {/* Sent */}
                  <td className="px-4 py-3">
                    {row.sentAt ? (
                      <div>
                        <span className="text-sm text-slate-700 block">{formatDateTime(row.sentAt).date}</span>
                        <span className="text-[11px] text-slate-400">{formatDateTime(row.sentAt).time}</span>
                        {row.method === 'EMAIL' && (
                          <div className="mt-0.5">
                            {row.emailOpenedAt ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
                                <Eye className="h-2.5 w-2.5" />
                                Opened
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Not opened</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>

                  {/* File link — opens in All Files tab */}
                  <td className="px-3 py-3 text-center">
                    {row.dropboxPath ? (
                      <button
                        onClick={() => handleOpenFile(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </button>
                    ) : (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ── Side panel — latest files by section ──────────────── */}
    <LatestFilesBySection sectionGroups={sectionGroups} />
    </div>
  )
}
