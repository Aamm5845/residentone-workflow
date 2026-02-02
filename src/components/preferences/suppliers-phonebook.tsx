'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Loader2,
  X,
  Image as ImageIcon,
  Eye,
  Lightbulb,
  Wrench,
  Sofa,
  Layers,
  CircleDot,
  Package,
  Shirt,
  MoreHorizontal,
  ChevronRight,
  Tag,
  Settings,
  Check,
  FileText,
  History,
  Percent,
  Crop
} from 'lucide-react'
import LogoCropperDialog from '@/components/image/LogoCropperDialog'

// Flag icons as SVG components
const CanadaFlag = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="6" height="16" fill="#FF0000"/>
    <rect x="6" width="12" height="16" fill="#FFFFFF"/>
    <rect x="18" width="6" height="16" fill="#FF0000"/>
    <path d="M12 3L12.5 5H14L12.75 6L13.25 8L12 7L10.75 8L11.25 6L10 5H11.5L12 3Z" fill="#FF0000"/>
    <path d="M12 4.5L11 7H9.5L11 8.5L10.5 10L12 9L13.5 10L13 8.5L14.5 7H13L12 4.5Z" fill="#FF0000"/>
  </svg>
)

const USAFlag = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="16" fill="#FFFFFF"/>
    <rect width="24" height="1.23" fill="#B22234"/>
    <rect y="2.46" width="24" height="1.23" fill="#B22234"/>
    <rect y="4.92" width="24" height="1.23" fill="#B22234"/>
    <rect y="7.38" width="24" height="1.23" fill="#B22234"/>
    <rect y="9.85" width="24" height="1.23" fill="#B22234"/>
    <rect y="12.31" width="24" height="1.23" fill="#B22234"/>
    <rect y="14.77" width="24" height="1.23" fill="#B22234"/>
    <rect width="10" height="8.62" fill="#3C3B6E"/>
    <circle cx="1.5" cy="1" r="0.4" fill="white"/>
    <circle cx="3.5" cy="1" r="0.4" fill="white"/>
    <circle cx="5.5" cy="1" r="0.4" fill="white"/>
    <circle cx="7.5" cy="1" r="0.4" fill="white"/>
    <circle cx="2.5" cy="2" r="0.4" fill="white"/>
    <circle cx="4.5" cy="2" r="0.4" fill="white"/>
    <circle cx="6.5" cy="2" r="0.4" fill="white"/>
    <circle cx="1.5" cy="3" r="0.4" fill="white"/>
    <circle cx="3.5" cy="3" r="0.4" fill="white"/>
    <circle cx="5.5" cy="3" r="0.4" fill="white"/>
    <circle cx="7.5" cy="3" r="0.4" fill="white"/>
    <circle cx="2.5" cy="4" r="0.4" fill="white"/>
    <circle cx="4.5" cy="4" r="0.4" fill="white"/>
    <circle cx="6.5" cy="4" r="0.4" fill="white"/>
    <circle cx="1.5" cy="5" r="0.4" fill="white"/>
    <circle cx="3.5" cy="5" r="0.4" fill="white"/>
    <circle cx="5.5" cy="5" r="0.4" fill="white"/>
    <circle cx="7.5" cy="5" r="0.4" fill="white"/>
    <circle cx="2.5" cy="6" r="0.4" fill="white"/>
    <circle cx="4.5" cy="6" r="0.4" fill="white"/>
    <circle cx="6.5" cy="6" r="0.4" fill="white"/>
    <circle cx="1.5" cy="7" r="0.4" fill="white"/>
    <circle cx="3.5" cy="7" r="0.4" fill="white"/>
    <circle cx="5.5" cy="7" r="0.4" fill="white"/>
    <circle cx="7.5" cy="7" r="0.4" fill="white"/>
  </svg>
)
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// Icon mapping for dynamic categories
const ICON_MAP: Record<string, any> = {
  Wrench,
  Lightbulb,
  Sofa,
  Layers,
  CircleDot,
  Package,
  Shirt,
  MoreHorizontal,
  Tag,
  Building2,
  Eye,
}

