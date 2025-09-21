'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, X, User, Calendar, DollarSign, Home, Bed, UtensilsCrossed, Bath, Briefcase, Sofa, Coffee, Flower, Car, Settings, Users, DoorOpen, Navigation, Baby, UserCheck, Gamepad2, Upload, Camera } from 'lucide-react'
import Image from 'next/image'

interface NewProjectFormProps {
  session: any
}

const ROOM_CATEGORIES = {
  'Entry & Circulation': [
    { value: 'ENTRANCE', label: 'Entrance', icon: DoorOpen, color: 'bg-gray-600' },
    { value: 'FOYER', label: 'Foyer', icon: Home, color: 'bg-gray-500' },
    { value: 'STAIRCASE', label: 'Staircase', icon: Navigation, color: 'bg-gray-400' },
  ],
  'Living Spaces': [
    { value: 'LIVING_ROOM', label: 'Living Room', icon: Sofa, color: 'bg-green-500' },
    { value: 'DINING_ROOM', label: 'Dining Room', icon: UtensilsCrossed, color: 'bg-orange-500' },
    { value: 'KITCHEN', label: 'Kitchen', icon: UtensilsCrossed, color: 'bg-red-500' },
    { value: 'STUDY_ROOM', label: 'Study Room', icon: Briefcase, color: 'bg-purple-400' },
    { value: 'OFFICE', label: 'Office', icon: Briefcase, color: 'bg-purple-500' },
    { value: 'PLAYROOM', label: 'Playroom', icon: Gamepad2, color: 'bg-pink-500' },
  ],
  'Bedrooms': [
    { value: 'MASTER_BEDROOM', label: 'Master Bedroom', icon: Bed, color: 'bg-blue-600' },
    { value: 'GIRLS_ROOM', label: 'Girls Room', icon: Bed, color: 'bg-pink-400' },
    { value: 'BOYS_ROOM', label: 'Boys Room', icon: Bed, color: 'bg-blue-400' },
    { value: 'GUEST_BEDROOM', label: 'Guest Bedroom', icon: Bed, color: 'bg-indigo-400' },
  ],
  'Bathrooms': [
    { value: 'POWDER_ROOM', label: 'Powder Room', icon: Bath, color: 'bg-cyan-300' },
    { value: 'MASTER_BATHROOM', label: 'Master Bathroom', icon: Bath, color: 'bg-cyan-600' },
    { value: 'FAMILY_BATHROOM', label: 'Family Bathroom', icon: Bath, color: 'bg-cyan-500' },
    { value: 'GIRLS_BATHROOM', label: 'Girls Bathroom', icon: Bath, color: 'bg-pink-300' },
    { value: 'BOYS_BATHROOM', label: 'Boys Bathroom', icon: Bath, color: 'bg-blue-300' },
    { value: 'GUEST_BATHROOM', label: 'Guest Bathroom', icon: Bath, color: 'bg-cyan-400' },
  ],
  'Utility': [
    { value: 'LAUNDRY_ROOM', label: 'Laundry Room', icon: Settings, color: 'bg-indigo-500' },
  ],
  'Special': [
    { value: 'SUKKAH', label: 'Sukkah', icon: Home, color: 'bg-green-700' },
  ],
}

// Flatten room types for easier access
const ROOM_TYPES = Object.values(ROOM_CATEGORIES).flat()


