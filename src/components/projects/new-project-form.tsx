'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, X, User, Calendar, DollarSign, Home, Bed, UtensilsCrossed, Bath, Briefcase, Sofa, Coffee, Flower, Car, Settings, Users, DoorOpen, Navigation, Baby, UserCheck, Gamepad2, Upload, Camera, Building, Search, FolderPlus, Link2, FolderX, ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import Image from 'next/image'
import { DropboxFolderBrowser } from './DropboxFolderBrowser'

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
    status: 'IN_PROGRESS',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    additionalEmails: [] as Array<{ label: string; email: string }>, // Additional emails for accounting, etc.
    projectAddress: '', // Legacy combined address
    streetAddress: '',
    city: '',
    province: '',
    postalCode: '',
    budget: '',
    dueDate: '',
    coverImages: [] as string[], // Support multiple images
    selectedRooms: [] as Array<{ type: string; name: string; customName?: string }>,
    contractors: [] as Array<{ id?: string; businessName: string; contactName: string; email: string; phone: string; address: string; type: 'contractor' | 'subcontractor' }>,
    dropboxOption: 'create' as 'create' | 'link' | 'skip',
    dropboxFolderPath: ''
  })

  const [showCustomRoomDialog, setShowCustomRoomDialog] = useState(false)
  const [customRoomBase, setCustomRoomBase] = useState('')
  const [customRoomName, setCustomRoomName] = useState('')
  const [showMultiCustomRoomDialog, setShowMultiCustomRoomDialog] = useState(false)
  const [customRooms, setCustomRooms] = useState<Array<{ name: string; type: string }>>([{ name: '', type: 'OTHER' }])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showContractorDialog, setShowContractorDialog] = useState(false)
  const [showSelectContractorDialog, setShowSelectContractorDialog] = useState(false)
  const [contractorType, setContractorType] = useState<'contractor' | 'subcontractor'>('contractor')
  const [contractorForm, setContractorForm] = useState({ businessName: '', contactName: '', email: '', phone: '', address: '' })
  const [existingContractors, setExistingContractors] = useState<any[]>([])
  const [contractorSearchTerm, setContractorSearchTerm] = useState('')
  const [isDropboxSectionExpanded, setIsDropboxSectionExpanded] = useState(true)
  const [addressInputRef, setAddressInputRef] = useState<HTMLInputElement | null>(null)
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null)
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null)
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [showPredictions, setShowPredictions] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Additional email management
  const addAdditionalEmail = () => {
    setFormData(prev => ({
      ...prev,
      additionalEmails: [...prev.additionalEmails, { label: '', email: '' }]
    }))
  }

  const updateAdditionalEmail = (index: number, field: 'label' | 'email', value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalEmails: prev.additionalEmails.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const removeAdditionalEmail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalEmails: prev.additionalEmails.filter((_, i) => i !== index)
    }))
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

  // Initialize Google Places API
  useEffect(() => {
    const initGooglePlaces = () => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        setAutocompleteService(new google.maps.places.AutocompleteService())
        // Create a dummy div for PlacesService
        const dummyMap = document.createElement('div')
        setPlacesService(new google.maps.places.PlacesService(dummyMap))
      }
    }

    // Check if Google Maps is already loaded
    if (typeof google !== 'undefined') {
      initGooglePlaces()
    } else {
      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (!existingScript) {
        // Load Google Maps script only if it doesn't exist
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&language=en`
        script.async = true
        script.defer = true
        script.charset = 'utf-8'
        script.id = 'google-maps-script'
        script.onload = initGooglePlaces
        document.head.appendChild(script)
      } else {
        // Wait for existing script to load
        existingScript.addEventListener('load', initGooglePlaces)
      }
    }
  }, [])

  // Handle address autocomplete
  const handleAddressSearch = (value: string) => {
    handleInputChange('streetAddress', value)
    
    if (!autocompleteService || value.length < 3) {
      setPredictions([])
      setShowPredictions(false)
      return
    }

    autocompleteService.getPlacePredictions(
      {
        input: value,
        types: ['address'],
        componentRestrictions: { country: 'ca' } // Restrict to Canada only
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results)
          setShowPredictions(true)
        } else {
          setPredictions([])
          setShowPredictions(false)
        }
      }
    )
  }

  // Handle address selection
  const handleAddressSelect = (placeId: string) => {
    if (!placesService) return

    placesService.getDetails(
      {
        placeId,
        fields: ['address_components', 'formatted_address']
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          let streetNumber = ''
          let route = ''
          let city = ''
          let province = ''
          let postalCode = ''

          place.address_components?.forEach(component => {
            const types = component.types
            if (types.includes('street_number')) {
              streetNumber = component.long_name
            }
            if (types.includes('route')) {
              route = component.long_name
            }
            if (types.includes('locality')) {
              city = component.long_name
            }
            if (types.includes('administrative_area_level_1')) {
              province = component.short_name // Use short_name for province code (e.g., QC, ON)
            }
            if (types.includes('postal_code')) {
              postalCode = component.long_name
            }
          })

          const fullStreet = `${streetNumber} ${route}`.trim()
          
          // Decode HTML entities and fix UTF-8 encoding issues
          const decodeText = (text: string) => {
            if (!text) return text
            
            // First decode HTML entities
            const textarea = document.createElement('textarea')
            textarea.innerHTML = text
            let decoded = textarea.value
            
            // Fix common UTF-8 encoding issues
            const fixes: { [key: string]: string } = {
              'Ã©': 'é',
              'Ã¨': 'è',
              'Ãª': 'ê',
              'Ã ': 'à',
              'Ã§': 'ç',
              'Ã´': 'ô',
              'Ã®': 'î',
              'Ã¯': 'ï',
              'Ã¹': 'ù',
              'Ã»': 'û',
              'Ã¼': 'ü',
              'Ã«': 'ë',
              'Ã': 'À',
              'Ã‰': 'É',
              'Ãˆ': 'È',
              'ÃŠ': 'Ê'
            }
            
            Object.keys(fixes).forEach(bad => {
              decoded = decoded.replace(new RegExp(bad, 'g'), fixes[bad])
            })
            
            return decoded
          }
          
          setFormData(prev => ({
            ...prev,
            streetAddress: decodeText(fullStreet),
            city: decodeText(city),
            province: decodeText(province),
            postalCode: decodeText(postalCode),
            projectAddress: decodeText(place.formatted_address || fullStreet)
          }))

          setPredictions([])
          setShowPredictions(false)
        }
      }
    )
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

  // Multi-custom room functions
  const addCustomRoomField = () => {
    setCustomRooms(prev => [...prev, { name: '', type: 'OTHER' }])
  }

  const removeCustomRoomField = (index: number) => {
    setCustomRooms(prev => prev.filter((_, i) => i !== index))
  }

  const updateCustomRoom = (index: number, field: 'name' | 'type', value: string) => {
    setCustomRooms(prev => prev.map((room, i) => 
      i === index ? { ...room, [field]: value } : room
    ))
  }

  const saveMultipleCustomRooms = () => {
    const validRooms = customRooms.filter(room => room.name.trim())
    
    const newRooms = validRooms.map(room => ({
      type: room.type,
      name: room.type === 'OTHER' ? 'Custom' : (ROOM_TYPES.find(r => r.value === room.type)?.label || 'Custom'),
      customName: room.name.trim()
    }))

    setFormData(prev => ({
      ...prev,
      selectedRooms: [...prev.selectedRooms, ...newRooms]
    }))
    
    setShowMultiCustomRoomDialog(false)
    setCustomRooms([{ name: '', type: 'OTHER' }])
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
          dropboxOption: formData.dropboxOption,
          dropboxFolderPath: formData.dropboxFolderPath,
          streetAddress: formData.streetAddress,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
          additionalEmails: formData.additionalEmails.filter(e => e.email) // Only include emails that have values
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Show success message with Dropbox status
        if (result.dropboxStatus) {
          if (result.dropboxStatus.option === 'create' && result.dropboxStatus.success) {
            alert(`Project created successfully!\n\nDropbox folder structure created at:\n${result.dropboxStatus.folderPath}`)
          } else if (result.dropboxStatus.option === 'link' && result.dropboxStatus.success) {
            alert(`Project created successfully!\n\nLinked to Dropbox folder:\n${result.dropboxStatus.folderPath}`)
          } else if (result.dropboxStatus.option === 'skip') {
            alert('Project created successfully!')
          } else if (result.dropboxStatus.error) {
            alert(`Project created successfully!\n\nHowever, Dropbox folder creation failed:\n${result.dropboxStatus.error}`)
          }
        }
        
        router.push(`/projects/${result.id}`)
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
            className="bg-[#a657f0] h-2 rounded-full transition-all duration-300"
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

              {/* Project Type and Status */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="URGENT">Urgent</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      !formData.clientName ? 'border-gray-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter client name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="client@example.com"
                    required
                  />
                </div>
                
                {/* Additional Emails */}
                {formData.additionalEmails.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Additional Emails
                    </label>
                    {formData.additionalEmails.map((item, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="w-1/3">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateAdditionalEmail(index, 'label', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            placeholder="Label (e.g., Accounting)"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="email"
                            value={item.email}
                            onChange={(e) => updateAdditionalEmail(index, 'email', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            placeholder="email@example.com"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAdditionalEmail(index)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAdditionalEmail}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Additional Email
                </Button>
                <p className="text-xs text-gray-500 -mt-2">
                  Add emails for accounting, operations, or other contacts
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Project Address */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Address</h3>
              
              <div className="space-y-4">
                {/* Street Address with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={formData.streetAddress}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      onFocus={() => predictions.length > 0 && setShowPredictions(true)}
                      onBlur={() => setTimeout(() => setShowPredictions(false), 200)}
                      ref={(ref) => setAddressInputRef(ref)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Start typing address..."
                      required
                    />
                  </div>
                  
                  {/* Autocomplete Predictions Dropdown */}
                  {showPredictions && predictions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {predictions.map((prediction) => (
                        <div
                          key={prediction.place_id}
                          onClick={() => handleAddressSelect(prediction.place_id)}
                          className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-start">
                            <MapPin className="w-4 h-4 text-purple-600 mt-0.5 mr-2 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {prediction.structured_formatting.main_text}
                              </p>
                              <p className="text-xs text-gray-500">
                                {prediction.structured_formatting.secondary_text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* City, Province, and Postal Code */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="City"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Province *
                    </label>
                    <input
                      type="text"
                      value={formData.province}
                      onChange={(e) => handleInputChange('province', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="QC, ON, BC..."
                      maxLength={2}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="A1A 1A1"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dropbox Integration - Collapsible */}
            <div>
              <div 
                className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setIsDropboxSectionExpanded(!isDropboxSectionExpanded)}
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Dropbox Integration</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {formData.dropboxOption === 'create'
                      ? 'Auto-create project folder with standard structure'
                      : formData.dropboxOption === 'link'
                      ? 'Link to existing Dropbox folder'
                      : 'No Dropbox folder will be created'
                    }
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {formData.dropboxOption !== 'skip' && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      {formData.dropboxOption === 'create' ? 'Create New' : 'Link Existing'}
                    </span>
                  )}
                  {isDropboxSectionExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </div>
              
              {isDropboxSectionExpanded && (
                <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
                {/* Create new folder option */}
                <div 
                  onClick={() => handleInputChange('dropboxOption', 'create')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.dropboxOption === 'create' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FolderPlus className="w-5 h-5 text-purple-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Create New Dropbox Folder</h4>
                      <p className="text-sm text-gray-600">
                        Automatically create a project folder in Meisner Interiors Team Folder with standard subfolders
                      </p>
                    </div>
                    <div className="ml-auto">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        formData.dropboxOption === 'create' 
                          ? 'border-[#a657f0] bg-[#a657f0]' 
                          : 'border-gray-300'
                      }`}>
                        {formData.dropboxOption === 'create' && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Link to existing folder option */}
                <div 
                  onClick={() => handleInputChange('dropboxOption', 'link')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.dropboxOption === 'link' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Link to Existing Dropbox Folder</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Connect this project to an existing Dropbox folder
                      </p>
                      {formData.dropboxOption === 'link' && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropboxFolderBrowser
                            onSelect={(path) => handleInputChange('dropboxFolderPath', path)}
                            currentPath={formData.dropboxFolderPath}
                          />
                        </div>
                      )}
                    </div>
                    <div className="ml-auto">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        formData.dropboxOption === 'link' 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300'
                      }`}>
                        {formData.dropboxOption === 'link' && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skip integration option */}
                <div 
                  onClick={() => handleInputChange('dropboxOption', 'skip')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.dropboxOption === 'skip' 
                      ? 'border-gray-500 bg-gray-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FolderX className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Skip Dropbox Integration</h4>
                      <p className="text-sm text-gray-600">
                        Create the project without Dropbox folder setup (you can add it later)
                      </p>
                    </div>
                    <div className="ml-auto">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        formData.dropboxOption === 'skip' 
                          ? 'border-gray-500 bg-gray-500' 
                          : 'border-gray-300'
                      }`}>
                        {formData.dropboxOption === 'skip' && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              )}
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
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContractorType('contractor')
                      setShowSelectContractorDialog(true)
                    }}
                    className="border-2 border-blue-300 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <Building className="w-4 h-4 mr-2" />
                    Select Contractor
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContractorType('contractor')
                      addContractor('contractor')
                    }}
                    className="border-dashed border-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Contractor
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContractorType('subcontractor')
                      setShowSelectContractorDialog(true)
                    }}
                    className="border-2 border-purple-300 hover:border-purple-400 hover:bg-purple-50"
                  >
                    <Building className="w-4 h-4 mr-2" />
                    Select Subcontractor
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContractorType('subcontractor')
                      addContractor('subcontractor')
                    }}
                    className="border-dashed border-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Subcontractor
                  </Button>
                </div>
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
              
              {/* Custom Rooms Section */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-4">Custom Rooms</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="relative">
                    <div
                      onClick={() => setShowMultiCustomRoomDialog(true)}
                      className="p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 cursor-pointer transition-all"
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <Plus className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">Add Custom Rooms</p>
                        <p className="text-xs text-gray-500 mt-1">Create your own room types</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                      
                      // Handle custom rooms with OTHER type or missing room info
                      const DisplayIcon = roomInfo?.icon || Settings
                      const displayColor = roomInfo?.color || 'bg-gray-500'
                      
                      return (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 ${displayColor} rounded flex items-center justify-center`}>
                              <DisplayIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-medium text-gray-900">
                              {room.customName || room.name}
                              {room.customName && room.type !== 'OTHER' && (
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
                      className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
                    >
                      Add Room
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Custom Rooms Dialog */}
            {showMultiCustomRoomDialog && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add Multiple Custom Rooms</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCustomRoomField}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Room
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">
                    Create multiple custom rooms with your own names. You can optionally choose a base room type for each.
                  </p>
                  
                  <div className="space-y-4 mb-6">
                    {customRooms.map((room, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-start space-x-4">
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Room Name *
                              </label>
                              <input
                                type="text"
                                value={room.name}
                                onChange={(e) => updateCustomRoom(index, 'name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="e.g., Server Room, Wine Cellar, Art Studio"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Base Room Type (Optional)
                              </label>
                              <select
                                value={room.type}
                                onChange={(e) => updateCustomRoom(index, 'type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              >
                                <option value="OTHER">Custom (No Base Type)</option>
                                {ROOM_TYPES.map(roomType => (
                                  <option key={roomType.value} value={roomType.value}>
                                    {roomType.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          {customRooms.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeCustomRoomField(index)}
                              className="text-red-600 border-red-200 hover:bg-red-50 mt-6"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowMultiCustomRoomDialog(false)
                        setCustomRooms([{ name: '', type: 'OTHER' }])
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveMultipleCustomRooms}
                      disabled={!customRooms.some(room => room.name.trim())}
                      className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
                    >
                      Add {customRooms.filter(room => room.name.trim()).length} Room(s)
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
                    
                    // Handle custom rooms with OTHER type or missing room info
                    const DisplayIcon = roomInfo?.icon || Settings
                    const displayColor = roomInfo?.color || 'bg-gray-500'
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className={`w-6 h-6 ${displayColor} rounded flex items-center justify-center`}>
                          <DisplayIcon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {room.customName || room.name}
                          {room.customName && room.type !== 'OTHER' && (
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
                  (step === 1 && (
                    !formData.name || 
                    !formData.clientName || 
                    !formData.clientEmail ||
                    !formData.streetAddress ||
                    !formData.city ||
                    !formData.province ||
                    !formData.postalCode
                  )) ||
                  (step === 2 && formData.selectedRooms.length === 0)
                }
                className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
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
            
            {/* Existing Contractors - Filtered by type */}
            {existingContractors.filter(c => 
              contractorType === 'contractor' ? c.type === 'CONTRACTOR' : c.type === 'SUBCONTRACTOR'
            ).length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Select Existing {contractorType === 'contractor' ? 'Contractor' : 'Subcontractor'}:
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {existingContractors
                    .filter(c => contractorType === 'contractor' ? c.type === 'CONTRACTOR' : c.type === 'SUBCONTRACTOR')
                    .map((contractor) => (
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
                className="bg-[#a657f0] hover:bg-[#a657f0]/90 text-white"
              >
                Add {contractorType === 'contractor' ? 'Contractor' : 'Subcontractor'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Select Contractor from Library Dialog */}
      {showSelectContractorDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Select {contractorType === 'contractor' ? 'Contractor' : 'Subcontractor'} from Library
                </h3>
                <button
                  onClick={() => {
                    setShowSelectContractorDialog(false)
                    setContractorSearchTerm('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  placeholder="Search contractors..."
                  value={contractorSearchTerm}
                  onChange={(e) => setContractorSearchTerm(e.target.value)}
                  className="w-full pl-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {existingContractors.filter(c => {
                // Filter by contractor type (CONTRACTOR or SUBCONTRACTOR)
                const typeMatch = contractorType === 'contractor' 
                  ? c.type === 'CONTRACTOR' 
                  : c.type === 'SUBCONTRACTOR'
                
                // Filter by search term
                const searchMatch = 
                  c.businessName.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                  c.contactName?.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                  c.specialty?.toLowerCase().includes(contractorSearchTerm.toLowerCase())
                
                return typeMatch && searchMatch
              }).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No {contractorType === 'contractor' ? 'contractors' : 'subcontractors'} found</p>
                  <p className="text-sm mt-1">Try adjusting your search or add {contractorType === 'contractor' ? 'contractors' : 'subcontractors'} in Preferences</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {existingContractors
                    .filter(c => {
                      // Filter by contractor type (CONTRACTOR or SUBCONTRACTOR)
                      const typeMatch = contractorType === 'contractor' 
                        ? c.type === 'CONTRACTOR' 
                        : c.type === 'SUBCONTRACTOR'
                      
                      // Filter by search term
                      const searchMatch = 
                        c.businessName.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                        c.contactName?.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                        c.specialty?.toLowerCase().includes(contractorSearchTerm.toLowerCase())
                      
                      return typeMatch && searchMatch
                    })
                    .map((contractor) => {
                      const isAlreadyAdded = formData.contractors.some(
                        (c: any) => c.id === contractor.id || c.email === contractor.email
                      )
                      
                      return (
                        <div
                          key={contractor.id}
                          className={`border rounded-lg p-4 transition-all ${
                            isAlreadyAdded 
                              ? 'border-gray-200 bg-gray-50 opacity-60' 
                              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isAlreadyAdded) {
                              selectExistingContractor(contractor, contractorType)
                              setShowSelectContractorDialog(false)
                              setContractorSearchTerm('')
                            }
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="font-semibold text-gray-900">{contractor.businessName}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  contractor.type === 'CONTRACTOR' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {contractor.type === 'CONTRACTOR' ? 'Contractor' : 'Subcontractor'}
                                </span>
                                {isAlreadyAdded && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Added
                                  </span>
                                )}
                              </div>
                              {contractor.specialty && (
                                <p className="text-sm text-gray-600 mb-1">
                                  <span className="font-medium">Specialty:</span> {contractor.specialty}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                {contractor.contactName && (
                                  <span>{contractor.contactName}</span>
                                )}
                                {contractor.email && (
                                  <span>{contractor.email}</span>
                                )}
                                {contractor.phone && (
                                  <span>{contractor.phone}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSelectContractorDialog(false)
                  setContractorSearchTerm('')
                }}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
