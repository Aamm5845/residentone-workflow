'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import toast from 'react-hot-toast'
import {
  Loader2,
  FileDown,
  FileText,
  Image,
  DollarSign,
  Tag,
  Building2,
  Ruler,
  Palette,
  Link2,
  Clock,
  StickyNote,
  Layers,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpecItem {
  id: string
  name: string
  sku?: string | null
  docCode?: string | null
  brand?: string | null
  modelNumber?: string | null
  supplierName?: string | null
  supplierLink?: string | null
  color?: string | null
  finish?: string | null
  material?: string | null
  width?: number | null
  height?: number | null
  depth?: number | null
  length?: number | null
  notes?: string | null
  quantity?: number | null
  leadTime?: string | null
  tradePrice?: number | null
  rrp?: number | null
  images?: string[]
  categoryName?: string
  roomName?: string
}

interface SpecPDFExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  items: SpecItem[]
  selectedItemIds?: Set<string>
}

type PageSizeOption = '24x36' | 'letter' | 'tabloid'
type StyleOption = 'grid' | 'list'
type GroupByOption = 'category' | 'room'

export default function SpecPDFExportDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  items,
  selectedItemIds
}: SpecPDFExportDialogProps) {
  const [exporting, setExporting] = useState(false)

  // Export options
  const [exportSelected, setExportSelected] = useState(false)
  const [includeCover, setIncludeCover] = useState(true)
  const [pageSize, setPageSize] = useState<PageSizeOption>('24x36')
  const [style, setStyle] = useState<StyleOption>('grid')
  const [groupBy, setGroupBy] = useState<GroupByOption>('category')

  // Visibility options
  const [showBrand, setShowBrand] = useState(true)
  const [showSupplier, setShowSupplier] = useState(true)
  const [showPricing, setShowPricing] = useState(false)
  const [showDimensions, setShowDimensions] = useState(true)
  const [showFinish, setShowFinish] = useState(true)
  const [showColor, setShowColor] = useState(true)
  const [showMaterial, setShowMaterial] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [showLink, setShowLink] = useState(true)
  const [showLeadTime, setShowLeadTime] = useState(false)

  const hasSelection = selectedItemIds && selectedItemIds.size > 0
  const itemsToExport = exportSelected && hasSelection
    ? items.filter(item => selectedItemIds!.has(item.id))
    : items

  const handleExport = async () => {
    if (itemsToExport.length === 0) {
      toast.error('No items to export')
      return
    }

    setExporting(true)

    try {
      // Prepare items for PDF generation
      const pdfItems = itemsToExport.map((item, index) => {
        // Build dimensions string
        let dimensions = ''
        const dims: string[] = []
        if (item.width) dims.push(`W: ${item.width}"`)
        if (item.height) dims.push(`H: ${item.height}"`)
        if (item.depth) dims.push(`D: ${item.depth}"`)
        if (item.length) dims.push(`L: ${item.length}"`)
        if (dims.length > 0) dimensions = dims.join(' x ')

        return {
          id: item.id,
          docCode: item.docCode || null,  // Use ONLY actual doc code, no auto-generation
          name: item.name,
          brand: item.brand,
          modelNumber: item.modelNumber || item.sku || null,  // Fall back to SKU like All Specs does
          dimensions,
          finish: item.finish,
          color: item.color,
          material: item.material,
          notes: item.notes,
          supplierLink: item.supplierLink,
          supplierName: item.supplierName,
          contact: null,
          imageUrl: item.images?.[0] || null,
          categoryName: item.categoryName || 'Uncategorized',
          roomName: item.roomName,
          quantity: item.quantity,
          leadTime: item.leadTime,
          tradePrice: item.tradePrice,
          rrp: item.rrp
        }
      })

      // Call API to generate PDF
      const response = await fetch('/api/specs/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          items: pdfItems,
          options: {
            includeCover,
            showBrand,
            showSupplier,
            showPricing,
            showDimensions,
            showFinish,
            showColor,
            showMaterial,
            showNotes,
            showLink,
            showLeadTime,
            style,
            pageSize,
            groupBy
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      // Download the PDF with unique filename
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '') // HHMM
      const sanitizedName = projectName.replace(/[^a-zA-Z0-9]/g, '-')
      const filename = `${sanitizedName}-specs-${dateStr}-${timeStr}.pdf`

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('PDF exported successfully')
      onOpenChange(false)
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error(error.message || 'Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-emerald-600" />
            Export to PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Selection */}
          {hasSelection && (
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="font-medium text-sm">Export Selected Items Only</p>
                  <p className="text-xs text-slate-500">
                    {selectedItemIds!.size} items selected
                  </p>
                </div>
              </div>
              <Switch
                checked={exportSelected}
                onCheckedChange={setExportSelected}
              />
            </div>
          )}

          {/* Items Summary */}
          <div className="text-sm text-slate-600">
            Exporting <span className="font-semibold text-emerald-600">{itemsToExport.length}</span> items
          </div>

          {/* Page Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Page Size</Label>
            <RadioGroup
              value={pageSize}
              onValueChange={(v) => setPageSize(v as PageSizeOption)}
              className="flex gap-4"
            >
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                pageSize === '24x36' ? "border-emerald-500 bg-emerald-50" : "hover:bg-slate-50"
              )}>
                <RadioGroupItem value="24x36" />
                <span className="text-sm">24" x 36" (Large Format)</span>
              </label>
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors opacity-50 pointer-events-none",
                pageSize === 'tabloid' ? "border-emerald-500 bg-emerald-50" : "hover:bg-slate-50"
              )}>
                <RadioGroupItem value="tabloid" disabled />
                <span className="text-sm">11" x 17" (Coming Soon)</span>
              </label>
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors opacity-50 pointer-events-none",
                pageSize === 'letter' ? "border-emerald-500 bg-emerald-50" : "hover:bg-slate-50"
              )}>
                <RadioGroupItem value="letter" disabled />
                <span className="text-sm">Letter (Coming Soon)</span>
              </label>
            </RadioGroup>
          </div>

          {/* Style */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Layout Style</Label>
            <RadioGroup
              value={style}
              onValueChange={(v) => setStyle(v as StyleOption)}
              className="flex gap-4"
            >
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                style === 'grid' ? "border-emerald-500 bg-emerald-50" : "hover:bg-slate-50"
              )}>
                <RadioGroupItem value="grid" />
                <div>
                  <span className="text-sm font-medium">Grid Layout</span>
                  <p className="text-xs text-slate-500">6x2 items per page</p>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors opacity-50 pointer-events-none",
                style === 'list' ? "border-emerald-500 bg-emerald-50" : "hover:bg-slate-50"
              )}>
                <RadioGroupItem value="list" disabled />
                <div>
                  <span className="text-sm font-medium">List Layout</span>
                  <p className="text-xs text-slate-500">Coming Soon</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Group By */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Group Items By</Label>
            <RadioGroup
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as GroupByOption)}
              className="flex gap-4"
            >
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                groupBy === 'category' ? "border-emerald-500 bg-emerald-50" : "hover:bg-slate-50"
              )}>
                <RadioGroupItem value="category" />
                <div>
                  <span className="text-sm font-medium">Category</span>
                  <p className="text-xs text-slate-500">Paint, Millwork, etc.</p>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                groupBy === 'room' ? "border-emerald-500 bg-emerald-50" : "hover:bg-slate-50"
              )}>
                <RadioGroupItem value="room" />
                <div>
                  <span className="text-sm font-medium">Room</span>
                  <p className="text-xs text-slate-500">Kitchen, Bedroom, etc.</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Cover Page */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span className="text-sm">Include Cover Page</span>
            </div>
            <Switch checked={includeCover} onCheckedChange={setIncludeCover} />
          </div>

          {/* Visibility Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What to Include</Label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Brand/Manufacturer</span>
                </div>
                <Switch checked={showBrand} onCheckedChange={setShowBrand} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Supplier/Vendor</span>
                </div>
                <Switch checked={showSupplier} onCheckedChange={setShowSupplier} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Pricing</span>
                </div>
                <Switch checked={showPricing} onCheckedChange={setShowPricing} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Dimensions</span>
                </div>
                <Switch checked={showDimensions} onCheckedChange={setShowDimensions} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Finish</span>
                </div>
                <Switch checked={showFinish} onCheckedChange={setShowFinish} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Color</span>
                </div>
                <Switch checked={showColor} onCheckedChange={setShowColor} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Material</span>
                </div>
                <Switch checked={showMaterial} onCheckedChange={setShowMaterial} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Notes</span>
                </div>
                <Switch checked={showNotes} onCheckedChange={setShowNotes} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Product Link</span>
                </div>
                <Switch checked={showLink} onCheckedChange={setShowLink} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Lead Time</span>
                </div>
                <Switch checked={showLeadTime} onCheckedChange={setShowLeadTime} />
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || itemsToExport.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
