'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Settings,
  Building2,
  Palette,
  Lightbulb,
  Wrench,
  Home,
  Sofa,
  ChefHat,
  Save,
  X,
  Users,
  Copy
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { BATHROOM_TEMPLATE } from '@/lib/ffe/bathroom-template'

interface RoomLibraryItem {
  id: string
  name: string
  category: string
  isRequired: boolean
  allowMultiple: boolean
  options?: string[]
  specialLogic?: {
    type: 'toilet' | 'vanity'
    standardTasks: number
    customTasks: number
    customSubItems: string[]
  }
  order: number
}

interface RoomLibrary {
  id: string
  name: string
  roomType: string
  description: string
  categories: {
    [categoryName: string]: RoomLibraryItem[]
  }
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

interface RoomBasedFFEManagementProps {
  orgId: string
  user: {
    id: string
    name: string
    role: string
  }
}

const ROOM_TYPES = [
  { value: 'BATHROOM', label: 'Bathroom', icon: Building2 },
  { value: 'KITCHEN', label: 'Kitchen', icon: ChefHat },
  { value: 'LIVING_ROOM', label: 'Living Room', icon: Sofa },
  { value: 'BEDROOM', label: 'Bedroom', icon: Home },
  { value: 'OFFICE', label: 'Office', icon: Building2 },
  { value: 'DINING_ROOM', label: 'Dining Room', icon: Sofa },
  { value: 'LAUNDRY_ROOM', label: 'Laundry Room', icon: Settings },
  { value: 'ENTRANCE', label: 'Entrance', icon: Home }
]

const DEFAULT_CATEGORIES = {
  BATHROOM: [
    'Flooring', 'Wall', 'Ceiling', 'Doors and Handles', 
    'Moulding', 'Lighting', 'Electric', 'Plumbing', 'Accessories'
  ],
  KITCHEN: [
    'Flooring', 'Wall', 'Ceiling', 'Cabinets', 'Countertops', 
    'Appliances', 'Lighting', 'Plumbing', 'Hardware'
  ],
  LIVING_ROOM: [
    'Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 
    'Textiles', 'Accessories', 'Entertainment'
  ],
  BEDROOM: [
    'Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 
    'Textiles', 'Storage', 'Accessories'
  ],
  OFFICE: [
    'Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 
    'Technology', 'Storage', 'Accessories'
  ],
  DINING_ROOM: [
    'Flooring', 'Wall', 'Ceiling', 'Furniture', 'Lighting', 
    'Textiles', 'Accessories', 'Storage'
  ],
  LAUNDRY_ROOM: [
    'Flooring', 'Wall', 'Ceiling', 'Appliances', 'Storage', 
    'Lighting', 'Plumbing', 'Electric'
  ],
  ENTRANCE: [
    'Flooring', 'Wall', 'Ceiling', 'Lighting', 'Storage', 
    'Accessories', 'Furniture'
  ]
}

const CATEGORY_ICONS = {
  'Flooring': Building2,
  'Wall': Palette,
  'Ceiling': Building2,
  'Doors and Handles': Wrench,
  'Moulding': Building2,
  'Lighting': Lightbulb,
  'Electric': Wrench,
  'Plumbing': Wrench,
  'Accessories': Settings,
  'Furniture': Sofa,
  'Cabinets': Building2,
  'Countertops': Building2,
  'Appliances': ChefHat,
  'Hardware': Wrench,
  'Textiles': Palette,
  'Entertainment': Settings,
  'Storage': Building2,
  'Technology': Settings
}

export default function RoomBasedFFEManagement({ orgId, user }: RoomBasedFFEManagementProps) {
  const [roomLibraries, setRoomLibraries] = useState<RoomLibrary[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [selectedLibrary, setSelectedLibrary] = useState<RoomLibrary | null>(null)
  const [editingItem, setEditingItem] = useState<RoomLibraryItem | null>(null)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showEditLibraryDialog, setShowEditLibraryDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Form states
  const [libraryForm, setLibraryForm] = useState({
    name: '',
    roomType: '',
    description: ''
  })

  const [itemForm, setItemForm] = useState({
    name: '',
    category: '',
    isRequired: false,
    allowMultiple: false,
    options: [] as string[],
    specialLogic: null as any
  })

  // Load room libraries
  const loadRoomLibraries = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe/room-libraries?orgId=${orgId}`)
      if (response.ok) {
        const data = await response.json()
        setRoomLibraries(data.libraries || [])
        
        // Load bathroom library by default if exists
        const bathroomLib = data.libraries?.find((lib: RoomLibrary) => lib.roomType === 'BATHROOM')
        if (bathroomLib) {
          setSelectedRoom('BATHROOM')
          setSelectedLibrary(bathroomLib)
        }
      } else {
        // Create default bathroom library if none exists
        await createDefaultBathroomLibrary()
      }
    } catch (error) {
      console.error('Error loading room libraries:', error)
      toast.error('Failed to load room libraries')
    } finally {
      setLoading(false)
    }
  }

  // Create default bathroom library
  const createDefaultBathroomLibrary = async () => {
    try {
      // Convert bathroom template to room library format
      const convertedCategories: { [key: string]: RoomLibraryItem[] } = {}
      
      Object.entries(BATHROOM_TEMPLATE.categories).forEach(([categoryName, items]) => {
        convertedCategories[categoryName] = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          isRequired: item.isRequired,
          allowMultiple: item.allowMultiple || false,
          options: item.options,
          specialLogic: item.specialLogic,
          order: item.order
        }))
      })

      const bathroomLibrary = {
        name: 'Bathroom Preset Library',
        roomType: 'BATHROOM',
        description: 'Standard bathroom FFE preset library with all essential categories',
        categories: convertedCategories,
        orgId
      }

      const response = await fetch('/api/ffe/room-libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bathroomLibrary)
      })

      if (response.ok) {
        toast.success('Created default bathroom library')
        loadRoomLibraries()
      }
    } catch (error) {
      console.error('Error creating default bathroom library:', error)
    }
  }

  useEffect(() => {
    loadRoomLibraries()
  }, [orgId])

  // Handle room selection
  const handleRoomSelect = (roomType: string) => {
    setSelectedRoom(roomType)
    const library = roomLibraries.find(lib => lib.roomType === roomType)
    setSelectedLibrary(library || null)
    
    if (!library) {
      // Create new library for this room type
      const roomLabel = roomType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
      setLibraryForm({
        name: `${roomLabel} Preset Library`,
        roomType,
        description: `Standard ${roomLabel.toLowerCase()} FFE preset library`
      })
      setShowEditLibraryDialog(true)
    }
  }

  // Save library
  const saveLibrary = async () => {
    try {
      const payload = {
        ...libraryForm,
        orgId,
        categories: selectedLibrary?.categories || createDefaultCategoriesForRoom(libraryForm.roomType)
      }

      const response = await fetch('/api/ffe/room-libraries', {
        method: selectedLibrary ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success(`Library ${selectedLibrary ? 'updated' : 'created'} successfully`)
        setShowEditLibraryDialog(false)
        loadRoomLibraries()
      } else {
        throw new Error('Failed to save library')
      }
    } catch (error) {
      toast.error('Failed to save library')
    }
  }

  // Add item to library
  const addItemToLibrary = async () => {
    try {
      if (!selectedLibrary) return

      const newItem: RoomLibraryItem = {
        id: `item_${Date.now()}`,
        name: itemForm.name,
        category: itemForm.category,
        isRequired: itemForm.isRequired,
        allowMultiple: itemForm.allowMultiple,
        options: itemForm.options.length > 0 ? itemForm.options : undefined,
        specialLogic: itemForm.specialLogic,
        order: (selectedLibrary.categories[itemForm.category]?.length || 0) + 1
      }

      const updatedLibrary = {
        ...selectedLibrary,
        categories: {
          ...selectedLibrary.categories,
          [itemForm.category]: [
            ...(selectedLibrary.categories[itemForm.category] || []),
            newItem
          ]
        }
      }

      const response = await fetch(`/api/ffe/room-libraries/${selectedLibrary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLibrary)
      })

