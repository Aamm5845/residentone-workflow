'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FileSpreadsheet, Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface ComponentItem {
  id: string
  name: string
  modelNumber?: string | null
  price?: number | null
  quantity: number
}

interface SpecItem {
  id: string
  docCode?: string
  name: string
  roomName: string
  sectionName: string
  brand?: string
  modelNumber?: string
  sku?: string
  supplierName?: string
  quantity: number
  tradePrice?: number | null
  tradePriceCurrency?: string
  rrp?: number | null
  rrpCurrency?: string
  markupPercent?: number | null
  specStatus?: string
  leadTime?: string
  color?: string
  finish?: string
  material?: string
  width?: string
  height?: string
  depth?: string
  description?: string
  notes?: string
  clientApproved?: boolean
  components?: ComponentItem[]
}

interface SpecCSVExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  specs: SpecItem[]
  selectedItemIds: Set<string>
  projectName: string
}

interface ExportColumn {
  key: string
  label: string
  category: 'basic' | 'pricing' | 'details' | 'other'
  default: boolean
}

const EXPORT_COLUMNS: ExportColumn[] = [
  // Basic Info
  { key: 'docCode', label: 'Doc Code', category: 'basic', default: true },
  { key: 'name', label: 'Name', category: 'basic', default: true },
  { key: 'room', label: 'Room', category: 'basic', default: true },
  { key: 'section', label: 'Section', category: 'basic', default: true },
  { key: 'brand', label: 'Brand', category: 'basic', default: true },
  { key: 'modelSku', label: 'Model/SKU', category: 'basic', default: true },
  { key: 'supplier', label: 'Supplier', category: 'basic', default: true },
  { key: 'quantity', label: 'Quantity', category: 'basic', default: true },

  // Pricing
  { key: 'tradePriceCAD', label: 'Trade Price (CAD)', category: 'pricing', default: true },
  { key: 'tradePriceUSD', label: 'Trade Price (USD)', category: 'pricing', default: true },
  { key: 'rrpCAD', label: 'RRP (CAD)', category: 'pricing', default: true },
  { key: 'rrpUSD', label: 'RRP (USD)', category: 'pricing', default: true },
  { key: 'markup', label: 'Markup %', category: 'pricing', default: true },
  { key: 'lineTotal', label: 'Line Total', category: 'pricing', default: true },

  // Details
  { key: 'status', label: 'Status', category: 'details', default: true },
  { key: 'leadTime', label: 'Lead Time', category: 'details', default: true },
  { key: 'color', label: 'Color', category: 'details', default: false },
  { key: 'finish', label: 'Finish', category: 'details', default: false },
  { key: 'material', label: 'Material', category: 'details', default: false },
  { key: 'dimensions', label: 'Dimensions (WxHxD)', category: 'details', default: false },

  // Other
  { key: 'description', label: 'Description', category: 'other', default: false },
  { key: 'notes', label: 'Notes', category: 'other', default: false },
  { key: 'clientApproved', label: 'Client Approved', category: 'other', default: false },
]

