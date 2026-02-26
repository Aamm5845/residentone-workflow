'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Building, Phone, Mail, MapPin, Briefcase, FileText, AlertCircle, CheckCircle, X, Upload, User, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { getTradeOptions, getTradeLabel } from '@/lib/contractor-utils'

interface ContractorContact {
  id?: string
  name: string
  email: string
  phone?: string | null
  role?: string | null
  isPrimary: boolean
}

interface Contractor {
  id: string
  businessName: string
  contactName: string | null
  email: string
  phone: string | null
  address: string | null
  type: 'CONTRACTOR' | 'SUBCONTRACTOR'
  specialty: string | null
  trade: string | null
  logoUrl: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  contacts?: ContractorContact[]
  projectContractors?: {
    id: string
    project: {
      id: string
      name: string
      status: string
    }
  }[]
}

interface ContractorsManagementProps {
  orgId: string
  user: {
    id: string
    role: string
  }
}

interface ContractorFormData {
  businessName: string
  contactName: string
  email: string
  phone: string
  address: string
  type: 'CONTRACTOR' | 'SUBCONTRACTOR'
  specialty: string
  trade: string
  logoUrl: string
  notes: string
  contacts: ContractorContact[]
}

const initialFormData: ContractorFormData = {
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  type: 'CONTRACTOR',
  specialty: '',
  trade: '',
  logoUrl: '',
  notes: '',
  contacts: []
}

