'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  FileSpreadsheet,
  Download,
  Loader2,
  Receipt,
  FileText,
  Users,
  Building2,
  CreditCard,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface QuickBooksExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExportType = 'invoices' | 'bills' | 'customers' | 'vendors' | 'payments'
type SourceType = 'billing' | 'procurement' | 'both'

interface ExportTypeOption {
  value: ExportType
  label: string
  description: string
  icon: React.ReactNode
  hasDateFilter: boolean
  hasSourceFilter: boolean
}

const EXPORT_TYPES: ExportTypeOption[] = [
  {
    value: 'invoices',
    label: 'Invoices (AR)',
    description: 'Client invoices for Accounts Receivable',
    icon: <Receipt className="w-4 h-4" />,
    hasDateFilter: true,
    hasSourceFilter: true,
  },
  {
    value: 'bills',
    label: 'Bills (AP)',
    description: 'Supplier purchase orders for Accounts Payable',
    icon: <FileText className="w-4 h-4" />,
    hasDateFilter: true,
    hasSourceFilter: false,
  },
  {
    value: 'customers',
    label: 'Customers',
    description: 'Client list for QBO Customer import',
    icon: <Users className="w-4 h-4" />,
    hasDateFilter: false,
    hasSourceFilter: false,
  },
  {
    value: 'vendors',
    label: 'Vendors',
    description: 'Supplier list for QBO Vendor import',
    icon: <Building2 className="w-4 h-4" />,
    hasDateFilter: false,
    hasSourceFilter: false,
  },
  {
    value: 'payments',
    label: 'Payments Received',
    description: 'Client payments for QBO Payment import',
    icon: <CreditCard className="w-4 h-4" />,
    hasDateFilter: true,
    hasSourceFilter: true,
  },
]

interface FilterProject {
  id: string
  name: string
}

