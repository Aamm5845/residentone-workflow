'use client'

import { useState, useEffect } from 'react'
import { Plus, DollarSign, Package, CheckCircle, Truck, ExternalLink, Trash2, Edit, Save, X } from 'lucide-react'
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
}

interface FFEStats {
  totalItems: number
  totalBudget: number
  approvedItems: number
  completedItems: number
  suppliers: number
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
  const [categories, setCategories] = useState<Record<string, FFEItem[]>>({})
  const [stats, setStats] = useState<FFEStats>({
    totalItems: 0,
    totalBudget: 0,
    approvedItems: 0,
    completedItems: 0,
    suppliers: 0
  })
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    supplierLink: '',
    notes: '',
    leadTime: '',
    status: 'NOT_STARTED'
  })

  // Load FFE data
  const loadFFEData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe?roomId=${roomId}`)
      const data = await response.json()
      
      if (data.success) {
        setCategories(data.categories || {})
        setStats(data.stats || {
          totalItems: 0,
          totalBudget: 0,
          approvedItems: 0,
          completedItems: 0,
          suppliers: 0
        })
      } else {
        throw new Error(data.error || 'Failed to load FFE data')
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

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Debug logging
    console.log('Form submitted with data:', formData)
    console.log('Room ID:', roomId)
    
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
          status: 'NOT_STARTED'
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
        <Button 
          onClick={() => {
            console.log('Add Item button clicked')
            setShowAddForm(true)
          }}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
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

      {/* Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {FFE_CATEGORIES.map((category) => {
          const categoryItems = categories[category.name] || []
          
          return (
            <FFECategoryCard
              key={category.name}
              category={category}
              items={categoryItems}
              onItemUpdate={loadFFEData}
            />
          )
        })}
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

// FFE Category Card Component
function FFECategoryCard({ 
  category, 
  items, 
  onItemUpdate 
}: { 
  category: any
  items: FFEItem[]
  onItemUpdate: () => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 group">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 bg-gradient-to-r ${category.color} rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
              <span className="text-lg text-white">{category.icon}</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{category.name}</h4>
              <p className="text-xs text-gray-500">{items.length} items</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-2xl mb-2 block">{category.icon}</span>
            <p className="text-sm">No items added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <FFEItemCard key={item.id} item={item} onUpdate={onItemUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// FFE Item Card Component
function FFEItemCard({ item, onUpdate }: { item: FFEItem; onUpdate: () => void }) {
  const statusColor = FFE_STATUSES.find(s => s.value === item.status)?.color || 'gray'
  
  return (
    <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h5 className="font-medium text-gray-900">{item.name}</h5>
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
