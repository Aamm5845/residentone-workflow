'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Save } from 'lucide-react'

interface FFESubItem {
  id: string
  name: string
  defaultState: 'pending' | 'confirmed' | 'not_needed' | 'custom_expanded'
  isRequired: boolean
  order: number
}

interface FFEItemFormData {
  name: string
  description?: string
  category: string
  level: 'base' | 'standard' | 'custom' | 'conditional'
  scope: 'global' | 'room_specific'
  defaultState: 'pending' | 'confirmed' | 'not_needed' | 'custom_expanded'
  isRequired: boolean
  supportsMultiChoice: boolean
  roomTypes: string[]
  excludeFromRoomTypes: string[]
  subItems: FFESubItem[]
  conditionalOn: string[]
  mutuallyExclusiveWith: string[]
  notes?: string
  tags: string[]
  estimatedCost?: number
  leadTimeWeeks?: number
  supplierInfo: Array<{
    name: string
    website?: string
    notes?: string
  }>
}

interface FFEItemFormProps {
  formData: FFEItemFormData
  setFormData: (data: FFEItemFormData) => void
  onSave: () => void
  onCancel: () => void
  availableItems?: any[]
  categories?: any[]
}

const ROOM_TYPE_OPTIONS = [
  { value: 'living-room', label: 'Living Room' },
  { value: 'master-bedroom', label: 'Master Bedroom' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'dining-room', label: 'Dining Room' },
  { value: 'office', label: 'Office' },
  { value: 'guest-room', label: 'Guest Room' },
  { value: 'family-room', label: 'Family Room' },
  { value: 'foyer', label: 'Foyer' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'laundry', label: 'Laundry Room' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'mudroom', label: 'Mudroom' },
  { value: 'closet', label: 'Closet' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'other', label: 'Other' }
]

const ITEM_LEVELS = [
  { value: 'base', label: 'Base Level', description: 'Simple checkbox item' },
  { value: 'standard', label: 'Standard vs Custom', description: 'Choose between standard or custom options' },
  { value: 'custom', label: 'Custom Level', description: 'Expands to show sub-items when selected' },
  { value: 'conditional', label: 'Conditional', description: 'Appears based on other selections' }
]

