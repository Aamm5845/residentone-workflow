'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Search, Building, Phone, Mail, MapPin, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

interface Contractor {
  id: string
  businessName: string
  contactName: string | null
  email: string
  phone: string | null
  address: string | null
  type: 'CONTRACTOR' | 'SUBCONTRACTOR'
  specialty: string | null
  notes: string | null
  isActive: boolean
}

interface ProjectContractor {
  id: string
  contractorId: string
  role?: string
  isActive: boolean
  contractor: Contractor
}

interface ProjectContractorSelectorProps {
  projectId: string
  projectContractors: ProjectContractor[]
  onUpdate: () => void
}

export default function ProjectContractorSelector({ 
  projectId, 
  projectContractors, 
  onUpdate 
}: ProjectContractorSelectorProps) {
  const [availableContractors, setAvailableContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewContractorForm, setShowNewContractorForm] = useState(false)
  const [newContractorData, setNewContractorData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    type: 'CONTRACTOR' as 'CONTRACTOR' | 'SUBCONTRACTOR',
    specialty: '',
    notes: ''
  })

  useEffect(() => {
    if (showSelector) {
      loadAvailableContractors()
    }
  }, [showSelector])

  const loadAvailableContractors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/contractors')
      if (response.ok) {
        const data = await response.json()
        // Filter out contractors already linked to this project
        const linkedIds = projectContractors.map(pc => pc.contractorId)
        const available = data.filter((c: Contractor) => !linkedIds.includes(c.id) && c.isActive)
        setAvailableContractors(available)
      }
    } catch (error) {
      console.error('Error loading contractors:', error)
      toast.error('Failed to load contractors')
    } finally {
      setLoading(false)
    }
  }

  const linkContractor = async (contractorId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/contractors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId })
      })

      if (response.ok) {
        toast.success('Contractor linked to project')
        setShowSelector(false)
        onUpdate()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to link contractor')
      }
    } catch (error) {
      console.error('Error linking contractor:', error)
      toast.error('Failed to link contractor')
    }
  }

  const unlinkContractor = async (projectContractorId: string) => {
    if (!confirm('Remove this contractor from the project?')) return

    try {
      const response = await fetch(`/api/projects/${projectId}/contractors/${projectContractorId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Contractor removed from project')
        onUpdate()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to remove contractor')
      }
    } catch (error) {
      console.error('Error unlinking contractor:', error)
      toast.error('Failed to remove contractor')
    }
  }

  const createAndLinkContractor = async () => {
    if (!newContractorData.businessName || !newContractorData.email) {
      toast.error('Business name and email are required')
      return
    }

    try {
      // First create the contractor
      const createResponse = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContractorData)
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        toast.error(error.error || 'Failed to create contractor')
        return
      }

      const newContractor = await createResponse.json()

      // Then link to project
      await linkContractor(newContractor.id)

      // Reset form
      setNewContractorData({
        businessName: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        type: 'CONTRACTOR',
        specialty: '',
        notes: ''
      })
      setShowNewContractorForm(false)
      setShowSelector(false)
    } catch (error) {
      console.error('Error creating contractor:', error)
      toast.error('Failed to create contractor')
    }
  }

  const filteredContractors = availableContractors.filter(c =>
    c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Current Contractors */}
      <div className="space-y-3">
        {projectContractors.length > 0 ? (
          projectContractors.map((pc) => (
            <div key={pc.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-medium text-gray-900">{pc.contractor.businessName}</h4>
                    <Badge variant={pc.contractor.type === 'CONTRACTOR' ? 'default' : 'secondary'}>
                      {pc.contractor.type === 'CONTRACTOR' ? 'Contractor' : 'Subcontractor'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {pc.contractor.contactName && (
                      <div>Contact: {pc.contractor.contactName}</div>
                    )}
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2" />
                      {pc.contractor.email}
                    </div>
                    {pc.contractor.phone && (
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-2" />
                        {pc.contractor.phone}
                      </div>
                    )}
                    {pc.contractor.specialty && (
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-2" />
                        {pc.contractor.specialty}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkContractor(pc.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Building className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">No contractors linked yet</p>
            <p className="text-sm text-gray-500 mt-1">Add contractors from your library or create new ones</p>
          </div>
        )}
      </div>

      {/* Add Contractor Button */}
      {!showSelector && (
        <Button
          onClick={() => setShowSelector(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contractor
        </Button>
      )}

      {/* Contractor Selector Modal */}
      {showSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add Contractor to Project</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSelector(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {!showNewContractorForm && (
                <>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search contractors from library..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={() => setShowNewContractorForm(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Contractor
                  </Button>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {showNewContractorForm ? (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">New Contractor Details</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={newContractorData.type}
                      onChange={(e) => setNewContractorData({ ...newContractorData, type: e.target.value as 'CONTRACTOR' | 'SUBCONTRACTOR' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="CONTRACTOR">Contractor</option>
                      <option value="SUBCONTRACTOR">Subcontractor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                    <Input
                      value={newContractorData.businessName}
                      onChange={(e) => setNewContractorData({ ...newContractorData, businessName: e.target.value })}
                      placeholder="Enter business name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                    <Input
                      value={newContractorData.contactName}
                      onChange={(e) => setNewContractorData({ ...newContractorData, contactName: e.target.value })}
                      placeholder="Enter contact person"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <Input
                      type="email"
                      value={newContractorData.email}
                      onChange={(e) => setNewContractorData({ ...newContractorData, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <Input
                      value={newContractorData.phone}
                      onChange={(e) => setNewContractorData({ ...newContractorData, phone: e.target.value })}
                      placeholder="Enter phone"
                    />
                  </div>

                  {newContractorData.type === 'SUBCONTRACTOR' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specialty/Trade</label>
                      <Input
                        value={newContractorData.specialty}
                        onChange={(e) => setNewContractorData({ ...newContractorData, specialty: e.target.value })}
                        placeholder="e.g., Electrician, Plumber"
                      />
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <Button variant="outline" onClick={() => setShowNewContractorForm(false)}>
                      Back
                    </Button>
                    <Button onClick={createAndLinkContractor}>
                      Create & Add to Project
                    </Button>
                  </div>
                </div>
              ) : loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-100 h-20 rounded-lg"></div>
                  ))}
                </div>
              ) : filteredContractors.length > 0 ? (
                <div className="space-y-3">
                  {filteredContractors.map((contractor) => (
                    <div
                      key={contractor.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => linkContractor(contractor.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-gray-900">{contractor.businessName}</h4>
                            <Badge variant={contractor.type === 'CONTRACTOR' ? 'default' : 'secondary'} className="text-xs">
                              {contractor.type === 'CONTRACTOR' ? 'Contractor' : 'Subcontractor'}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            {contractor.contactName && <div>{contractor.contactName}</div>}
                            <div>{contractor.email}</div>
                            {contractor.specialty && <div className="text-gray-500">{contractor.specialty}</div>}
                          </div>
                        </div>
                        <Button size="sm">Add</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">No contractors found</p>
                  <p className="text-sm text-gray-500 mt-1">Try a different search or create a new contractor</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
