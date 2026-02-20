'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Send,
  Plus,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Mail,
  Truck,
  Globe,
  Eye,
  CheckCircle2,
  Clock,
  ClipboardList,
  Package,
  Search,
  X,
  Calendar,
  Filter,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─── Shared config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  SENT: { label: 'Sent', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-50' },
}

const METHOD_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  HAND_DELIVERY: 'Hand Delivery',
  COURIER: 'Courier',
  FTP: 'FTP',
  OTHER: 'Other',
}

// ─── Types ──────────────────────────────────────────────────────────────────

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
      discipline: string | null
    }
    revision: {
      id: string
      revisionNumber: number
      description: string | null
    } | null
  }>
}

interface TransmittalLogProps {
  transmittals: TransmittalData[]
  isLoading: boolean
  onViewDetail: (transmittal: TransmittalData) => void
  onCreateNew: () => void
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

const RECIPIENT_TYPE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  CONTRACTOR: 'Contractor',
  SUBCONTRACTOR: 'Sub',
  CONSULTANT: 'Consultant',
  TEAM: 'Team',
  OTHER: '',
}

function getMethodIcon(method: string) {
  switch (method) {
    case 'EMAIL':
      return <Mail className="h-3.5 w-3.5" />
    case 'HAND_DELIVERY':
      return <Package className="h-3.5 w-3.5" />
    case 'COURIER':
      return <Truck className="h-3.5 w-3.5" />
    case 'FTP':
      return <Globe className="h-3.5 w-3.5" />
    default:
      return <ClipboardList className="h-3.5 w-3.5" />
  }
}