export default function ContractorsManagement({ orgId, user }: ContractorsManagementProps) {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null)
  const [formData, setFormData] = useState<ContractorFormData>(initialFormData)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadContractors()
  }, [])

  const loadContractors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/contractors')
      if (response.ok) {
        const data = await response.json()
        setContractors(data)
      } else {
        toast.error('Failed to load contractors')
      }
    } catch (error) {
      console.error('Error loading contractors:', error)
      toast.error('Failed to load contractors')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setFormLoading(true)
    try {
      const url = editingContractor ? `/api/contractors/${editingContractor.id}` : '/api/contractors'
      const method = editingContractor ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success(editingContractor ? 'Contractor updated successfully' : 'Contractor added successfully')
        setShowForm(false)
        setEditingContractor(null)
        setFormData(initialFormData)
        await loadContractors()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to save contractor')
      }
    } catch (error) {
      console.error('Error saving contractor:', error)
      toast.error('Failed to save contractor')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (contractor: Contractor) => {
    setEditingContractor(contractor)
    setFormData({
      businessName: contractor.businessName,
      contactName: contractor.contactName || '',
      email: contractor.email,
      phone: contractor.phone || '',
      address: contractor.address || '',
      type: contractor.type,
      specialty: contractor.specialty || '',
      trade: contractor.trade || '',
      logoUrl: contractor.logoUrl || '',
      notes: contractor.notes || '',
      contacts: contractor.contacts || []
    })
    setShowForm(true)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const uploadFormData = new FormData()
    uploadFormData.append('file', file)
    uploadFormData.append('imageType', 'contractor-logo')

    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: uploadFormData,
      })
      if (res.ok) {
        const data = await res.json()
        setFormData(prev => ({ ...prev, logoUrl: data.url }))
        toast.success('Logo uploaded')
      } else {
        toast.error('Failed to upload logo')
      }
    } catch {
      toast.error('Failed to upload logo')
    }
  }

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', email: '', phone: '', role: '', isPrimary: prev.contacts.length === 0 }]
    }))
  }

  const updateContact = (index: number, field: keyof ContractorContact, value: any) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => {
        if (i !== index) return field === 'isPrimary' && value ? { ...c, isPrimary: false } : c
        return { ...c, [field]: value }
      })
    }))
  }

  const removeContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index)
    }))
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/contractors/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message || 'Contractor deleted successfully')
        await loadContractors()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to delete contractor')
      }
    } catch (error) {
      console.error('Error deleting contractor:', error)
      toast.error('Failed to delete contractor')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingContractor(null)
    setFormData(initialFormData)
  }

  const filteredContractors = contractors.filter(contractor =>
    contractor.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contractor.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contractor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contractor.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const contractorCount = contractors.filter(c => c.isActive).length
  const subcontractorCount = contractors.filter(c => c.isActive && c.type === 'SUBCONTRACTOR').length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building className="w-5 h-5 mr-2" />
            Contractors & Subcontractors
          </CardTitle>
          <CardDescription>
            Manage your database of contractors and subcontractors for projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900">{contractorCount}</div>
                  <div className="text-sm text-blue-700">Active Contractors</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-900">{subcontractorCount}</div>
                  <div className="text-sm text-green-700">Active Subcontractors</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-900">{contractors.length}</div>
                  <div className="text-sm text-purple-700">Total in Database</div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contractors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button 
                  onClick={() => setShowForm(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contractor
                </Button>
              </div>

              {/* Contractors List */}
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
                  ))}
                </div>
              ) : filteredContractors.length > 0 ? (
                <div className="grid gap-4">
                  {filteredContractors.map((contractor) => (
                    <div key={contractor.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {contractor.logoUrl && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                              <Image src={contractor.logoUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{contractor.businessName}</h3>
                              <Badge
                                variant={contractor.type === 'CONTRACTOR' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {contractor.trade ? getTradeLabel(contractor.trade) : (contractor.type === 'CONTRACTOR' ? 'Contractor' : 'Subcontractor')}
                              </Badge>
                              {!contractor.isActive && (
                                <Badge variant="destructive" className="text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-1 text-sm text-gray-600">
                              {contractor.contactName && (
                                <div className="flex items-center">
                                  <User className="w-4 h-4 mr-2" />
                                  <span>{contractor.contactName}</span>
                                </div>
                              )}
                              <div className="flex items-center">
                                <Mail className="w-4 h-4 mr-2" />
                                <span>{contractor.email}</span>
                              </div>
                              {contractor.phone && (
                                <div className="flex items-center">
                                  <Phone className="w-4 h-4 mr-2" />
                                  <span>{contractor.phone}</span>
                                </div>
                              )}
                              {contractor.address && (
                                <div className="flex items-center">
                                  <MapPin className="w-4 h-4 mr-2" />
                                  <span>{contractor.address}</span>
                                </div>
                              )}
                              {contractor.contacts && contractor.contacts.length > 0 && (
                                <div className="flex items-center text-xs text-purple-600">
                                  <Users className="w-4 h-4 mr-2" />
                                  <span>{contractor.contacts.length} contact{contractor.contacts.length !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>

                            {contractor.projectContractors && contractor.projectContractors.length > 0 && (
                              <div className="mt-2 text-xs text-gray-500">
                                Used in {contractor.projectContractors.length} project(s)
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(contractor)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirm(contractor.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No contractors found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm ? 'No contractors match your search.' : 'Get started by adding your first contractor.'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Contractor
                    </Button>
                  )}
                </div>
              )}
            </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingContractor ? 'Edit Contractor' : 'Add New Contractor'}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Logo Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                    {formData.logoUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                          <Image src={formData.logoUrl} alt="Logo" width={64} height={64} className="object-cover w-full h-full" />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({ ...formData, logoUrl: '' })} className="text-red-500 hover:text-red-700">
                          <X className="w-4 h-4 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors">
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        <Upload className="w-5 h-5 text-gray-400" />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Name *
                    </label>
                    <Input
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      placeholder="ABC Construction Inc."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name
                    </label>
                    <Input
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@abcconstruction.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'CONTRACTOR' | 'SUBCONTRACTOR' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="CONTRACTOR">Contractor</option>
                      <option value="SUBCONTRACTOR">Subcontractor</option>
                    </select>
                  </div>

                  {/* Trade Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trade / Profession
                    </label>
                    <select
                      value={formData.trade}
                      onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select a trade...</option>
                      {getTradeOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {(!formData.trade || formData.trade === 'OTHER') && formData.type === 'SUBCONTRACTOR' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Specialty
                      </label>
                      <Input
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        placeholder="e.g., Custom Metalwork"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Contacts Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-700">Contacts</label>
                      <Button type="button" variant="outline" size="sm" onClick={addContact}>
                        <Plus className="w-3 h-3 mr-1" /> Add Contact
                      </Button>
                    </div>
                    {formData.contacts.length > 0 ? (
                      <div className="space-y-3">
                        {formData.contacts.map((contact, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2 relative">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="primaryContact"
                                    checked={contact.isPrimary}
                                    onChange={() => updateContact(idx, 'isPrimary', true)}
                                    className="accent-purple-600"
                                  />
                                  Primary
                                </label>
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(idx)} className="text-red-500 hover:text-red-700 h-6 w-6 p-0">
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={contact.name}
                                onChange={(e) => updateContact(idx, 'name', e.target.value)}
                                placeholder="Name *"
                                className="text-sm"
                              />
                              <Input
                                type="email"
                                value={contact.email}
                                onChange={(e) => updateContact(idx, 'email', e.target.value)}
                                placeholder="Email *"
                                className="text-sm"
                              />
                              <Input
                                value={contact.phone || ''}
                                onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                                placeholder="Phone"
                                className="text-sm"
                              />
                              <Input
                                value={contact.role || ''}
                                onChange={(e) => updateContact(idx, 'role', e.target.value)}
                                placeholder="Role (e.g., PM, Owner)"
                                className="text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No additional contacts. Use &quot;Add Contact&quot; to add team members for CC&apos;ing.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={formLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={formLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {formLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        {editingContractor ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {editingContractor ? 'Update Contractor' : 'Add Contractor'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this contractor? If the contractor is used in any projects, 
              it will be deactivated instead of permanently deleted.
            </p>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
