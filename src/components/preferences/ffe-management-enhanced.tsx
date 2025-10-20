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
import FFEItemForm from '@/components/ffe/FFEItemForm'
import ItemCard from '@/components/ffe/ItemCard'

// Define interfaces
interface FFEItemTemplate {
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

interface FFECategory {
  id: string
  name: string
  description?: string
  icon?: string
  order: number
  isExpandable: boolean
  roomTypes: string[]
  isGlobal: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdById: string
  updatedById: string
}

interface FFERoomLibrary {
  id: string
  name: string
  roomType: string
  version: string
  isActive: boolean
  isDefault: boolean
  categories: any[]
  customItemCount?: number
  totalItemCount?: number
  projectsUsing: number
  createdAt: string
  updatedAt: string
}

interface FFEVersionHistory {
  id: string
  orgId: string
  entityType: 'room_library' | 'category' | 'item_template'
  entityId: string
  version: string
  changeType: 'created' | 'updated' | 'deprecated' | 'restored'
  changeDescription: string
  changeDetails: any[]
  entitySnapshot: any
  affectedProjects?: any[]
  migrationRequired: boolean
  migrationNotes?: string
  autoMigrationPossible: boolean
  createdAt: string
  createdById: string
}

interface FFEGlobalSettings {
  id: string
  orgId: string
  autoAddCustomItems: boolean
  enableVersionControl: boolean
  requireApprovalForChanges: boolean
  enableCostTracking: boolean
  enableSupplierIntegration: boolean
  enableUsageAnalytics: boolean
  createdAt: string
  updatedAt: string
  createdById: string
  updatedById: string
}

interface FFEManagementViewState {
  activeTab: 'room_presets' | 'library_items' | 'settings'
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
  subItems: any[]
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
  // Entry & Circulation
  { value: 'ENTRANCE', label: 'Entrance' },
  { value: 'FOYER', label: 'Foyer' },
  { value: 'STAIRCASE', label: 'Staircase' },
  
  // Living Spaces
  { value: 'LIVING_ROOM', label: 'Living Room' },
  { value: 'DINING_ROOM', label: 'Dining Room' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'STUDY_ROOM', label: 'Study Room' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'PLAYROOM', label: 'Playroom' },
  
  // Bedrooms
  { value: 'MASTER_BEDROOM', label: 'Master Bedroom' },
  { value: 'BEDROOM', label: 'Bedroom' },
  { value: 'GIRLS_ROOM', label: 'Girls Room' },
  { value: 'BOYS_ROOM', label: 'Boys Room' },
  
  // Bathrooms
  { value: 'POWDER_ROOM', label: 'Powder Room' },
  { value: 'MASTER_BATHROOM', label: 'Master Bathroom' },
  { value: 'FAMILY_BATHROOM', label: 'Family Bathroom' },
  { value: 'GIRLS_BATHROOM', label: 'Girls Bathroom' },
  { value: 'BOYS_BATHROOM', label: 'Boys Bathroom' },
  { value: 'GUEST_BATHROOM', label: 'Guest Bathroom' },
  { value: 'BATHROOM', label: 'Bathroom' },
  
  // Utility
  { value: 'LAUNDRY_ROOM', label: 'Laundry Room' },
  
