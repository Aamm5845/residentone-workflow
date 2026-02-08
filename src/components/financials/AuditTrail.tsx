'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/pricing'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Filter,
} from 'lucide-react'

interface AuditEntry {
  id: string
  type: 'CLIENT_QUOTE' | 'ORDER' | 'SUPPLIER_QUOTE' | 'PAYMENT' | 'SUPPLIER_PAYMENT'
  date: string
  documentNumber: string
  amount: number
  currency: string
  projectId: string
  projectName: string
  status: string
  description: string
  link: string
}

interface FilterProject {
  id: string
  name: string
}

const typeLabels: Record<string, { label: string; color: string }> = {
  CLIENT_QUOTE: { label: 'Invoice', color: 'bg-blue-100 text-blue-800' },
  ORDER: { label: 'Purchase Order', color: 'bg-amber-100 text-amber-800' },
  SUPPLIER_QUOTE: { label: 'Supplier Quote', color: 'bg-purple-100 text-purple-800' },
  PAYMENT: { label: 'Payment Received', color: 'bg-emerald-100 text-emerald-800' },
  SUPPLIER_PAYMENT: { label: 'Supplier Payment', color: 'bg-red-100 text-red-800' },
}

const docTypes = [
  { value: '', label: 'All Types' },
  { value: 'CLIENT_QUOTE', label: 'Invoices' },
  { value: 'ORDER', label: 'Purchase Orders' },
  { value: 'PAYMENT', label: 'Payments Received' },
  { value: 'SUPPLIER_PAYMENT', label: 'Supplier Payments' },
]

export function AuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [projects, setProjects] = useState<FilterProject[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [typeFilter, setTypeFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (typeFilter) params.set('type', typeFilter)
      if (projectFilter) params.set('projectId', projectFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/financials/audit-trail?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries)
        setTotalPages(data.totalPages)
        setTotal(data.total)
        if (data.projects) setProjects(data.projects)
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, projectFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [typeFilter, projectFilter, dateFrom, dateTo])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {docTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No audit entries found for the selected filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Doc #
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entries.map((entry) => {
                    const typeInfo = typeLabels[entry.type] || {
                      label: entry.type,
                      color: 'bg-gray-100 text-gray-800',
                    }
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('en-CA')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                          {entry.documentNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(entry.amount, entry.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                          {entry.projectName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {entry.status}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={entry.link}
                            className="text-purple-600 hover:text-purple-800"
                            title="View in procurement"
                          >
                            <ExternalLink className="w-4 h-4 inline" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-600">
                Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
