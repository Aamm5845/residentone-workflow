'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Edit2, Trash2, Search, Filter, Building2, Sofa, Lightbulb, Palette, Wrench, ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface FFELibraryItem {
  id: string
  itemId: string
  name: string
  category: string
  roomTypes: string[]
  isRequired: boolean
  isStandard: boolean
  notes?: string
  addedFromProject?: {
    id: string
    name: string
  }
  createdBy: {
    name: string
  }
  createdAt: string
}

interface FFELibraryManagementProps {
  orgId: string
  user: any
}

const CATEGORY_ICONS = {
  'base-finishes': Building2,
  'furniture': Sofa,
  'lighting': Lightbulb,
  'textiles': Palette,
  'accessories': Palette,
  'plumbing': Wrench,
  'appliances': ChefHat
}

const CATEGORY_LABELS = {
  'base-finishes': 'Base Finishes',
  'furniture': 'Furniture',
  'lighting': 'Lighting',
  'textiles': 'Textiles',
  'accessories': 'Accessories',
  'plumbing': 'Plumbing',
  'appliances': 'Appliances'
}

const ROOM_TYPE_LABELS = {
  'living-room': 'Living Room',
  'bedroom': 'Bedroom',
  'kitchen': 'Kitchen',
  'bathroom': 'Bathroom',
  'dining-room': 'Dining Room',
  'office': 'Office',
  'guest-room': 'Guest Room'
}

