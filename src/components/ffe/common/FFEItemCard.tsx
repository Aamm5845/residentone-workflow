'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Eye, 
  EyeOff, 
  Clock, 
  CheckCircle, 
  HelpCircle,
  FileText,
  Save,
  Trash2,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  Link2,
  Info
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export type FFEItemState = 'PENDING' | 'UNDECIDED' | 'COMPLETED'
export type FFEItemVisibility = 'VISIBLE' | 'HIDDEN'

interface FFEItemCardProps {
  id: string
  name: string
  description?: string
  state: FFEItemState
  visibility: FFEItemVisibility
  notes?: string
  sectionName: string
  isRequired?: boolean
  isCustom?: boolean
  quantity?: number
  customFields?: any
  linkedChildren?: Array<{id: string; name: string; visibility: FFEItemVisibility}>
  
  // Behavior control
  mode: 'settings' | 'workspace'
  disabled?: boolean
  isChildItem?: boolean
  
  // Selection (for settings mode)
  isSelected?: boolean
  onSelect?: (itemId: string, selected: boolean) => void
  
  // Event handlers
  onStateChange?: (itemId: string, newState: FFEItemState) => Promise<void>
  onVisibilityChange?: (itemId: string, newVisibility: FFEItemVisibility) => Promise<void>
  onNotesChange?: (itemId: string, notes: string) => Promise<void>
  onDelete?: (itemId: string) => Promise<void>
  onQuantityInclude?: (itemId: string, quantity: number, customName?: string) => Promise<void>
  onAddLinkedItem?: (item: { id: string; name: string; customFields?: any }) => void
}

const STATE_CONFIGS = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock
  },
  UNDECIDED: {
    label: 'Undecided',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: HelpCircle
  },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle
  }
}

