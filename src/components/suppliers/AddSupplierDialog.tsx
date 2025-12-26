'use client'

import { useState, useEffect } from 'react'
import { 
  Plus, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  MapPin,
  Loader2,
  X,
  Image as ImageIcon,
  Tag,
  Wrench,
  Lightbulb,
  Sofa,
  Layers,
  CircleDot,
  Package,
  Shirt,
  MoreHorizontal,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
}

interface SupplierCategory {
  id: string
  name: string
  icon?: string
  color?: string
}

interface Supplier {
  id: string
  name: string
  contactName: string
  email: string
  logo?: string
  phone?: string
  address?: string
  website?: string
  notes?: string
  categoryId?: string
}

interface AddSupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSupplierCreated: (supplier: Supplier) => void
  initialName?: string // Pre-fill name if coming from URL extraction
}

const emptyFormData = {
  name: '',
  contactName: '',
  email: '',
  logo: '',
  phone: '',
  address: '',
  website: '',
  notes: '',
  categoryId: '',
  currency: 'CAD' as 'CAD' | 'USD'
}

export default function AddSupplierDialog({ 
  open, 
  onOpenChange, 
  onSupplierCreated,
  initialName = ''
}: AddSupplierDialogProps) {
  const [formData, setFormData] = useState({
    ...emptyFormData,
    name: initialName
  })
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [categories, setCategories] = useState<SupplierCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)

  // Load categories when dialog opens
  useEffect(() => {
    if (open) {
      loadCategories()
    }
  }, [open])

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

  // Reset form when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setFormData({
        ...emptyFormData,
        name: initialName
      })
    } else {
      setFormData(emptyFormData)
    }
    onOpenChange(newOpen)
  }

  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true)
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      
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
    }
  }

  const getCategoryInfo = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    if (!cat) return { name: 'Other', Icon: Tag, ...COLOR_MAP.gray }
    
    const Icon = ICON_MAP[cat.icon || 'Tag'] || Tag
    const colors = COLOR_MAP[cat.color || 'slate'] || COLOR_MAP.slate
    
    return { name: cat.name, Icon, ...colors }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Business name is required')
      return
    }
    if (!formData.contactName.trim()) {
      toast.error('Contact name is required')
      return
    }
    if (!formData.email.trim()) {
      toast.error('Contact email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          categoryId: formData.categoryId || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        onSupplierCreated(data.supplier)
        handleOpenChange(false)
        toast.success('Supplier added to phonebook')
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Add New Supplier
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo (optional)</Label>
            <div className="flex items-center gap-4">
              {formData.logo ? (
                <div className="relative">
                  <img 
                    src={formData.logo} 
                    alt="Logo" 
                    className="w-16 h-16 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleLogoUpload(file)
                    }}
                    disabled={uploadingLogo}
                  />
                  {uploadingLogo ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  )}
                </label>
              )}
              <p className="text-xs text-muted-foreground">Upload company logo</p>
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Category</Label>
            {loadingCategories ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading categories...
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-[120px] overflow-y-auto">
                {categories.map(cat => {
                  const { Icon, text, bgLight } = getCategoryInfo(cat.id)
                  const isSelected = formData.categoryId === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, categoryId: cat.id }))}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all relative",
                        isSelected 
                          ? `${bgLight} border-current ${text}` 
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      )}
                    >
                      {isSelected && (
                        <Check className="absolute top-1 right-1 w-3 h-3" />
                      )}
                      <Icon className="w-4 h-4 mb-0.5" />
                      <span className="text-[10px] font-medium truncate w-full text-center">{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Currency Selection */}
          <div className="space-y-2">
            <Label>Currency</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, currency: 'CAD' }))}
                className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-all ${
                  formData.currency === 'CAD'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                🇨🇦 CAD
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, currency: 'USD' }))}
                className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-all ${
                  formData.currency === 'USD'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                🇺🇸 USD
              </button>
            </div>
          </div>

          {/* Required Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Business Name <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Company name"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Name <span className="text-red-500">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={formData.contactName}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                  placeholder="Contact person"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contact Email <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@company.com"
                className="pl-10"
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website (optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://www.company.com"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address (optional)</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Full address"
                className="pl-10 min-h-[60px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
