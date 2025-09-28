'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  { value: 'ENTRANCE', label: 'Entrance', icon: Home },
  { value: 'FOYER', label: 'Foyer', icon: Home }
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
  ],
  FOYER: [
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
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<string>('')
  
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
    specialLogic: null as any,
    optionsText: '',
    hasSpecialLogic: false,
    specialLogicType: '' as 'toilet' | 'vanity' | '',
    standardTasks: 1,
    customTasks: 1,
    customSubItems: '' as string
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
        console.error('Failed to load room libraries')
        toast.error('Failed to load room libraries')
      }
    } catch (error) {
      console.error('Error loading room libraries:', error)
      toast.error('Failed to load room libraries')
    } finally {
      setLoading(false)
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
    
    // Don't automatically show dialog, just select the room
    // User can manually create library if needed
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

      // Parse options from text
      const options = itemForm.optionsText.trim() ? 
        itemForm.optionsText.split('\n').filter(opt => opt.trim()).map(opt => opt.trim()) : 
        undefined

      // Parse special logic
      const specialLogic = itemForm.hasSpecialLogic && itemForm.specialLogicType ? {
        type: itemForm.specialLogicType as 'toilet' | 'vanity',
        standardTasks: itemForm.standardTasks,
        customTasks: itemForm.customTasks,
        customSubItems: itemForm.customSubItems.trim() ? 
          itemForm.customSubItems.split('\n').filter(item => item.trim()).map(item => item.trim()) : 
          []
      } : undefined

      const itemData: RoomLibraryItem = {
        id: editingItem ? editingItem.id : `item_${Date.now()}`,
        name: itemForm.name,
        category: itemForm.category,
        isRequired: itemForm.isRequired,
        allowMultiple: itemForm.allowMultiple,
        options,
        specialLogic,
        order: editingItem ? editingItem.order : (selectedLibrary.categories[itemForm.category]?.length || 0) + 1
      }

      let updatedCategories = { ...selectedLibrary.categories }
      
      if (editingItem) {
        // Update existing item
        updatedCategories = {
          ...updatedCategories,
          [itemForm.category]: updatedCategories[itemForm.category]?.map(item => 
            item.id === editingItem.id ? itemData : item
          ) || []
        }
      } else {
        // Add new item
        updatedCategories = {
          ...updatedCategories,
          [itemForm.category]: [
            ...(updatedCategories[itemForm.category] || []),
            itemData
          ]
        }
      }

      const updatedLibrary = {
        ...selectedLibrary,
        categories: updatedCategories
      }

      const response = await fetch(`/api/ffe/room-libraries/${selectedLibrary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLibrary)
      })

      if (response.ok) {
        toast.success(`Item ${editingItem ? 'updated' : 'added'} successfully`)
        setShowAddItemDialog(false)
        setItemForm({
          name: '',
          category: '',
          isRequired: false,
          allowMultiple: false,
          options: [],
          specialLogic: null,
          optionsText: '',
          hasSpecialLogic: false,
          specialLogicType: '',
          standardTasks: 1,
          customTasks: 1,
          customSubItems: ''
        })
        setEditingItem(null)
        loadRoomLibraries()
      }
    } catch (error) {
      toast.error(`Failed to ${editingItem ? 'update' : 'add'} item`)
    }
  }

  // Add category to library
  const addCategoryToLibrary = async () => {
    try {
      if (!selectedLibrary || !newCategoryName.trim()) return

      const categoryName = newCategoryName.trim()
      
      // Check if category already exists
      if (selectedLibrary.categories[categoryName]) {
        toast.error('Category already exists')
        return
      }

      const updatedLibrary = {
        ...selectedLibrary,
        categories: {
          ...selectedLibrary.categories,
          [categoryName]: []
        }
      }

      const response = await fetch(`/api/ffe/room-libraries/${selectedLibrary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLibrary)
      })

      if (response.ok) {
        toast.success('Category added successfully')
        setShowAddCategoryDialog(false)
        setNewCategoryName('')
        loadRoomLibraries()
      } else {
        throw new Error('Failed to add category')
      }
    } catch (error) {
      toast.error('Failed to add category')
    }
  }

  // Delete category from library
  const deleteCategoryFromLibrary = async (categoryName: string) => {
    try {
      if (!selectedLibrary) return

      // Check if category has items
      const categoryItems = selectedLibrary.categories[categoryName] || []
      if (categoryItems.length > 0) {
        toast.error(`Cannot delete category "${categoryName}" because it contains ${categoryItems.length} items. Please remove all items first.`)
        return
      }

      const updatedCategories = { ...selectedLibrary.categories }
      delete updatedCategories[categoryName]

      const updatedLibrary = {
        ...selectedLibrary,
        categories: updatedCategories
      }

      const response = await fetch(`/api/ffe/room-libraries/${selectedLibrary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLibrary)
      })

      if (response.ok) {
        toast.success(`Category "${categoryName}" deleted successfully`)
        loadRoomLibraries()
      } else {
        throw new Error('Failed to delete category')
      }
    } catch (error) {
      toast.error('Failed to delete category')
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
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddCategoryDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Category
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingItem(null)
                        setItemForm({
                          name: '',
                          category: '',
                          isRequired: false,
                          allowMultiple: false,
                          options: [],
                          specialLogic: null,
                          optionsText: '',
                          hasSpecialLogic: false,
                          specialLogicType: '',
                          standardTasks: 1,
                          customTasks: 1,
                          customSubItems: ''
                        })
                        setShowAddItemDialog(true)
                      }}
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
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItem(null)
                                setItemForm({
                                  name: '',
                                  category: categoryName,
                                  isRequired: false,
                                  allowMultiple: false,
                                  options: [],
                                  specialLogic: null,
                                  optionsText: '',
                                  hasSpecialLogic: false,
                                  specialLogicType: '',
                                  standardTasks: 1,
                                  customTasks: 1,
                                  customSubItems: ''
                                })
                                setShowAddItemDialog(true)
                              }}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Item
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCategoryFromLibrary(categoryName)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
                                      specialLogic: item.specialLogic,
                                      optionsText: item.options ? item.options.join('\n') : '',
                                      hasSpecialLogic: !!item.specialLogic,
                                      specialLogicType: item.specialLogic?.type || '',
                                      standardTasks: item.specialLogic?.standardTasks || 1,
                                      customTasks: item.specialLogic?.customTasks || 1,
                                      customSubItems: item.specialLogic?.customSubItems ? item.specialLogic.customSubItems.join('\n') : ''
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
                <Button onClick={() => {
                  const roomLabel = selectedRoom.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
                  setLibraryForm({
                    name: `${roomLabel} Preset Library`,
                    roomType: selectedRoom,
                    description: `Standard ${roomLabel.toLowerCase()} FFE preset library`
                  })
                  setShowEditLibraryDialog(true)
                }}>
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
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} Library Item</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Name</label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                placeholder="Item name"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium block mb-2">Category</label>
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
            
            <div>
              <label className="text-sm font-medium block mb-2">Options (one per line)</label>
              <Textarea
                value={itemForm.optionsText}
                onChange={(e) => setItemForm({...itemForm, optionsText: e.target.value})}
                placeholder="Option 1\nOption 2\nOption 3\n..."
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">Enter each option on a new line</p>
            </div>
            
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  checked={itemForm.hasSpecialLogic}
                  onCheckedChange={(checked) => setItemForm({...itemForm, hasSpecialLogic: !!checked})}
                />
                <label className="text-sm font-medium">Has Special Logic</label>
              </div>
              
              {itemForm.hasSpecialLogic && (
                <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                  <div>
                    <label className="text-sm font-medium block mb-2">Logic Type</label>
                    <Select 
                      value={itemForm.specialLogicType} 
                      onValueChange={(value) => setItemForm({...itemForm, specialLogicType: value as 'toilet' | 'vanity'})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select logic type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="toilet">Toilet Logic</SelectItem>
                        <SelectItem value="vanity">Vanity Logic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium block mb-2">Standard Tasks</label>
                      <Input
                        type="number"
                        min="1"
                        value={itemForm.standardTasks}
                        onChange={(e) => setItemForm({...itemForm, standardTasks: parseInt(e.target.value) || 1})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">Custom Tasks</label>
                      <Input
                        type="number"
                        min="1"
                        value={itemForm.customTasks}
                        onChange={(e) => setItemForm({...itemForm, customTasks: parseInt(e.target.value) || 1})}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium block mb-2">Custom Sub-Items (one per line)</label>
                    <Textarea
                      value={itemForm.customSubItems}
                      onChange={(e) => setItemForm({...itemForm, customSubItems: e.target.value})}
                      placeholder="Sub-item 1\nSub-item 2\n..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => {
                setShowAddItemDialog(false)
                setItemForm({
                  name: '',
                  category: '',
                  isRequired: false,
                  allowMultiple: false,
                  options: [],
                  specialLogic: null,
                  optionsText: '',
                  hasSpecialLogic: false,
                  specialLogicType: '',
                  standardTasks: 1,
                  customTasks: 1,
                  customSubItems: ''
                })
                setEditingItem(null)
              }}>
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
        <DialogContent className="max-w-md">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{selectedLibrary ? 'Edit' : 'Create'} Room Library</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Name</label>
              <Input
                value={libraryForm.name}
                onChange={(e) => setLibraryForm({...libraryForm, name: e.target.value})}
                placeholder="Library name"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Room Type</label>
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
              <label className="text-sm font-medium block mb-2">Description</label>
              <Textarea
                value={libraryForm.description}
                onChange={(e) => setLibraryForm({...libraryForm, description: e.target.value})}
                placeholder="Library description"
                rows={2}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
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

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Category Name</label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addCategoryToLibrary()
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Categories help organize FFE items by type (e.g., Flooring, Lighting, Furniture)
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddCategoryDialog(false)
                  setNewCategoryName('')
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={addCategoryToLibrary}
                disabled={!newCategoryName.trim()}
              >
                Add Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

