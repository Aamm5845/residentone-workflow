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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
            <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-8 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="h-8 w-36 animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-gray-100 px-4 py-3.5">
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
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
            <h2 className="text-lg font-semibold text-gray-900">Sent Files</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <Send className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Nothing sent yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-4">
            Send drawings to contractors, subs, or clients and track everything here.
          </p>
          <Button onClick={onCreateNew} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Send Files
          </Button>
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
          <h2 className="text-lg font-semibold text-gray-900">Sent Files</h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {filteredRows.length}{hasActiveFilters ? ` / ${allRows.length}` : ''}
          </span>
        </div>
        <Button onClick={onCreateNew} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Send Files
        </Button>
      </div>

      {/* ── Filter & Sort bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search title, recipient..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="h-8 w-52 rounded-md border border-gray-200 bg-white pl-8 pr-7 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
            title="From date"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
            title="To date"
          />
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Sort dropdown */}
        <div className="relative" ref={sortDropdownRef}>
          <button
            onClick={() => { setShowSortDropdown((v) => !v); setShowFilterDropdown(false) }}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-all border',
              showSortDropdown
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
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
            <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {SORT_OPTIONS.map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => handleSort(field)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>{label}</span>
                  <span className="flex items-center gap-1">
                    {sortField === field && (
                      <>
                        {sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-gray-900" /> : <ArrowDown className="h-3 w-3 text-gray-900" />}
                        <Check className="h-3.5 w-3.5 text-gray-900" />
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
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-all border',
              showFilterDropdown || activeFilterCount > 0
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className={cn(
                'ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-bold',
                showFilterDropdown ? 'bg-white text-gray-900' : 'bg-white text-gray-900'
              )}>
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', showFilterDropdown && 'rotate-180')} />
          </button>
          {showFilterDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {/* Section filter */}
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Section</span>
              </div>
              <button
                onClick={() => setFilterSection(null)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>All Sections</span>
                {filterSection === null && <Check className="h-3.5 w-3.5 text-gray-900" />}
              </button>
              {uniqueSections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setFilterSection(filterSection === sec.id ? null : sec.id)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', sec.color || 'bg-gray-400')} />
                    <span className="truncate">{sec.name}</span>
                  </span>
                  {filterSection === sec.id && <Check className="h-3.5 w-3.5 text-gray-900" />}
                </button>
              ))}

              <div className="my-1 border-t border-gray-100" />

              {/* Recipient filter */}
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recipient</span>
              </div>
              <button
                onClick={() => setFilterRecipient(null)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>All Recipients</span>
                {filterRecipient === null && <Check className="h-3.5 w-3.5 text-gray-900" />}
              </button>
              <div className="max-h-40 overflow-y-auto">
                {uniqueRecipients.map((name) => (
                  <button
                    key={name}
                    onClick={() => setFilterRecipient(filterRecipient === name ? null : name)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate">{name}</span>
                    {filterRecipient === name && <Check className="h-3.5 w-3.5 text-gray-900" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active filter/sort chips */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-5 bg-gray-200" />
            {filterSection && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-gray-100 text-[11px] font-medium text-gray-700">
                {uniqueSections.find(s => s.id === filterSection)?.name}
                <button onClick={() => setFilterSection(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filterRecipient && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-gray-100 text-[11px] font-medium text-gray-700">
                {filterRecipient}
                <button onClick={() => setFilterRecipient(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          </>
        )}
      </div>

      {/* ── Filtered empty state ───────────────────────────────────── */}
      {filteredRows.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
            <Filter className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No results found</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-3">
            No sent files match your current filters.
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* ── Table — one row per file ─────────────────────────────── */}
      {filteredRows.length > 0 && (
        <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('title')} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none">
                    Title
                    {sortField === 'title' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-gray-900" /> : <ArrowDown className="h-3 w-3 text-gray-900" />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Rev
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Page No
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('section')} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none">
                    Section
                    {sortField === 'section' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-gray-900" /> : <ArrowDown className="h-3 w-3 text-gray-900" />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('recipient')} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none">
                    Recipient
                    {sortField === 'recipient' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-gray-900" /> : <ArrowDown className="h-3 w-3 text-gray-900" />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Method
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('sent')} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none">
                    Sent
                    {sortField === 'sent' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-gray-900" /> : <ArrowDown className="h-3 w-3 text-gray-900" />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  File
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-gray-50/70">
                  {/* Title */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 truncate block">
                      {row.title}
                    </span>
                  </td>

                  {/* Revision — show reviewNo (user-entered) or revisionNumber */}
                  <td className="px-3 py-3 text-center">
                    {(row.reviewNo || row.revisionNumber != null) ? (
                      <span className="text-sm font-medium text-gray-700">
                        {row.reviewNo || row.revisionNumber}
                      </span>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>

                  {/* Page No */}
                  <td className="px-3 py-3">
                    {row.pageNo ? (
                      <span className="text-sm text-gray-700">{row.pageNo}</span>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>

                  {/* Section — show full name with color dot */}
                  <td className="px-4 py-3">
                    {row.section ? (
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                        'bg-gray-50 text-gray-700 border border-gray-200'
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', row.section.color || 'bg-gray-400')} />
                        <span className="truncate">{row.section.name}</span>
                      </span>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>

                  {/* Recipient */}
                  <td className="px-4 py-3">
                    <div className="truncate">
                      {row.recipientType && RECIPIENT_TYPE_LABELS[row.recipientType] ? (
                        <>
                          <span className="text-xs text-gray-400">{RECIPIENT_TYPE_LABELS[row.recipientType]}</span>
                          <span className="text-xs text-gray-300 mx-1">–</span>
                        </>
                      ) : null}
                      <span className="text-sm text-gray-700">{row.recipientName}</span>
                    </div>
                  </td>

                  {/* Method */}
                  <td className="px-3 py-3 text-center">
                    {row.method === 'EMAIL' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        <Mail className="h-3 w-3" />
                        Email
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        <FileText className="h-3 w-3" />
                        Manual
                      </span>
                    )}
                  </td>

                  {/* Sent */}
                  <td className="px-4 py-3">
                    {row.sentAt ? (
                      <div>
                        <span className="text-sm text-gray-700 block">{formatDateTime(row.sentAt).date}</span>
                        <span className="text-[11px] text-gray-400">{formatDateTime(row.sentAt).time}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>

                  {/* File link — opens in All Files tab */}
                  <td className="px-3 py-3 text-center">
                    {row.dropboxPath ? (
                      <button
                        onClick={() => handleOpenFile(row)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </button>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
