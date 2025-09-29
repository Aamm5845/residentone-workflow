'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Package,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Settings,
  Building2,
  Palette,
  Lightbulb,
  Wrench,
  Home,
  Sofa,
  ChefHat,
  Edit2,
  Plus,
  Trash2,
  Save
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { 
  createFFEManagementSystem,
  type FFEMasterRoomType,
  type FFEMasterCategory,
  type FFEMasterItem
} from '@/lib/ffe/ffe-management-backend'

interface FFEManagementRedesignedProps {
  orgId: string
  user: {
    id: string
    name: string
    role: string
  }
}

const CATEGORY_ICONS = {
  'FLOORING': Building2,
  'WALLS': Palette,
  'CEILING': Building2,
  'PLUMBING': Wrench,
  'FURNITURE': Sofa,
  'LIGHTING': Lightbulb,
  'ACCESSORIES': Settings
}

const ROOM_TYPE_ICONS = {
  'bedroom': Home,
  'bathroom': Building2,
  'kitchen': ChefHat,
  'dining-room': Sofa,
  'living-room': Sofa,
  'office': Building2
}

// Available room types from project creation
const AVAILABLE_ROOM_TYPES = {
  'Entry & Circulation': [
    { value: 'entrance', label: 'Entrance' },
    { value: 'foyer', label: 'Foyer' },
    { value: 'staircase', label: 'Staircase' },
  ],
  'Living Spaces': [
    { value: 'living-room', label: 'Living Room' },
    { value: 'dining-room', label: 'Dining Room' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'study-room', label: 'Study Room' },
    { value: 'office', label: 'Office' },
    { value: 'playroom', label: 'Playroom' },
  ],
  'Bedrooms': [
    { value: 'master-bedroom', label: 'Master Bedroom' },
    { value: 'girls-room', label: 'Girls Room' },
    { value: 'boys-room', label: 'Boys Room' },
    { value: 'guest-bedroom', label: 'Guest Bedroom' },
  ],
  'Bathrooms': [
    { value: 'powder-room', label: 'Powder Room' },
    { value: 'master-bathroom', label: 'Master Bathroom' },
    { value: 'family-bathroom', label: 'Family Bathroom' },
    { value: 'girls-bathroom', label: 'Girls Bathroom' },
    { value: 'boys-bathroom', label: 'Boys Bathroom' },
    { value: 'guest-bathroom', label: 'Guest Bathroom' },
  ],
  'Utility': [
    { value: 'laundry-room', label: 'Laundry Room' },
  ],
  'Special': [
    { value: 'sukkah', label: 'Sukkah' },
  ],
}

