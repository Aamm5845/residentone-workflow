'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import toast from 'react-hot-toast'
import {
  Loader2,
  Link2,
  Eye,
  DollarSign,
  Tag,
  FileText,
  Calendar,
  Search,
  CheckSquare,
  Square,
  Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpecItem {
  id: string
  name: string
  roomName: string
  categoryName: string
  thumbnailUrl?: string
}

interface CreateSpecShareLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  items: SpecItem[]
  onLinkCreated: () => void
  // For editing existing link
  editingLink?: {
    id: string
    name: string | null
    itemIds: string[]
    showSupplier: boolean
    showBrand: boolean
    showPricing: boolean
    showDetails: boolean
    expiresAt: string | null
  } | null
}

export default function CreateSpecShareLinkDialog({
  open,
  onOpenChange,
  projectId,
  items,
  onLinkCreated,
  editingLink
}: CreateSpecShareLinkDialogProps) {
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [showSupplier, setShowSupplier] = useState(false)
  const [showBrand, setShowBrand] = useState(true)
  const [showPricing, setShowPricing] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')

  // Reset form when dialog opens/closes or editing link changes
  useEffect(() => {
    if (open) {
      if (editingLink) {
        setName(editingLink.name || '')
        setSelectedItemIds(new Set(editingLink.itemIds))
        setShowSupplier(editingLink.showSupplier)
        setShowBrand(editingLink.showBrand)
        setShowPricing(editingLink.showPricing)
        setShowDetails(editingLink.showDetails)
        setExpiresAt(editingLink.expiresAt ? editingLink.expiresAt.split('T')[0] : '')
      } else {
        setName('')
        setSelectedItemIds(new Set())
        setShowSupplier(false)
        setShowBrand(true)
        setShowPricing(false)
        setShowDetails(true)
        setExpiresAt('')
      }
      setSearchQuery('')
    }
  }, [open, editingLink])

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const key = item.categoryName || 'Uncategorized'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, SpecItem[]>)

  // Filter items by search
  const filteredGroups = Object.entries(groupedItems)
    .map(([category, categoryItems]) => ({
      category,
      items: categoryItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.roomName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(g => g.items.length > 0)

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedItemIds(new Set(items.map(i => i.id)))
  }

  const clearAll = () => {
    setSelectedItemIds(new Set())
  }

  const handleSave = async () => {
    if (selectedItemIds.size === 0) {
      toast.error('Please select at least one item')
      return
    }

    setSaving(true)
    try {
      const url = editingLink
        ? `/api/projects/${projectId}/spec-share-links/${editingLink.id}`
        : `/api/projects/${projectId}/spec-share-links`

      const response = await fetch(url, {
        method: editingLink ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || null,
          itemIds: Array.from(selectedItemIds),
          showSupplier,
          showBrand,
          showPricing,
          showDetails,
          expiresAt: expiresAt || null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      toast.success(editingLink ? 'Link updated' : 'Share link created')
      onLinkCreated()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save share link')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            {editingLink ? 'Edit Share Link' : 'Create Share Link'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
          {/* Link Name */}
          <div className="space-y-2">
            <Label>Link Name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Client, Contractor, Architect"
              className="h-10"
            />
            <p className="text-xs text-slate-500">
              Help identify who this link is for
            </p>
          </div>

          {/* Item Selection */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Label>Select Items to Share</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="h-7 text-xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1" />
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 text-xs"
                >
                  <Square className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="pl-9 h-9"
              />
            </div>

            {/* Items List */}
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-3">
                {filteredGroups.map(({ category, items: categoryItems }) => (
                  <div key={category}>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
                      {category}
                    </div>
                    <div className="space-y-1">
                      {categoryItems.map(item => (
                        <label
                          key={item.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                            selectedItemIds.has(item.id)
                              ? "bg-emerald-50 border border-emerald-200"
                              : "hover:bg-slate-50"
                          )}
                        >
                          <Checkbox
                            checked={selectedItemIds.has(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500">{item.roomName}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredGroups.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No items found
                  </div>
                )}
              </div>
            </ScrollArea>

            <p className="text-xs text-slate-500 mt-1">
              {selectedItemIds.size} of {items.length} items selected
            </p>
          </div>

          {/* Visibility Options */}
          <div className="space-y-3">
            <Label>What can they see?</Label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Supplier</span>
                </div>
                <Switch checked={showSupplier} onCheckedChange={setShowSupplier} />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Brand</span>
                </div>
                <Switch checked={showBrand} onCheckedChange={setShowBrand} />
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
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">Details</span>
                </div>
                <Switch checked={showDetails} onCheckedChange={setShowDetails} />
              </label>
            </div>
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              Expiry Date (optional)
            </Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="h-10 w-48"
            />
            <p className="text-xs text-slate-500">
              Leave empty for no expiry
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || selectedItemIds.size === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            {editingLink ? 'Update Link' : 'Create Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
