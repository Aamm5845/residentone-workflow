'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Download,
  Plus,
  Search,
  X,
  Calendar,
  Filter,
  FileText,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  drawing: {
    id: string
    drawingNumber: string
    title: string
    currentRevision: number
    status: string
  } | null
  creator: { id: string; name: string | null } | null
}

interface ReceivedFilesLogProps {
  receivedFiles: ReceivedFileData[]
  isLoading: boolean
  onReceiveNew: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(date: string): { date: string; time: string } {
  const d = new Date(date)
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

const SENDER_TYPE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  CONTRACTOR: 'Contractor',
  SUBCONTRACTOR: 'Sub',
  CONSULTANT: 'Consultant',
  TEAM: 'Team',
  OTHER: '',
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReceivedFilesLog({
  receivedFiles,
  isLoading,
  onReceiveNew,
}: ReceivedFilesLogProps) {
  // ── Filter state ────────────────────────────────────────────────────────
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const hasActiveFilters = filterSearch !== '' || filterDateFrom !== '' || filterDateTo !== ''

  const clearAllFilters = useCallback(() => {
    setFilterSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }, [])

  // ── Filter received files ─────────────────────────────────────────────
  const filteredFiles = useMemo(() => {
    return receivedFiles.filter((rf) => {
      // Search filter (sender, title, company, drawing number)
      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        const senderMatch = rf.senderName.toLowerCase().includes(q)
        const companyMatch = rf.senderCompany?.toLowerCase().includes(q) ?? false
        const titleMatch = rf.title.toLowerCase().includes(q)
        const drawingMatch = rf.drawing?.drawingNumber.toLowerCase().includes(q) ?? false
        if (!senderMatch && !companyMatch && !titleMatch && !drawingMatch) return false
      }

      // Date from filter
      if (filterDateFrom) {
        const from = new Date(filterDateFrom)
        if (new Date(rf.receivedDate) < from) return false
      }

      // Date to filter
      if (filterDateTo) {
        const to = new Date(filterDateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(rf.receivedDate) > to) return false
      }

      return true
    })
  }, [receivedFiles, filterSearch, filterDateFrom, filterDateTo])

  // ── Loading state ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-8 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="h-8 w-36 animate-pulse rounded-md bg-gray-200" />
        </div>
        {/* Table skeleton */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-b border-gray-100 px-4 py-3.5">
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (receivedFiles.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Received Files</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <Download className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No files received yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-4">
            Log files received from contractors, subs, or clients to keep track of everything.
          </p>
          <Button onClick={onReceiveNew} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Receive Files
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Received Files</h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {filteredFiles.length}{hasActiveFilters ? ` / ${receivedFiles.length}` : ''}
          </span>
        </div>
        <Button onClick={onReceiveNew} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Receive Files
        </Button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />

        {/* Search filter */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search sender, title..."
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

        {/* Separator */}
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

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* ── Filtered empty state ───────────────────────────────────── */}
      {filteredFiles.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
            <Filter className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No results found</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-3">
            No received files match your current filters.
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────── */}
      {filteredFiles.length > 0 && (
        <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[120px]">
                  Received
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[160px]">
                  Sender
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[130px]">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[100px]">
                  Section
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[100px]">
                  Drawing #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[70px]">
                  Rev
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[110px]">
                  Logged By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredFiles.map((rf) => {
                const dt = formatDateTime(rf.receivedDate)
                return (
                  <tr key={rf.id} className="transition-colors hover:bg-gray-50/70">
                    {/* Received date */}
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm text-gray-700 block">{dt.date}</span>
                        <span className="text-[11px] text-gray-400">{dt.time}</span>
                      </div>
                    </td>

                    {/* Sender */}
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[150px]">
                        {rf.senderType && SENDER_TYPE_LABELS[rf.senderType] ? (
                          <>
                            <span className="text-xs text-gray-400">{SENDER_TYPE_LABELS[rf.senderType]}</span>
                            <span className="text-xs text-gray-300 mx-1">&ndash;</span>
                          </>
                        ) : null}
                        <span className="text-sm text-gray-700">{rf.senderName}</span>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      {rf.senderCompany ? (
                        <span className="text-sm text-gray-600 truncate max-w-[120px] block">
                          {rf.senderCompany}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-900 truncate">{rf.title}</span>
                        {rf.notes && (
                          <span className="text-xs text-gray-400 truncate mt-0.5 italic">
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
                          'bg-gray-50 text-gray-700 border border-gray-200'
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', rf.section.color || 'bg-gray-400')} />
                          {rf.section.shortName}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Drawing # */}
                    <td className="px-4 py-3">
                      {rf.drawing ? (
                        <span className="font-mono font-bold text-gray-900 text-xs">
                          {rf.drawing.drawingNumber}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Rev */}
                    <td className="px-4 py-3">
                      {rf.drawing ? (
                        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                          Rev {rf.drawing.currentRevision}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>

                    {/* Logged By */}
                    <td className="px-4 py-3">
                      {rf.creator?.name ? (
                        <span className="text-sm text-gray-600 truncate max-w-[100px] block">
                          {rf.creator.name}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
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
  )
}