// Color mapping
const COLOR_MAP: Record<string, { bg: string; text: string; bgLight: string }> = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', bgLight: 'bg-blue-50' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', bgLight: 'bg-amber-50' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', bgLight: 'bg-emerald-50' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', bgLight: 'bg-orange-50' },
  zinc: { bg: 'bg-zinc-500', text: 'text-zinc-600', bgLight: 'bg-zinc-50' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-600', bgLight: 'bg-indigo-50' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-600', bgLight: 'bg-pink-50' },
  gray: { bg: 'bg-gray-500', text: 'text-gray-600', bgLight: 'bg-gray-50' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-600', bgLight: 'bg-slate-50' },
  red: { bg: 'bg-red-500', text: 'text-red-600', bgLight: 'bg-red-50' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-600', bgLight: 'bg-teal-50' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', bgLight: 'bg-cyan-50' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-600', bgLight: 'bg-rose-50' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-600', bgLight: 'bg-violet-50' },
}

const AVAILABLE_COLORS = Object.keys(COLOR_MAP)

interface SupplierCategory {
  id: string
  name: string
  icon?: string
  color?: string
  isDefault: boolean
  _count?: { suppliers: number }
}

interface Supplier {
  id: string
  name: string
  contactName: string
  email: string
  emails?: string[]
  category?: string
  categoryId?: string
  supplierCategory?: SupplierCategory
  currency?: string
  logo?: string
  phone?: string
  address?: string
  website?: string
  notes?: string
  markupPercent?: number | null
  isActive: boolean
  createdAt: string
}

interface SuppliersPhonebookProps {
  orgId: string
  user: {
    id: string
    name: string
    role: string
  }
}

const emptySupplier = {
  name: '',
  contactName: '',
  email: '',
  emails: [] as string[],
  categoryId: '',
  currency: 'CAD' as 'CAD' | 'USD',
  logo: '',
  phone: '',
  address: '',
  website: '',
  notes: '',
  markupPercent: '' as string
}