  // Legacy/Other
  { value: 'FAMILY_ROOM', label: 'Family Room' },
  { value: 'HALLWAY', label: 'Hallway' },
  { value: 'PANTRY', label: 'Pantry' },
  { value: 'MUDROOM', label: 'Mudroom' },
  { value: 'CLOSET', label: 'Closet' },
  { value: 'OUTDOOR', label: 'Outdoor' },
  { value: 'SUKKAH', label: 'Sukkah' },
  { value: 'OTHER', label: 'Other' }
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
    activeTab: 'room_presets'
  })
  
  const [loading, setLoading] = useState(false)

  const updateViewState = (updates: Partial<FFEManagementViewState>) => {
    setViewState(prev => ({ ...prev, ...updates }))
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
            <CardTitle className="text-2xl font-bold">FFE Management</CardTitle>
            <p className="text-gray-600 mt-1">
              Manage room presets and FFE library items
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="room_presets" className="flex items-center">
              <Home className="h-4 w-4 mr-2" />
              Room Presets
            </TabsTrigger>
            <TabsTrigger value="library_items" className="flex items-center">
              <Globe className="h-4 w-4 mr-2" />
              Library Items
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Room Presets Tab */}
          <TabsContent value="room_presets" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Room Presets</h3>
                <p className="text-sm text-gray-600">
                  Preset templates for each bathroom type with all FFE categories
                </p>
              </div>
            </div>

            {/* Bathroom Presets Focus */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ROOM_TYPE_OPTIONS.filter(room => 
                room.value.includes('BATHROOM') || room.value === 'POWDER_ROOM'
              ).map(roomType => {
                // No hardcoded categories or items - user managed
                const bathroomCategories: string[] = []
                const totalItems = 0

                return (
                  <Card key={roomType.value} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{roomType.label}</h4>
                          <p className="text-sm text-gray-600">
                            Comprehensive FFE Template
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Ready
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Total Items</span>
                          <Badge variant="secondary">{totalItems}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">User Managed</span>
                          <Badge variant="outline">0</Badge>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>⚪ No hardcoded defaults</p>
                          <p>⚪ User-managed categories</p>
                          <p>⚪ Custom FFE items only</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* No Hardcoded Stats */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-gray-800 mb-2">User-Managed System</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">0</div>
                  <div className="text-gray-700">Hardcoded Categories</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">0</div>
                  <div className="text-gray-700">Default Items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">100%</div>
                  <div className="text-gray-700">User Control</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">∞</div>
                  <div className="text-gray-700">Custom Items</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Library Items Tab */}
          <TabsContent value="library_items" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Library Items</h3>
                <p className="text-sm text-gray-600">
                  View all items available in the bathroom preset library
                </p>
              </div>
            </div>

            {/* No Hardcoded Categories */}
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Settings className="h-16 w-16 mx-auto" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Hardcoded Categories</h4>
              <p className="text-gray-600 max-w-md mx-auto">
                All categories and items are now user-managed through the FFE Management system. 
                Create your own categories and items to build your custom FFE library.
              </p>
            </div>

            {/* User-Managed Features */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">User-Managed Features</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Settings className="h-5 w-5 text-green-600 mt-1" />
                      <div>
                        <h5 className="font-medium text-green-800">Custom Logic</h5>
                        <p className="text-sm text-green-700">
                          Define your own item logic and expansion rules through the FFE Management interface.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Plus className="h-5 w-5 text-blue-600 mt-1" />
                      <div>
                        <h5 className="font-medium text-blue-800">Flexible Categories</h5>
                        <p className="text-sm text-blue-700">
                          Create unlimited categories and items tailored to your specific workflow and requirements.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">FFE Settings</h3>
                <p className="text-sm text-gray-600">
                  Configure how FFE presets work in your projects
                </p>
              </div>
            </div>

            {/* Settings Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workspace Behavior</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Show all preset items by default</label>
                    <Checkbox checked={true} disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Allow multiple selections per category</label>
                    <Checkbox checked={true} disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Enable toilet special logic</label>
                    <Checkbox checked={true} disabled />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Template Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Template Version:</span>
                      <span className="font-medium">1.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Updated:</span>
                      <span className="font-medium">Today</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Supported Room Types:</span>
                      <span className="font-medium">7</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Categories:</span>
                      <span className="font-medium">9</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Implementation Note</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    The bathroom FFE template is designed to work across all bathroom types (Master, Powder Room, Girls, Boys, etc.).
                    Team members will see all preset categories when working in the FFE workspace and can select what's needed for each specific bathroom.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
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