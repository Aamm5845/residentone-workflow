'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { 
  Eye, 
  EyeOff, 
  Clock, 
  CheckCircle, 
  HelpCircle,
  FileText,
  Save
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
  onDelete
}: FFEItemCardProps) {
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [notesText, setNotesText] = useState(notes || '')
  const [isSaving, setIsSaving] = useState(false)

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
          ? 'Item added to workspace' 
          : 'Item removed from workspace'
      )
    } catch (error) {
      toast.error('Failed to update item visibility')
      console.error('Visibility update error:', error)
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

  const renderSettingsControls = () => (
    <div className="flex items-center space-x-2">
      {/* Visibility Toggle */}
      <Button
        variant={visibility === 'VISIBLE' ? 'default' : 'outline'}
        size="sm"
        onClick={handleVisibilityToggle}
        disabled={disabled}
        className={cn(
          "transition-all duration-200",
          visibility === 'VISIBLE' 
            ? "bg-green-600 hover:bg-green-700 text-white" 
            : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
        )}
      >
        {visibility === 'VISIBLE' ? (
          <>
            <Eye className="w-4 h-4 mr-1" />
            Use
          </>
        ) : (
          <>
            <EyeOff className="w-4 h-4 mr-1" />
            Hidden
          </>
        )}
      </Button>

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
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      mode === 'settings' && visibility === 'HIDDEN' && "opacity-60",
      state === 'COMPLETED' && mode === 'workspace' && "bg-green-50 border-green-200"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Item Info */}
            <div className="flex items-center space-x-2 mb-2">
              <h4 className="font-medium text-gray-900 truncate">{name}</h4>
              {quantity > 1 && (
                <Badge variant="secondary" className="text-xs">
                  Qty: {quantity}
                </Badge>
              )}
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {description}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>Section: {sectionName}</span>
              {isRequired && (
                <Badge variant="destructive" className="text-xs">
                  Required
                </Badge>
              )}
              {isCustom && (
                <Badge variant="outline" className="text-xs">
                  Custom
                </Badge>
              )}
              {hasNotes && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  Has Notes
                </Badge>
              )}
            </div>
          </div>

          {/* State Badge */}
          <div className="flex items-center space-x-2 ml-4">
            <Badge className={cn("flex items-center space-x-1", stateConfig.color)}>
              <StateIcon className="w-3 h-3" />
              <span>{stateConfig.label}</span>
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 pt-3 border-t">
          {mode === 'settings' ? renderSettingsControls() : renderWorkspaceControls()}
        </div>
      </CardContent>
    </Card>
  )
}