export default function FFEItemCard({
  id,
  name,
  description,
  state,
  visibility,
  notes,
  sectionName,
  isRequired = false,
  isCustom = false,
  quantity = 1,
  customFields,
  linkedChildren = [],
  mode,
  disabled = false,
  isChildItem = false,
  isSelected = false,
  onSelect,
  onStateChange,
  onVisibilityChange,
  onNotesChange,
  onDelete,
  onQuantityInclude,
  onAddLinkedItem
}: FFEItemCardProps) {
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [notesText, setNotesText] = useState(notes || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [pendingQuantity, setPendingQuantity] = useState(1)
  const [itemNames, setItemNames] = useState<string[]>([])
  const [selectedItems, setSelectedItems] = useState<boolean[]>([])
  
  const hasLinkedChildren = customFields?.hasChildren === true && linkedChildren.length > 0
  const allChildrenVisible = linkedChildren.every(child => child.visibility === 'VISIBLE')
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  
  // Auto-expand parent items by default
  useEffect(() => {
    if (hasLinkedChildren) {
      setIsExpanded(true)
    }
  }, [hasLinkedChildren])

  const stateConfig = STATE_CONFIGS[state]
  const StateIcon = stateConfig.icon
  const hasNotes = notes && notes.trim().length > 0

  const handleVisibilityToggle = async () => {
    if (!onVisibilityChange || disabled) return

    const newVisibility: FFEItemVisibility = visibility === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE'
    
    try {
      await onVisibilityChange(id, newVisibility)
      toast.success(
        newVisibility === 'VISIBLE' 
          ? `"${name}" included in workspace` 
          : `"${name}" removed from workspace`
      )
    } catch (error) {
      toast.error('Failed to update item visibility')
      console.error('Visibility update error:', error)
    }
  }

  const handleQuantityInclude = async (quantity: number = 1) => {
    if (!onQuantityInclude || disabled || quantity < 1) return

    // If quantity is 1, just include it directly
    if (quantity === 1) {
      try {
        setIsSaving(true)
        await onQuantityInclude(id, quantity)
        toast.success(`"${name}" included in workspace`)
      } catch (error) {
        toast.error('Failed to include items in workspace')
        console.error('Quantity include error:', error)
      } finally {
        setIsSaving(false)
      }
      return
    }

    // If quantity > 1, open rename dialog
    setPendingQuantity(quantity)
    setItemNames(Array.from({ length: quantity }, (_, i) => `${name} ${i + 1}`))
    setSelectedItems(Array.from({ length: quantity }, () => true)) // All selected by default
    setIsRenameDialogOpen(true)
  }

  const handleConfirmQuantityInclude = async () => {
    if (!onQuantityInclude || disabled) return

    // Filter to only include selected items
    const selectedItemNames = itemNames.filter((_, index) => selectedItems[index])
    const selectedCount = selectedItemNames.length

    if (selectedCount === 0) {
      toast.error('Please select at least one item to include')
      return
    }

    try {
      setIsSaving(true)
      // Pass only the selected items
      await onQuantityInclude(id, selectedCount, selectedItemNames.join('|||'))
      toast.success(`${selectedCount} item${selectedCount > 1 ? 's' : ''} included in workspace`)
      setIsRenameDialogOpen(false)
    } catch (error) {
      toast.error('Failed to include items in workspace')
      console.error('Quantity include error:', error)
    } finally {
      setIsSaving(false)
    }
  }


  const handleStateChange = async (newState: FFEItemState) => {
    if (!onStateChange || disabled) return

    try {
      await onStateChange(id, newState)
      toast.success(`Item state changed to ${STATE_CONFIGS[newState].label}`)
    } catch (error) {
      toast.error('Failed to update item state')
      console.error('State update error:', error)
    }
  }

  const handleSaveNotes = async () => {
    if (!onNotesChange || isSaving) return

    setIsSaving(true)
    try {
      await onNotesChange(id, notesText.trim())
      setIsNotesDialogOpen(false)
      toast.success('Notes saved successfully')
    } catch (error) {
      toast.error('Failed to save notes')
      console.error('Notes save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || disabled) return

    // Build confirmation message with extra warning if item is visible in workspace
    const confirmMessage = visibility === 'VISIBLE'
      ? `⚠️ WARNING: "${name}" is currently visible in the workspace.\n\nAre you sure you want to delete it? This action cannot be undone.`
      : `Are you sure you want to delete "${name}"? This action cannot be undone.`

    if (confirm(confirmMessage)) {
      try {
        await onDelete(id)
        toast.success(`"${name}" deleted successfully`)
      } catch (error) {
        toast.error('Failed to delete item')
        console.error('Delete error:', error)
      }
    }
  }

  const renderSettingsControls = () => (
    <div className="flex items-center justify-between">
      {/* Status indicator */}
      <div className="flex items-center space-x-2">
        {visibility === 'VISIBLE' ? (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Included in Workspace
          </Badge>
        ) : (
          <Badge variant="outline" className="text-gray-600">
            <Plus className="w-3 h-3 mr-1" />
            Not Included
          </Badge>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-2">
        {visibility === 'VISIBLE' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleVisibilityToggle}
            disabled={disabled}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
          >
            Remove
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-300 rounded-md">
              <input
                type="number"
                min="1"
                max="50"
                defaultValue="1"
                className="w-12 text-center text-sm border-0 focus:ring-0 focus:outline-none py-1"
                id={`quantity-${id}`}
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const quantityInput = document.getElementById(`quantity-${id}`) as HTMLInputElement
                const quantity = parseInt(quantityInput?.value || '1')
                handleQuantityInclude(quantity)
              }}
              disabled={disabled}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Include
            </Button>
          </div>
        )}
        
        {/* Delete Button */}
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={disabled}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Notes Button */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              hasNotes && "bg-blue-50 border-blue-200 text-blue-700"
            )}
          >
            <FileText className="w-4 h-4 mr-1" />
            {hasNotes ? 'Edit Notes' : 'Add Notes'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes for {name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Add notes about this item..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNotesText(notes || '')
                  setIsNotesDialogOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveNotes} disabled={isSaving}>
                {isSaving ? (
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Items Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Name Your Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Select and name the items you want to add:
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedItems.every(Boolean)}
                  onCheckedChange={(checked) => {
                    setSelectedItems(Array.from({ length: pendingQuantity }, () => !!checked))
                  }}
                />
                <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All
                </Label>
              </div>
            </div>
            <div className="space-y-3">
              {itemNames.map((itemName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    id={`item-${index}`}
                    checked={selectedItems[index]}
                    onCheckedChange={(checked) => {
                      const newSelected = [...selectedItems]
                      newSelected[index] = !!checked
                      setSelectedItems(newSelected)
                    }}
                  />
                  <Input
                    value={itemName}
                    onChange={(e) => {
                      const newNames = [...itemNames]
                      newNames[index] = e.target.value
                      setItemNames(newNames)
                    }}
                    placeholder={`${name} ${index + 1}`}
                    className="flex-1"
                    disabled={!selectedItems[index]}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                {selectedItems.filter(Boolean).length} of {pendingQuantity} items selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsRenameDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleConfirmQuantityInclude} disabled={isSaving || selectedItems.filter(Boolean).length === 0}>
                  {isSaving ? (
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Include {selectedItems.filter(Boolean).length} Item{selectedItems.filter(Boolean).length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  const renderWorkspaceControls = () => {
    const availableStates: FFEItemState[] = ['PENDING', 'UNDECIDED', 'COMPLETED']
    
    return (
      <div className="flex items-center space-x-2">
        {/* State Toggle Buttons */}
        <div className="flex items-center space-x-1">
          {availableStates.map(availableState => {
            const config = STATE_CONFIGS[availableState]
            const isActive = state === availableState
            
            return (
              <Button
                key={availableState}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleStateChange(availableState)}
                disabled={disabled}
                className={cn(
                  "transition-all duration-200",
                  isActive && "shadow-md"
                )}
              >
                <config.icon className="w-4 h-4 mr-1" />
                {config.label}
              </Button>
            )
          })}
        </div>

        {/* Notes Button */}
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                hasNotes && "bg-blue-50 border-blue-200 text-blue-700"
              )}
            >
              <FileText className="w-4 h-4 mr-1" />
              {hasNotes ? 'View Notes' : 'Add Notes'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Notes for {name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Add notes about this item..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNotesText(notes || '')
                    setIsNotesDialogOpen(false)
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveNotes} disabled={isSaving}>
                  {isSaving ? (
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Notes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <>
    {/* Modern Professional Item Card */}
    <div className={cn(
      "item-row group relative transition-all duration-300",
      // Settings mode styling
      mode === 'settings' && {
        "bg-green-100 border-l-4 border-l-green-500 shadow-sm": visibility === 'VISIBLE',
        "bg-white hover:bg-gray-50/50": visibility === 'HIDDEN',
        "ml-8 border-l-2 border-l-gray-300": isChildItem
      },
      // Workspace mode styling  
      mode === 'workspace' && {
        "bg-green-50/30 border-l-4 border-l-green-400": state === 'COMPLETED',
        "bg-blue-50/30 border-l-4 border-l-blue-400": state === 'PENDING',
        "hover:bg-gray-50/50": state === 'UNDECIDED'
      },
      disabled && "opacity-60 pointer-events-none"
    )}>
      {/* Left Column - Checkbox (settings) or State Icon (workspace) */}
      <div className="flex items-center gap-3">
        {/* Expand/Collapse button for parent items */}
        {mode === 'settings' && hasLinkedChildren && !isChildItem && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title={isExpanded ? 'Collapse children' : 'Expand children'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )}
          </button>
        )}
        
        {mode === 'settings' && onSelect && !isChildItem ? (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(id, !!checked)}
            disabled={disabled}
            className="h-5 w-5"
          />
        ) : mode === 'settings' && visibility === 'VISIBLE' && !hasLinkedChildren ? (
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 transition-all duration-200">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
        ) : !hasLinkedChildren && !isChildItem ? (
          <div className={cn(
            "state-icon transition-all duration-200",
            state === 'COMPLETED' && "state-icon-completed",
            state === 'PENDING' && "state-icon-progress", 
            state === 'UNDECIDED' && "state-icon-pending"
          )}>
            <StateIcon className="h-4 w-4" />
          </div>
        ) : null}
        
        {/* Drag Handle (future feature) */}
        {!hasLinkedChildren && !isChildItem && (
          <div className="opacity-0 group-hover:opacity-30 transition-opacity cursor-move">
            <div className="flex flex-col gap-0.5">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        )}
      </div>
      
      {/* Middle Column - Item Meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900 truncate text-sm">{name}</h4>
              
              {/* Compact badges */}
              <div className="flex items-center gap-1">
                {hasLinkedChildren && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 font-medium">
                    <Link2 className="h-3 w-3 mr-1" />
                    {linkedChildren.length} linked
                  </span>
                )}
                {quantity > 1 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-medium">
                    {quantity}x
                  </span>
                )}
                {isRequired && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">
                    Required
                  </span>
                )}
                {isCustom && !isChildItem && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                    Custom
                  </span>
                )}
                {isChildItem && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-medium">
                    Linked Item
                  </span>
                )}
                {hasNotes && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
                    <FileText className="h-3 w-3 mr-1" />
                    Notes
                  </span>
                )}
              </div>
            </div>
            
            {description && (
              <button 
                onClick={() => setShowDescription(!showDescription)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <Info className="w-3 h-3" />
                {showDescription ? 'Hide details' : 'Show details'}
              </button>
            )}
            {description && showDescription && (
              <p className="text-xs text-gray-500 mt-1 pl-3 border-l-2 border-gray-200">
                {description}
              </p>
            )}
            
            <div className="flex items-center text-xs text-gray-500">
              <span className="font-medium text-gray-600">{sectionName}</span>
            </div>
          </div>
          
          {/* Status Chip */}
          <div className={cn(
            "status-chip ml-3 flex-shrink-0",
            state === 'COMPLETED' && "status-chip-completed",
            state === 'PENDING' && "status-chip-progress",
            state === 'UNDECIDED' && "status-chip-pending"
          )}>
            <StateIcon className="h-3 w-3" />
            <span className="text-xs font-medium">{stateConfig.label}</span>
          </div>
        </div>
      </div>
      
      {/* Right Column - Quick Actions */}
      <div className={cn(
        "flex items-center gap-2 ml-4 transition-opacity",
        mode === 'settings' && visibility === 'VISIBLE' ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        {mode === 'settings' ? (
          <>
            {visibility === 'VISIBLE' ? (
              <button
                onClick={handleVisibilityToggle}
                disabled={disabled}
                className="btn-ghost p-2 text-red-600 hover:bg-red-100 rounded-lg font-medium text-sm"
                title="Remove from workspace"
              >
                <Minus className="h-4 w-4 mr-1" />
                Remove
              </button>
            ) : (
              <button
                onClick={handleVisibilityToggle}
                disabled={disabled}
                className="btn-ghost p-2 text-green-600 hover:bg-green-100 rounded-lg font-medium text-sm"
                title="Include in workspace"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </button>
            )}
            
            {/* Notes Button */}
            <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
              <DialogTrigger asChild>
                <button
                  className={cn(
                    "btn-ghost p-2 rounded-lg",
                    hasNotes ? "text-blue-600 hover:bg-blue-50" : "text-gray-600 hover:bg-gray-50"
                  )}
                  title={hasNotes ? 'Edit notes' : 'Add notes'}
                >
                  <FileText className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg animate-slide-in-right">
                <DialogHeader className="pb-4 border-b border-gray-200">
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Notes for {name}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <textarea
                    placeholder="Add notes about this item..."
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    rows={4}
                    className="floating-input peer resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setNotesText(notes || '')
                      setIsNotesDialogOpen(false)
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveNotes} 
                    disabled={isSaving}
                    className="btn-primary disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Notes</span>
                      </>
                    )}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={disabled}
                className="btn-ghost p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          /* Workspace Mode Actions */
          <>
            {/* State Quick Actions */}
            <div className="flex items-center gap-1">
              {(['UNDECIDED', 'PENDING', 'COMPLETED'] as FFEItemState[]).map(targetState => {
                const config = STATE_CONFIGS[targetState]
                const isActive = state === targetState
                
                return (
                  <button
                    key={targetState}
                    onClick={() => handleStateChange(targetState)}
                    disabled={disabled}
                    className={cn(
                      "p-2 rounded-lg transition-colors text-xs font-medium",
                      isActive ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-50"
                    )}
                    title={`Mark as ${config.label}`}
                  >
                    <config.icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
            
            {/* Notes Button */}
            <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
              <DialogTrigger asChild>
                <button
                  className={cn(
                    "btn-ghost p-2 rounded-lg",
                    hasNotes ? "text-blue-600 hover:bg-blue-50" : "text-gray-600 hover:bg-gray-50"
                  )}
                  title={hasNotes ? 'View notes' : 'Add notes'}
                >
                  <FileText className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg animate-slide-in-right">
                <DialogHeader className="pb-4 border-b border-gray-200">
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Notes for {name}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <textarea
                    placeholder="Add notes about this item..."
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    rows={4}
                    className="floating-input peer resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setNotesText(notes || '')
                      setIsNotesDialogOpen(false)
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveNotes} 
                    disabled={isSaving}
                    className="btn-primary disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Notes</span>
                      </>
                    )}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
        
        {/* Add Linked Item Button (for items without children yet) */}
        {mode === 'settings' && !isChildItem && !hasLinkedChildren && onAddLinkedItem && (
          <button
            onClick={() => onAddLinkedItem({ id, name, customFields })}
            disabled={disabled}
            className="btn-ghost p-2 rounded-lg text-blue-600 hover:bg-blue-50"
            title="Add linked item"
          >
            <Link2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
    
    {/* Linked Children (Only show in settings mode when expanded) */}
    {mode === 'settings' && hasLinkedChildren && isExpanded && (
      <div className="ml-12 mt-2 space-y-2">
        {linkedChildren.map((child) => (
          <div
            key={child.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border-l-2 transition-all duration-200 group",
              child.visibility === 'VISIBLE'
                ? "bg-green-50 border-l-green-400"
                : "bg-gray-50 border-l-gray-300"
            )}
          >
            <div className="flex items-center justify-center w-4 h-4">
              <Link2 className="h-3 w-3 text-gray-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700">{child.name}</p>
              <p className="text-xs text-gray-500">Linked item</p>
            </div>
            <div className="flex items-center gap-2">
              {child.visibility === 'VISIBLE' ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 font-medium">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Included
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-600 font-medium">
                  Hidden
                </span>
              )}
              {onDelete && (
                <button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete "${child.name}"? This action cannot be undone.`)) {
                      try {
                        await onDelete(child.id)
                        toast.success(`"${child.name}" deleted successfully`)
                      } catch (error) {
                        toast.error('Failed to delete item')
                        console.error('Delete error:', error)
                      }
                    }
                  }}
                  disabled={disabled}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-100 rounded text-red-600"
                  title="Delete linked item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        
        {/* Add More Linked Items Button */}
        {onAddLinkedItem && (
          <button
            onClick={() => onAddLinkedItem({ id, name, customFields })}
            disabled={disabled}
            className="flex items-center gap-2 p-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors text-blue-700 font-medium text-sm w-full justify-center"
          >
            <Plus className="h-4 w-4" />
            Add More Linked Items
          </button>
        )}
        
        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> Adding the parent item to workspace will automatically include all {linkedChildren.length} linked item{linkedChildren.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    )}
    
    </>
  )
}
