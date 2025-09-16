'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, X, User, Calendar, DollarSign, Home, Bed, UtensilsCrossed, Bath, Briefcase, Sofa, Coffee, Flower, Car, Settings, Users, DoorOpen, Navigation, Baby, UserCheck, Gamepad2 } from 'lucide-react'

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

const CLIENT_SUGGESTIONS = [
  { name: 'John & Jane Johnson', email: 'john@studioflow.com', phone: '(555) 123-4567' },
  { name: 'Michael & Sarah Smith', email: 'michael@example.com', phone: '(555) 987-6543' },
  { name: 'David & Emma Johnson', email: 'david@example.com', phone: '(555) 555-0123' },
  { name: 'Create New Client', email: '', phone: '' },
]

export default function NewProjectForm({ session }: NewProjectFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'RESIDENTIAL',
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    budget: '',
    dueDate: '',
    selectedRooms: [] as Array<{ type: string; name: string; customName?: string }>
  })

  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [showCustomRoomDialog, setShowCustomRoomDialog] = useState(false)
  const [customRoomBase, setCustomRoomBase] = useState('')
  const [customRoomName, setCustomRoomName] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleClientSelect = (client: any) => {
    if (client.name === 'Create New Client') {
      setShowNewClientForm(true)
      setFormData(prev => ({ 
        ...prev, 
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: ''
      }))
    } else {
      setShowNewClientForm(false)
      setFormData(prev => ({ 
        ...prev, 
        clientId: client.id || 'new',
        clientName: client.name,
        clientEmail: client.email,
        clientPhone: client.phone
      }))
    }
  }

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

            {/* Client Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h3>
              
              {!showNewClientForm ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Client
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {CLIENT_SUGGESTIONS.map((client, index) => (
                      <div
                        key={index}
                        onClick={() => handleClientSelect(client)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          formData.clientName === client.name
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            client.name === 'Create New Client' ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {client.name === 'Create New Client' ? (
                              <Plus className="w-5 h-5 text-green-600" />
                            ) : (
                              <User className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.name}</p>
                            {client.email && (
                              <p className="text-sm text-gray-600">{client.email} • {client.phone}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">New Client Details</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewClientForm(false)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                  
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
              )}
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
    </div>
  )
}
