'use client'

import { useState, useCallback, useMemo } from 'react'
import { Send, Plus, Search, X, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FilterPill from './FilterPill'
import TransmittalCard, { type TransmittalData } from './TransmittalCard'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SentTabContentProps {
  transmittals: TransmittalData[]
  isLoading: boolean
  onViewDetail: (transmittal: TransmittalData) => void
  onCreateNew: () => void
}

// ─── Date grouping ──────────────────────────────────────────────────────────

function groupByDate(transmittals: TransmittalData[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: TransmittalData[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Earlier', items: [] },
  ]

  for (const t of transmittals) {
    const date = new Date(t.sentAt || t.createdAt)
    if (date >= today) groups[0].items.push(t)
    else if (date >= yesterday) groups[1].items.push(t)
    else if (date >= weekAgo) groups[2].items.push(t)
    else groups[3].items.push(t)
  }

  return groups.filter((g) => g.items.length > 0)
}

// ─── Status options ─────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'SENT', label: 'Sent', dot: 'bg-emerald-500' },
  { value: 'DRAFT', label: 'Draft', dot: 'bg-gray-400' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged', dot: 'bg-blue-500' },
  { value: 'CANCELLED', label: 'Cancelled', dot: 'bg-red-500' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export default function SentTabContent({
  transmittals,
  isLoading,
  onViewDetail,
  onCreateNew,
}: SentTabContentProps) {
  // Filters
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterRecipient, setFilterRecipient] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const hasActiveFilters = filterStatus !== null || filterRecipient !== '' || filterDateFrom !== '' || filterDateTo !== ''

  const clearAllFilters = useCallback(() => {
    setFilterStatus(null)
    setFilterRecipient('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }, [])

  // Filter logic
  const filtered = useMemo(() => {
    return transmittals.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false
      if (filterRecipient) {
        const q = filterRecipient.toLowerCase()
        if (!t.recipientName.toLowerCase().includes(q) &&
            !(t.recipientCompany?.toLowerCase().includes(q) ?? false)) return false
      }
      if (filterDateFrom) {
        const from = new Date(filterDateFrom)
        const d = new Date(t.sentAt || t.createdAt)
        if (d < from) return false
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo)
        to.setHours(23, 59, 59, 999)
        const d = new Date(t.sentAt || t.createdAt)
        if (d > to) return false
      }
      return true
    })
  }, [transmittals, filterStatus, filterRecipient, filterDateFrom, filterDateTo])

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-36 animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-white p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 mb-2" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Empty ─────────────────────────────────────────────────────────────
  if (transmittals.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sent</h2>
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
            <Plus className="w-4 h-4 mr-1.5" /> Send Drawings
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Sent</h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {filtered.length}{hasActiveFilters ? ` / ${transmittals.length}` : ''}
          </span>
        </div>
        <Button onClick={onCreateNew} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Send Drawings
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          label="Status"
          value={filterStatus}
          options={STATUS_OPTIONS}
          onChange={setFilterStatus}
        />

        {/* Recipient search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Recipient..."
            value={filterRecipient}
            onChange={(e) => setFilterRecipient(e.target.value)}
            className="h-7 w-40 rounded-md border border-gray-200 bg-white pl-8 pr-7
              text-xs text-gray-700 placeholder:text-gray-400
              focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 transition-all"
          />
          {filterRecipient && (
            <button
              onClick={() => setFilterRecipient('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700
              focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <span className="text-[10px] text-gray-400">to</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700
              focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Empty filter state */}
      {filtered.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
            <Filter className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No results</h3>
          <p className="text-sm text-gray-500 mb-3">No transmittals match your filters.</p>
          <Button variant="outline" size="sm" onClick={clearAllFilters}>Clear Filters</Button>
        </div>
      )}

      {/* Date-grouped list */}
      {groups.map((group) => (
        <div key={group.label}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            {group.label}
          </div>
          <div className="space-y-2">
            {group.items.map((t) => (
              <TransmittalCard key={t.id} transmittal={t} onViewDetail={onViewDetail} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
