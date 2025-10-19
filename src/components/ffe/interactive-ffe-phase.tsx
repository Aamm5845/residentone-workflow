'use client'

import { useState, useEffect } from 'react'
import { Plus, DollarSign, Package, CheckCircle, Truck, ExternalLink, Trash2, Edit, Save, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import toast from 'react-hot-toast'

interface FFEItem {
  id: string
  name: string
  category: string
  status: string
  price?: number
  supplierLink?: string
  notes?: string
  leadTime?: string
  createdBy?: { name: string }
  updatedBy?: { name: string }
  createdAt: string
  updatedAt: string
  isFromLibrary?: boolean
  libraryItemId?: string
}

interface FFEStats {
  totalItems: number
  totalBudget: number
  approvedItems: number
  completedItems: number
  suppliers: number
}

interface FFESection {
  id: string
  name: string
  description?: string
  order: number
  isExpanded: boolean
  isCompleted: boolean
  items: FFEItem[]
  templateSection?: {
    name: string
    description?: string
    icon?: string
    color?: string
  }
}

const FFE_CATEGORIES = [
  { name: 'Furniture', icon: '🛋️', color: 'from-amber-500 to-orange-500' },
  { name: 'Lighting', icon: '💡', color: 'from-yellow-400 to-amber-500' },
  { name: 'Textiles', icon: '🧵', color: 'from-pink-500 to-rose-500' },
  { name: 'Art & Accessories', icon: '🎨', color: 'from-purple-500 to-indigo-500' },
  { name: 'Window Treatments', icon: '🪟', color: 'from-blue-500 to-cyan-500' },
  { name: 'Hardware & Fixtures', icon: '⚙️', color: 'from-gray-500 to-slate-600' }
]

const FFE_STATUSES = [
  { value: 'NOT_STARTED', label: 'Not Started', color: 'gray' },
  { value: 'SOURCING', label: 'Sourcing', color: 'blue' },
  { value: 'PROPOSED', label: 'Proposed', color: 'yellow' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'ORDERED', label: 'Ordered', color: 'indigo' },
  { value: 'DELIVERED', label: 'Delivered', color: 'purple' },
  { value: 'COMPLETED', label: 'Completed', color: 'emerald' }
]

interface InteractiveFFEPhaseProps {
  roomId: string
}

export default function InteractiveFFEPhase({ roomId }: InteractiveFFEPhaseProps) {
  const [sections, setSections] = useState<FFESection[]>([])
  const [stats, setStats] = useState<FFEStats>({
    totalItems: 0,
    totalBudget: 0,
    approvedItems: 0,
    completedItems: 0,
    suppliers: 0
  })
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showAddSectionForm, setShowAddSectionForm] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    supplierLink: '',
    notes: '',
    leadTime: '',
    status: 'NOT_STARTED',
    sectionId: ''
  })
  const [sectionFormData, setSectionFormData] = useState({
    name: '',
    description: ''
  })
  const [instanceId, setInstanceId] = useState<string | null>(null)

  // Load FFE data - first get or create FFE instance, then load sections
  const loadFFEData = async () => {
    try {
      setLoading(true)
      
      // First, get or create the FFE instance for this room
      const instanceResponse = await fetch(`/api/ffe/instances?roomId=${roomId}`)
      const instanceData = await instanceResponse.json()
      
      if (instanceData.success && instanceData.instance) {
        setInstanceId(instanceData.instance.id)
        
        // Then load sections for this instance
        const sectionsResponse = await fetch(`/api/ffe/sections?instanceId=${instanceData.instance.id}`)
        const sectionsData = await sectionsResponse.json()
        
        if (sectionsData.success) {
          setSections(sectionsData.sections || [])
          
          // Calculate stats from sections
          const allItems = sectionsData.sections.flatMap((section: FFESection) => section.items)
          const totalItems = allItems.length
          const totalBudget = allItems.reduce((sum: number, item: FFEItem) => sum + (item.price || 0), 0)
          const approvedItems = allItems.filter((item: FFEItem) => item.status === 'APPROVED').length
          const completedItems = allItems.filter((item: FFEItem) => ['COMPLETED', 'DELIVERED'].includes(item.status)).length
          const suppliers = new Set(allItems.filter((item: FFEItem) => item.supplierLink).map((item: FFEItem) => item.supplierLink)).size
          
          setStats({ totalItems, totalBudget, approvedItems, completedItems, suppliers })
        } else {
          throw new Error(sectionsData.error || 'Failed to load sections')
        }
      } else {
        throw new Error(instanceData.error || 'Failed to load FFE instance')
      }
    } catch (error) {
      console.error('Failed to load FFE data:', error)
      toast.error('Failed to load FFE items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFFEData()
  }, [roomId])

  const handleSubmitSection = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!instanceId) {
      toast.error('FFE instance not found')
      return
    }
    
    try {
      const response = await fetch('/api/ffe/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          name: sectionFormData.name,
          description: sectionFormData.description
        })
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success('Section added successfully!')
        setShowAddSectionForm(false)
        setSectionFormData({ name: '', description: '' })
        await loadFFEData() // Reload sections
      } else {
        throw new Error(result.error || 'Failed to add section')
      }
    } catch (error) {
      console.error('Failed to add section:', error)
      toast.error('Failed to add section')
    }
  }

  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!confirm(`Are you sure you want to delete the "${sectionName}" section? This will also delete all items in this section.`)) {
      return
    }

    try {
      const response = await fetch(`/api/ffe/sections/${sectionId}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message || 'Section deleted successfully!')
        await loadFFEData() // Reload sections
      } else {
        throw new Error(result.error || 'Failed to delete section')
      }
    } catch (error) {
      console.error('Failed to delete section:', error)
      toast.error('Failed to delete section')
    }
  }

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Debug logging

    try {
      const payload = {
        roomId,
        ...formData,
        price: formData.price ? parseFloat(formData.price) : undefined,
        supplierLink: formData.supplierLink || undefined
      }

      const response = await fetch('/api/ffe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success('FFE item added successfully!')
        setShowAddForm(false)
        setFormData({
          name: '',
          category: '',
          price: '',
          supplierLink: '',
          notes: '',
          leadTime: '',
          status: 'NOT_STARTED',
          sectionId: ''
        })
        await loadFFEData()
      } else {
        throw new Error(result.error || 'Failed to add FFE item')
      }
    } catch (error) {
      console.error('Failed to add FFE item:', error)
      toast.error('Failed to add FFE item')
    }
  }

  const getStatusColor = (status: string) => {
    const statusConfig = FFE_STATUSES.find(s => s.value === status)
    return statusConfig?.color || 'gray'
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-200 rounded-xl h-48"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Furniture, Fixtures & Equipment</h3>
          <p className="text-gray-600 mt-1">Manage and track all interior elements for this room</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => setShowAddSectionForm(true)}
            variant="outline" 
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </Button>
          <Button 
            onClick={() => {
              
              setShowAddForm(true)
            }}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Add New FFE Item</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <form onSubmit={handleSubmitItem} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., King Size Bed Frame"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {FFE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.name} value={cat.name}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FFE_STATUSES.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="supplierLink">Supplier Link</Label>
              <Input
                id="supplierLink"
                type="url"
                value={formData.supplierLink}
                onChange={(e) => setFormData({...formData, supplierLink: e.target.value})}
                placeholder="https://supplier.com/product"
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional specifications, notes, or requirements"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Add Section Form */}
      {showAddSectionForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Add New FFE Section</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowAddSectionForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <form onSubmit={handleSubmitSection} className="space-y-4">
            <div>
              <Label htmlFor="sectionName">Section Name *</Label>
              <Input
                id="sectionName"
                value={sectionFormData.name}
                onChange={(e) => setSectionFormData({...sectionFormData, name: e.target.value})}
                placeholder="e.g., Flooring, Lighting, Furniture"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="sectionDescription">Description (Optional)</Label>
              <Textarea
                id="sectionDescription"
                value={sectionFormData.description}
                onChange={(e) => setSectionFormData({...sectionFormData, description: e.target.value})}
                placeholder="Brief description of what this section covers"
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddSectionForm(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Add Section
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Sections View */}
      <div className="space-y-6">
        {sections.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-gray-400 mb-4">
              <Plus className="h-16 w-16 mx-auto" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No FFE sections yet</h4>
            <p className="text-gray-600 max-w-md mx-auto mb-4">
              Get started by creating your first FFE section. Organize your furniture, fixtures, and equipment by categories like flooring, lighting, or furniture.
            </p>
            <Button 
              onClick={() => setShowAddSectionForm(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Section
            </Button>
          </div>
        ) : (
          sections.map((section) => (
            <FFESectionCard
              key={section.id}
              section={section}
              onItemUpdate={loadFFEData}
              onDeleteSection={handleDeleteSection}
            />
          ))
        )}
      </div>

      {/* Summary Statistics */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">FFE Project Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.totalItems}</div>
            <div className="text-sm text-gray-600">Total Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              ${(stats.totalBudget / 1000).toFixed(0)}k
            </div>
            <div className="text-sm text-gray-600">Total Budget</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {stats.totalItems > 0 ? Math.round((stats.approvedItems / stats.totalItems) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.suppliers}</div>
            <div className="text-sm text-gray-600">Suppliers</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// FFE Section Card Component
function FFESectionCard({ 
  section, 
  onItemUpdate,
  onDeleteSection 
}: { 
  section: FFESection
  onItemUpdate: () => void
  onDeleteSection: (sectionId: string, sectionName: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(section.isExpanded)

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
    // Could also call API to persist expansion state
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="p-1 h-auto w-auto"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div>
              <h4 className="font-semibold text-gray-900">{section.name}</h4>
              {section.description && (
                <p className="text-xs text-gray-600">{section.description}</p>
              )}
              <p className="text-xs text-gray-500">{section.items.length} items</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteSection(section.id, section.name)}
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-6">
          {section.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No items in this section yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {section.items.map((item) => (
                <FFEItemCard key={item.id} item={item} onUpdate={onItemUpdate} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// FFE Item Card Component
function FFEItemCard({ item, onUpdate }: { item: FFEItem; onUpdate: () => void }) {
  const statusColor = FFE_STATUSES.find(s => s.value === item.status)?.color || 'gray'
  
  return (
    <div className={`p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
      item.isFromLibrary 
        ? 'border-purple-200 bg-purple-50/30' 
        : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h5 className="font-medium text-gray-900">{item.name}</h5>
            {item.isFromLibrary && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                Library
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${statusColor}-100 text-${statusColor}-800`}>
              {FFE_STATUSES.find(s => s.value === item.status)?.label || item.status}
            </span>
            {item.price && (
              <span className="text-sm font-medium text-gray-600">
                ${item.price.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        
        {item.supplierLink && (
          <a
            href={item.supplierLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      
      {item.notes && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{item.notes}</p>
      )}
      
      {item.leadTime && (
        <p className="text-xs text-gray-500 mt-1">Lead time: {item.leadTime}</p>
      )}
    </div>
  )
}
