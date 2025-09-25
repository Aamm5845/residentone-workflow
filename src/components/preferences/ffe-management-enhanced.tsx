'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter, 
  Building2, 
  Sofa, 
  Lightbulb, 
  Palette, 
  Wrench, 
  ChefHat,
  Settings,
  History,
  Globe,
  Home,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Archive,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Tag,
  DollarSign,
  Truck,
  ExternalLink,
  Move,
  MoreHorizontal,
  Save,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { 
  type FFEItemTemplate, 
  type FFECategory, 
  type FFERoomLibrary,
  type FFEManagementViewState,
  type FFEItemFormData,
  type FFECategoryFormData,
  type FFERoomLibraryFormData,
  type FFEVersionHistory,
  type FFEGlobalSettings,
  type FFESubItem,
  type FFEItemLevel,
  type FFEItemState,
  type FFEItemScope
} from '@/types/ffe-management'

interface FFEManagementEnhancedProps {
  orgId: string
  user: {
    id: string
    name: string
    role: string
  }
}

const CATEGORY_ICONS = {
  'base-finishes': Building2,
  'furniture': Sofa,
  'lighting': Lightbulb,
  'textiles': Palette,
  'accessories': Palette,
  'fixtures': Wrench,
  'appliances': ChefHat,
  'custom': Settings
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

const ITEM_STATES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-100 text-green-800' },
  { value: 'not_needed', label: 'Not Needed', color: 'bg-gray-100 text-gray-800' },
  { value: 'custom_expanded', label: 'Custom Expanded', color: 'bg-blue-100 text-blue-800' }
]