export default function FFELibraryManagement({ orgId, user }: FFELibraryManagementProps) {
  const [items, setItems] = useState<FFELibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<FFELibraryItem | null>(null)

  // Form state for add/edit
  const [formData, setFormData] = useState({
    itemId: '',
    name: '',
    category: 'furniture',
    roomTypes: [] as string[],
    isRequired: false,
    isStandard: true,
    notes: ''
  })

  // Load FFE library items
  const loadItems = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe/library?orgId=${orgId}&category=${selectedCategory !== 'all' ? selectedCategory : ''}&roomType=${selectedRoomType !== 'all' ? selectedRoomType : ''}&search=${searchTerm}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
      } else {
        toast.error('Failed to load FFE library')
      }
    } catch (error) {
      console.error('Error loading FFE library:', error)
      toast.error('Failed to load FFE library')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [orgId, selectedCategory, selectedRoomType, searchTerm])

  const handleAddItem = async () => {
    try {
      if (!formData.name || !formData.itemId || formData.roomTypes.length === 0) {
        toast.error('Please fill in all required fields')
        return
      }

      const response = await fetch('/api/ffe/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          ...formData
        })
      })

      if (response.ok) {
        toast.success('FFE item added to library')
        setShowAddDialog(false)
        resetForm()
        loadItems()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add item')
      }
    } catch (error) {
      toast.error('Failed to add item')
    }
  }

  const handleEditItem = async () => {
    try {
      if (!editingItem) return

      const response = await fetch(`/api/ffe/library/${editingItem.itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          ...formData
        })
      })

      if (response.ok) {
        toast.success('FFE item updated')
        setShowEditDialog(false)
        setEditingItem(null)
        resetForm()
        loadItems()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update item')
      }
    } catch (error) {
      toast.error('Failed to update item')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item from the library?')) {
      return
    }

    try {
      const response = await fetch(`/api/ffe/library/${itemId}?orgId=${orgId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('FFE item deleted')
        loadItems()
      } else {
        toast.error('Failed to delete item')
      }
    } catch (error) {
      toast.error('Failed to delete item')
    }
  }

  const resetForm = () => {
    setFormData({
      itemId: '',
      name: '',
      category: 'furniture',
      roomTypes: [],
      isRequired: false,
      isStandard: true,
      notes: ''
    })
  }

  const openEditDialog = (item: FFELibraryItem) => {
    setEditingItem(item)
    setFormData({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      roomTypes: item.roomTypes,
      isRequired: item.isRequired,
      isStandard: item.isStandard,
      notes: item.notes || ''
    })
    setShowEditDialog(true)
  }

  const filteredItems = items.filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false
    }
    if (selectedRoomType !== 'all' && !item.roomTypes.includes(selectedRoomType)) {
      return false
    }
    return true
  })

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">FFE Library Management</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Manage your organization's custom FFE items that appear in all projects
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add FFE Library Item</DialogTitle>
              </DialogHeader>
              <FFEItemForm
                formData={formData}
                setFormData={setFormData}
                onSave={handleAddItem}
                onCancel={() => {
                  setShowAddDialog(false)
                  resetForm()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Room Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Room Types</SelectItem>
              {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div className="flex space-x-2">
                    <div className="h-5 bg-gray-200 rounded w-16"></div>
                    <div className="h-5 bg-gray-200 rounded w-20"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No FFE items found</p>
            <p className="text-sm mt-1">
              {searchTerm || selectedCategory !== 'all' || selectedRoomType !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Add your first custom FFE item to get started'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => {
              const CategoryIcon = CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS] || Building2
              
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <CategoryIcon className="h-5 w-5 text-gray-600" />
                        <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteItem(item.itemId)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] || item.category}
                        </Badge>
                        {item.isRequired && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                        {!item.isStandard && (
                          <Badge variant="secondary" className="text-xs">Custom</Badge>
                        )}
                      </div>

                      <div className="text-xs text-gray-600">
                        <p>Room types: {item.roomTypes.map(type => 
                          ROOM_TYPE_LABELS[type as keyof typeof ROOM_TYPE_LABELS] || type
                        ).join(', ')}</p>
                        <p className="mt-1">Added by {item.createdBy.name}</p>
                        {item.addedFromProject && (
                          <p>From project: {item.addedFromProject.name}</p>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-gray-500 line-clamp-2">{item.notes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit FFE Library Item</DialogTitle>
            </DialogHeader>
            <FFEItemForm
              formData={formData}
              setFormData={setFormData}
              onSave={handleEditItem}
              onCancel={() => {
                setShowEditDialog(false)
                setEditingItem(null)
                resetForm()
              }}
              isEditing={true}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// Form component for add/edit
function FFEItemForm({
  formData,
  setFormData,
  onSave,
  onCancel,
  isEditing = false
}: {
  formData: any
  setFormData: (data: any) => void
  onSave: () => void
  onCancel: () => void
  isEditing?: boolean
}) {
  const updateFormData = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const toggleRoomType = (roomType: string) => {
    const newRoomTypes = formData.roomTypes.includes(roomType)
      ? formData.roomTypes.filter((type: string) => type !== roomType)
      : [...formData.roomTypes, roomType]
    updateFormData('roomTypes', newRoomTypes)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Item ID *</label>
          <Input
            placeholder="e.g., custom-dining-chair"
            value={formData.itemId}
            onChange={(e) => updateFormData('itemId', e.target.value)}
            disabled={isEditing}
          />
          <p className="text-xs text-gray-500 mt-1">Unique identifier for this item</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <Input
            placeholder="e.g., Custom Dining Chair"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Category *</label>
        <Select value={formData.category} onValueChange={(value) => updateFormData('category', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Applicable Room Types *</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                checked={formData.roomTypes.includes(key)}
                onCheckedChange={() => toggleRoomType(key)}
              />
              <label className="text-sm">{label}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={formData.isRequired}
            onCheckedChange={(checked) => updateFormData('isRequired', checked)}
          />
          <label className="text-sm">Required item</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={formData.isStandard}
            onCheckedChange={(checked) => updateFormData('isStandard', checked)}
          />
          <label className="text-sm">Standard item (simple checkbox)</label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <Textarea
          placeholder="Additional notes about this item..."
          value={formData.notes}
          onChange={(e) => updateFormData('notes', e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          {isEditing ? 'Update' : 'Add'} Item
        </Button>
      </div>
    </div>
  )
}