      if (response.ok) {
        toast.success('Item added to library')
        setShowAddItemDialog(false)
        setItemForm({
          name: '',
          category: '',
          isRequired: false,
          allowMultiple: false,
          options: [],
          specialLogic: null
        })
        loadRoomLibraries()
      }
    } catch (error) {
      toast.error('Failed to add item')
    }
  }

  // Create default categories for room type
  const createDefaultCategoriesForRoom = (roomType: string) => {
    const categories: { [key: string]: RoomLibraryItem[] } = {}
    const categoryList = DEFAULT_CATEGORIES[roomType as keyof typeof DEFAULT_CATEGORIES] || DEFAULT_CATEGORIES.BATHROOM
    
    categoryList.forEach(categoryName => {
      categories[categoryName] = []
    })
    
    return categories
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">FFE Room Libraries</h2>
          <p className="text-gray-600">Manage preset libraries for each room type</p>
        </div>
        <Button 
          onClick={() => {
            setLibraryForm({ name: '', roomType: '', description: '' })
            setShowEditLibraryDialog(true)
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Room Library
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Room Selection */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Room Types</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {ROOM_TYPES.map((room) => {
                  const Icon = room.icon
                  const hasLibrary = roomLibraries.some(lib => lib.roomType === room.value)
                  
                  return (
                    <Button
                      key={room.value}
                      variant={selectedRoom === room.value ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => handleRoomSelect(room.value)}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {room.label}
                      {hasLibrary && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {roomLibraries.find(lib => lib.roomType === room.value)?.categories ? 
                            Object.values(roomLibraries.find(lib => lib.roomType === room.value)!.categories).flat().length : 0} items
                        </Badge>
                      )}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Library Content */}
        <div className="lg:col-span-3">
          {selectedLibrary ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedLibrary.name}</CardTitle>
                    <p className="text-sm text-gray-600">{selectedLibrary.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setLibraryForm({
                          name: selectedLibrary.name,
                          roomType: selectedLibrary.roomType,
                          description: selectedLibrary.description
                        })
                        setShowEditLibraryDialog(true)
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Library
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowAddItemDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Categories */}
              <div className="space-y-4">
                {Object.entries(selectedLibrary.categories).map(([categoryName, items]) => {
                  const CategoryIcon = CATEGORY_ICONS[categoryName as keyof typeof CATEGORY_ICONS] || Settings
                  
                  return (
                    <Card key={categoryName}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CategoryIcon className="w-5 h-5" />
                            <CardTitle className="text-lg">{categoryName}</CardTitle>
                            <Badge variant="outline">{items.length} items</Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setItemForm({
                                name: '',
                                category: categoryName,
                                isRequired: false,
                                allowMultiple: false,
                                options: [],
                                specialLogic: null
                              })
                              setShowAddItemDialog(true)
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add to {categoryName}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium">{item.name}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    {item.isRequired && (
                                      <Badge variant="destructive" className="text-xs">Required</Badge>
                                    )}
                                    {item.allowMultiple && (
                                      <Badge variant="secondary" className="text-xs">Multiple</Badge>
                                    )}
                                    {item.specialLogic && (
                                      <Badge variant="outline" className="text-xs">
                                        {item.specialLogic.type === 'toilet' ? 'Toilet Logic' : 'Vanity Logic'}
                                      </Badge>
                                    )}
                                  </div>
                                  {item.options && item.options.length > 0 && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      {item.options.length} options available
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingItem(item)
                                    setItemForm({
                                      name: item.name,
                                      category: item.category,
                                      isRequired: item.isRequired,
                                      allowMultiple: item.allowMultiple,
                                      options: item.options || [],
                                      specialLogic: item.specialLogic
                                    })
                                    setShowAddItemDialog(true)
                                  }}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {items.length === 0 && (
                            <div className="col-span-full text-center text-gray-500 py-8">
                              No items in this category yet
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : selectedRoom ? (
            <Card className="text-center py-12">
              <CardContent>
                <h3 className="text-xl font-semibold mb-2">
                  No Library for {selectedRoom.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="text-gray-600 mb-4">Create a preset library for this room type</p>
                <Button onClick={() => handleRoomSelect(selectedRoom)}>
                  Create Library
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <h3 className="text-xl font-semibold mb-2">Select a Room Type</h3>
                <p className="text-gray-600">Choose a room type from the left to manage its preset library</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} Library Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                placeholder="Item name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={itemForm.category} onValueChange={(value) => setItemForm({...itemForm, category: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {selectedLibrary && Object.keys(selectedLibrary.categories).map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={itemForm.isRequired}
                  onCheckedChange={(checked) => setItemForm({...itemForm, isRequired: !!checked})}
                />
                <label className="text-sm">Required</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={itemForm.allowMultiple}
                  onCheckedChange={(checked) => setItemForm({...itemForm, allowMultiple: !!checked})}
                />
                <label className="text-sm">Allow Multiple</label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addItemToLibrary}>
                {editingItem ? 'Update' : 'Add'} Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Library Dialog */}
      <Dialog open={showEditLibraryDialog} onOpenChange={setShowEditLibraryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedLibrary ? 'Edit' : 'Create'} Room Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={libraryForm.name}
                onChange={(e) => setLibraryForm({...libraryForm, name: e.target.value})}
                placeholder="Library name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Room Type</label>
              <Select 
                value={libraryForm.roomType} 
                onValueChange={(value) => setLibraryForm({...libraryForm, roomType: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map(room => (
                    <SelectItem key={room.value} value={room.value}>{room.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={libraryForm.description}
                onChange={(e) => setLibraryForm({...libraryForm, description: e.target.value})}
                placeholder="Library description"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEditLibraryDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveLibrary}>
                {selectedLibrary ? 'Update' : 'Create'} Library
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