export default function SuppliersPhonebook({ orgId, user }: SuppliersPhonebookProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<SupplierCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState(emptySupplier)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [showCropperDialog, setShowCropperDialog] = useState(false)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  
  // Category form
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('slate')
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    loadCategories()
    loadSuppliers()
  }, [])

  const loadCategories = async () => {
    try {
      setLoadingCategories(true)
      const response = await fetch('/api/supplier-categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoadingCategories(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      setSavingCategory(true)
      const response = await fetch('/api/supplier-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          icon: 'Tag',
          color: newCategoryColor
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCategories(prev => [...prev, data.category].sort((a, b) => a.sortOrder - b.sortOrder))
        setNewCategoryName('')
        setNewCategoryColor('slate')
        toast.success('Category added!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add category')
      }
    } catch (error) {
      console.error('Error adding category:', error)
      toast.error('Failed to add category')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (category: SupplierCategory) => {
    if (category._count?.suppliers && category._count.suppliers > 0) {
      toast.error(`Cannot delete category with ${category._count.suppliers} supplier(s)`)
      return
    }

    if (!confirm(`Delete "${category.name}" category?`)) return

    try {
      const response = await fetch(`/api/supplier-categories?id=${category.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCategories(prev => prev.filter(c => c.id !== category.id))
        toast.success('Category deleted')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete category')
    }
  }

  const handleAddSupplier = async () => {
    if (!formData.name.trim()) {
      toast.error('Business name is required')
      return
    }
    if (!formData.contactName.trim()) {
      toast.error('Contact name is required')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Primary email is required')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          emails: formData.emails.length > 0 ? formData.emails : null,
          categoryId: formData.categoryId || null,
          markupPercent: formData.markupPercent ? parseFloat(formData.markupPercent) : null
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSuppliers(prev => [...prev, data.supplier].sort((a, b) => a.name.localeCompare(b.name)))
        setShowAddDialog(false)
        setFormData(emptySupplier)
        loadCategories() // Refresh counts
        toast.success('Supplier added successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add supplier')
      }
    } catch (error) {
      console.error('Error adding supplier:', error)
      toast.error('Failed to add supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleEditSupplier = async () => {
    if (!editingSupplier) return
    if (!formData.name.trim()) {
      toast.error('Business name is required')
      return
    }
    if (!formData.contactName.trim()) {
      toast.error('Contact name is required')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Primary email is required')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/suppliers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSupplier.id,
          ...formData,
          emails: formData.emails.length > 0 ? formData.emails : null,
          categoryId: formData.categoryId || null,
          markupPercent: formData.markupPercent ? parseFloat(formData.markupPercent) : null
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? data.supplier : s))
        setShowEditDialog(false)
        setEditingSupplier(null)
        setFormData(emptySupplier)
        loadCategories() // Refresh counts
        toast.success('Supplier updated successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update supplier')
      }
    } catch (error) {
      console.error('Error updating supplier:', error)
      toast.error('Failed to update supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`Are you sure you want to delete "${supplier.name}"?`)) return

    try {
      const response = await fetch(`/api/suppliers?id=${supplier.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSuppliers(prev => prev.filter(s => s.id !== supplier.id))
        loadCategories() // Refresh counts
        toast.success('Supplier deleted')
      } else {
        toast.error('Failed to delete supplier')
      }
    } catch (error) {
      console.error('Error deleting supplier:', error)
      toast.error('Failed to delete supplier')
    }
  }

  // Handle file selection - open cropper
  const handleFileSelect = (file: File) => {
    setPendingImageFile(file)
    setShowCropperDialog(true)
  }

  // Handle cropped image upload
  const handleCroppedLogoUpload = async (croppedBlob: Blob) => {
    try {
      setUploadingLogo(true)
      const formDataUpload = new FormData()
      formDataUpload.append('file', croppedBlob, 'logo.png')

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formDataUpload
      })

      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          setFormData(prev => ({ ...prev, logo: data.url }))
          toast.success('Logo uploaded')
        }
      } else {
        toast.error('Failed to upload logo')
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      setPendingImageFile(null)
    }
  }

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email,
      emails: supplier.emails || [],
      categoryId: supplier.categoryId || '',
      currency: (supplier.currency as 'CAD' | 'USD') || 'CAD',
      logo: supplier.logo || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      website: supplier.website || '',
      notes: supplier.notes || '',
      markupPercent: supplier.markupPercent != null ? String(supplier.markupPercent) : ''
    })
    setShowEditDialog(true)
  }

  const openViewDialog = (supplier: Supplier) => {
    setViewingSupplier(supplier)
    setShowViewDialog(true)
  }

  const addEmail = () => {
    if (!newEmail.trim()) return
    if (formData.emails.includes(newEmail.trim())) {
      toast.error('Email already added')
      return
    }
    if (newEmail.trim() === formData.email) {
      toast.error('This is already the primary email')
      return
    }
    setFormData(prev => ({ ...prev, emails: [...prev.emails, newEmail.trim()] }))
    setNewEmail('')
  }

  const removeEmail = (emailToRemove: string) => {
    setFormData(prev => ({ ...prev, emails: prev.emails.filter(e => e !== emailToRemove) }))
  }

  // Get category info with icon and color
  const getCategoryInfo = (categoryId?: string, category?: SupplierCategory) => {
    const cat = category || categories.find(c => c.id === categoryId)
    if (!cat) return { 
      name: 'Uncategorized', 
      Icon: Tag, 
      ...COLOR_MAP.gray 
    }
    
    const Icon = ICON_MAP[cat.icon || 'Tag'] || Tag
    const colors = COLOR_MAP[cat.color || 'slate'] || COLOR_MAP.slate
    
    return { name: cat.name, Icon, ...colors }
  }

  // Filter suppliers by search and category
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'ALL' || s.categoryId === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  // Count suppliers per category
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'ALL') return suppliers.length
    return suppliers.filter(s => s.categoryId === categoryId).length
  }

  const renderSupplierForm = () => (
    <div className="space-y-5">
      {/* Logo Upload */}
      <div className="flex items-start gap-4">
        {formData.logo ? (
          <div className="relative group">
            <img 
              src={formData.logo} 
              alt="Logo" 
              className="w-20 h-20 object-cover rounded-xl border-2 border-slate-200 shadow-sm"
            />
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
              disabled={uploadingLogo}
            />
            {uploadingLogo ? (
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-6 h-6 text-slate-400" />
                <span className="text-[10px] text-slate-400 mt-1">Upload</span>
              </>
            )}
          </label>
        )}
        <div className="flex-1">
          <Label className="text-slate-700 font-medium">Company Logo</Label>
          <p className="text-xs text-slate-500 mt-1">Optional. Recommended size: 200x200px</p>
        </div>
      </div>

      {/* Category Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-slate-700 font-medium">Category</Label>
          <button
            type="button"
            onClick={() => setShowCategoryDialog(true)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Category
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
          {categories.map(cat => {
            const { Icon, bg, text, bgLight } = getCategoryInfo(cat.id, cat)
            const isSelected = formData.categoryId === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, categoryId: cat.id }))}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all relative",
                  isSelected 
                    ? `${bgLight} border-current ${text}` 
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                )}
              >
                {isSelected && (
                  <div className={cn("absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center", bg)}>
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium truncate w-full text-center">{cat.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Currency Selection */}
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Currency</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, currency: 'CAD' }))}
            className={`flex-1 py-2.5 px-4 rounded-xl border-2 font-medium transition-all flex items-center justify-center gap-2 ${
              formData.currency === 'CAD'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            <CanadaFlag className="w-6 h-4 rounded-sm shadow-sm" />
            CAD
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, currency: 'USD' }))}
            className={`flex-1 py-2.5 px-4 rounded-xl border-2 font-medium transition-all flex items-center justify-center gap-2 ${
              formData.currency === 'USD'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            <USAFlag className="w-6 h-4 rounded-sm shadow-sm" />
            USD
          </button>
        </div>
        <p className="text-xs text-slate-500">All prices from this supplier will be in this currency</p>
      </div>

      {/* Fixed Markup */}
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Fixed Markup %</Label>
        <div className="relative">
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.markupPercent}
            onChange={(e) => setFormData(prev => ({ ...prev, markupPercent: e.target.value }))}
            placeholder="e.g. 15"
            className="h-11 pr-10"
          />
          <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
        <p className="text-xs text-slate-500">Leave empty to use category markup. This overrides category markup for this supplier.</p>
      </div>

      {/* Business Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">Business Name <span className="text-red-500">*</span></Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Company name"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">Contact Person <span className="text-red-500">*</span></Label>
          <Input
            value={formData.contactName}
            onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
            placeholder="John Doe"
            className="h-11"
          />
        </div>
      </div>

      {/* Primary Email */}
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Primary Email <span className="text-red-500">*</span></Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="contact@company.com"
          className="h-11"
        />
      </div>

      {/* Additional Emails */}
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Additional Emails</Label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Add another email..."
            className="h-11 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addEmail()
              }
            }}
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={addEmail}
            className="h-11 px-4"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {formData.emails.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.emails.map((email, idx) => (
              <Badge 
                key={idx} 
                variant="secondary"
                className="pl-3 pr-1.5 py-1.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200"
              >
                <Mail className="w-3 h-3 text-slate-500" />
                {email}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="ml-1 p-0.5 rounded-full hover:bg-slate-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Phone & Website */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">Phone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+1 (555) 000-0000"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium">Website</Label>
          <Input
            value={formData.website}
            onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
            placeholder="https://www.company.com"
            className="h-11"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Address</Label>
        <Textarea
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Full address"
          className="min-h-[70px] resize-none"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes about this supplier..."
          className="min-h-[70px] resize-none"
        />
      </div>
    </div>
  )

  const isLoading = loading || loadingCategories

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Supplier Phonebook
          </h2>
          <p className="text-slate-500 mt-1">Manage your supplier contacts organized by category</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowCategoryDialog(true)}
            className="h-11"
          >
            <Settings className="w-4 h-4 mr-2" />
            Categories
          </Button>
          <Button 
            onClick={() => {
              setFormData(emptySupplier)
              setShowAddDialog(true)
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 h-11 px-5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 pb-2">
        {/* View All Button */}
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all font-medium text-sm",
            selectedCategory === 'ALL'
              ? "bg-slate-600 text-white border-transparent shadow-lg" 
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
          )}
        >
          <Eye className="w-4 h-4" />
          View All
          <span className={cn(
            "ml-1 px-2 py-0.5 rounded-full text-xs font-bold",
            selectedCategory === 'ALL' ? "bg-white/20" : "bg-slate-100"
          )}>
            {suppliers.length}
          </span>
        </button>

        {/* Dynamic Category Buttons */}
        {categories.map(cat => {
          const { Icon, bg, text, bgLight } = getCategoryInfo(cat.id, cat)
          const isSelected = selectedCategory === cat.id
          const count = getCategoryCount(cat.id)
          
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all font-medium text-sm",
                isSelected 
                  ? `${bg} text-white border-transparent shadow-lg` 
                  : `bg-white border-slate-200 ${text} hover:border-current hover:${bgLight}`
              )}
            >
              <Icon className="w-4 h-4" />
              {cat.name}
              {count > 0 && (
                <span className={cn(
                  "ml-1 px-2 py-0.5 rounded-full text-xs font-bold",
                  isSelected ? "bg-white/20" : "bg-slate-100"
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, contact, or email..."
          className="pl-12 h-12 text-base bg-white border-slate-200 rounded-xl shadow-sm"
        />
      </div>

      {/* Suppliers Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-200">
          <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">
            {searchQuery ? 'No suppliers found matching your search' : 
             selectedCategory !== 'ALL' ? `No suppliers in this category yet` :
             'No suppliers added yet'}
          </p>
          {!searchQuery && selectedCategory === 'ALL' && (
            <Button 
              variant="outline" 
              className="mt-6 h-11"
              onClick={() => {
                setFormData(emptySupplier)
                setShowAddDialog(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Supplier
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map(supplier => {
            const catInfo = getCategoryInfo(supplier.categoryId, supplier.supplierCategory)
            const CategoryIcon = catInfo.Icon
            const allEmails = [supplier.email, ...(supplier.emails || [])]
            
            return (
              <div 
                key={supplier.id}
                onClick={() => openViewDialog(supplier)}
                className="group bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 cursor-pointer"
              >
                {/* Header Row */}
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  {supplier.logo ? (
                    <img
                      src={supplier.logo}
                      alt={supplier.name}
                      className="w-14 h-14 object-cover rounded-xl border border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center shadow-sm">
                      <span className="text-xl font-semibold text-emerald-700">
                        {supplier.name.substring(0, 1).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate text-lg group-hover:text-indigo-600 transition-colors">
                      {supplier.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-xs font-medium px-2 py-0.5",
                          catInfo.bgLight,
                          catInfo.text
                        )}
                      >
                        {catInfo.name}
                      </Badge>
                      {supplier.currency && supplier.currency !== 'CAD' && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-600 flex items-center gap-1"
                        >
                          <USAFlag className="w-4 h-3 rounded-sm" /> USD
                        </Badge>
                      )}
                      {supplier.markupPercent != null && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium px-2 py-0.5 bg-amber-50 text-amber-600 flex items-center gap-1"
                        >
                          <Percent className="w-3 h-3" /> {supplier.markupPercent}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Details */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{supplier.contactName}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{supplier.email}</span>
                    {allEmails.length > 1 && (
                      <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-500">
                        +{allEmails.length - 1}
                      </Badge>
                    )}
                  </div>

                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="truncate">{supplier.phone}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons - show on hover */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/procurement/suppliers/${supplier.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-9 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                    >
                      <History className="w-4 h-4 mr-2" />
                      History
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditDialog(supplier)
                    }}
                    className="h-9 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-3"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSupplier(supplier)
                    }}
                    className="h-9 text-slate-600 hover:text-red-600 hover:bg-red-50 px-3"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View Supplier Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Supplier Details</DialogTitle>
          </DialogHeader>
          {viewingSupplier && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                {viewingSupplier.logo ? (
                  <img
                    src={viewingSupplier.logo}
                    alt={viewingSupplier.name}
                    className="w-20 h-20 object-cover rounded-2xl border-2 border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl font-semibold text-emerald-700">
                      {viewingSupplier.name.substring(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900">{viewingSupplier.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-sm font-medium",
                        getCategoryInfo(viewingSupplier.categoryId, viewingSupplier.supplierCategory).bgLight,
                        getCategoryInfo(viewingSupplier.categoryId, viewingSupplier.supplierCategory).text
                      )}
                    >
                      {getCategoryInfo(viewingSupplier.categoryId, viewingSupplier.supplierCategory).name}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-sm font-medium",
                        viewingSupplier.currency === 'USD'
                          ? "bg-blue-50 text-blue-600"
                          : "bg-emerald-50 text-emerald-600"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {viewingSupplier.currency === 'USD'
                          ? <><USAFlag className="w-5 h-3.5 rounded-sm" /> USD</>
                          : <><CanadaFlag className="w-5 h-3.5 rounded-sm" /> CAD</>
                        }
                      </span>
                    </Badge>
                    {viewingSupplier.markupPercent != null && (
                      <Badge
                        variant="secondary"
                        className="text-sm font-medium bg-amber-50 text-amber-600"
                      >
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          {viewingSupplier.markupPercent}% markup
                        </span>
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 py-4 border-y border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Contact Person</p>
                    <p className="font-medium text-slate-900">{viewingSupplier.contactName}</p>
                  </div>
                </div>

                {/* All Emails */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Email{(viewingSupplier.emails?.length || 0) > 0 ? 's' : ''}</p>
                    <div className="space-y-1">
                      <a href={`mailto:${viewingSupplier.email}`} className="block font-medium text-indigo-600 hover:underline">
                        {viewingSupplier.email}
                      </a>
                      {viewingSupplier.emails?.map((email, idx) => (
                        <a key={idx} href={`mailto:${email}`} className="block text-slate-600 hover:text-indigo-600 hover:underline">
                          {email}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {viewingSupplier.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <a href={`tel:${viewingSupplier.phone}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {viewingSupplier.phone}
                      </a>
                    </div>
                  </div>
                )}

                {viewingSupplier.website && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Website</p>
                      <a 
                        href={viewingSupplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {viewingSupplier.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                )}

                {viewingSupplier.address && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="font-medium text-slate-900">{viewingSupplier.address}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {viewingSupplier.notes && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{viewingSupplier.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Link href={`/procurement/suppliers/${viewingSupplier.id}`} className="flex-1">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
                    onClick={() => setShowViewDialog(false)}
                  >
                    <History className="w-4 h-4 mr-2" />
                    View History
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewDialog(false)
                    openEditDialog(viewingSupplier)
                  }}
                  className="h-11"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowViewDialog(false)}
                  className="h-11"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Supplier Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-indigo-600" />
              </div>
              Add New Supplier
            </DialogTitle>
          </DialogHeader>
          {renderSupplierForm()}
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="h-11">
              Cancel
            </Button>
            <Button 
              onClick={handleAddSupplier} 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-6"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-indigo-600" />
              </div>
              Edit Supplier
            </DialogTitle>
          </DialogHeader>
          {renderSupplierForm()}
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="h-11">
              Cancel
            </Button>
            <Button 
              onClick={handleEditSupplier} 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-6"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Settings className="w-5 h-5 text-indigo-600" />
              </div>
              Manage Categories
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Add New Category */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <Label className="text-slate-700 font-medium">Add New Category</Label>
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name..."
                  className="h-10 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCategory()
                    }
                  }}
                />
                <Button 
                  onClick={handleAddCategory}
                  disabled={savingCategory || !newCategoryName.trim()}
                  className="h-10 bg-indigo-600 hover:bg-indigo-700"
                >
                  {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              
              {/* Color Selection */}
              <div>
                <Label className="text-xs text-slate-500">Color</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {AVAILABLE_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategoryColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full transition-all",
                        COLOR_MAP[color].bg,
                        newCategoryColor === color ? "ring-2 ring-offset-2 ring-slate-400" : ""
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Existing Categories */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Your Categories</Label>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {categories.map(cat => {
                  const { Icon, bg, text, bgLight } = getCategoryInfo(cat.id, cat)
                  return (
                    <div 
                      key={cat.id}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bgLight)}>
                          <Icon className={cn("w-5 h-5", text)} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{cat.name}</p>
                          <p className="text-xs text-slate-500">
                            {cat._count?.suppliers || 0} supplier{(cat._count?.suppliers || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {!cat.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(cat)}
                          disabled={(cat._count?.suppliers || 0) > 0}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)} className="h-10">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logo Cropper Dialog */}
      <LogoCropperDialog
        open={showCropperDialog}
        onOpenChange={setShowCropperDialog}
        imageFile={pendingImageFile}
        onCropComplete={handleCroppedLogoUpload}
      />
    </div>
  )
}
