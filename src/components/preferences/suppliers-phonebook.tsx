'use client'

import { useState, useEffect } from 'react'
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
  Upload,
  Image as ImageIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

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
  logo: '',
  phone: '',
  address: '',
  website: '',
  notes: ''
}

export default function SuppliersPhonebook({ orgId, user }: SuppliersPhonebookProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState(emptySupplier)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

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
      toast.error('Contact email is required')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const data = await response.json()
        setSuppliers(prev => [...prev, data.supplier].sort((a, b) => a.name.localeCompare(b.name)))
        setShowAddDialog(false)
        setFormData(emptySupplier)
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
      toast.error('Contact email is required')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/suppliers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSupplier.id,
          ...formData
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? data.supplier : s))
        setShowEditDialog(false)
        setEditingSupplier(null)
        setFormData(emptySupplier)
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
        toast.success('Supplier deleted')
      } else {
        toast.error('Failed to delete supplier')
      }
    } catch (error) {
      console.error('Error deleting supplier:', error)
      toast.error('Failed to delete supplier')
    }
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

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email,
      logo: supplier.logo || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      website: supplier.website || '',
      notes: supplier.notes || ''
    })
    setShowEditDialog(true)
  }

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderSupplierForm = () => (
    <div className="space-y-4">
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
            <label className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors">
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

      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes about this supplier..."
          className="min-h-[60px]"
        />
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Building2 className="w-5 h-5 mr-2" />
              Supplier Phonebook
            </CardTitle>
            <CardDescription>
              Manage your supplier contacts and information
            </CardDescription>
          </div>
          <Button onClick={() => {
            setFormData(emptySupplier)
            setShowAddDialog(true)
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suppliers..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Suppliers List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery ? 'No suppliers found matching your search' : 'No suppliers added yet'}
            </p>
            {!searchQuery && (
              <Button 
                variant="outline" 
                className="mt-4"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSuppliers.map(supplier => (
              <div 
                key={supplier.id}
                className="border rounded-lg p-4 hover:border-purple-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Logo or Placeholder */}
                  {supplier.logo ? (
                    <img 
                      src={supplier.logo} 
                      alt={supplier.name}
                      className="w-12 h-12 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-purple-600" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 truncate">{supplier.name}</h3>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(supplier)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteSupplier(supplier)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-1 space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <span className="truncate">{supplier.contactName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        <a 
                          href={`mailto:${supplier.email}`}
                          className="truncate hover:text-purple-600"
                        >
                          {supplier.email}
                        </a>
                      </div>
                      {supplier.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          <a 
                            href={`tel:${supplier.phone}`}
                            className="truncate hover:text-purple-600"
                          >
                            {supplier.phone}
                          </a>
                        </div>
                      )}
                      {supplier.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3" />
                          <a 
                            href={supplier.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate hover:text-purple-600"
                          >
                            {supplier.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Supplier Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                Add New Supplier
              </DialogTitle>
            </DialogHeader>
            {renderSupplierForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSupplier} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Supplier Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-purple-600" />
                Edit Supplier
              </DialogTitle>
            </DialogHeader>
            {renderSupplierForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSupplier} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

