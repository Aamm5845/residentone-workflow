'use client'

import React, { useState } from 'react'
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
  Plus
} from 'lucide-react'
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
  
  // Behavior control
  mode: 'settings' | 'workspace'
  disabled?: boolean
  
  // Event handlers
  onStateChange?: (itemId: string, newState: FFEItemState) => Promise<void>
  onVisibilityChange?: (itemId: string, newVisibility: FFEItemVisibility) => Promise<void>
  onNotesChange?: (itemId: string, notes: string) => Promise<void>
  onDelete?: (itemId: string) => Promise<void>
  onQuantityInclude?: (itemId: string, quantity: number, customName?: string) => Promise<void>
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
  mode,
  disabled = false,
  onStateChange,
  onVisibilityChange,
  onNotesChange,
  onDelete,
  onQuantityInclude
}: FFEItemCardProps) {
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [notesText, setNotesText] = useState(notes || '')
  const [isSaving, setIsSaving] = useState(false)
  
  // Quantity dialog states
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false)
  const [quantityCount, setQuantityCount] = useState(1)
  const [customName, setCustomName] = useState('')

  const stateConfig = STATE_CONFIGS[state]
  const StateIcon = stateConfig.icon
  const hasNotes = notes && notes.trim().length > 0

  const handleVisibilityToggle = async () => {
    if (!onVisibilityChange || disabled) return

    const newVisibility: FFEItemVisibility = visibility === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE'
    
    // If making visible and onQuantityInclude is available, show quantity dialog
    if (newVisibility === 'VISIBLE' && onQuantityInclude && mode === 'settings') {
      setIsQuantityDialogOpen(true)
      return
    }
    
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

  const handleQuantityInclude = async () => {
    if (!onQuantityInclude || disabled || quantityCount < 1) return

    try {
      setIsSaving(true)
      await onQuantityInclude(id, quantityCount, customName.trim() || undefined)
      setIsQuantityDialogOpen(false)
      setQuantityCount(1)
      setCustomName('')
      toast.success(`${quantityCount} ${name} items included in workspace`)
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

    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
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
            <Eye className="w-3 h-3 mr-1" />
            Included in Workspace
          </Badge>
        ) : (
          <Badge variant="outline" className="text-gray-600">
            <EyeOff className="w-3 h-3 mr-1" />
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
          <Button
            variant="default"
            size="sm"
            onClick={handleVisibilityToggle}
            disabled={disabled}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Eye className="w-4 h-4 mr-1" />
            Include
          </Button>
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
      "item-row group relative",
      // Settings mode styling
      mode === 'settings' && {
        "bg-green-50/30 border-l-4 border-l-green-400": visibility === 'VISIBLE',
        "hover:bg-gray-50/50": visibility === 'HIDDEN'
      },
      // Workspace mode styling  
      mode === 'workspace' && {
        "bg-green-50/30 border-l-4 border-l-green-400": state === 'COMPLETED',
        "bg-blue-50/30 border-l-4 border-l-blue-400": state === 'PENDING',
        "hover:bg-gray-50/50": state === 'UNDECIDED'
      },
      disabled && "opacity-60 pointer-events-none"
    )}>
      {/* Left Column - State Icon */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "state-icon transition-all duration-200",
          state === 'COMPLETED' && "state-icon-completed",
          state === 'PENDING' && "state-icon-progress", 
          state === 'UNDECIDED' && "state-icon-pending"
        )}>
          <StateIcon className="h-4 w-4" />
        </div>
        
        {/* Drag Handle (future feature) */}
        <div className="opacity-0 group-hover:opacity-30 transition-opacity cursor-move">
          <div className="flex flex-col gap-0.5">
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          </div>
        </div>
      </div>
      
      {/* Middle Column - Item Meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900 truncate text-sm">{name}</h4>
              
              {/* Compact badges */}
              <div className="flex items-center gap-1">
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
                {isCustom && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
                    Custom
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
              <p className="text-xs text-gray-600 line-clamp-2 mb-1">
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
      <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {mode === 'settings' ? (
          <>
            {visibility === 'VISIBLE' ? (
              <button
                onClick={handleVisibilityToggle}
                disabled={disabled}
                className="btn-ghost p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Remove from workspace"
              >
                <EyeOff className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleVisibilityToggle}
                disabled={disabled}
                className="btn-ghost p-2 text-green-600 hover:bg-green-50 rounded-lg"
                title="Include in workspace"
              >
                <Eye className="h-4 w-4" />
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
      </div>
    </div>
    
    {/* Modern Quantity Dialog - only show in settings mode */}
    {mode === 'settings' && onQuantityInclude && (
      <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
        <DialogContent className="max-w-lg animate-slide-in-right">
          <DialogHeader className="pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-xl">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Include in Workspace
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Adding "{name}" to the workspace
                </p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-6">
            <div className="relative">
              <input
                id="quantity"
                type="number"
                min={1}
                max={50}
                value={quantityCount}
                onChange={(e) => setQuantityCount(parseInt(e.target.value) || 1)}
                placeholder=" "
                className="floating-input peer"
                required
              />
              <label htmlFor="quantity" className="floating-label peer-focus:text-green-600">
                Quantity *
              </label>
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  How many of this item do you need?
                </p>
              </div>
            </div>
            
            <div className="relative">
              <input
                id="custom-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder=" "
                className="floating-input peer"
              />
              <label htmlFor="custom-name" className="floating-label peer-focus:text-green-600">
                Custom Name (Optional)
              </label>
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  Example: "{name} (Kitchen)", "{name} (Bathroom)"
                </p>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <Eye className="h-4 w-4" />
                <span className="font-medium text-sm">Preview</span>
              </div>
              <p className="text-xs text-green-700">
                {quantityCount} × {customName.trim() || name} will be added to the workspace
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 justify-end pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setIsQuantityDialogOpen(false)
                setQuantityCount(1)
                setCustomName('')
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleQuantityInclude}
              disabled={isSaving || quantityCount < 1}
              className="btn-primary disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Including...</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Include {quantityCount > 1 ? `${quantityCount} Items` : 'Item'}</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
