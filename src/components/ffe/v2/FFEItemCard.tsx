'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { 
  Circle, 
  CheckCircle2, 
  Clock,
  HelpCircle,
  StickyNote,
  MoreVertical,
  Save,
  X,
  Trash2,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FFEItemState } from '@prisma/client'

// Simplified FFE item states - only 3 states needed
type SimplifiedFFEItemState = 'UNDECIDED' | 'COMPLETED' | 'NOT_NEEDED'

interface FFEItem {
  id: string
  name: string
  description?: string
  state: SimplifiedFFEItemState
  notes?: string
  isRequired: boolean
  order: number
  quantity?: number
  estimatedCost?: number
}

interface FFEItemCardProps {
  item: FFEItem
  onStateChange: (itemId: string, newState: SimplifiedFFEItemState, notes?: string) => Promise<void>
  onDelete?: (itemId: string) => Promise<void>
  disabled?: boolean
}

const STATE_CONFIG = {
  UNDECIDED: {
    label: 'Undecided',
    icon: HelpCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    description: 'Decision pending'
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    description: 'Fully complete'
  },
  NOT_NEEDED: {
    label: 'Not Needed',
    icon: X,
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Not required'
  }
}

export default function FFEItemCard({ 
  item, 
  onStateChange, 
  onDelete, 
  disabled = false 
}: FFEItemCardProps) {
  const [showNotesDialog, setShowNotesDialog] = useState(false)
  const [notes, setNotes] = useState(item.notes || '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  
  const stateConfig = STATE_CONFIG[item.state]
  const StateIcon = stateConfig.icon
  
  // Handle state change
  const handleStateChange = async (newState: SimplifiedFFEItemState) => {
    if (disabled || isUpdating) return
    
    setIsUpdating(true)
    try {
      await onStateChange(item.id, newState, notes)
    } catch (error) {
      console.error('Failed to update item state:', error)
    } finally {
      setIsUpdating(false)
    }
  }
  
  // Handle notes save
  const handleNotesClick = () => {
    setNotes(item.notes || '')
    setShowNotesDialog(true)
  }
  
  const handleSaveNotes = async () => {
    setIsUpdating(true)
    try {
      await onStateChange(item.id, item.state, notes)
      setShowNotesDialog(false)
    } catch (error) {
      console.error('Failed to update notes:', error)
    } finally {
      setIsUpdating(false)
    }
  }
  
  // Handle delete
  const handleDelete = async () => {
    if (!onDelete || disabled) return
    
    if (confirm(`Delete "${item.name}"?`)) {
      setIsUpdating(true)
      try {
        await onDelete(item.id)
      } catch (error) {
        console.error('Failed to delete item:', error)
      } finally {
        setIsUpdating(false)
      }
    }
  }
  
  return (
    <>
      <div className={cn(
        "p-4 rounded-lg border transition-all duration-200",
        stateConfig.bgColor,
        stateConfig.borderColor,
        disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-start gap-3">
              {/* State Icon */}
              <div className="flex-shrink-0 mt-1">
                <StateIcon className={cn("h-5 w-5", stateConfig.color)} />
              </div>
              
              <div className="flex-1">
                {/* Item Name */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={cn(
                      "font-medium",
                      item.state === 'NOT_NEEDED' ? "line-through text-gray-500" : "text-gray-900"
                    )}>
                      {item.name}
                      {item.isRequired && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                      {item.quantity && item.quantity > 1 && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Qty: {item.quantity}
                        </Badge>
                      )}
                    </h4>
                    {item.description && (
                      <button 
                        onClick={() => setShowDescription(!showDescription)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-0.5"
                      >
                        <Info className="w-3 h-3" />
                        {showDescription ? 'Hide details' : 'Show details'}
                      </button>
                    )}
                    {item.description && showDescription && (
                      <p className="text-xs text-gray-500 mt-1 pl-3 border-l-2 border-gray-200">{item.description}</p>
                    )}
                  </div>
                  
                  {/* Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled={disabled}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onDelete && (
                        <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* State Badge */}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    stateConfig.color,
                    stateConfig.bgColor
                  )}>
                    {stateConfig.label}
                  </Badge>
                  
                  {/* Notes Indicator */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNotesClick}
                    disabled={disabled}
                    className={cn(
                      "h-6 px-2 text-xs",
                      item.notes ? "text-blue-600 bg-blue-50" : "text-gray-400"
                    )}
                  >
                    <StickyNote className="h-3 w-3 mr-1" />
                    Notes
                  </Button>
                </div>
                
                {/* Cost */}
                {item.estimatedCost && (
                  <div className="text-sm text-gray-500 mt-1">
                    Est. ${item.estimatedCost.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Simple State Actions - Just 3 buttons */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={item.state === 'COMPLETED' ? "default" : "outline"}
              onClick={() => handleStateChange('COMPLETED')}
              disabled={disabled || isUpdating || item.state === 'COMPLETED'}
              className={cn(
                "h-8 px-3 text-sm",
                item.state === 'COMPLETED' ? "bg-green-600 text-white" : "text-green-600 border-green-300 hover:bg-green-50"
              )}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Completed
            </Button>
            
            <Button
              size="sm"
              variant={item.state === 'UNDECIDED' ? "default" : "outline"}
              onClick={() => handleStateChange('UNDECIDED')}
              disabled={disabled || isUpdating || item.state === 'UNDECIDED'}
              className={cn(
                "h-8 px-3 text-sm",
                item.state === 'UNDECIDED' ? "bg-gray-600 text-white" : "text-gray-600 border-gray-300 hover:bg-gray-50"
              )}
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              Undecided
            </Button>
          </div>
          
          {/* Add Note Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleNotesClick}
            disabled={disabled}
            className={cn(
              "h-8 px-3 text-sm",
              item.notes ? "text-blue-600 bg-blue-50 border-blue-300" : "text-gray-500 border-gray-300 hover:bg-gray-50"
            )}
          >
            <StickyNote className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Notes: {item.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes, specifications, or decisions about this item..."
                rows={6}
                className="resize-none"
              />
            </div>
            
            <div className="text-sm text-gray-500">
              Notes are saved automatically and visible to all team members working on this room.
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowNotesDialog(false)
                  setNotes(item.notes || '')
                }}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveNotes}
                disabled={isUpdating}
              >
                <Save className="h-4 w-4 mr-2" />
                {isUpdating ? 'Saving...' : 'Save Notes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
