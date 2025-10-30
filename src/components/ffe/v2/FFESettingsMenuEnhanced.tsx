'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Import, 
  Plus,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  Loader2,
  Package
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface LinkedItemDisplayProps {
  item: any
  isSelected: boolean
  onToggle: () => void
}

function LinkedItemDisplay({ item, isSelected, onToggle }: LinkedItemDisplayProps) {
  const [showLinked, setShowLinked] = useState(false)
  const hasLinkedItems = item.customFields?.linkedItems && 
                          Array.isArray(item.customFields.linkedItems) && 
                          item.customFields.linkedItems.length > 0

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3 p-2 rounded border hover:bg-gray-50">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          className="mt-1"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {hasLinkedItems && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-transparent"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLinked(!showLinked)
                }}
              >
                {showLinked ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                )}
              </Button>
            )}
            <span className="font-medium">{item.name}</span>
            {item.isRequired && (
              <Badge variant="destructive" className="text-xs h-5">Required</Badge>
            )}
            {hasLinkedItems && (
              <Badge variant="outline" className="text-xs h-5 bg-blue-50 text-blue-700">
                +{item.customFields.linkedItems.length} linked
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
          )}
        </div>
      </div>
      
      {/* Collapsed Linked Items */}
      {hasLinkedItems && showLinked && (
        <div className="ml-10 pl-4 border-l-2 border-blue-200 space-y-1">
          {item.customFields.linkedItems.map((linkedItemName: string, idx: number) => (
            <div key={idx} className="flex items-center gap-2 p-2 text-sm bg-blue-50 rounded border border-blue-200">
              <Package className="h-3 w-3 text-blue-600" />
              <span className="text-gray-700 flex-1">{linkedItemName}</span>
              <Badge variant="secondary" className="text-xs">Auto-linked</Badge>
            </div>
          ))}
          <div className="text-xs text-gray-500 italic mt-2 pl-2">
            💡 These {item.customFields.linkedItems.length} items will be automatically added to the workspace when "{item.name}" is selected
          </div>
        </div>
      )}
    </div>
  )
}

export { LinkedItemDisplay }