function formatDateQBO(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

function escapeCSV(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function QuickBooksExportDialog({
  open,
  onOpenChange,
}: QuickBooksExportDialogProps) {
  const [exportType, setExportType] = useState<ExportType>('invoices')
  const [source, setSource] = useState<SourceType>('both')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<FilterProject[]>([])
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const selectedType = EXPORT_TYPES.find((t) => t.value === exportType)!

  // Fetch projects for filter dropdown
  useEffect(() => {
    if (!open) return
    fetch('/api/financials/audit-trail?limit=1')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects)
      })
      .catch(() => {})
  }, [open])

  // Fetch preview count when filters change
  const fetchPreview = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: exportType })
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (projectId) params.set('projectId', projectId)
      if (selectedType.hasSourceFilter) params.set('source', source)

      const res = await fetch(`/api/financials/export?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPreviewCount(data.count)
      } else {
        setPreviewCount(null)
      }
    } catch {
      setPreviewCount(null)
    } finally {
      setLoading(false)
    }
  }, [exportType, dateFrom, dateTo, projectId, source, selectedType.hasSourceFilter])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(fetchPreview, 300)
    return () => clearTimeout(timer)
  }, [open, fetchPreview])

  // Build CSV from records
  function buildCSV(records: Record<string, unknown>[]): string {
    if (records.length === 0) return ''

    switch (exportType) {
      case 'invoices':
        return buildInvoiceCSV(records)
      case 'bills':
        return buildBillCSV(records)
      case 'customers':
        return buildCustomerCSV(records)
      case 'vendors':
        return buildVendorCSV(records)
      case 'payments':
        return buildPaymentCSV(records)
      default:
        return ''
    }
  }

  function buildInvoiceCSV(records: Record<string, unknown>[]): string {
    const headers = [
      'InvoiceNo',
      'Customer',
      'InvoiceDate',
      'DueDate',
      'Item(Product/Service)',
      'ItemDescription',
      'ItemQuantity',
      'ItemRate',
      'ItemAmount',
      'TaxAmount',
      'Memo',
      'Project',
      'Source',
    ]
    const rows = records.map((r) => [
      escapeCSV(r.invoiceNo as string),
      escapeCSV(r.customer as string),
      escapeCSV(formatDateQBO(r.invoiceDate as string)),
      escapeCSV(formatDateQBO(r.dueDate as string)),
      escapeCSV(r.item as string),
      escapeCSV(r.description as string),
      escapeCSV(r.quantity as number),
      escapeCSV(Number(r.rate as number).toFixed(2)),
      escapeCSV(Number(r.amount as number).toFixed(2)),
      escapeCSV(Number(r.taxAmount as number).toFixed(2)),
      escapeCSV(r.memo as string),
      escapeCSV(r.project as string),
      escapeCSV(r.source as string),
    ])
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  }

  function buildBillCSV(records: Record<string, unknown>[]): string {
    const headers = [
      'Vendor',
      'BillDate',
      'DueDate',
      'BillNo',
      'ItemDescription',
      'ItemQuantity',
      'ItemRate',
      'ItemAmount',
      'TaxAmount',
      'ShippingCost',
      'TotalAmount',
      'Currency',
      'Project',
      'Status',
      'PaidDate',
      'PaymentMethod',
      'PaymentRef',
    ]
    const rows = records.map((r) => [
      escapeCSV(r.vendor as string),
      escapeCSV(formatDateQBO(r.billDate as string)),
      escapeCSV(formatDateQBO(r.dueDate as string)),
      escapeCSV(r.billNo as string),
      escapeCSV(r.description as string),
      escapeCSV(r.quantity as number),
      escapeCSV(Number(r.rate as number).toFixed(2)),
      escapeCSV(Number(r.amount as number).toFixed(2)),
      escapeCSV(Number(r.taxAmount as number).toFixed(2)),
      escapeCSV(Number(r.shippingCost as number).toFixed(2)),
      escapeCSV(Number(r.totalAmount as number).toFixed(2)),
      escapeCSV(r.currency as string),
      escapeCSV(r.project as string),
      escapeCSV(r.status as string),
      escapeCSV(formatDateQBO(r.paidDate as string)),
      escapeCSV(r.paymentMethod as string),
      escapeCSV(r.paymentRef as string),
    ])
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  }

  function buildCustomerCSV(records: Record<string, unknown>[]): string {
    const headers = [
      'Name',
      'Company',
      'Email',
      'Phone',
      'Street',
      'City',
      'State',
      'Zip',
      'Country',
    ]
    const rows = records.map((r) => [
      escapeCSV(r.name as string),
      escapeCSV(r.company as string),
      escapeCSV(r.email as string),
      escapeCSV(r.phone as string),
      escapeCSV(r.street as string),
      escapeCSV(r.city as string),
      escapeCSV(r.state as string),
      escapeCSV(r.zip as string),
      escapeCSV(r.country as string),
    ])
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  }

  function buildVendorCSV(records: Record<string, unknown>[]): string {
    const headers = [
      'Name',
      'Contact Name',
      'Email',
      'Phone',
      'Street',
      'Website',
      'Currency',
      'Category',
    ]
    const rows = records.map((r) => [
      escapeCSV(r.name as string),
      escapeCSV(r.contactName as string),
      escapeCSV(r.email as string),
      escapeCSV(r.phone as string),
      escapeCSV(r.street as string),
      escapeCSV(r.website as string),
      escapeCSV(r.currency as string),
      escapeCSV(r.category as string),
    ])
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  }

  function buildPaymentCSV(records: Record<string, unknown>[]): string {
    const headers = [
      'Date',
      'Customer',
      'PaymentMethod',
      'ReferenceNo',
      'Amount',
      'InvoiceNo',
      'Project',
      'Status',
      'Memo',
      'Source',
    ]
    const rows = records.map((r) => [
      escapeCSV(formatDateQBO(r.date as string)),
      escapeCSV(r.customer as string),
      escapeCSV(r.paymentMethod as string),
      escapeCSV(r.referenceNo as string),
      escapeCSV(Number(r.amount as number).toFixed(2)),
      escapeCSV(r.invoiceNo as string),
      escapeCSV(r.project as string),
      escapeCSV(r.status as string),
      escapeCSV(r.memo as string),
      escapeCSV(r.source as string),
    ])
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ type: exportType })
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (projectId) params.set('projectId', projectId)
      if (selectedType.hasSourceFilter) params.set('source', source)

      const res = await fetch(`/api/financials/export?${params}`)
      if (!res.ok) {
        toast.error('Failed to fetch export data')
        return
      }

      const data = await res.json()
      if (!data.records || data.records.length === 0) {
        toast.error('No records to export')
        return
      }

      const csv = buildCSV(data.records)
      if (!csv) {
        toast.error('Failed to build CSV')
        return
      }

      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `quickbooks_${exportType}_${dateStr}.csv`
      downloadCSV(csv, filename)

      toast.success(`Exported ${data.records.length} rows to ${filename}`)
      onOpenChange(false)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Export for QuickBooks
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Export Type Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">What to export</Label>
            <div className="grid gap-2">
              {EXPORT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setExportType(type.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    exportType === type.value
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded ${
                      exportType === type.value
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {type.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Source Filter (for invoices and payments) */}
          {selectedType.hasSourceFilter && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Data source</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'both', label: 'Both' },
                    { value: 'billing', label: 'Billing' },
                    { value: 'procurement', label: 'Procurement' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSource(s.value)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      source === s.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Range (for date-filterable types) */}
          {selectedType.hasDateFilter && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Date range</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Project Filter (for types with date filter) */}
          {selectedType.hasDateFilter && projects.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Project (optional)</Label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview Count */}
          <div className="bg-slate-50 rounded-lg p-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Counting records...
              </div>
            ) : previewCount !== null ? (
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{previewCount}</span>{' '}
                {previewCount === 1 ? 'record' : 'records'} will be exported as CSV
              </p>
            ) : (
              <p className="text-sm text-slate-500">Select options to preview export count</p>
            )}
          </div>

          {/* QBO Import Tip */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>QuickBooks tip:</strong> Import Customers & Vendors first, then Invoices &
              Bills. In QBO, go to Settings &gt; Import Data to upload the CSV.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || previewCount === 0 || previewCount === null}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