export default function FFEManagementRedesigned({ orgId, user }: FFEManagementRedesignedProps) {
  const [activeTab, setActiveTab] = useState('room-types')
  const [categories, setCategories] = useState<FFEMasterCategory[]>([])
  const [roomTypes, setRoomTypes] = useState<any[]>([])
  const [selectedRoomType, setSelectedRoomType] = useState<string>('')
  const [roomItems, setRoomItems] = useState<FFEMasterItem[]>([])
  const [loading, setLoading] = useState(false)
  const [validationResults, setValidationResults] = useState<any>(null)
  
  // Edit dialogs state
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<FFEMasterItem | null>(null)
  const [showLogicDialog, setShowLogicDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<FFEMasterCategory | null>(null)
  const [showRoomTypeDialog, setShowRoomTypeDialog] = useState(false)
  const [editingRoomType, setEditingRoomType] = useState<any | null>(null)
  
  // Item form state
  const [itemForm, setItemForm] = useState({
    name: '',
    categoryKey: '',
    isRequired: false,
    order: 1,
    logicRules: [] as any[]
  })
  
  // Logic option form state
  const [logicForm, setLogicForm] = useState({
    id: '',
    name: '',
    description: '',
    itemsToCreate: 1,
    subItems: [] as { name: string; category?: string }[]
  })
  
  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    key: '',
    order: 1,
    selectedRoomTypes: ['bedroom', 'bathroom', 'kitchen'] as string[]
  })
  
  // Room type form state
  const [roomTypeForm, setRoomTypeForm] = useState({
    name: '',
    key: '',
    linkedRooms: [] as string[]
  })
  
  const managementSystem = createFFEManagementSystem(orgId)

  // Load data on mount
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load room items when room type changes
  useEffect(() => {
    if (selectedRoomType && activeTab === 'items') {
      loadRoomItems(selectedRoomType)
    }
  }, [selectedRoomType, activeTab])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [categoriesData, roomTypesData] = await Promise.all([
        managementSystem.getAllCategories(),
        managementSystem.getAllRoomTypes()
      ])
      setCategories(categoriesData)
      setRoomTypes(roomTypesData)
      
      // Auto-select first room type if none selected and room types exist
      if (!selectedRoomType && roomTypesData.length > 0) {
        setSelectedRoomType(roomTypesData[0].key)
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load FFE data')
    } finally {
      setLoading(false)
    }
  }


  const loadRoomItems = async (roomTypeKey: string) => {
    try {
      const items = await managementSystem.getItemsForRoom(roomTypeKey)
      setRoomItems(items)
    } catch (error) {
      console.error('Error loading room items:', error)
      toast.error('Failed to load room items')
    }
  }

  const validateLibrary = async () => {
    try {
      setLoading(true)
      const results = await managementSystem.validateLibraryConsistency()
      setValidationResults(results)
      if (results.isValid) {
        toast.success('Library validation passed!')
      } else {
        toast.error(`Validation failed: ${results.errors.length} errors found`)
      }
    } catch (error) {
      toast.error('Failed to validate library')
    } finally {
      setLoading(false)
    }
  }

  // Item management functions
  const openItemDialog = (item?: FFEMasterItem) => {
    if (item) {
      setEditingItem(item)
      setItemForm({
        name: item.name,
        categoryKey: item.categoryKey,
        isRequired: item.isRequired,
        order: item.order,
        logicRules: item.logicRules
      })
    } else {
      setEditingItem(null)
      setItemForm({
        name: '',
        categoryKey: categories.length > 0 ? categories[0].key : '',
        isRequired: false,
        order: roomItems.length + 1,
        logicRules: []
      })
    }
    setShowItemDialog(true)
  }

  const saveItem = async () => {
    try {
      setLoading(true)
      if (editingItem) {
        await managementSystem.updateItem(editingItem.id, {
          name: itemForm.name,
          categoryKey: itemForm.categoryKey,
          isRequired: itemForm.isRequired,
          order: itemForm.order,
          logicRules: itemForm.logicRules
        })
        toast.success('Item updated successfully')
      } else {
        await managementSystem.createItem(
          itemForm.name,
          itemForm.categoryKey,
          [selectedRoomType],
          itemForm.isRequired,
          itemForm.logicRules
        )
        toast.success('Item created successfully')
      }
      setShowItemDialog(false)
      if (selectedRoomType) {
        await loadRoomItems(selectedRoomType)
      }
    } catch (error) {
      toast.error('Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      setLoading(true)
      await managementSystem.deleteItem(itemId)
      toast.success('Item deleted successfully')
      if (selectedRoomType) {
        await loadRoomItems(selectedRoomType)
      }
    } catch (error) {
      toast.error('Failed to delete item')
    } finally {
      setLoading(false)
    }
  }

  const addLogicOption = () => {
    const newOption = {
      id: logicForm.id || `option_${Date.now()}`,
      name: logicForm.name,
      description: logicForm.description,
      itemsToCreate: logicForm.itemsToCreate,
      subItems: logicForm.subItems
    }
    
    // Update itemForm to include logicOptions (not logicRules)
    const currentLogicOptions = itemForm.logicRules || [] // Keep backward compatibility
    setItemForm({
      ...itemForm,
      logicRules: [...currentLogicOptions, newOption] // Store as logicRules for backend compatibility
    })
    
    // Reset form
    setLogicForm({
      id: '',
      name: '',
      description: '',
      itemsToCreate: 1,
      subItems: []
    })
    setShowLogicDialog(false)
  }

  const duplicateRoomLibrary = async (sourceRoom: string, targetRoom: string) => {
    try {
      setLoading(true)
      await managementSystem.duplicateRoomLibrary(sourceRoom, targetRoom)
      toast.success(`Duplicated ${sourceRoom} library to ${targetRoom}`)
    } catch (error) {
      toast.error('Failed to duplicate library')
    } finally {
      setLoading(false)
    }
  }



  // Room type management functions
  const openRoomTypeDialog = (roomType?: any) => {
    if (roomType) {
      setEditingRoomType(roomType)
      setRoomTypeForm({
        name: roomType.name,
        key: roomType.key,
        linkedRooms: roomType.linkedRooms || []
      })
    } else {
      setEditingRoomType(null)
      setRoomTypeForm({ name: '', key: '', linkedRooms: [] })
    }
    setShowRoomTypeDialog(true)
  }

  const saveRoomType = async () => {
    try {
      setLoading(true)
      if (editingRoomType) {
        console.log('Updating room type:', editingRoomType.id, 'with data:', {
          name: roomTypeForm.name,
          key: roomTypeForm.key,
          linkedRooms: roomTypeForm.linkedRooms
        })
        
        // Check if the room type still exists in our current state
        const roomTypeExists = roomTypes.some(rt => rt.id === editingRoomType.id)
        console.log('Room type exists in current state:', roomTypeExists)
        
        if (!roomTypeExists) {
          console.warn('Room type not found in current state, it may have been cleared. Re-creating it.')
          // If it doesn't exist, create it instead
          await managementSystem.createRoomType(
            roomTypeForm.name,
            roomTypeForm.key,
            roomTypeForm.linkedRooms
          )
          toast.success(`Re-created room type: ${roomTypeForm.name}`)
        } else {
          // Update existing room type
          await managementSystem.updateRoomType(editingRoomType.id, {
            name: roomTypeForm.name,
            key: roomTypeForm.key,
            linkedRooms: roomTypeForm.linkedRooms
          })
          toast.success(`Updated room type: ${roomTypeForm.name}`)
        }
      } else {
        // Create new room type
        await managementSystem.createRoomType(
          roomTypeForm.name,
          roomTypeForm.key,
          roomTypeForm.linkedRooms
        )
        toast.success(`Created room type: ${roomTypeForm.name}. You can now add categories and items to this room type.`)
      }
      setShowRoomTypeDialog(false)
      setEditingRoomType(null)
      setRoomTypeForm({ name: '', key: '', linkedRooms: [] })
      await loadInitialData()
    } catch (error) {
      toast.error(editingRoomType ? 'Failed to update room type' : 'Failed to create room type')
    } finally {
      setLoading(false)
    }
  }

  const deleteAllRoomTypes = async () => {
    if (!confirm('Are you sure you want to clear ALL room types? This will start you with a clean slate.')) return
    
    try {
      setLoading(true)
      console.log('Clearing all room types')
      
      // Use the new clearAllRoomTypes function
      await managementSystem.clearAllRoomTypes()
      
      toast.success('All room types cleared successfully! You can now add room types manually.')
      await loadInitialData()
    } catch (error) {
      console.error('Error in deleteAllRoomTypes:', error)
      toast.error('Failed to clear room types: ' + (error?.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Open category dialog for editing or creating
  const openCategoryDialog = (category?: FFEMasterCategory) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({
        name: category.name,
        key: category.key,
        order: category.order,
        selectedRoomTypes: category.roomTypeKeys
      })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', key: '', order: categories.length + 1, selectedRoomTypes: [] })
    }
    setShowCategoryDialog(true)
  }

  // Create or update category
  const saveCategory = async () => {
    try {
      setLoading(true)
      if (editingCategory) {
        // Update existing category
        const updatedCategory = await managementSystem.updateCategory(editingCategory.id, {
          name: categoryForm.name,
          key: categoryForm.key,
          order: categoryForm.order,
          roomTypeKeys: categoryForm.selectedRoomTypes
        })
        toast.success(`Updated category: ${updatedCategory.name}`)
      } else {
        // Create new category
        const newCategory = await managementSystem.createCategory(
          categoryForm.name,
          categoryForm.key,
          categoryForm.order,
          categoryForm.selectedRoomTypes
        )
        toast.success(`Created category: ${newCategory.name}`)
      }
      setShowCategoryDialog(false)
      setEditingCategory(null)
      setCategoryForm({ name: '', key: '', order: 1, selectedRoomTypes: [] })
      await loadInitialData()
    } catch (error) {
      toast.error(editingCategory ? 'Failed to update category' : 'Failed to create category')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'room-types', name: 'Room Types', icon: Home },
    { id: 'categories', name: 'Categories', icon: Package },
    { id: 'items', name: 'Items', icon: Settings },
    { id: 'validation', name: 'Validation', icon: CheckCircle }
  ]

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Package className="w-5 h-5 mr-2" />
            FFE Management - Redesigned System
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            New Design
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Manage your FFE (Furniture, Fixtures & Equipment) libraries with the new redesigned system. 
          One library per room type, logic-driven expansions, and two-phase workflow support.
        </p>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center">
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.name}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* Room Types Tab */}
          <TabsContent value="room-types" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Room Types</h3>
                  <p className="text-sm text-gray-600">
                    Manage room types and their associated FFE libraries.
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={deleteAllRoomTypes}
                    variant="outline"
                    className="text-red-600 hover:text-red-700 border-red-300"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Room Types
                  </Button>
                  <Button 
                    onClick={() => openRoomTypeDialog()}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Room Type
                  </Button>
                </div>
              </div>
              
              {roomTypes.length === 0 ? (
                <Card className="p-8 text-center">
                  <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-600 mb-2">Ready to Build Your Room Types</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    You can now create custom room types manually. These will be specific to your organization and can be fully customized.
                  </p>
                  <Button onClick={() => openRoomTypeDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Room Type
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roomTypes.map((roomType) => {
                    const IconComponent = ROOM_TYPE_ICONS[roomType.key] || Home
                    
                    return (
                      <Card key={roomType.id} className="relative">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <IconComponent className="w-5 h-5 text-gray-600 mr-2" />
                              <h4 className="font-medium">{roomType.name}</h4>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {roomType.key}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex justify-between">
                              <span>Categories:</span>
                              <span className="font-medium">0</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Items:</span>
                              <span className="font-medium">0</span>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 mt-3">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => {
                                setSelectedRoomType(roomType.key)
                                setActiveTab('items')
                              }}
                            >
                              View Items
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openRoomTypeDialog(roomType)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Categories</h3>
                  <p className="text-sm text-gray-600">
                    Manage FFE categories and assign them to room types.
                  </p>
                </div>
                <Button 
                  onClick={() => openCategoryDialog()}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => {
                  const IconComponent = CATEGORY_ICONS[category.key] || Settings
                  
                  return (
                      <Card key={category.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <IconComponent className="w-5 h-5 text-gray-600 mr-2" />
                              <h4 className="font-medium">{category.name}</h4>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                Order: {category.order}
                              </Badge>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openCategoryDialog(category)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>Used in room types:</div>
                            <div className="flex flex-wrap gap-1">
                              {category.roomTypeKeys.map((roomKey) => (
                                <Badge key={roomKey} variant="secondary" className="text-xs">
                                  {roomKey}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">
                    Items for {roomTypes.find(rt => rt.key === selectedRoomType)?.name || selectedRoomType}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Items in this room type library, including logic rules for expansions.
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={() => openItemDialog()}
                    className="flex items-center space-x-2"
                    disabled={!selectedRoomType}
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </Button>
                  <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.length === 0 ? (
                        <div className="p-2 text-center text-gray-500 text-sm">
                          No room types created yet
                        </div>
                      ) : (
                        roomTypes.map((roomType) => (
                          <SelectItem key={roomType.key} value={roomType.key}>
                            {roomType.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!selectedRoomType && roomTypes.length > 0 && (
                <Card className="p-8 text-center">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-600 mb-2">Select a Room Type</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Choose a room type from the dropdown above to view and manage its items.
                  </p>
                </Card>
              )}
              
              {!selectedRoomType && roomTypes.length === 0 && (
                <Card className="p-8 text-center">
                  <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-600 mb-2">No Room Types Found</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Create room types in the Room Types tab first, then return here to add items.
                  </p>
                  <Button onClick={() => setActiveTab('room-types')}>
                    Go to Room Types Tab
                  </Button>
                </Card>
              )}
              
              {selectedRoomType && (
                <div className="space-y-4">
                  {categories.length === 0 ? (
                    <Card className="p-8 text-center">
                      <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-600 mb-2">No Categories Found</h4>
                      <p className="text-sm text-gray-500 mb-4">
                        Create categories in the Categories tab first, then assign them to this room type.
                      </p>
                      <Button onClick={() => setActiveTab('categories')}>
                        Go to Categories Tab
                      </Button>
                    </Card>
                  ) : (
                    categories
                      .filter(cat => cat.roomTypeKeys.includes(selectedRoomType))
                      .length === 0 ? (
                        <Card className="p-8 text-center">
                          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h4 className="text-lg font-medium text-gray-600 mb-2">No Categories Assigned</h4>
                          <p className="text-sm text-gray-500 mb-4">
                            This room type doesn't have any categories assigned. Go to the Categories tab to assign categories to this room type.
                          </p>
                          <Button onClick={() => setActiveTab('categories')}>
                            Assign Categories
                          </Button>
                        </Card>
                      ) : (
                        categories
                          .filter(cat => cat.roomTypeKeys.includes(selectedRoomType))
                          .map((category) => {
                      const categoryItems = roomItems.filter(item => item.categoryKey === category.key)
                      const IconComponent = CATEGORY_ICONS[category.key] || Settings
                      
                      return (
                        <Card key={category.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <IconComponent className="w-5 h-5 text-gray-600 mr-2" />
                                <h4 className="font-medium">{category.name}</h4>
                              </div>
                              <Badge variant="outline">
                                {categoryItems.length} items
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {categoryItems.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">
                                  No items in this category
                                </p>
                              ) : (
                                categoryItems.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                      <div>
                                        <div className="flex items-center space-x-2">
                                          <h5 className="font-medium text-sm">{item.name}</h5>
                                          {item.isRequired && (
                                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                              Required
                                            </Badge>
                                          )}
                                          {item.logicRules.length > 0 && (
                                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                              Logic Options: {item.logicRules.length}
                                            </Badge>
                                          )}
                                        </div>
                                        {item.logicRules.length > 0 && (
                                          <div className="text-xs text-gray-600 mt-1">
                                            Options: {item.logicRules.map(option => 
                                              `${option.name} (${option.itemsToCreate} items)`
                                            ).join(', ')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => openItemDialog(item)}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => deleteItem(item.id)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                          })
                      )
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Validation Tab */}
          <TabsContent value="validation" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Library Validation</h3>
                  <p className="text-sm text-gray-600">
                    Validate the consistency and integrity of your FFE library system.
                  </p>
                </div>
                <Button onClick={validateLibrary} disabled={loading}>
                  {loading ? (
                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Run Validation
                </Button>
              </div>

              {validationResults && (
                <div className="space-y-4">
                  <Card className={cn(
                    "border-2",
                    validationResults.isValid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        {validationResults.isValid ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        )}
                        <div>
                          <h4 className={cn(
                            "font-medium",
                            validationResults.isValid ? "text-green-800" : "text-red-800"
                          )}>
                            {validationResults.isValid ? 'Validation Passed' : 'Validation Failed'}
                          </h4>
                          <p className={cn(
                            "text-sm",
                            validationResults.isValid ? "text-green-600" : "text-red-600"
                          )}>
                            {validationResults.isValid 
                              ? 'Your FFE library is consistent and ready to use.'
                              : `${validationResults.errors.length} errors and ${validationResults.warnings.length} warnings found.`
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {validationResults.errors.length > 0 && (
                    <Card className="border-red-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-red-800 flex items-center">
                          <AlertCircle className="w-5 h-5 mr-2" />
                          Errors ({validationResults.errors.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {validationResults.errors.map((error: string, index: number) => (
                            <li key={index} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                              <span className="text-sm text-red-700">{error}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {validationResults.warnings.length > 0 && (
                    <Card className="border-yellow-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-yellow-800 flex items-center">
                          <AlertCircle className="w-5 h-5 mr-2" />
                          Warnings ({validationResults.warnings.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {validationResults.warnings.map((warning: string, index: number) => (
                            <li key={index} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 flex-shrink-0" />
                              <span className="text-sm text-yellow-700">{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

      </CardContent>
    </Card>
    
    {/* Item Edit Dialog */}
    <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle>
            {editingItem ? 'Edit Item' : 'Add New Item'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          <div>
            <Label htmlFor="itemName">Item Name</Label>
            <Input
              id="itemName"
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              placeholder="Enter item name"
            />
          </div>
          
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={itemForm.categoryKey}
              onValueChange={(value) => setItemForm({ ...itemForm, categoryKey: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <div className="p-2 text-center text-gray-500 text-sm">
                    No categories created yet
                  </div>
                ) : (
                  categories
                    .filter(cat => selectedRoomType && cat.roomTypeKeys.includes(selectedRoomType))
                    .map((category) => (
                      <SelectItem key={category.key} value={category.key}>
                        {category.name}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={itemForm.isRequired}
              onCheckedChange={(checked) => setItemForm({ ...itemForm, isRequired: !!checked })}
            />
            <Label htmlFor="required">Required Item</Label>
          </div>
          
          <div>
            <Label htmlFor="order">Display Order</Label>
            <Input
              id="order"
              type="number"
              value={itemForm.order}
              onChange={(e) => setItemForm({ ...itemForm, order: parseInt(e.target.value) || 1 })}
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between">
              <Label>Logic Options ({itemForm.logicRules.length})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogicDialog(true)}
                type="button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Logic Option
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Logic options allow users to select different configurations that create multiple sub-items
            </p>
            {itemForm.logicRules.length > 0 && (
              <div className="space-y-2 mt-2">
                {itemForm.logicRules.map((option, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="text-sm">
                      <div className="font-medium">{option.name}</div>
                      {option.description && (
                        <div className="text-gray-600 text-xs mt-1">{option.description}</div>
                      )}
                      <div className="text-blue-600 text-xs mt-1">
                        Creates {option.itemsToCreate} item{option.itemsToCreate > 1 ? 's' : ''}
                        {option.subItems && option.subItems.length > 0 && (
                          <span className="ml-2">({option.subItems.map(sub => sub.name).join(', ')})</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newOptions = itemForm.logicRules.filter((_, i) => i !== index)
                        setItemForm({ ...itemForm, logicRules: newOptions })
                      }}
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="pt-6">
          <Button variant="outline" onClick={() => setShowItemDialog(false)}>
            Cancel
          </Button>
          <Button onClick={saveItem} disabled={!itemForm.name.trim() || loading}>
            {loading ? (
              <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {editingItem ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Logic Option Dialog */}
    <Dialog open={showLogicDialog} onOpenChange={setShowLogicDialog}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pb-4">
          <DialogTitle>Add Logic Option</DialogTitle>
          <p className="text-sm text-gray-600">
            Logic options create dynamic workflows where selecting an item can generate multiple sub-items.
          </p>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          <div>
            <Label htmlFor="optionName">Option Name</Label>
            <Input
              id="optionName"
              placeholder="e.g., Standard Setup, Advanced Configuration"
              value={logicForm.name}
              onChange={(e) => setLogicForm({ ...logicForm, name: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="optionDescription">Description (Optional)</Label>
            <Input
              id="optionDescription"
              placeholder="e.g., Basic setup with 2 tasks"
              value={logicForm.description}
              onChange={(e) => setLogicForm({ ...logicForm, description: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="itemsToCreate">Number of Items to Create</Label>
            <Input
              id="itemsToCreate"
              type="number"
              min="1"
              max="10"
              value={logicForm.itemsToCreate}
              onChange={(e) => setLogicForm({ ...logicForm, itemsToCreate: parseInt(e.target.value) || 1 })}
            />
            <p className="text-xs text-gray-500 mt-1">
              When this option is selected, it will create {logicForm.itemsToCreate} sub-item{logicForm.itemsToCreate > 1 ? 's' : ''}
            </p>
          </div>
          
          <div>
            <div className="flex items-center justify-between">
              <Label>Sub-Items (Optional)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLogicForm({
                    ...logicForm,
                    subItems: [...logicForm.subItems, { name: '', category: '' }]
                  })
                }}
                type="button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Sub-Item
              </Button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Define specific names for the sub-items that will be created
            </p>
            
            {logicForm.subItems.map((subItem, index) => (
              <div key={index} className="flex items-center space-x-2 mt-2">
                <Input
                  placeholder="Sub-item name (e.g., Planning Phase)"
                  value={subItem.name}
                  onChange={(e) => {
                    const newSubItems = [...logicForm.subItems]
                    newSubItems[index].name = e.target.value
                    setLogicForm({ ...logicForm, subItems: newSubItems })
                  }}
                />
                <Input
                  placeholder="Category (optional)"
                  value={subItem.category || ''}
                  onChange={(e) => {
                    const newSubItems = [...logicForm.subItems]
                    newSubItems[index].category = e.target.value
                    setLogicForm({ ...logicForm, subItems: newSubItems })
                  }}
                  className="w-32"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newSubItems = logicForm.subItems.filter((_, i) => i !== index)
                    setLogicForm({ ...logicForm, subItems: newSubItems })
                  }}
                  type="button"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            {logicForm.subItems.length === 0 && (
              <div className="text-xs text-gray-400 italic mt-2">
                If no sub-items are defined, generic names will be generated (e.g., "Item Name #1", "Item Name #2")
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="pt-6">
          <Button variant="outline" onClick={() => setShowLogicDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={addLogicOption}
            disabled={!logicForm.name.trim()}
          >
            Add Logic Option
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Room Type Dialog */}
    <Dialog open={showRoomTypeDialog} onOpenChange={setShowRoomTypeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle>
            {editingRoomType ? 'Edit Room Type' : 'Create New Room Type'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          <div>
            <Label htmlFor="roomTypeName">Room Type Name</Label>
            <Input
              id="roomTypeName"
              value={roomTypeForm.name}
              onChange={(e) => {
                const name = e.target.value
                if (!editingRoomType) {
                  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                  setRoomTypeForm({ ...roomTypeForm, name, key })
                } else {
                  setRoomTypeForm({ ...roomTypeForm, name })
                }
              }}
              placeholder="e.g., Wine Cellar, Media Room"
            />
          </div>
          
          <div>
            <Label htmlFor="roomTypeKey">Room Type Key</Label>
            <Input
              id="roomTypeKey"
              value={roomTypeForm.key}
              onChange={(e) => setRoomTypeForm({ ...roomTypeForm, key: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              placeholder="e.g., wine-cellar, media-room"
              readOnly={!!editingRoomType}
              className={editingRoomType ? 'bg-gray-50' : ''}
            />
            <p className="text-xs text-gray-500 mt-1">Auto-generated from name, used for internal identification</p>
          </div>
          
          <div>
            <Label>Linked Room Types (Optional)</Label>
            <p className="text-xs text-gray-500 mb-3">
              {!editingRoomType ? 
                "Select room types to link with this new room type for library sharing." :
                "Edit which room types are linked with this room type."
              }
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {Object.entries(AVAILABLE_ROOM_TYPES).map(([category, roomTypes]) => (
                <div key={category}>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">{category}</h4>
                  <div className="space-y-2 ml-4">
                    {roomTypes.map((room) => (
                      <div key={room.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={room.value}
                          checked={roomTypeForm.linkedRooms.includes(room.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setRoomTypeForm({
                                ...roomTypeForm,
                                linkedRooms: [...roomTypeForm.linkedRooms, room.value]
                              })
                            } else {
                              setRoomTypeForm({
                                ...roomTypeForm,
                                linkedRooms: roomTypeForm.linkedRooms.filter(r => r !== room.value)
                              })
                            }
                          }}
                        />
                        <Label htmlFor={room.value} className="text-sm cursor-pointer">
                          {room.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {roomTypeForm.linkedRooms.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Selected:</strong> {roomTypeForm.linkedRooms.map(roomId => {
                    const room = Object.values(AVAILABLE_ROOM_TYPES).flat().find(r => r.value === roomId)
                    return room?.label
                  }).join(', ')}
                </p>
                {!editingRoomType && roomTypeForm.linkedRooms.length > 1 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Library will be copied from <strong>{Object.values(AVAILABLE_ROOM_TYPES).flat().find(r => r.value === roomTypeForm.linkedRooms[0])?.label}</strong> to the other selected rooms.
                  </p>
                )}
              </div>
            )}
            {!editingRoomType && roomTypeForm.linkedRooms.length === 0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Fresh Start:</strong> Room type will be created empty. You can add categories and items later.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="pt-6">
          <Button variant="outline" onClick={() => setShowRoomTypeDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={saveRoomType} 
            disabled={!roomTypeForm.name.trim() || !roomTypeForm.key.trim() || loading}
          >
            {loading ? (editingRoomType ? 'Updating...' : 'Creating...') : (editingRoomType ? 'Update Room Type' : 'Create Room Type')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Create Category Dialog */}
    <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle>
            {editingCategory ? 'Edit Category' : 'Create New Category'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          <div>
            <Label htmlFor="categoryName">Category Name</Label>
            <Input
              id="categoryName"
              value={categoryForm.name}
              onChange={(e) => {
                const name = e.target.value
                if (!editingCategory) {
                  const key = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
                  setCategoryForm({ ...categoryForm, name, key })
                } else {
                  setCategoryForm({ ...categoryForm, name })
                }
              }}
              placeholder="e.g., Window Treatments, Technology"
            />
          </div>
          
          <div>
            <Label htmlFor="categoryKey">Category Key</Label>
            <Input
              id="categoryKey"
              value={categoryForm.key}
              onChange={(e) => setCategoryForm({ ...categoryForm, key: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              placeholder="e.g., WINDOW_TREATMENTS, TECHNOLOGY"
              readOnly={!!editingCategory}
              className={editingCategory ? 'bg-gray-50' : ''}
            />
            <p className="text-xs text-gray-500 mt-1">Auto-generated from name, used for internal identification</p>
          </div>
          
          <div>
            <Label htmlFor="categoryOrder">Display Order</Label>
            <Input
              id="categoryOrder"
              type="number"
              value={categoryForm.order}
              onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 1 })}
              min={1}
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
          </div>
          
          <div>
            <Label>Room Types That Will Use This Category</Label>
            <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
              {roomTypes.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No room types created yet.</p>
                  <p className="text-xs mt-1">Create room types in the Room Types tab first.</p>
                </div>
              ) : (
                roomTypes.map((roomType) => (
                  <div key={roomType.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={roomType.key}
                      checked={categoryForm.selectedRoomTypes.includes(roomType.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCategoryForm({
                            ...categoryForm,
                            selectedRoomTypes: [...categoryForm.selectedRoomTypes, roomType.key]
                          })
                        } else {
                          setCategoryForm({
                            ...categoryForm,
                            selectedRoomTypes: categoryForm.selectedRoomTypes.filter(key => key !== roomType.key)
                          })
                        }
                      }}
                    />
                    <Label htmlFor={roomType.key} className="text-sm cursor-pointer">
                      {roomType.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Select which room types will include this category</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={saveCategory} 
            disabled={!categoryForm.name.trim() || !categoryForm.key.trim() || categoryForm.selectedRoomTypes.length === 0 || loading}
          >
            {loading ? (editingCategory ? 'Updating...' : 'Creating...') : (editingCategory ? 'Update Category' : 'Create Category')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