export default function SpecCSVExportDialog({
  open,
  onOpenChange,
  specs,
  selectedItemIds,
  projectName
}: SpecCSVExportDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(EXPORT_COLUMNS.filter(c => c.default).map(c => c.key))
  )
  const [includeComponentsAsRows, setIncludeComponentsAsRows] = useState(false)

  const specsToExport = selectedItemIds.size > 0
    ? specs.filter(s => selectedItemIds.has(s.id))
    : specs

  // Count total components
  const totalComponents = specsToExport.reduce((sum, spec) => sum + (spec.components?.length || 0), 0)

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedColumns(new Set(EXPORT_COLUMNS.map(c => c.key)))
  }

  const selectNone = () => {
    setSelectedColumns(new Set())
  }

  const selectCategory = (category: string, selected: boolean) => {
    setSelectedColumns(prev => {
      const next = new Set(prev)
      EXPORT_COLUMNS.filter(c => c.category === category).forEach(c => {
        if (selected) {
          next.add(c.key)
        } else {
          next.delete(c.key)
        }
      })
      return next
    })
  }

  const isCategoryFullySelected = (category: string) => {
    return EXPORT_COLUMNS.filter(c => c.category === category).every(c => selectedColumns.has(c.key))
  }

  const isCategoryPartiallySelected = (category: string) => {
    const cols = EXPORT_COLUMNS.filter(c => c.category === category)
    const selected = cols.filter(c => selectedColumns.has(c.key))
    return selected.length > 0 && selected.length < cols.length
  }

  const handleExport = () => {
    if (specsToExport.length === 0) {
      toast.error('No items to export')
      return
    }

    if (selectedColumns.size === 0) {
      toast.error('Please select at least one column to export')
      return
    }

    // Build headers based on selected columns
    const orderedColumns = EXPORT_COLUMNS.filter(c => selectedColumns.has(c.key))
    const headers = orderedColumns.map(c => c.label)

    // Helper to get value for each column
    const getValue = (spec: SpecItem, key: string): string | number => {
      switch (key) {
        case 'docCode': return spec.docCode || ''
        case 'name': return spec.name || ''
        case 'room': return spec.roomName || ''
        case 'section': return spec.sectionName || ''
        case 'brand': return spec.brand || ''
        case 'modelSku': return spec.modelNumber || spec.sku || ''
        case 'supplier': return spec.supplierName || ''
        case 'quantity': return spec.quantity || 1
        case 'tradePriceCAD':
          return (spec.tradePriceCurrency === 'CAD' || !spec.tradePriceCurrency) && spec.tradePrice
            ? `$${Number(spec.tradePrice).toFixed(2)}`
            : ''
        case 'tradePriceUSD':
          return spec.tradePriceCurrency === 'USD' && spec.tradePrice
            ? `$${Number(spec.tradePrice).toFixed(2)}`
            : ''
        case 'rrpCAD':
          return (spec.rrpCurrency === 'CAD' || !spec.rrpCurrency) && spec.rrp
            ? `$${Number(spec.rrp).toFixed(2)}`
            : ''
        case 'rrpUSD':
          return spec.rrpCurrency === 'USD' && spec.rrp
            ? `$${Number(spec.rrp).toFixed(2)}`
            : ''
        case 'markup': {
          // Use stored markup or calculate from trade price and RRP
          let markup = spec.markupPercent
          if (markup == null && spec.tradePrice && spec.rrp && spec.tradePrice > 0) {
            markup = ((spec.rrp - spec.tradePrice) / spec.tradePrice) * 100
          }
          return markup != null ? `${markup.toFixed(1)}%` : ''
        }
        case 'lineTotal': {
          const price = spec.rrp || spec.tradePrice || 0
          const qty = spec.quantity || 1
          const total = Number(price) * qty
          const currency = spec.rrpCurrency || spec.tradePriceCurrency || 'CAD'
          return total > 0 ? `$${total.toFixed(2)} ${currency}` : ''
        }
        case 'status': return spec.specStatus || ''
        case 'leadTime': return spec.leadTime || ''
        case 'color': return spec.color || ''
        case 'finish': return spec.finish || ''
        case 'material': return spec.material || ''
        case 'dimensions':
          return [spec.width, spec.height, spec.depth].filter(Boolean).join(' x ') || ''
        case 'description': return spec.description || ''
        case 'notes': return spec.notes || ''
        case 'clientApproved': return spec.clientApproved ? 'Yes' : 'No'
        default: return ''
      }
    }

    // Helper to get value for component row
    const getComponentValue = (spec: SpecItem, comp: ComponentItem, key: string): string | number => {
      const markupPercent = spec.markupPercent || 0
      const compPrice = comp.price || 0
      const compRrp = compPrice * (1 + markupPercent / 100)
      const currency = spec.rrpCurrency || spec.tradePriceCurrency || 'CAD'

      switch (key) {
        case 'docCode': return '' // Components don't have doc codes
        case 'name': return `  ↳ ${comp.name}` // Indent to show it's a component
        case 'room': return spec.roomName || ''
        case 'section': return spec.sectionName || ''
        case 'brand': return '' // Components don't have brands
        case 'modelSku': return comp.modelNumber || ''
        case 'supplier': return spec.supplierName || '' // Use parent's supplier
        case 'quantity': return comp.quantity || 1
        case 'tradePriceCAD':
          return currency === 'CAD' && compPrice ? `$${compPrice.toFixed(2)}` : ''
        case 'tradePriceUSD':
          return currency === 'USD' && compPrice ? `$${compPrice.toFixed(2)}` : ''
        case 'rrpCAD':
          return currency === 'CAD' && compRrp ? `$${compRrp.toFixed(2)}` : ''
        case 'rrpUSD':
          return currency === 'USD' && compRrp ? `$${compRrp.toFixed(2)}` : ''
        case 'markup':
          return markupPercent ? `${markupPercent}%` : ''
        case 'lineTotal': {
          const total = compRrp * (comp.quantity || 1)
          return total > 0 ? `$${total.toFixed(2)} ${currency}` : ''
        }
        case 'status': return 'COMPONENT'
        case 'leadTime': return ''
        case 'color': return ''
        case 'finish': return ''
        case 'material': return ''
        case 'dimensions': return ''
        case 'description': return ''
        case 'notes': return ''
        case 'clientApproved': return ''
        default: return ''
      }
    }

    // Convert specs to CSV rows (and optionally include components)
    const rows: (string | number)[][] = []
    specsToExport.forEach(spec => {
      // Add the main item row
      rows.push(orderedColumns.map(col => getValue(spec, col.key)))

      // Add component rows if enabled
      if (includeComponentsAsRows && spec.components && spec.components.length > 0) {
        spec.components.forEach(comp => {
          rows.push(orderedColumns.map(col => getComponentValue(spec, comp, col.key)))
        })
      }
    })

    // Escape CSV values
    const escapeCSV = (value: string | number) => {
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_specs_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    const totalRows = includeComponentsAsRows
      ? specsToExport.length + specsToExport.reduce((sum, s) => sum + (s.components?.length || 0), 0)
      : specsToExport.length
    toast.success(`Exported ${totalRows} rows to CSV`)
    onOpenChange(false)
  }

  const categories = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'details', label: 'Details' },
    { key: 'other', label: 'Other' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Export to CSV
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Export summary */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-slate-600">
              Exporting <span className="font-semibold text-slate-900">{specsToExport.length}</span> items
              {selectedItemIds.size > 0 && (
                <span className="text-slate-500"> (selected)</span>
              )}
              {totalComponents > 0 && (
                <span className="text-slate-500"> with {totalComponents} components</span>
              )}
            </p>
          </div>

          {/* Include components as rows option */}
          {totalComponents > 0 && (
            <div className="mb-4 p-3 border rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={includeComponentsAsRows}
                  onCheckedChange={(checked) => setIncludeComponentsAsRows(!!checked)}
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Include components as separate rows</span>
                  <p className="text-xs text-slate-500">Components will appear as rows below their parent item</p>
                </div>
              </label>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex items-center justify-between mb-4">
            <Label className="text-sm font-medium">Select Columns</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="h-7 text-xs"
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectNone}
                className="h-7 text-xs"
              >
                None
              </Button>
            </div>
          </div>

          {/* Column selection by category */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {categories.map(cat => (
              <div key={cat.key} className="border rounded-lg p-3">
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <Checkbox
                    checked={isCategoryFullySelected(cat.key)}
                    // @ts-ignore - indeterminate is valid but not in types
                    data-state={isCategoryPartiallySelected(cat.key) ? 'indeterminate' : undefined}
                    onCheckedChange={(checked) => selectCategory(cat.key, !!checked)}
                  />
                  <span className="text-sm font-medium text-slate-700">{cat.label}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 pl-6">
                  {EXPORT_COLUMNS.filter(c => c.category === cat.key).map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedColumns.has(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      <span className="text-sm text-slate-600">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedColumns.size === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