function formatTransmittalNumber(num: string): string {
  // If already formatted like "T-001", return as-is
  if (num.startsWith('T-')) return num
  // Otherwise try to pad the number
  const n = parseInt(num, 10)
  if (!isNaN(n)) return `T-${String(n).padStart(3, '0')}`
  return num
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TransmittalLog({
  transmittals,
  isLoading,
  onViewDetail,
  onCreateNew,
}: TransmittalLogProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // ── Filter state ────────────────────────────────────────────────────────
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

  // ── Unique recipient names/companies for the dropdown ───────────────────
  const uniqueRecipients = useMemo(() => {
    const names = new Map<string, { name: string; company: string | null }>()
    for (const t of transmittals) {
      if (!names.has(t.recipientName)) {
        names.set(t.recipientName, { name: t.recipientName, company: t.recipientCompany })
      }
    }
    return Array.from(names.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [transmittals])

  // ── Filter transmittals ─────────────────────────────────────────────────
  const filteredTransmittals = useMemo(() => {
    return transmittals.filter((t) => {
      // Status filter
      if (filterStatus && t.status !== filterStatus) return false

      // Recipient filter (search across name and company)
      if (filterRecipient) {
        const q = filterRecipient.toLowerCase()
        const nameMatch = t.recipientName.toLowerCase().includes(q)
        const companyMatch = t.recipientCompany?.toLowerCase().includes(q) ?? false
        if (!nameMatch && !companyMatch) return false
      }

      // Date from filter
      if (filterDateFrom) {
        const from = new Date(filterDateFrom)
        const sentDate = t.sentAt ? new Date(t.sentAt) : new Date(t.createdAt)
        if (sentDate < from) return false
      }

      // Date to filter
      if (filterDateTo) {
        const to = new Date(filterDateTo)
        to.setHours(23, 59, 59, 999)
        const sentDate = t.sentAt ? new Date(t.sentAt) : new Date(t.createdAt)
        if (sentDate > to) return false
      }

      return true
    })
  }, [transmittals, filterStatus, filterRecipient, filterDateFrom, filterDateTo])

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
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

  if (transmittals.length === 0) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Sent Drawings</h2>
          </div>
        </div>
        {/* Empty content */}
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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Sent History</h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {filteredTransmittals.length}{hasActiveFilters ? ` / ${transmittals.length}` : ''}
          </span>
        </div>
        <Button onClick={onCreateNew} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Send Drawings
        </Button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />

        {/* Status filter */}
        <select
          value={filterStatus ?? ''}
          onChange={(e) => setFilterStatus(e.target.value || null)}
          className="h-8 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        {/* Sent To filter - search input with datalist for autocomplete */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Sent to..."
            value={filterRecipient}
            onChange={(e) => setFilterRecipient(e.target.value)}
            list="recipient-suggestions"
            className="h-8 w-44 rounded-md border border-gray-200 bg-white pl-8 pr-7 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
          <datalist id="recipient-suggestions">
            {uniqueRecipients.map((r) => (
              <option key={r.name} value={r.name}>
                {r.company ? `${r.name} — ${r.company}` : r.name}
              </option>
            ))}
          </datalist>
          {filterRecipient && (
            <button
              onClick={() => setFilterRecipient('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Date from */}
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
      {filteredTransmittals.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
            <Filter className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No results found</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-3">
            No transmittals match your current filters.
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Table */}
      {filteredTransmittals.length > 0 && (
      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          {/* ── Header ──────────────────────────────────────────────── */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              {/* Expand toggle */}
              <th className="w-[40px] px-2 py-3" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[90px]">
                T#
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Subject
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[170px]">
                Recipient
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[130px]">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[110px]">
                Drawings
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[120px]">
                Method
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[120px]">
                Sent
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[110px]">
                Status
              </th>
              <th className="w-[52px] px-2 py-3" />
            </tr>
          </thead>

          {/* ── Body ────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-gray-100">
            {filteredTransmittals.map((transmittal) => {
              const status = STATUS_CONFIG[transmittal.status]
              const isExpanded = expandedRows.has(transmittal.id)
              const drawingCount = transmittal.items.length

              return (
                <TransmittalRow
                  key={transmittal.id}
                  transmittal={transmittal}
                  status={status}
                  isExpanded={isExpanded}
                  drawingCount={drawingCount}
                  onToggleExpand={toggleExpand}
                  onViewDetail={onViewDetail}
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

// ─── Row sub-component ──────────────────────────────────────────────────────

function TransmittalRow({
  transmittal,
  status,
  isExpanded,
  drawingCount,
  onToggleExpand,
  onViewDetail,
}: {
  transmittal: TransmittalData
  status: { label: string; color: string; bgColor: string } | undefined
  isExpanded: boolean
  drawingCount: number
  onToggleExpand: (id: string, e: React.MouseEvent) => void
  onViewDetail: (transmittal: TransmittalData) => void
}) {
  return (
    <>
      {/* Main row */}
      <tr
        onClick={() => onViewDetail(transmittal)}
        className="cursor-pointer transition-colors hover:bg-gray-50/70"
      >
        {/* Expand toggle */}
        <td className="px-2 py-3">
          {drawingCount > 0 && (
            <button
              onClick={(e) => onToggleExpand(transmittal.id, e)}
              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </td>

        {/* T# */}
        <td className="px-4 py-3">
          <span className="font-mono font-bold text-gray-900 text-xs">
            {formatTransmittalNumber(transmittal.transmittalNumber)}
          </span>
        </td>

        {/* Subject */}
        <td className="px-4 py-3">
          <span className="font-medium text-gray-900 truncate max-w-[260px] block">
            {transmittal.subject || 'No subject'}
          </span>
        </td>

        {/* Recipient */}
        <td className="px-4 py-3">
          <div className="truncate max-w-[160px]">
            {transmittal.recipientType && RECIPIENT_TYPE_LABELS[transmittal.recipientType] ? (
              <>
                <span className="text-xs text-gray-400">{RECIPIENT_TYPE_LABELS[transmittal.recipientType]}</span>
                <span className="text-xs text-gray-300 mx-1">–</span>
              </>
            ) : null}
            <span className="text-sm text-gray-700">{transmittal.recipientName}</span>
          </div>
        </td>

        {/* Company */}
        <td className="px-4 py-3">
          {transmittal.recipientCompany ? (
            <span className="text-sm text-gray-600 truncate max-w-[120px] block">
              {transmittal.recipientCompany}
            </span>
          ) : (
            <span className="text-gray-300">&mdash;</span>
          )}
        </td>

        {/* Drawings */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {drawingCount} {drawingCount === 1 ? 'drawing' : 'drawings'}
            </span>
          </span>
        </td>

        {/* Method — Email = system sent, anything else = manual/logged */}
        <td className="px-4 py-3">
          {transmittal.method === 'EMAIL' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              <Mail className="h-3 w-3" />
              Email
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {getMethodIcon(transmittal.method)}
              Manual
            </span>
          )}
        </td>

        {/* Sent date + time */}
        <td className="px-4 py-3">
          {transmittal.sentAt ? (
            <div>
              <span className="text-sm text-gray-700 block">{formatDateTime(transmittal.sentAt).date}</span>
              <span className="text-[11px] text-gray-400">{formatDateTime(transmittal.sentAt).time}</span>
            </div>
          ) : (
            <span className="text-gray-300">&mdash;</span>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          {status ? (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                status.bgColor,
                status.color
              )}
            >
              {status.label}
            </span>
          ) : (
            <span className="text-xs text-gray-400">{transmittal.status}</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-2 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-gray-400 hover:text-gray-600"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onViewDetail(transmittal)
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {transmittal.status === 'SENT' && transmittal.method === 'EMAIL' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Resend
                  </DropdownMenuItem>
                </>
              )}
              {transmittal.status === 'SENT' && (
                <DropdownMenuItem
                  onClick={(e) => e.stopPropagation()}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark Acknowledged
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      {/* Expanded items */}
      {isExpanded && transmittal.items.length > 0 && (
        <tr>
          <td colSpan={10} className="bg-gray-50/50 px-0 py-0">
            <div className="px-12 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="pb-2 pr-4 font-semibold">Drawing #</th>
                    <th className="pb-2 pr-4 font-semibold">Title</th>
                    <th className="pb-2 pr-4 font-semibold w-[100px]">Discipline</th>
                    <th className="pb-2 pr-4 font-semibold w-[80px]">Revision</th>
                    <th className="pb-2 font-semibold w-[120px]">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transmittal.items.map((item) => {
                    return (
                      <tr key={item.id}>
                        <td className="py-2 pr-4">
                          <span className="font-mono font-medium text-gray-800">
                            {item.drawing.drawingNumber}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className="text-gray-700">{item.drawing.title}</span>
                        </td>
                        <td className="py-2 pr-4">
                          {item.drawing.discipline ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600">
                              {item.drawing.discipline.replace('_', ' ')}
                            </span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {item.revision ? (
                            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                              Rev {item.revision.revisionNumber}
                            </span>
                          ) : item.revisionNumber != null ? (
                            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                              Rev {item.revisionNumber}
                            </span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                        <td className="py-2">
                          {item.purpose ? (
                            <span className="text-gray-600">{item.purpose}</span>
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
          </td>
        </tr>
      )}
    </>
  )
}