export default function FFEItemForm({ 
  formData, 
  setFormData, 
  onSave, 
  onCancel, 
  categories = [] 
}: FFEItemFormProps) {
  
  const updateField = (field: keyof FFEItemFormData, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const toggleRoomType = (roomType: string) => {
    const currentRoomTypes = formData.roomTypes || []
    if (currentRoomTypes.includes(roomType)) {
      updateField('roomTypes', currentRoomTypes.filter(rt => rt !== roomType))
    } else {
      updateField('roomTypes', [...currentRoomTypes, roomType])
    }
  }

  const addSubItem = () => {
    const newSubItem: FFESubItem = {
      id: `sub-${Date.now()}`,
      name: '',
      defaultState: 'pending',
      isRequired: false,
      order: formData.subItems.length
    }
    updateField('subItems', [...formData.subItems, newSubItem])
  }

  const updateSubItem = (index: number, field: keyof FFESubItem, value: any) => {
    const updatedSubItems = formData.subItems.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    )
    updateField('subItems', updatedSubItems)
  }

  const removeSubItem = (index: number) => {
    updateField('subItems', formData.subItems.filter((_, i) => i !== index))
  }

  const addSupplier = () => {
    updateField('supplierInfo', [...formData.supplierInfo, { name: '', website: '', notes: '' }])
  }

  const updateSupplier = (index: number, field: string, value: string) => {
    const updatedSuppliers = formData.supplierInfo.map((supplier, i) => 
      i === index ? { ...supplier, [field]: value } : supplier
    )
    updateField('supplierInfo', updatedSuppliers)
  }

  const removeSupplier = (index: number) => {
    updateField('supplierInfo', formData.supplierInfo.filter((_, i) => i !== index))
  }

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      updateField('tags', [...formData.tags, tag])
    }
  }

  const removeTag = (tag: string) => {
    updateField('tags', formData.tags.filter(t => t !== tag))
  }

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Basic Information</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Custom Sectional Sofa"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => updateField('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Detailed description of the FFE item..."
            rows={3}
          />
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Configuration</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="level">Item Level</Label>
            <Select value={formData.level} onValueChange={(value: any) => updateField('level', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {ITEM_LEVELS.map(level => (
                  <SelectItem key={level.value} value={level.value}>
                    <div>
                      <div className="font-medium">{level.label}</div>
                      <div className="text-xs text-gray-500">{level.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="scope">Scope</Label>
            <Select value={formData.scope} onValueChange={(value: any) => updateField('scope', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global - All room types</SelectItem>
                <SelectItem value="room_specific">Room Specific - Selected rooms only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="required"
              checked={formData.isRequired}
              onCheckedChange={(checked) => updateField('isRequired', Boolean(checked))}
            />
            <Label htmlFor="required">Required Item</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="multiChoice"
              checked={formData.supportsMultiChoice}
              onCheckedChange={(checked) => updateField('supportsMultiChoice', Boolean(checked))}
            />
            <Label htmlFor="multiChoice">Supports Multiple Choice</Label>
          </div>
        </div>
      </div>

      {/* Room Types */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Room Types</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {ROOM_TYPE_OPTIONS.map(roomType => (
            <div key={roomType.value} className="flex items-center space-x-2">
              <Checkbox 
                id={`room-${roomType.value}`}
                checked={formData.roomTypes.includes(roomType.value)}
                onCheckedChange={() => toggleRoomType(roomType.value)}
              />
              <Label htmlFor={`room-${roomType.value}`} className="text-sm">
                {roomType.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Sub Items (for custom level) */}
      {formData.level === 'custom' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">Sub Items</h4>
            <Button type="button" variant="outline" size="sm" onClick={addSubItem}>
              <Plus className="w-4 h-4 mr-2" />
              Add Sub Item
            </Button>
          </div>
          
          {formData.subItems.map((subItem, index) => (
            <div key={subItem.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium">Sub Item {index + 1}</h5>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => removeSubItem(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={subItem.name}
                    onChange={(e) => updateSubItem(index, 'name', e.target.value)}
                    placeholder="Sub item name"
                  />
                </div>
                
                <div>
                  <Label>Default State</Label>
                  <Select 
                    value={subItem.defaultState} 
                    onValueChange={(value: any) => updateSubItem(index, 'defaultState', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="not_needed">Not Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  checked={subItem.isRequired}
                  onCheckedChange={(checked) => updateSubItem(index, 'isRequired', Boolean(checked))}
                />
                <Label>Required sub item</Label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pricing & Lead Time */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Pricing & Lead Time</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cost">Estimated Cost</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              value={formData.estimatedCost || ''}
              onChange={(e) => updateField('estimatedCost', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
            />
          </div>
          
          <div>
            <Label htmlFor="leadTime">Lead Time (weeks)</Label>
            <Input
              id="leadTime"
              type="number"
              value={formData.leadTimeWeeks || ''}
              onChange={(e) => updateField('leadTimeWeeks', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Supplier Information */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">Supplier Information</h4>
          <Button type="button" variant="outline" size="sm" onClick={addSupplier}>
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>
        
        {formData.supplierInfo.map((supplier, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium">Supplier {index + 1}</h5>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={() => removeSupplier(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Supplier Name</Label>
                <Input
                  value={supplier.name}
                  onChange={(e) => updateSupplier(index, 'name', e.target.value)}
                  placeholder="Supplier name"
                />
              </div>
              
              <div>
                <Label>Website</Label>
                <Input
                  type="url"
                  value={supplier.website || ''}
                  onChange={(e) => updateSupplier(index, 'website', e.target.value)}
                  placeholder="https://supplier.com"
                />
              </div>
            </div>
            
            <div>
              <Label>Notes</Label>
              <Input
                value={supplier.notes || ''}
                onChange={(e) => updateSupplier(index, 'notes', e.target.value)}
                placeholder="Additional notes about this supplier"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Tags</h4>
        <div className="flex flex-wrap gap-2">
          {formData.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => removeTag(tag)}
              />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a tag..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const target = e.target as HTMLInputElement
                addTag(target.value)
                target.value = ''
              }
            }}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Additional Notes</h4>
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Any additional notes or specifications..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Item
        </Button>
      </div>
    </div>
  )
}