export default function FFEManagementEnhanced({ orgId, user }: FFEManagementEnhancedProps) {
  // Main State
  const [viewState, setViewState] = useState<FFEManagementViewState>({
    activeTab: 'room_libraries',
    searchTerm: '',
    statusFilter: 'all',
    scopeFilter: 'all',
    levelFilter: 'all',
    showDeprecated: false,
    expandedCategories: new Set(),
    selectedItems: new Set(),
    showAddItemModal: false,
    showEditItemModal: false,
    showVersionHistoryModal: false,
    showBulkOperationsModal: false
  })

  // Data State
  const [roomLibraries, setRoomLibraries] = useState<FFERoomLibrary[]>([])
  const [categories, setCategories] = useState<FFECategory[]>([])
  const [itemTemplates, setItemTemplates] = useState<FFEItemTemplate[]>([])
  const [versionHistory, setVersionHistory] = useState<FFEVersionHistory[]>([])
  const [globalSettings, setGlobalSettings] = useState<FFEGlobalSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [itemFormData, setItemFormData] = useState<FFEItemFormData>({
    name: '',
    category: 'furniture',
    level: 'base',
    scope: 'room_specific',
    defaultState: 'pending',
    isRequired: false,
    supportsMultiChoice: false,
    roomTypes: [],
    excludeFromRoomTypes: [],
    subItems: [],
    conditionalOn: [],
    mutuallyExclusiveWith: [],
    tags: [],
    supplierInfo: []
  })

  const [categoryFormData, setCategoryFormData] = useState<FFECategoryFormData>({
    name: '',
    roomTypes: [],
    isGlobal: false,
    isExpandable: true
  })

  const [roomLibraryFormData, setRoomLibraryFormData] = useState<FFERoomLibraryFormData>({
    name: '',
    roomType: '',
    categories: []
  })

  // Load initial data
  useEffect(() => {
    loadData()
  }, [orgId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [
        roomLibsRes,
        categoriesRes,
        itemsRes,
        settingsRes,
        historyRes
      ] = await Promise.all([
        fetch(`/api/ffe/room-libraries?orgId=${orgId}`),
        fetch(`/api/ffe/categories?orgId=${orgId}`),
        fetch(`/api/ffe/items?orgId=${orgId}`),
        fetch(`/api/ffe/settings?orgId=${orgId}`),
        fetch(`/api/ffe/version-history?orgId=${orgId}`)
      ])

      if (roomLibsRes.ok) {
        const data = await roomLibsRes.json()
        setRoomLibraries(data.libraries || [])
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.categories || [])
      }

      if (itemsRes.ok) {
        const data = await itemsRes.json()
        setItemTemplates(data.items || [])
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setGlobalSettings(data.settings)
      }

      if (historyRes.ok) {
        const data = await historyRes.json()
        setVersionHistory(data.history || [])
      }

    } catch (error) {
      console.error('Error loading FFE management data:', error)
      toast.error('Failed to load FFE management data')
    } finally {
      setLoading(false)
    }
  }

  // Filtered and organized data
  const filteredItems = useMemo(() => {
    return itemTemplates.filter(item => {
      if (viewState.searchTerm && !item.name.toLowerCase().includes(viewState.searchTerm.toLowerCase())) {
        return false
      }
      if (viewState.statusFilter !== 'all') {
        if (viewState.statusFilter === 'active' && !item.isActive) return false
        if (viewState.statusFilter === 'deprecated' && item.isActive) return false
      }
      if (viewState.scopeFilter !== 'all' && item.scope !== viewState.scopeFilter) {
        return false
      }
      if (viewState.levelFilter !== 'all' && item.level !== viewState.levelFilter) {
        return false
      }
      if (!viewState.showDeprecated && item.deprecatedAt) {
        return false
      }
      if (viewState.selectedCategory && item.category !== viewState.selectedCategory) {
        return false
      }
      return true
    })
  }, [itemTemplates, viewState])

  const categorizedItems = useMemo(() => {
    const grouped = new Map<string, FFEItemTemplate[]>()
    filteredItems.forEach(item => {
      if (!grouped.has(item.category)) {
        grouped.set(item.category, [])
      }
      grouped.get(item.category)!.push(item)
    })
    return grouped
  }, [filteredItems])

  const updateViewState = (updates: Partial<FFEManagementViewState>) => {
    setViewState(prev => ({ ...prev, ...updates }))
  }

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(viewState.expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    updateViewState({ expandedCategories: newExpanded })
  }

  const handleCreateItem = async () => {
    try {
      const response = await fetch('/api/ffe/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          userId: user.id,
          ...itemFormData
        })
      })

      if (response.ok) {
        toast.success('FFE item created successfully')
        updateViewState({ showAddItemModal: false })
        resetItemForm()
        await loadData()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to create item')
      }
    } catch (error) {
      toast.error('Failed to create item')
    }
  }

  const resetItemForm = () => {
    setItemFormData({
      name: '',
      category: 'furniture',
      level: 'base',
      scope: 'room_specific',
      defaultState: 'pending',
      isRequired: false,
      supportsMultiChoice: false,
      roomTypes: [],
      excludeFromRoomTypes: [],
      subItems: [],
      conditionalOn: [],
      mutuallyExclusiveWith: [],
      tags: [],
      supplierInfo: []
    })
  }

  const addSubItem = () => {
    const newSubItem: FFESubItem = {
      id: `sub-${Date.now()}`,
      name: '',
      defaultState: 'pending',
      isRequired: false,
      order: itemFormData.subItems.length
    }
    setItemFormData(prev => ({
      ...prev,
      subItems: [...prev.subItems, newSubItem]
    }))
  }

  const updateSubItem = (index: number, updates: Partial<FFESubItem>) => {
    setItemFormData(prev => ({
      ...prev,
      subItems: prev.subItems.map((item, i) => 
        i === index ? { ...item, ...updates } : item
      )
    }))
  }

  const removeSubItem = (index: number) => {
    setItemFormData(prev => ({
      ...prev,
      subItems: prev.subItems.filter((_, i) => i !== index)
    }))
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Enhanced FFE Management</CardTitle>
            <p className="text-gray-600 mt-1">
              Comprehensive room library, category, and item template management
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-2" />
              Version History
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={viewState.activeTab} onValueChange={(value) => updateViewState({ activeTab: value as any })}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="room_libraries" className="flex items-center">
              <Home className="h-4 w-4 mr-2" />
              Room Libraries
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center">
              <Tag className="h-4 w-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="global_items" className="flex items-center">
              <Globe className="h-4 w-4 mr-2" />
              Global Items
            </TabsTrigger>
            <TabsTrigger value="version_control" className="flex items-center">
              <History className="h-4 w-4 mr-2" />
              Version Control
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Room Libraries Tab */}
          <TabsContent value="room_libraries" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Room Libraries</h3>
                <p className="text-sm text-gray-600">
                  Master templates for each room type with customizable categories and items
                </p>
              </div>
              <Button onClick={() => updateViewState({ showAddItemModal: true })}>
                <Plus className="h-4 w-4 mr-2" />
                Create Room Library
              </Button>
            </div>

            {/* Room Library Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ROOM_TYPE_OPTIONS.map(roomType => {
                const library = roomLibraries.find(lib => lib.roomType === roomType.value && lib.isActive)
                const itemCount = itemTemplates.filter(item => 
                  item.roomTypes.includes(roomType.value) || 
                  (item.scope === 'global' && !item.excludeFromRoomTypes?.includes(roomType.value))
                ).length

                return (
                  <Card key={roomType.value} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{roomType.label}</h4>
                          <p className="text-sm text-gray-600">
                            {library ? `Version ${library.version}` : 'No template'}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Items</span>
                          <Badge variant="secondary">{itemCount}</Badge>
                        </div>
                        
                        {library && (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Projects Using</span>
                              <Badge variant="outline">{library.projectsUsing}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Last Updated</span>
                              <span className="text-gray-500">
                                {new Date(library.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {!library && (
                        <div className="mt-4 pt-4 border-t">
                          <Button size="sm" className="w-full" variant="outline">
                            <Plus className="h-3 w-3 mr-2" />
                            Create Template
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">FFE Categories</h3>
                <p className="text-sm text-gray-600">
                  Organize FFE items into categories with room-specific configurations
                </p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>

            {/* Categories List */}
            <div className="space-y-4">
              {categories.map(category => {
                const categoryItems = itemTemplates.filter(item => item.category === category.id)
                const isExpanded = viewState.expandedCategories.has(category.id)
                const CategoryIcon = CATEGORY_ICONS[category.id as keyof typeof CATEGORY_ICONS] || Building2

                return (
                  <Card key={category.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Category Header */}
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleCategoryExpansion(category.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <CategoryIcon className="h-5 w-5 text-gray-600" />
                          <div>
                            <h4 className="font-medium">{category.name}</h4>
                            <p className="text-sm text-gray-600">
                              {categoryItems.length} items • {category.roomTypes.length} room types
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {category.isGlobal && (
                            <Badge variant="secondary" className="text-xs">
                              <Globe className="h-3 w-3 mr-1" />
                              Global
                            </Badge>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Category Items (Expanded) */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50/50">
                          {categoryItems.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No items in this category</p>
                              <Button size="sm" variant="outline" className="mt-2">
                                <Plus className="h-3 w-3 mr-2" />
                                Add Item
                              </Button>
                            </div>
                          ) : (
                            <div className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {categoryItems.map(item => (
                                  <ItemCard key={item.id} item={item} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Global Items Tab */}
          <TabsContent value="global_items" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Global FFE Items</h3>
                <p className="text-sm text-gray-600">
                  Items that apply to all room types unless specifically excluded
                </p>
              </div>
              <Dialog open={viewState.showAddItemModal} onOpenChange={(open) => updateViewState({ showAddItemModal: open })}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Global Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Global FFE Item</DialogTitle>
                  </DialogHeader>
                  <FFEItemForm 
                    formData={itemFormData}
                    setFormData={setItemFormData}
                    onSave={handleCreateItem}
                    onCancel={() => {
                      updateViewState({ showAddItemModal: false })
                      resetItemForm()
                    }}
                    availableItems={itemTemplates}
                    categories={categories}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search items..."
                    value={viewState.searchTerm}
                    onChange={(e) => updateViewState({ searchTerm: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <Select value={viewState.statusFilter} onValueChange={(value: any) => updateViewState({ statusFilter: value })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="deprecated">Deprecated Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={viewState.levelFilter} onValueChange={(value: any) => updateViewState({ levelFilter: value })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Item Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {ITEM_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="show-deprecated"
                  checked={viewState.showDeprecated}
                  onCheckedChange={(checked) => updateViewState({ showDeprecated: Boolean(checked) })}
                />
                <label htmlFor="show-deprecated" className="text-sm font-medium">
                  Show deprecated items
                </label>
              </div>
            </div>

            {/* Items Grid */}
            <div className="space-y-6">
              {Array.from(categorizedItems.entries()).map(([categoryId, items]) => {
                const category = categories.find(c => c.id === categoryId)
                const CategoryIcon = CATEGORY_ICONS[categoryId as keyof typeof CATEGORY_ICONS] || Building2
                
                return (
                  <div key={categoryId}>
                    <div className="flex items-center space-x-2 mb-4">
                      <CategoryIcon className="h-5 w-5 text-gray-600" />
                      <h4 className="text-lg font-medium">{category?.name || categoryId}</h4>
                      <Badge variant="outline">{items.length}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map(item => (
                        <ItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No items found</p>
                <p className="text-sm mt-1">
                  Try adjusting your search or filters, or add your first global item
                </p>
              </div>
            )}
          </TabsContent>

          {/* Version Control Tab */}
          <TabsContent value="version_control" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Version Control</h3>
                <p className="text-sm text-gray-600">
                  Track changes to room libraries and manage version history
                </p>
              </div>
              <Button variant="outline">
                <Archive className="h-4 w-4 mr-2" />
                Create Snapshot
              </Button>
            </div>

            {/* Version History */}
            <div className="space-y-4">
              {versionHistory.map(version => (
                <Card key={version.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            version.changeType === 'created' ? 'default' :
                            version.changeType === 'updated' ? 'secondary' :
                            version.changeType === 'deprecated' ? 'destructive' : 'outline'
                          }>
                            {version.changeType}
                          </Badge>
                          <span className="font-medium">{version.changeDescription}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Version {version.version} • {new Date(version.createdAt).toLocaleDateString()}
                        </p>
                        {version.affectedProjects && version.affectedProjects.length > 0 && (
                          <p className="text-sm text-orange-600">
                            Affects {version.affectedProjects.length} active projects
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        {version.changeType !== 'deprecated' && (
                          <Button size="sm" variant="outline">
                            <RotateCcw className="h-3 w-3 mr-2" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">FFE Management Settings</h3>
              <p className="text-sm text-gray-600">
                Configure global settings for FFE management behavior
              </p>
            </div>

            {globalSettings && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Default Behaviors</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Auto-add custom items to library</label>
                      <Checkbox checked={globalSettings.autoAddCustomItems} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Enable version control</label>
                      <Checkbox checked={globalSettings.enableVersionControl} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Require approval for changes</label>
                      <Checkbox checked={globalSettings.requireApprovalForChanges} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Advanced Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Enable cost tracking</label>
                      <Checkbox checked={globalSettings.enableCostTracking} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Enable supplier integration</label>
                      <Checkbox checked={globalSettings.enableSupplierIntegration} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Enable usage analytics</label>
                      <Checkbox checked={globalSettings.enableUsageAnalytics} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Item Card Component
function ItemCard({ item }: { item: FFEItemTemplate }) {
  const stateConfig = ITEM_STATES.find(s => s.value === item.defaultState)
  const levelConfig = ITEM_LEVELS.find(l => l.value === item.level)
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{item.name}</h4>
            <p className="text-sm text-gray-600 truncate">{levelConfig?.label}</p>
          </div>
          <div className="flex space-x-1">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <Badge variant={stateConfig ? "secondary" : "outline"} className="text-xs">
              {stateConfig?.label || item.defaultState}
            </Badge>
            
            {item.scope === 'global' && (
              <Badge variant="outline" className="text-xs">
                <Globe className="h-2 w-2 mr-1" />
                Global
              </Badge>
            )}
            
            {item.isRequired && (
              <Badge variant="destructive" className="text-xs">
                Required
              </Badge>
            )}
            
            {item.supportsMultiChoice && (
              <Badge variant="secondary" className="text-xs">
                Multi-Choice
              </Badge>
            )}
            
            {item.subItems && item.subItems.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {item.subItems.length} sub-items
              </Badge>
            )}
          </div>

          <div className="text-xs text-gray-600">
            <p>
              {item.scope === 'global' 
                ? `All rooms${item.excludeFromRoomTypes?.length ? ` (excluding ${item.excludeFromRoomTypes.length})` : ''}`
                : `${item.roomTypes.length} room types`
              }
            </p>
            {item.estimatedCost && (
              <p className="flex items-center mt-1">
                <DollarSign className="h-3 w-3 mr-1" />
                ${item.estimatedCost}
              </p>
            )}
            {item.leadTimeWeeks && (
              <p className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {item.leadTimeWeeks} weeks
              </p>
            )}
          </div>

          {!item.isActive && (
            <div className="flex items-center text-xs text-red-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Deprecated
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// FFE Item Form Component
function FFEItemForm({ 
  formData, 
  setFormData, 
  onSave, 
  onCancel,
  availableItems,
  categories 
}: {
  formData: FFEItemFormData
  setFormData: (data: FFEItemFormData) => void
  onSave: () => void
  onCancel: () => void
  availableItems: FFEItemTemplate[]
  categories: FFECategory[]
}) {
  const updateField = (field: keyof FFEItemFormData, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const toggleRoomType = (roomType: string) => {
    const newRoomTypes = formData.roomTypes.includes(roomType)
      ? formData.roomTypes.filter(rt => rt !== roomType)
      : [...formData.roomTypes, roomType]
    updateField('roomTypes', newRoomTypes)
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

  const updateSubItem = (index: number, updates: Partial<FFESubItem>) => {
    const newSubItems = formData.subItems.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    )
    updateField('subItems', newSubItems)
  }

  const removeSubItem = (index: number) => {
    updateField('subItems', formData.subItems.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Item Name *</label>
          <Input
            placeholder="e.g., Custom Dining Chairs"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <Select value={formData.category} onValueChange={(value) => updateField('category', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Textarea
          placeholder="Describe this FFE item..."
          value={formData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
        />
      </div>

      {/* Item Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Item Level *</label>
          <Select value={formData.level} onValueChange={(value: any) => updateField('level', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_LEVELS.map(level => (
                <SelectItem key={level.value} value={level.value}>
                  <div>
                    <div className="font-medium">{level.label}</div>
                    <div className="text-xs text-gray-600">{level.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Scope *</label>
          <Select value={formData.scope} onValueChange={(value: any) => updateField('scope', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global (All Rooms)</SelectItem>
              <SelectItem value="room_specific">Room Specific</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Default State</label>
          <Select value={formData.defaultState} onValueChange={(value: any) => updateField('defaultState', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_STATES.map(state => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-3 pt-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formData.isRequired}
              onCheckedChange={(checked) => updateField('isRequired', checked)}
            />
            <label className="text-sm">Required item</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formData.supportsMultiChoice}
              onCheckedChange={(checked) => updateField('supportsMultiChoice', checked)}
            />
            <label className="text-sm">Supports multiple choices</label>
          </div>
        </div>
      </div>

      {/* Room Types */}
      {formData.scope === 'room_specific' && (
        <div>
          <label className="block text-sm font-medium mb-2">Applicable Room Types *</label>
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded">
            {ROOM_TYPE_OPTIONS.map(roomType => (
              <div key={roomType.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.roomTypes.includes(roomType.value)}
                  onCheckedChange={() => toggleRoomType(roomType.value)}
                />
                <label className="text-sm">{roomType.label}</label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Items (for Custom level) */}
      {formData.level === 'custom' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">Sub-Items</label>
            <Button size="sm" type="button" onClick={addSubItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-Item
            </Button>
          </div>
          
          <div className="space-y-3">
            {formData.subItems.map((subItem, index) => (
              <div key={subItem.id} className="flex items-center space-x-3 p-3 border rounded">
                <Input
                  placeholder="Sub-item name"
                  value={subItem.name}
                  onChange={(e) => updateSubItem(index, { name: e.target.value })}
                  className="flex-1"
                />
                
                <Select 
                  value={subItem.defaultState} 
                  onValueChange={(value: any) => updateSubItem(index, { defaultState: value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={subItem.isRequired}
                    onCheckedChange={(checked) => updateSubItem(index, { isRequired: Boolean(checked) })}
                  />
                  <label className="text-sm">Required</label>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => removeSubItem(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost and Timeline */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Estimated Cost</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="0"
              value={formData.estimatedCost || ''}
              onChange={(e) => updateField('estimatedCost', e.target.value ? Number(e.target.value) : undefined)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Lead Time (weeks)</label>
          <div className="relative">
            <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="0"
              value={formData.leadTimeWeeks || ''}
              onChange={(e) => updateField('leadTimeWeeks', e.target.value ? Number(e.target.value) : undefined)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <Textarea
          placeholder="Additional notes about this item..."
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Item
        </Button>
      </div>
    </div>
  )
}