export default function NewProjectForm({ session }: NewProjectFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'RESIDENTIAL',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    projectAddress: '',
    budget: '',
    dueDate: '',
    coverImages: [] as string[], // Support multiple images
    selectedRooms: [] as Array<{ type: string; name: string; customName?: string }>,
    contractors: [] as Array<{ id?: string; businessName: string; contactName: string; email: string; phone: string; address: string; type: 'contractor' | 'subcontractor' }>
  })

  const [showCustomRoomDialog, setShowCustomRoomDialog] = useState(false)
  const [customRoomBase, setCustomRoomBase] = useState('')
  const [customRoomName, setCustomRoomName] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showContractorDialog, setShowContractorDialog] = useState(false)
  const [contractorType, setContractorType] = useState<'contractor' | 'subcontractor'>('contractor')
  const [contractorForm, setContractorForm] = useState({ businessName: '', contactName: '', email: '', phone: '', address: '' })
  const [existingContractors, setExistingContractors] = useState<any[]>([])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    try {
      setUploadingImage(true)
      const uploadedUrls = []
      
      for (const file of Array.from(files)) {
        const formDataUpload = new FormData()
        formDataUpload.append('file', file)
        formDataUpload.append('imageType', 'project-cover')

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formDataUpload,
        })

        if (!response.ok) {
          throw new Error('Failed to upload image')
        }

        const data = await response.json()
        uploadedUrls.push(data.url)
      }
      
      setFormData(prev => ({ 
        ...prev, 
        coverImages: [...prev.coverImages, ...uploadedUrls]
      }))
      
      alert(`${uploadedUrls.length} image(s) uploaded successfully!`)
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  // Load existing contractors on mount
  useEffect(() => {
    const loadContractors = async () => {
      try {
        const response = await fetch('/api/contractors')
        if (response.ok) {
          const contractors = await response.json()
          setExistingContractors(contractors)
        }
      } catch (error) {
        console.error('Error loading contractors:', error)
      }
    }
    loadContractors()
  }, [])

  const toggleRoom = (roomType: string) => {
    const roomInfo = ROOM_TYPES.find(r => r.value === roomType)
    if (!roomInfo) return

    setFormData(prev => {
      const existingRoom = prev.selectedRooms.find(r => r.type === roomType && !r.customName)
      if (existingRoom) {
        return {
          ...prev,
          selectedRooms: prev.selectedRooms.filter(r => !(r.type === roomType && !r.customName))
        }
      } else {
        return {
          ...prev,
          selectedRooms: [...prev.selectedRooms, { type: roomType, name: roomInfo.label }]
        }
      }
    })
  }

  const addCustomRoom = (baseRoomType: string) => {
    setCustomRoomBase(baseRoomType)
    setCustomRoomName('')
    setShowCustomRoomDialog(true)
  }

  // Contractor management functions
  const addContractor = (type: 'contractor' | 'subcontractor') => {
    setContractorType(type)
    setContractorForm({ businessName: '', contactName: '', email: '', phone: '', address: '' })
    setShowContractorDialog(true)
  }

  const selectExistingContractor = (contractor: any, type: 'contractor' | 'subcontractor') => {
    const newContractor = {
      id: contractor.id,
      businessName: contractor.businessName,
      contactName: contractor.contactName || '',
      email: contractor.email,
      phone: contractor.phone,
      address: contractor.address,
      type
    }
    setFormData(prev => ({
      ...prev,
      contractors: [...prev.contractors, newContractor]
    }))
  }

  const saveNewContractor = async () => {
    if (!contractorForm.businessName || !contractorForm.email) return
    
    try {
      // Save to database
      const response = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractorForm)
      })
      
      if (response.ok) {
        const savedContractor = await response.json()
        
        // Add to form data
        const newContractor = {
          id: savedContractor.id,
          ...contractorForm,
          type: contractorType
        }
        
        setFormData(prev => ({
          ...prev,
          contractors: [...prev.contractors, newContractor]
        }))
        
        // Update existing contractors list
        setExistingContractors(prev => [...prev, savedContractor])
        
        setShowContractorDialog(false)
        setContractorForm({ businessName: '', contactName: '', email: '', phone: '', address: '' })
      }
    } catch (error) {
      console.error('Error saving contractor:', error)
      alert('Failed to save contractor')
    }
  }

  const removeContractor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      contractors: prev.contractors.filter((_, i) => i !== index)
    }))
  }

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      coverImages: prev.coverImages.filter((_, i) => i !== index)
    }))
  }

  const saveCustomRoom = () => {
    if (!customRoomName.trim() || !customRoomBase) return
    
    const baseRoom = ROOM_TYPES.find(r => r.value === customRoomBase)
    if (!baseRoom) return

    setFormData(prev => ({
      ...prev,
      selectedRooms: [...prev.selectedRooms, { 
        type: customRoomBase, 
        name: baseRoom.label,
        customName: customRoomName.trim()
      }]
    }))
    
    setShowCustomRoomDialog(false)
    setCustomRoomName('')
    setCustomRoomBase('')
  }

  const removeRoom = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedRooms: prev.selectedRooms.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          budget: formData.budget ? parseFloat(formData.budget) : null,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
          coverImages: formData.coverImages,
          contractors: formData.contractors,
        })
      })

      if (response.ok) {
        const project = await response.json()
        router.push(`/projects/${project.id}`)
      } else {
        throw new Error('Failed to create project')
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Progress Bar */}
      <div className="px-8 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Step {step} of 3</span>
          <span className="text-sm text-gray-500">
            {step === 1 && 'Project Details'}
            {step === 2 && 'Select Rooms'}
            {step === 3 && 'Review & Create'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-8">
        {/* Step 1: Project Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>
              
              {/* Project Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Sunset Villa Renovation"
                  required
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Brief description of the project..."
                />
              </div>

              {/* Project Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="RESIDENTIAL">Residential</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="HOSPITALITY">Hospitality</option>
                </select>
              </div>

              {/* Project Cover Images */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
                  <Camera className="w-4 h-4 mr-2" />
                  Project Cover Images (Optional)
                </h4>
                
                <div className="space-y-4">
                  {/* Existing Images */}
                  {formData.coverImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {formData.coverImages.map((imageUrl, index) => (
                        <div key={index} className="relative">
                          <Image
                            src={imageUrl}
                            alt={`Project cover ${index + 1}`}
                            width={120}
                            height={80}
                            className="rounded-lg object-cover border border-gray-200 w-full"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div>
                    <input
                      type="file"
                      id="cover-images"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <label htmlFor="cover-images">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingImage}
                        className="cursor-pointer"
                        asChild
                      >
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingImage ? 'Uploading...' : 'Upload Images'}
                        </span>
                      </Button>
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      PNG, JPG, WebP up to 4MB each. Select multiple images.
                    </p>
                  </div>
                </div>
              </div>

              {/* Budget */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => handleInputChange('budget', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="150000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleInputChange('dueDate', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Client Name *"
                    required
                  />
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Email Address *"
                    required
                  />
                  <input
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Phone Number"
                  />
                </div>
              </div>
            </div>

            {/* Project Address */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Address</h3>
              
              <div>
                <input
                  type="text"
                  value={formData.projectAddress}
                  onChange={(e) => handleInputChange('projectAddress', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="123 Main Street, City, State ZIP *"
                  required
                />
              </div>
            </div>

            {/* Contractors and Subcontractors */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contractors & Subcontractors</h3>
              
              {/* Selected Contractors */}
              {formData.contractors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Selected:</h4>
                  <div className="space-y-2">
                    {formData.contractors.map((contractor, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                        <div>
                          <p className="font-medium text-gray-900">{contractor.businessName}</p>
                          <p className="text-sm text-gray-600">{contractor.type} • {contractor.contactName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContractor(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add Contractor Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addContractor('contractor')}
                  className="flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contractor
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addContractor('subcontractor')}
                  className="flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subcontractor
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Room Selection */}
        {step === 2 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Select Rooms</h2>
                <p className="text-gray-600">Choose which rooms are included in this project</p>
              </div>
            </div>
            
            {/* Room Categories */}
            <div className="space-y-8">
              {Object.entries(ROOM_CATEGORIES).map(([category, rooms]) => (
                <div key={category}>
                  <h3 className="text-md font-medium text-gray-900 mb-4">{category}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {rooms.map((room) => {
                      const Icon = room.icon
                      const isSelected = formData.selectedRooms.some(r => r.type === room.value && !r.customName)
                      
                      return (
                        <div key={room.value} className="relative group">
                          <div
                            onClick={() => toggleRoom(room.value)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="text-center">
                              <div className={`w-12 h-12 ${room.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <p className="text-sm font-medium text-gray-900">{room.label}</p>
                            </div>
                          </div>
                          
                          {/* Add Custom Room Button */}
                          <button
                            onClick={() => addCustomRoom(room.value)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Add custom ${room.label}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Selected Rooms Summary */}
            {formData.selectedRooms.length > 0 && (
              <div className="mt-8 space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 mb-3">
                    <strong>{formData.selectedRooms.length} rooms selected</strong> - Each room will go through the complete workflow: Design → 3D → Client Approval → Drawings + FFE
                  </p>
                </div>
                
                {/* Selected Rooms List */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Selected Rooms:</h4>
                  <div className="space-y-2">
                    {formData.selectedRooms.map((room, index) => {
                      const roomInfo = ROOM_TYPES.find(r => r.value === room.type)
                      return (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                          <div className="flex items-center space-x-3">
                            {roomInfo && (
                              <div className={`w-8 h-8 ${roomInfo.color} rounded flex items-center justify-center`}>
                                <roomInfo.icon className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <span className="font-medium text-gray-900">
                              {room.customName || room.name}
                              {room.customName && (
                                <span className="text-sm text-gray-500 ml-1">({room.name})</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={() => removeRoom(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Custom Room Dialog */}
            {showCustomRoomDialog && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Custom Room</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Based on: <strong>{ROOM_TYPES.find(r => r.value === customRoomBase)?.label}</strong>
                  </p>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Room Name
                    </label>
                    <input
                      type="text"
                      value={customRoomName}
                      onChange={(e) => setCustomRoomName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Boys Bedroom 2, Living Room - Main"
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowCustomRoomDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveCustomRoom}
                      disabled={!customRoomName.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Add Room
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review & Create Project</h2>
            
            <div className="space-y-6">
              {/* Project Summary */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Project Summary</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Project Name</dt>
                    <dd className="text-sm text-gray-900 mt-1">{formData.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Project Type</dt>
                    <dd className="text-sm text-gray-900 mt-1">{formData.type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Client</dt>
                    <dd className="text-sm text-gray-900 mt-1">{formData.clientName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Budget</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {formData.budget ? `$${parseInt(formData.budget).toLocaleString()}` : 'Not specified'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Rooms Summary */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Selected Rooms ({formData.selectedRooms.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {formData.selectedRooms.map((room, index) => {
                    const roomInfo = ROOM_TYPES.find(r => r.value === room.type)
                    if (!roomInfo) return null
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className={`w-6 h-6 ${roomInfo.color} rounded flex items-center justify-center`}>
                          <roomInfo.icon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {room.customName || room.name}
                          {room.customName && (
                            <span className="text-xs text-gray-500 block">({room.name})</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Previous
              </Button>
            )}
          </div>
          
          <div>
            {step < 3 ? (
              <Button 
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && (!formData.name || !formData.clientName)) ||
                  (step === 2 && formData.selectedRooms.length === 0)
                }
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isLoading ? 'Creating...' : 'Create Project'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Contractor Dialog */}
      {showContractorDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add {contractorType === 'contractor' ? 'Contractor' : 'Subcontractor'}
            </h3>
            
            {/* Existing Contractors */}
            {existingContractors.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Select Existing:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {existingContractors.map((contractor) => (
                    <div
                      key={contractor.id}
                      onClick={() => {
                        selectExistingContractor(contractor, contractorType)
                        setShowContractorDialog(false)
                      }}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900">{contractor.businessName || contractor.name}</p>
                      <p className="text-sm text-gray-600">{contractor.contactName || ''}</p>
                      {contractor.email && (
                        <p className="text-sm text-gray-500">{contractor.email} • {contractor.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="my-4 flex items-center">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="px-3 text-sm text-gray-500 bg-white">OR</span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>
              </div>
            )}
            
            {/* New Contractor Form */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Add New {contractorType === 'contractor' ? 'Contractor' : 'Subcontractor'}:</h4>
              
              <input
                type="text"
                value={contractorForm.businessName}
                onChange={(e) => setContractorForm(prev => ({ ...prev, businessName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Business Name *"
                required
              />
              
              <input
                type="text"
                value={contractorForm.contactName}
                onChange={(e) => setContractorForm(prev => ({ ...prev, contactName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Contact Name"
              />
              
              <input
                type="text"
                value={contractorForm.address}
                onChange={(e) => setContractorForm(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Business Address (Optional)"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="email"
                  value={contractorForm.email}
                  onChange={(e) => setContractorForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Email Address *"
                  required
                />
                <input
                  type="tel"
                  value={contractorForm.phone}
                  onChange={(e) => setContractorForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Phone Number"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowContractorDialog(false)
                  setContractorForm({ businessName: '', contactName: '', email: '', phone: '', address: '' })
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={saveNewContractor}
                disabled={!contractorForm.businessName || !contractorForm.email}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Add {contractorType === 'contractor' ? 'Contractor' : 'Subcontractor'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
