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
  Building2,
  UserCheck,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet
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
  // Pre-selected items from parent (e.g., when user has items selected in the main view)
  preSelectedItemIds?: string[]
  // For editing existing link
  editingLink?: {
    id: string
    name: string | null
    itemIds: string[]
    showSupplier: boolean
    showBrand: boolean
    showPricing: boolean
    showDetails: boolean
    showSpecSheets: boolean
    showNotes: boolean
    allowApproval: boolean
    expiresAt: string | null
  } | null
}

export default function CreateSpecShareLinkDialog({
  open,
  onOpenChange,
  projectId,
  items,
  onLinkCreated,
  preSelectedItemIds,
  editingLink
}: CreateSpecShareLinkDialogProps) {
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Form state
  const [name, setName] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [shareAllSpecs, setShareAllSpecs] = useState(false) // New: Share All mode
  const [showSupplier, setShowSupplier] = useState(false)
  const [showBrand, setShowBrand] = useState(true)
  const [showPricing, setShowPricing] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [showSpecSheets, setShowSpecSheets] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [allowApproval, setAllowApproval] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')

  // Reset form when dialog opens/closes or editing link changes
  useEffect(() => {
    if (open) {
      if (editingLink) {
        setName(editingLink.name || '')
        // If itemIds is empty, it means "all items" mode
        const isAllItemsMode = !editingLink.itemIds || editingLink.itemIds.length === 0
        setShareAllSpecs(isAllItemsMode)
        setSelectedItemIds(isAllItemsMode ? new Set() : new Set(editingLink.itemIds))
        setShowSupplier(editingLink.showSupplier)
        setShowBrand(editingLink.showBrand)
        setShowPricing(editingLink.showPricing)
        setShowDetails(editingLink.showDetails)
        setShowSpecSheets(editingLink.showSpecSheets || false)
        setShowNotes(editingLink.showNotes !== false) // Default to true
        setAllowApproval(editingLink.allowApproval || false)
        setExpiresAt(editingLink.expiresAt ? editingLink.expiresAt.split('T')[0] : '')
      } else {
        setName('')
        // If pre-selected items are provided, use them (don't enable Share All)
        if (preSelectedItemIds && preSelectedItemIds.length > 0) {
          setShareAllSpecs(false)
          setSelectedItemIds(new Set(preSelectedItemIds))
        } else {
          setShareAllSpecs(false)
          setSelectedItemIds(new Set())
        }
        setShowSupplier(false)
        setShowBrand(true)
        setShowPricing(false)
        setShowDetails(true)
        setShowSpecSheets(false)
        setShowNotes(true)
        setAllowApproval(false)
        setExpiresAt('')
      }
      setSearchQuery('')
      // Expand all categories by default
      const categories = Object.keys(items.reduce((acc, item) => {
        acc[item.categoryName || 'Uncategorized'] = true
        return acc
      }, {} as Record<string, boolean>))
      setExpandedCategories(new Set(categories))
    }
  }, [open, editingLink, items, preSelectedItemIds])

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

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const selectAllInCategory = (category: string) => {
    const categoryItems = groupedItems[category] || []
    const categoryIds = categoryItems.map(i => i.id)
    const allSelected = categoryIds.every(id => selectedItemIds.has(id))

    setSelectedItemIds(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        // Deselect all in category
        categoryIds.forEach(id => newSet.delete(id))
      } else {
        // Select all in category
        categoryIds.forEach(id => newSet.add(id))
      }
      return newSet
    })
  }

  const selectAll = () => {
    if (items.length === 0) {
      toast.error('No items available to select')
      return
    }
    setSelectedItemIds(new Set(items.map(i => i.id)))
  }

  const clearAll = () => {
    setSelectedItemIds(new Set())
  }

  const getCategorySelectionState = (category: string) => {
    const categoryItems = groupedItems[category] || []
    const selectedCount = categoryItems.filter(i => selectedItemIds.has(i.id)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === categoryItems.length) return 'all'
    return 'partial'
  }

  const handleSave = async () => {
    // Require selection unless "Share All" is enabled
    if (!shareAllSpecs && selectedItemIds.size === 0) {
      toast.error('Please select at least one item or enable "Share All Specs"')
      return
    }

    setSaving(true)
    try {
      const url = editingLink
        ? `/api/projects/${projectId}/spec-share-links/${editingLink.id}`
        : `/api/projects/${projectId}/spec-share-links`

      // If shareAllSpecs is enabled, send empty array (means "all items" mode - dynamic)
      const itemIdsToSend = shareAllSpecs ? [] : Array.from(selectedItemIds)

      const response = await fetch(url, {
        method: editingLink ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || null,
          itemIds: itemIdsToSend,
          showSupplier,
          showBrand,
          showPricing,
          showDetails,
          showSpecSheets,
          showNotes,
          allowApproval,
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

        <div className="flex-1 overflow-y-auto flex flex-col gap-6 py-4">
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

          {/* Share All Specs Toggle */}
          <div className={cn(
            "p-4 rounded-lg border-2 transition-colors",
            shareAllSpecs
              ? "bg-emerald-50 border-emerald-300"
              : "bg-slate-50 border-slate-200 hover:border-slate-300"
          )}>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  shareAllSpecs ? "bg-emerald-500" : "bg-slate-300"
                )}>
                  <CheckSquare className={cn(
                    "w-5 h-5",
                    shareAllSpecs ? "text-white" : "text-slate-500"
                  )} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-900">Share All Specs</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Automatically includes all current and future spec items
                  </p>
                </div>
              </div>
              <Switch
                checked={shareAllSpecs}
                onCheckedChange={(checked) => {
                  setShareAllSpecs(checked)
                  if (checked) {
                    setSelectedItemIds(new Set()) // Clear individual selection
                  }
                }}
              />
            </label>
          </div>

          {/* Item Selection - Only show if not sharing all */}
          {!shareAllSpecs && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Label>Or Select Specific Items</Label>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="pl-9 h-9"
              />
            </div>

            {/* Items List */}
            <div className="border rounded-lg h-[250px] overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredGroups.map(({ category, items: categoryItems }) => {
                  const isExpanded = expandedCategories.has(category)
                  const selectionState = getCategorySelectionState(category)
                  const selectedInCategory = categoryItems.filter(i => selectedItemIds.has(i.id)).length

                  return (
                    <div key={category} className="border rounded-lg overflow-hidden">
                      {/* Category Header - Clickable to expand/collapse */}
                      <div
                        className={cn(
                          "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors",
                          selectionState === 'all' ? "bg-emerald-50" :
                          selectionState === 'partial' ? "bg-emerald-50/50" : "bg-slate-50 hover:bg-slate-100"
                        )}
                      >
                        <div
                          className="flex items-center gap-2 flex-1"
                          onClick={() => toggleCategory(category)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          )}
                          <span className="text-sm font-semibold text-slate-800">{category}</span>
                          <span className="text-xs text-slate-600 font-medium">
                            ({selectedInCategory}/{categoryItems.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            selectAllInCategory(category)
                          }}
                          className={cn(
                            "text-xs px-2 py-1 rounded transition-colors",
                            selectionState === 'all'
                              ? "bg-emerald-200 text-emerald-800 hover:bg-emerald-300"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          )}
                        >
                          {selectionState === 'all' ? 'Deselect' : 'Select All'}
                        </button>
                      </div>

                      {/* Category Items - Only show when expanded */}
                      {isExpanded && (
                        <div className="border-t bg-white">
                          {categoryItems.map(item => (
                            <label
                              key={item.id}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-b last:border-b-0",
                                selectedItemIds.has(item.id)
                                  ? "bg-emerald-50"
                                  : "hover:bg-slate-50"
                              )}
                            >
                              <Checkbox
                                checked={selectedItemIds.has(item.id)}
                                onCheckedChange={() => toggleItem(item.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-slate-600 font-medium">{item.roomName}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {filteredGroups.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    {items.length === 0 ? (
                      <p className="text-amber-600">No specs available. Add specs to the project first.</p>
                    ) : (
                      <p>No items match your search</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              {selectedItemIds.size} of {items.length} items selected
            </p>
          </div>
          )}

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

            {/* Notes Option */}
            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50 mt-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="text-sm">Notes</span>
                  <p className="text-xs text-slate-500">Include item notes/descriptions</p>
                </div>
              </div>
              <Switch checked={showNotes} onCheckedChange={setShowNotes} />
            </label>

            {/* Spec Sheets Option */}
            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50 mt-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="text-sm">Spec Sheets</span>
                  <p className="text-xs text-slate-500">Include uploaded spec sheet documents</p>
                </div>
              </div>
              <Switch checked={showSpecSheets} onCheckedChange={setShowSpecSheets} />
            </label>
          </div>

          {/* Client Approval Option */}
          <div className="space-y-2">
            <Label>Client Actions</Label>
            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="text-sm font-medium">Allow Approval</span>
                  <p className="text-xs text-slate-500">Client can approve items directly from the shared link</p>
                </div>
              </div>
              <Switch checked={allowApproval} onCheckedChange={(checked) => {
                setAllowApproval(checked)
                // Auto-enable pricing when approval is enabled (client needs to see prices to approve)
                if (checked) {
                  setShowPricing(true)
                }
              }} />
            </label>
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
              max={new Date(new Date().getFullYear() + 5, 11, 31).toISOString().split('T')[0]}
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
            disabled={saving || (!shareAllSpecs && selectedItemIds.size === 0)}
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
