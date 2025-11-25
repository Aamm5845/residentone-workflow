'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Edit2, 
  Trash2, 
  Eye,
  MoreHorizontal,
  Archive,
  Copy,
  ExternalLink,
  Tag,
  DollarSign,
  Clock,
  Users
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface FFEItem {
  id: string
  name: string
  description?: string
  category: string
  level: 'base' | 'standard' | 'custom' | 'conditional'
  scope: 'global' | 'room_specific'
  defaultState: 'pending' | 'confirmed' | 'not_needed' | 'custom_expanded'
  isRequired: boolean
  supportsMultiChoice: boolean
  roomTypes: string[]
  excludeFromRoomTypes?: string[]
  subItems?: any[]
  version: string
  isActive: boolean
  deprecatedAt?: string | null
  notes?: string
  tags?: string[]
  estimatedCost?: number
  leadTimeWeeks?: number
  createdAt: string | Date
  updatedAt: string | Date
  createdBy?: { name: string }
  updatedBy?: { name: string }
  isCustom?: boolean
}

interface ItemCardProps {
  item: FFEItem
  onEdit?: (item: FFEItem) => void
  onDelete?: (item: FFEItem) => void
  onDuplicate?: (item: FFEItem) => void
  onDeprecate?: (item: FFEItem) => void
  onActivate?: (item: FFEItem) => void
  onViewHistory?: (item: FFEItem) => void
  showActions?: boolean
}

const LEVEL_COLORS = {
  base: 'bg-blue-100 text-blue-800',
  standard: 'bg-green-100 text-green-800', 
  custom: 'bg-purple-100 text-purple-800',
  conditional: 'bg-orange-100 text-orange-800'
}

const SCOPE_COLORS = {
  global: 'bg-emerald-100 text-emerald-800',
  room_specific: 'bg-cyan-100 text-cyan-800'
}

export default function ItemCard({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  onDeprecate,
  onActivate,
  onViewHistory,
  showActions = true
}: ItemCardProps) {

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatPrice = (price?: number) => {
    if (!price) return null
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  const getRoomTypeText = (roomTypes: string[]) => {
    if (!roomTypes || roomTypes.length === 0) return 'No rooms specified'
    if (roomTypes.length === 1) return roomTypes[0].replace('-', ' ')
    if (roomTypes.length <= 3) return roomTypes.map(rt => rt.replace('-', ' ')).join(', ')
    return `${roomTypes.slice(0, 2).map(rt => rt.replace('-', ' ')).join(', ')} +${roomTypes.length - 2} more`
  }

  return (
    <Card className={cn(
      'group hover:shadow-md transition-all duration-200',
      !item.isActive && 'opacity-60 border-dashed'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{item.name}</h3>
              {item.isCustom && (
                <Badge variant="outline" className="text-xs">
                  Custom
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1 mb-2">
              <Badge 
                variant="secondary" 
                className={cn('text-xs', LEVEL_COLORS[item.level])}
              >
                {item.level}
              </Badge>
              
              <Badge 
                variant="secondary" 
                className={cn('text-xs', SCOPE_COLORS[item.scope])}
              >
                {item.scope === 'global' ? 'Global' : 'Room Specific'}
              </Badge>
              
              {item.isRequired && (
                <Badge variant="destructive" className="text-xs">
                  Required
                </Badge>
              )}
              
              {!item.isActive && (
                <Badge variant="outline" className="text-xs text-gray-500">
                  Deprecated
                </Badge>
              )}
            </div>
          </div>
          
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Item
                  </DropdownMenuItem>
                )}
                
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(item)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                
                {onViewHistory && (
                  <DropdownMenuItem onClick={() => onViewHistory(item)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View History
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                {item.isActive && onDeprecate && (
                  <DropdownMenuItem onClick={() => onDeprecate(item)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Deprecate
                  </DropdownMenuItem>
                )}
                
                {!item.isActive && onActivate && (
                  <DropdownMenuItem onClick={() => onActivate(item)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Reactivate
                  </DropdownMenuItem>
                )}
                
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete(item)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Description */}
        {item.description && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2">
            {item.description}
          </p>
        )}
        
        {/* Room Types */}
        {item.scope === 'room_specific' && item.roomTypes && item.roomTypes.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <Users className="h-3 w-3 text-gray-400" />
              <span className="text-xs font-medium text-gray-700">Room Types</span>
            </div>
            <p className="text-xs text-gray-600 capitalize">
              {getRoomTypeText(item.roomTypes)}
            </p>
          </div>
        )}
        
        {/* Sub Items */}
        {item.level === 'custom' && item.subItems && item.subItems.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <Tag className="h-3 w-3 text-gray-400" />
              <span className="text-xs font-medium text-gray-700">Sub Items</span>
            </div>
            <p className="text-xs text-gray-600">
              {item.subItems.length} sub-item{item.subItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        
        {/* Pricing & Lead Time */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          {item.estimatedCost && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <DollarSign className="h-3 w-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-700">Cost</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">
                {formatPrice(item.estimatedCost)}
              </p>
            </div>
          )}
          
          {item.leadTimeWeeks && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-700">Lead Time</span>
              </div>
              <p className="text-xs text-gray-600">
                {item.leadTimeWeeks} week{item.leadTimeWeeks !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
        
        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
          <div>
            Version {item.version}
          </div>
          <div>
            Updated {formatDate(item.updatedAt)}
          </div>
        </div>
        
        {/* Created/Updated By */}
        {(item.createdBy || item.updatedBy) && (
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
            {item.createdBy && (
              <span>By {item.createdBy.name}</span>
            )}
            {item.deprecatedAt && (
              <span>Deprecated {formatDate(item.deprecatedAt)}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
