'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/pricing'
import { ArrowUpDown, ExternalLink, Loader2 } from 'lucide-react'

interface ProjectRow {
  id: string
  name: string
  status: string
  clientName: string
  invoicedAmount: number
  paidAmount: number
  outstanding: number
  supplierCosts: number
  profit: number
  marginPercent: number
  link: string
}

interface ProjectData {
  projects: ProjectRow[]
  totals: {
    invoicedAmount: number
    paidAmount: number
    outstanding: number
    supplierCosts: number
    profit: number
    marginPercent: number
  }
}

type SortKey = keyof Pick<
  ProjectRow,
  'name' | 'invoicedAmount' | 'paidAmount' | 'outstanding' | 'supplierCosts' | 'profit' | 'marginPercent'
>

export function ProjectBreakdownTable() {
  const [data, setData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('profit')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/financials/projects')
        if (res.ok) {
          setData(await res.json())
        }
      } catch (error) {
        console.error('Error fetching project breakdown:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!data || data.projects.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        No projects with financial activity found.
      </div>
    )
  }

  const sorted = [...data.projects].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return sortDir === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number)
  })

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: 'name', label: 'Project' },
    { key: 'invoicedAmount', label: 'Invoiced', align: 'right' },
    { key: 'paidAmount', label: 'Paid', align: 'right' },
    { key: 'outstanding', label: 'Outstanding', align: 'right' },
    { key: 'supplierCosts', label: 'Supplier Costs', align: 'right' },
    { key: 'profit', label: 'Profit', align: 'right' },
    { key: 'marginPercent', label: 'Margin', align: 'right' },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                Link
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{project.name}</div>
                    <div className="text-xs text-gray-500">{project.clientName}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatCurrency(project.invoicedAmount)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatCurrency(project.paidAmount)}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className={project.outstanding > 0 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                    {formatCurrency(project.outstanding)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-red-600 text-right">
                  {formatCurrency(project.supplierCosts)}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className={`font-medium ${project.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(project.profit)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className={`font-medium ${project.marginPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {project.marginPercent}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={project.link}
                    className="text-purple-600 hover:text-purple-800"
                    title="View procurement"
                  >
                    <ExternalLink className="w-4 h-4 inline" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals Row */}
          <tfoot className="bg-gray-50 border-t-2 border-gray-300">
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-gray-900">Totals</td>
              <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                {formatCurrency(data.totals.invoicedAmount)}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                {formatCurrency(data.totals.paidAmount)}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-amber-600 text-right">
                {formatCurrency(data.totals.outstanding)}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                {formatCurrency(data.totals.supplierCosts)}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">
                {formatCurrency(data.totals.profit)}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">
                {data.totals.marginPercent}%
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
