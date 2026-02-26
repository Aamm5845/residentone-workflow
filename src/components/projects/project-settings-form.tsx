'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Upload, Calendar, DollarSign, Trash2, Building, Camera, Folder, Edit, X, User, Users, Plus,
  Settings as SettingsIcon, BookOpen, ClipboardList, Home, Search, FolderPlus, Link2, FolderX,
  Shield, Layers, Check, Mail, Phone, MapPin, Briefcase, FileText, ShoppingCart
} from 'lucide-react'
import Image from 'next/image'
import ClientAccessManagement from './ClientAccessManagement'
import RoomsManagementSection from './rooms-management-section'
import { DropboxFolderBrowser } from './DropboxFolderBrowser'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { TRADE_LABELS, TRADE_ORDER, getTradeForContractor, getTradeLabel } from '@/lib/contractor-utils'

// Form validation schema
const projectSettingsSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().optional(),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'HOSPITALITY']),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'URGENT', 'CANCELLED', 'COMPLETED']),
  budget: z.string().optional(),
  dueDate: z.string().optional(),
  address: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  coverImages: z.array(z.string()).optional(),
  dropboxFolder: z.string().optional().nullable(),
  hasFloorplanApproval: z.boolean().optional(),
  hasSpecBook: z.boolean().optional(),
  hasProjectUpdates: z.boolean().optional(),
  hasBillingProcurement: z.boolean().optional(),
})

type ProjectSettingsFormData = z.infer<typeof projectSettingsSchema>

interface ProjectSettingsFormProps {
  project: any
  clients: any[]
  session: any
}

// Navigation items for sidebar
const navItems = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'images', label: 'Cover Images', icon: Camera },
  { id: 'access', label: 'Client Access', icon: Shield },
  { id: 'rooms', label: 'Rooms', icon: Home },
  { id: 'features', label: 'Features', icon: SettingsIcon },
  { id: 'dropbox', label: 'Dropbox', icon: Folder },
  { id: 'danger', label: 'Delete', icon: Trash2 },
]

export default function ProjectSettingsForm({ project, clients, session }: ProjectSettingsFormProps) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [currentCoverImages, setCurrentCoverImages] = useState(() => {
    if (!project.coverImages) return []
    if (Array.isArray(project.coverImages)) return project.coverImages
    if (typeof project.coverImages === 'string') {
      try {
        const parsed = JSON.parse(project.coverImages)
        return Array.isArray(parsed) ? parsed : [project.coverImages]
      } catch {
        return [project.coverImages]
      }
    }
    return []
  })
  const [editingField, setEditingField] = useState<string | null>(null)
  const [contractorsList, setContractorsList] = useState(project.contractors || [])
  const [showAddContractorDialog, setShowAddContractorDialog] = useState(false)
  const [showSelectContractorDialog, setShowSelectContractorDialog] = useState(false)
  const [availableContractors, setAvailableContractors] = useState<any[]>([])
  const [loadingContractors, setLoadingContractors] = useState(false)
  const [contractorSearchTerm, setContractorSearchTerm] = useState('')
  const [newContractor, setNewContractor] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    type: 'contractor' as 'contractor' | 'subcontractor',
    specialty: ''
  })
  const [editingContractor, setEditingContractor] = useState<any | null>(null)
  const [editContractorData, setEditContractorData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    type: 'contractor' as 'contractor' | 'subcontractor',
    specialty: '',
    notes: ''
  })
  const [isSavingContractor, setIsSavingContractor] = useState(false)
  const [isDeletingContractor, setIsDeletingContractor] = useState(false)
  const [dropboxOption, setDropboxOption] = useState<'create' | 'link' | 'skip'>('skip')
  const [dropboxFolderPath, setDropboxFolderPath] = useState('')
  const [isCreatingDropbox, setIsCreatingDropbox] = useState(false)
  const [clientFormData, setClientFormData] = useState({
    name: project.client?.name || '',
    email: project.client?.email || '',
    phone: project.client?.phone || '',
    company: project.client?.company || '',
    // Billing information
    billingName: project.client?.billingName || '',
    billingEmail: project.client?.billingEmail || '',
    billingAddress: project.client?.billingAddress || '',
    billingCity: project.client?.billingCity || '',
    billingProvince: project.client?.billingProvince || '',
    billingPostalCode: project.client?.billingPostalCode || '',
    billingCountry: project.client?.billingCountry || 'Canada'
  })
  const [additionalEmails, setAdditionalEmails] = useState<Array<{ label: string; email: string }>>(
    project.client?.additionalEmails || []
  )
  const [roomsData, setRoomsData] = useState<any[]>([])
  const [sectionsData, setSectionsData] = useState<any[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  
  // Google Maps autocomplete state
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null)
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null)
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [showPredictions, setShowPredictions] = useState(false)
  const [addressValue, setAddressValue] = useState(project?.streetAddress || '')

  // Additional email functions
  const addAdditionalEmail = () => {
    setAdditionalEmails(prev => [...prev, { label: '', email: '' }])
  }

  const updateAdditionalEmail = (index: number, field: 'label' | 'email', value: string) => {
    setAdditionalEmails(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const removeAdditionalEmail = (index: number) => {
    setAdditionalEmails(prev => prev.filter((_, i) => i !== index))
  }

  // Initialize Google Places API
  useEffect(() => {
    const initGooglePlaces = () => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        setAutocompleteService(new google.maps.places.AutocompleteService())
        const dummyMap = document.createElement('div')
        setPlacesService(new google.maps.places.PlacesService(dummyMap))
      }
    }

    if (typeof google !== 'undefined' && google.maps) {
      initGooglePlaces()
    } else {
      const existingScript = document.getElementById('google-maps-script')
      if (!existingScript) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (apiKey) {
          const script = document.createElement('script')
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=en`
          script.async = true
          script.defer = true
          script.id = 'google-maps-script'
          script.onload = initGooglePlaces
          document.head.appendChild(script)
        }
      } else {
        initGooglePlaces()
      }
    }
  }, [])

  // Handle address autocomplete
  const handleAddressSearch = (value: string) => {
    setAddressValue(value)
    setValue('streetAddress', value)
    
    if (!autocompleteService || value.length < 3) {
      setPredictions([])
      setShowPredictions(false)
      return
    }

    autocompleteService.getPlacePredictions(
      {
        input: value,
        types: ['address'],
        componentRestrictions: { country: 'ca' }
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

  const handleSelectAddress = (placeId: string) => {
    if (!placesService) return

    placesService.getDetails(
      {
        placeId: placeId,
        fields: ['address_components', 'formatted_address']
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          let streetNumber = ''
          let route = ''
          let city = ''
          let postalCode = ''

          place.address_components?.forEach((component) => {
            const types = component.types
            if (types.includes('street_number')) streetNumber = component.long_name
            if (types.includes('route')) route = component.long_name
            if (types.includes('locality')) city = component.long_name
            if (types.includes('postal_code')) postalCode = component.long_name
          })

          const streetAddress = `${streetNumber} ${route}`.trim()
          setAddressValue(streetAddress)
          setValue('streetAddress', streetAddress)
          setValue('city', city)
          setValue('postalCode', postalCode)
          setPredictions([])
          setShowPredictions(false)
        }
      }
    )
  }

  // Fetch rooms and sections data
  useEffect(() => {
    const fetchRoomsAndSections = async () => {
      try {
        setLoadingRooms(true)
        const response = await fetch(`/api/projects/${project.id}`)
        if (response.ok) {
          const data = await response.json()
          setRoomsData(data.rooms || [])
          setSectionsData(data.roomSections || [])
        }
      } catch (error) {
        console.error('Error fetching rooms:', error)
      } finally {
        setLoadingRooms(false)
      }
    }
    fetchRoomsAndSections()
  }, [project.id])

  useEffect(() => {
    if (editingField === 'client') {
      setClientFormData({
        name: project.client?.name || '',
        email: project.client?.email || '',
        phone: project.client?.phone || '',
        company: project.client?.company || '',
        billingName: project.client?.billingName || '',
        billingEmail: project.client?.billingEmail || '',
        billingAddress: project.client?.billingAddress || '',
        billingCity: project.client?.billingCity || '',
        billingProvince: project.client?.billingProvince || '',
        billingPostalCode: project.client?.billingPostalCode || '',
        billingCountry: project.client?.billingCountry || 'Canada'
      })
    }
  }, [editingField, project.client])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ProjectSettingsFormData>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      type: project?.type || 'RESIDENTIAL',
      status: project?.status || 'DRAFT',
      budget: project?.budget ? project.budget.toString() : '',
      dueDate: project?.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : '',
      streetAddress: project?.streetAddress || project?.address || '',
      city: project?.city || '',
      postalCode: project?.postalCode || '',
      coverImages: currentCoverImages,
      dropboxFolder: project?.dropboxFolder || '',
      hasFloorplanApproval: project?.hasFloorplanApproval || false,
      hasSpecBook: project?.hasSpecBook || false,
      hasProjectUpdates: project?.hasProjectUpdates || false,
    }
  })

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    try {
      setUploadingImage(true)
      const uploadedUrls = []
      
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('imageType', 'project-cover')
        formData.append('projectId', project.id)
        if (project.dropboxFolder) {
          formData.append('dropboxFolder', project.dropboxFolder)
        }

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to upload')
        uploadedUrls.push(data.url)
      }
      
      const newCoverImages = [...currentCoverImages, ...uploadedUrls]
      setCurrentCoverImages(newCoverImages)
      setValue('coverImages', newCoverImages, { shouldDirty: true })
      await updateSection('cover images', { coverImages: newCoverImages })
      
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image.')
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async (index: number) => {
    const newCoverImages = currentCoverImages.filter((_: string, i: number) => i !== index)
    setCurrentCoverImages(newCoverImages)
    setValue('coverImages', newCoverImages, { shouldDirty: true })
    await updateSection('cover images', { coverImages: newCoverImages })
  }

  const updateSection = async (sectionName: string, sectionData: any) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionData),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update ${sectionName}`)
      }
      
      setEditingField(null)
      router.refresh()
      
    } catch (error) {
      console.error(`Update error:`, error)
      alert(error instanceof Error ? error.message : `Failed to update`)
    } finally {
      setIsLoading(false)
    }
  }

  const addContractor = async () => {
    if (!newContractor.businessName || !newContractor.email) {
      alert('Please fill in Business Name and Email')
      return
    }
    
    if (newContractor.type === 'subcontractor' && !newContractor.specialty) {
      alert('Please specify the specialty for subcontractors')
      return
    }

    try {
      const response = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: newContractor.businessName,
          contactName: newContractor.contactName || null,
          email: newContractor.email,
          phone: newContractor.phone || null,
          address: newContractor.address || null,
          type: newContractor.type.toUpperCase(),
          specialty: newContractor.specialty || null
        })
      })

      if (response.ok) {
        const savedContractor = await response.json()
        setContractorsList([...contractorsList, { id: savedContractor.id, ...newContractor }])
        setNewContractor({ businessName: '', contactName: '', email: '', phone: '', address: '', type: 'contractor', specialty: '' })
        setShowAddContractorDialog(false)
      }
    } catch (error) {
      alert('Failed to save contractor')
    }
  }

  const removeContractor = (index: number) => {
    setContractorsList(contractorsList.filter((_: any, i: number) => i !== index))
  }

  const saveContractors = async () => {
    await updateSection('contractors', { contractors: contractorsList })
  }

  const openEditContractor = (contractor: any) => {
    setEditingContractor(contractor)
    setEditContractorData({
      businessName: contractor.businessName || '',
      contactName: contractor.contactName || '',
      email: contractor.email || '',
      phone: contractor.phone || '',
      address: contractor.address || '',
      type: (contractor.type?.toLowerCase() || 'contractor') as 'contractor' | 'subcontractor',
      specialty: contractor.specialty || '',
      notes: contractor.notes || ''
    })
  }

  const saveEditContractor = async () => {
    if (!editingContractor) return
    if (!editContractorData.businessName || !editContractorData.email) {
      alert('Business Name and Email are required')
      return
    }
    if (editContractorData.type === 'subcontractor' && !editContractorData.specialty) {
      alert('Specialty is required for subcontractors')
      return
    }

    setIsSavingContractor(true)
    try {
      const response = await fetch(`/api/contractors/${editingContractor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: editContractorData.businessName,
          contactName: editContractorData.contactName || null,
          email: editContractorData.email,
          phone: editContractorData.phone || null,
          address: editContractorData.address || null,
          type: editContractorData.type.toUpperCase(),
          specialty: editContractorData.specialty || null,
          notes: editContractorData.notes || null
        })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update contractor')
      }

      const updated = await response.json()
      setContractorsList((prev: any[]) => prev.map((c: any) =>
        c.id === editingContractor.id ? {
          ...c,
          businessName: updated.businessName,
          contactName: updated.contactName,
          email: updated.email,
          phone: updated.phone,
          address: updated.address,
          type: updated.type?.toLowerCase(),
          specialty: updated.specialty,
          notes: updated.notes
        } : c
      ))
      setEditingContractor(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update contractor')
    } finally {
      setIsSavingContractor(false)
    }
  }

  const deleteContractor = async (contractor: any) => {
    if (!confirm(`Are you sure you want to remove ${contractor.businessName}? This will deactivate or delete the contractor.`)) return

    setIsDeletingContractor(true)
    try {
      const response = await fetch(`/api/contractors/${contractor.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete contractor')
      }

      setContractorsList((prev: any[]) => prev.filter((c: any) => c.id !== contractor.id))
      setEditingContractor(null)
    } catch (error) {
      alert('Failed to delete contractor')
    } finally {
      setIsDeletingContractor(false)
    }
  }

  const updateClient = async () => {
    try {
      setIsLoading(true)

      // Transform empty strings to null for billing fields
      const dataToSend = {
        ...clientFormData,
        billingName: clientFormData.billingName?.trim() || null,
        billingEmail: clientFormData.billingEmail?.trim() || null,
        billingAddress: clientFormData.billingAddress?.trim() || null,
        billingCity: clientFormData.billingCity?.trim() || null,
        billingProvince: clientFormData.billingProvince?.trim() || null,
        billingPostalCode: clientFormData.billingPostalCode?.trim() || null,
        billingCountry: clientFormData.billingCountry?.trim() || null,
        additionalEmails: additionalEmails.filter(e => e.email) // Only include emails that have values
      }

      const response = await fetch(`/api/clients/${project.clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update client')
      }
      setEditingField(null)
      router.refresh()
    } catch (error) {
      console.error('Client update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update client')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmation.trim() !== project.name.trim()) {
      alert('Please enter the exact project name.')
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationName: deleteConfirmation }),
      })

      if (!response.ok) throw new Error('Failed to delete')
      router.push('/projects')
    } catch (error) {
      alert('Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'DRAFT': 'bg-gray-100 text-gray-700 border-gray-200',
      'IN_PROGRESS': 'bg-blue-50 text-blue-700 border-blue-200',
      'ON_HOLD': 'bg-amber-50 text-amber-700 border-amber-200',
      'URGENT': 'bg-red-50 text-red-700 border-red-200',
      'CANCELLED': 'bg-gray-100 text-gray-500 border-gray-200',
      'COMPLETED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
    return colors[status] || colors['DRAFT']
  }

  const formatStatus = (status: string) => status?.replace(/_/g, ' ')

  // Get address string
  const getAddress = () => {
    const parts = [project.streetAddress, project.city, project.postalCode].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  // Render sidebar
  const renderSidebar = () => (
    <div className="w-48 flex-shrink-0">
      <nav className="space-y-1 sticky top-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          const isDanger = item.id === 'danger'
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all ${
                isActive
                  ? isDanger
                    ? 'bg-red-50 text-red-700'
                    : 'bg-purple-50 text-purple-700'
                  : isDanger
                    ? 'text-gray-500 hover:bg-red-50 hover:text-red-600'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className={`w-4 h-4 mr-2.5 ${isActive ? '' : 'text-gray-400'}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )

  // Render main content
  const renderContent = () => {
    switch (activeSection) {
      case 'overview': return renderOverview()
      case 'images': return renderCoverImages()
      case 'access': return renderClientAccess()
      case 'rooms': return renderRoomsManagement()
      case 'features': return renderProjectFeatures()
      case 'dropbox': return renderDropboxConfig()
      case 'danger': return renderDangerZone()
      default: return null
    }
  }

  // Main Overview - Project + Client + Contractors in one view
  const renderOverview = () => {
    // Group ALL contractors by trade
    const contractorsByTrade = contractorsList.reduce((groups: Record<string, any[]>, c: any) => {
      const trade = getTradeForContractor(c)
      if (!groups[trade]) groups[trade] = []
      groups[trade].push(c)
      return groups
    }, {})

    // Sort trade groups by TRADE_ORDER
    const sortedTrades = Object.keys(contractorsByTrade).sort((a, b) => {
      const aIdx = TRADE_ORDER.indexOf(a)
      const bIdx = TRADE_ORDER.indexOf(b)
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })

    return (
      <div className="space-y-8">
        {/* Project Details */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900">Project Details</h3>
            {editingField !== 'project' && (
              <Button variant="ghost" size="sm" onClick={() => setEditingField('project')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
          </div>

          {editingField === 'project' ? (
            <form onSubmit={handleSubmit((data) => {
              updateSection('project', {
                name: data.name,
                type: data.type,
                status: data.status,
                description: data.description,
                streetAddress: data.streetAddress,
                city: data.city,
                postalCode: data.postalCode,
                budget: data.budget ? parseFloat(data.budget) : null,
                dueDate: data.dueDate || null
              })
            })} className="bg-gray-50 rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                  <Input {...register('name')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select {...register('type')} className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="HOSPITALITY">Hospitality</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select {...register('status')} className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">
                    <option value="DRAFT">Draft</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="URGENT">Urgent</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                  <Input {...register('budget')} type="number" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <Input {...register('dueDate')} type="date" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Textarea {...register('description')} rows={2} placeholder="Project description..." />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                      value={addressValue}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      onBlur={() => setTimeout(() => setShowPredictions(false), 200)}
                      onFocus={() => predictions.length > 0 && setShowPredictions(true)}
                      placeholder="Start typing address..."
                      className="pl-10"
                    />
                  </div>
                  {showPredictions && predictions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {predictions.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          type="button"
                          onClick={() => handleSelectAddress(prediction.place_id)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 focus:bg-purple-50 focus:outline-none"
                        >
                          <span className="font-medium">{prediction.structured_formatting.main_text}</span>
                          <span className="text-gray-500 ml-1">{prediction.structured_formatting.secondary_text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <Input {...register('city')} placeholder="City" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <Input {...register('postalCode')} placeholder="A1A 1A1" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={isLoading} className="bg-[#a657f0] hover:bg-[#a657f0]/90">Save Changes</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingField(null)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Project Name" value={project.name} />
                <InfoRow label="Type" value={project.type} />
                <InfoRow label="Status" value={
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(project.status)}`}>
                    {formatStatus(project.status)}
                  </span>
                } />
                <InfoRow label="Budget" value={project.budget ? `$${project.budget.toLocaleString()}` : null} />
                <InfoRow label="Due Date" value={project.dueDate ? new Date(project.dueDate).toLocaleDateString() : null} />
                <InfoRow label="Description" value={project.description} className="col-span-2" />
                <InfoRow label="Street Address" value={project.streetAddress} />
                <InfoRow label="City" value={project.city} />
                <InfoRow label="Postal Code" value={project.postalCode} />
              </div>
            </div>
          )}
        </div>

        {/* Client Information */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900">Client Information</h3>
            {editingField !== 'client' && (
              <Button variant="ghost" size="sm" onClick={() => setEditingField('client')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
          </div>

          {editingField === 'client' ? (
            <form onSubmit={(e) => { e.preventDefault(); updateClient() }} className="bg-gray-50 rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                  <Input value={clientFormData.name} onChange={(e) => setClientFormData(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <Input value={clientFormData.company} onChange={(e) => setClientFormData(p => ({ ...p, company: e.target.value }))} placeholder="Company name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Email</label>
                  <Input type="email" value={clientFormData.email} onChange={(e) => setClientFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input value={clientFormData.phone} onChange={(e) => setClientFormData(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" />
                </div>
              </div>

              {/* Additional Emails */}
              {additionalEmails.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Additional Emails</label>
                  {additionalEmails.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="w-1/3">
                        <Input
                          value={item.label}
                          onChange={(e) => updateAdditionalEmail(index, 'label', e.target.value)}
                          placeholder="Label (e.g., Accounting)"
                          className="text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="email"
                          value={item.email}
                          onChange={(e) => updateAdditionalEmail(index, 'email', e.target.value)}
                          placeholder="email@example.com"
                          className="text-sm"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeAdditionalEmail(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={addAdditionalEmail} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                <Plus className="w-4 h-4 mr-2" />
                Add Additional Email
              </Button>

              {/* Billing Information */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Billing Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Billing Contact Name</label>
                    <Input value={clientFormData.billingName} onChange={(e) => setClientFormData(p => ({ ...p, billingName: e.target.value }))} placeholder="Accounts Payable" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
                    <Input type="email" value={clientFormData.billingEmail} onChange={(e) => setClientFormData(p => ({ ...p, billingEmail: e.target.value }))} placeholder="billing@example.com" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                    <Input value={clientFormData.billingAddress} onChange={(e) => setClientFormData(p => ({ ...p, billingAddress: e.target.value }))} placeholder="123 Main St, Suite 100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <Input value={clientFormData.billingCity} onChange={(e) => setClientFormData(p => ({ ...p, billingCity: e.target.value }))} placeholder="Montreal" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province/State</label>
                    <Input value={clientFormData.billingProvince} onChange={(e) => setClientFormData(p => ({ ...p, billingProvince: e.target.value }))} placeholder="Quebec" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <Input value={clientFormData.billingPostalCode} onChange={(e) => setClientFormData(p => ({ ...p, billingPostalCode: e.target.value }))} placeholder="H2X 1Y4" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <Input value={clientFormData.billingCountry} onChange={(e) => setClientFormData(p => ({ ...p, billingCountry: e.target.value }))} placeholder="Canada" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={isLoading} className="bg-[#a657f0] hover:bg-[#a657f0]/90">Save Changes</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingField(null)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Client Name" value={project.client?.name} />
                <InfoRow label="Company" value={project.client?.company} />
                <InfoRow label="Primary Email" value={project.client?.email} />
                <InfoRow label="Phone" value={project.client?.phone} />
                {project.client?.additionalEmails && project.client.additionalEmails.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">Additional Emails</p>
                    <div className="space-y-1">
                      {project.client.additionalEmails.map((item: any, i: number) => (
                        <p key={i} className="text-sm text-gray-900">
                          {item.label && <span className="text-gray-500">{item.label}: </span>}
                          {item.email}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Billing Information Display */}
              {(project.client?.billingName || project.client?.billingEmail || project.client?.billingAddress) && (
                <div className="border-t border-gray-200 mt-4 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Billing Information</h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <InfoRow label="Billing Contact" value={project.client?.billingName} />
                    <InfoRow label="Billing Email" value={project.client?.billingEmail} />
                    <InfoRow label="Billing Address" value={project.client?.billingAddress} />
                    <InfoRow label="City" value={project.client?.billingCity} />
                    <InfoRow label="Province/State" value={project.client?.billingProvince} />
                    <InfoRow label="Postal Code" value={project.client?.billingPostalCode} />
                    <InfoRow label="Country" value={project.client?.billingCountry} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contractors & Subcontractors */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900">Contractors & Subcontractors</h3>
            {editingField !== 'contractors' && (
              <Button variant="ghost" size="sm" onClick={() => setEditingField('contractors')} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
          </div>

          {editingField === 'contractors' ? (
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              {contractorsList.length > 0 && (
                <div className="space-y-2">
                  {contractorsList.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                      <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => openEditContractor(c)}>
                        {c.logoUrl && (
                          <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 border border-gray-200">
                            <Image src={c.logoUrl} alt="" width={32} height={32} className="object-cover w-full h-full" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{c.businessName}</p>
                          <p className="text-xs text-gray-500">{getTradeLabel(getTradeForContractor(c))}{c.specialty && !c.trade ? ` • ${c.specialty}` : ''}</p>
                          {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditContractor(c)} className="text-purple-500 hover:text-purple-700 hover:bg-purple-50 h-8 w-8 p-0">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeContractor(i)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={async () => {
                  setLoadingContractors(true)
                  try {
                    const res = await fetch('/api/contractors')
                    if (res.ok) { setAvailableContractors(await res.json()); setShowSelectContractorDialog(true) }
                  } finally { setLoadingContractors(false) }
                }}>
                  <Building className="w-4 h-4 mr-1.5" />
                  Select from Library
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddContractorDialog(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add New
                </Button>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" onClick={saveContractors} disabled={isLoading} className="bg-[#a657f0] hover:bg-[#a657f0]/90">Save Changes</Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditingField(null); setContractorsList(project.contractors || []) }}>Cancel</Button>
              </div>
            </div>
          ) : contractorsList.length > 0 ? (
            <Accordion type="multiple" defaultValue={['GENERAL_CONTRACTOR']} className="space-y-2">
              {sortedTrades.map((trade) => {
                const tradeContractors = contractorsByTrade[trade]
                const label = getTradeLabel(trade)
                const isGC = trade === 'GENERAL_CONTRACTOR'
                const isDesignPro = ['ARCHITECT', 'INTERIOR_DESIGNER', 'STRUCTURAL_ENGINEER', 'MEP_ENGINEER', 'CIVIL_ENGINEER'].includes(trade)
                const bgColor = isGC ? 'bg-blue-50 border-blue-100' : isDesignPro ? 'bg-indigo-50 border-indigo-100' : 'bg-purple-50 border-purple-100'
                const badgeColor = isGC ? 'bg-blue-100 text-blue-700' : isDesignPro ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                const borderColor = isGC ? 'border-blue-200' : isDesignPro ? 'border-indigo-200' : 'border-purple-200'

                return (
                  <AccordionItem key={trade} value={trade} className={`rounded-xl border ${bgColor} overflow-hidden`}>
                    <AccordionTrigger className="px-5 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        {isGC ? <Building className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                        <span className="text-sm font-semibold">{label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
                          {tradeContractors.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-4">
                      <div className="space-y-3">
                        {tradeContractors.map((c: any, i: number) => (
                          <div key={i} className={`bg-white rounded-lg p-4 border ${borderColor} cursor-pointer hover:shadow-sm transition-all`} onClick={() => openEditContractor(c)}>
                            <div className="flex items-start gap-3">
                              {c.logoUrl && (
                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                  <Image src={c.logoUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-gray-900 text-sm">{c.businessName}</p>
                                  <span className="text-xs text-gray-400">Click to edit</span>
                                </div>
                                <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1">
                                  {(c.contacts && c.contacts.length > 0) ? (
                                    <>
                                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                        <User className="w-3 h-3 text-gray-400" />
                                        {c.contacts.find((ct: any) => ct.isPrimary)?.name || c.contacts[0]?.name || c.contactName || '—'}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                        <Mail className="w-3 h-3 text-gray-400" />
                                        {c.contacts.find((ct: any) => ct.isPrimary)?.email || c.contacts[0]?.email || c.email}
                                      </div>
                                      {(c.contacts.find((ct: any) => ct.isPrimary)?.phone || c.contacts[0]?.phone || c.phone) && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                          <Phone className="w-3 h-3 text-gray-400" />
                                          {c.contacts.find((ct: any) => ct.isPrimary)?.phone || c.contacts[0]?.phone || c.phone}
                                        </div>
                                      )}
                                      {c.contacts.length > 1 && (
                                        <div className="flex items-center">
                                          <span className="text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                            +{c.contacts.length - 1} more contact{c.contacts.length > 2 ? 's' : ''}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {c.contactName && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                          <User className="w-3 h-3 text-gray-400" />
                                          {c.contactName}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                        <Mail className="w-3 h-3 text-gray-400" />
                                        {c.email}
                                      </div>
                                      {c.phone && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                          <Phone className="w-3 h-3 text-gray-400" />
                                          {c.phone}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-3">No contractors or subcontractors assigned</p>
              <Button variant="outline" size="sm" onClick={() => setEditingField('contractors')}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Contractors
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Cover Images Section
  const renderCoverImages = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Cover Images</h3>
          <p className="text-sm text-gray-500">{currentCoverImages.length} image{currentCoverImages.length !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <input type="file" id="cover-images" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          <label htmlFor="cover-images">
            <Button variant="outline" size="sm" disabled={uploadingImage} className="cursor-pointer" asChild>
              <span><Upload className="w-4 h-4 mr-2" />{uploadingImage ? 'Uploading...' : 'Add'}</span>
            </Button>
          </label>
        </div>
      </div>

      {currentCoverImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {currentCoverImages.map((url: string, i: number) => (
            <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border border-gray-200">
              <Image src={url} alt={`Cover ${i + 1}`} fill className="object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Camera className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No cover images</p>
          <label htmlFor="cover-images" className="cursor-pointer">
            <Button variant="outline" size="sm" asChild><span>Upload Images</span></Button>
          </label>
        </div>
      )}
    </div>
  )

  // Client Access Section
  const renderClientAccess = () => (
    <ClientAccessManagement 
      projectId={project.id}
      projectName={project.name}
      clientName={project.client?.name || 'Client'}
    />
  )

  // Rooms Management Section
  const renderRoomsManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Rooms Management</h3>
          <p className="text-sm text-gray-500">
            {loadingRooms ? 'Loading...' : `${roomsData.length} rooms • ${sectionsData.length} sections`}
          </p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl p-6">
        <RoomsManagementSection projectId={project.id} />
      </div>
    </div>
  )

  // Project Features Section
  const renderProjectFeatures = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Project Features</h3>
          <p className="text-sm text-gray-500">Enable or disable features</p>
        </div>
        {editingField !== 'features' && (
          <Button variant="ghost" size="sm" onClick={() => setEditingField('features')}><Edit className="w-4 h-4" /></Button>
        )}
      </div>

      {editingField === 'features' ? (
        <form onSubmit={handleSubmit((data) => {
          updateSection('features', {
            hasFloorplanApproval: data.hasFloorplanApproval || false,
            hasSpecBook: data.hasSpecBook || false,
            hasProjectUpdates: data.hasProjectUpdates || false,
            hasBillingProcurement: data.hasBillingProcurement || false,
          })
        })} className="space-y-3">
          <FeatureToggle icon={Folder} title="Floorplan" color="blue" register={register('hasFloorplanApproval')} />
          <FeatureToggle icon={BookOpen} title="Spec Book" color="green" register={register('hasSpecBook')} />
          <FeatureToggle icon={ClipboardList} title="Project Updates" color="purple" register={register('hasProjectUpdates')} />
          <FeatureToggle icon={ShoppingCart} title="Billing & Procurement" color="amber" register={register('hasBillingProcurement')} />
          <div className="flex gap-2 pt-4">
            <Button type="submit" size="sm" disabled={isLoading} className="bg-[#a657f0] hover:bg-[#a657f0]/90">Save</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingField(null)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <FeatureStatus title="Floorplan" enabled={project.hasFloorplanApproval} icon={Folder} color="blue" />
          <FeatureStatus title="Spec Book" enabled={project.hasSpecBook} icon={BookOpen} color="green" />
          <FeatureStatus title="Project Updates" enabled={project.hasProjectUpdates} icon={ClipboardList} color="purple" />
          <FeatureStatus title="Billing & Procurement" enabled={project.hasBillingProcurement} icon={ShoppingCart} color="amber" />
        </div>
      )}
    </div>
  )

  // Dropbox Config Section
  const renderDropboxConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Dropbox Configuration</h3>
        <p className="text-sm text-gray-500">File storage location</p>
      </div>

      {project.dropboxFolder && editingField !== 'dropbox' ? (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
              <Folder className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-900 truncate">{project.dropboxFolder}</p>
              <p className="text-xs text-purple-600">Connected</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              setDropboxFolderPath(project.dropboxFolder || '')
              setDropboxOption('link')
              setEditingField('dropbox')
            }}>Change</Button>
          </div>
        </div>
      ) : editingField === 'dropbox' ? (
        <div className="space-y-4">
          {/* Show current folder if changing */}
          {project.dropboxFolder && (
            <div className="p-3 bg-gray-100 rounded-lg text-sm">
              <p className="text-gray-500">Current folder:</p>
              <p className="font-medium text-gray-700 truncate">{project.dropboxFolder}</p>
            </div>
          )}

          <div onClick={() => setDropboxOption('create')} className={`p-4 rounded-xl border-2 cursor-pointer ${dropboxOption === 'create' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center gap-3">
              <FolderPlus className="w-5 h-5 text-purple-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Create New Folder</p>
                <p className="text-xs text-gray-500">Auto-create with subfolders</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 ${dropboxOption === 'create' ? 'border-[#a657f0] bg-[#a657f0]' : 'border-gray-300'}`}>
                {dropboxOption === 'create' && <Check className="w-full h-full text-white p-0.5" />}
              </div>
            </div>
          </div>

          <div onClick={() => setDropboxOption('link')} className={`p-4 rounded-xl border-2 cursor-pointer ${dropboxOption === 'link' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Link Existing</p>
                <p className="text-xs text-gray-500">Browse or enter path</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 ${dropboxOption === 'link' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                {dropboxOption === 'link' && <Check className="w-full h-full text-white p-0.5" />}
              </div>
            </div>
            {dropboxOption === 'link' && (
              <div className="mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                <Input value={dropboxFolderPath} onChange={(e) => setDropboxFolderPath(e.target.value)} placeholder="/Folder/Path" />
                <DropboxFolderBrowser currentPath={dropboxFolderPath} onSelect={(p) => setDropboxFolderPath(p)} />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" disabled={isCreatingDropbox || (dropboxOption === 'link' && !dropboxFolderPath)} className="bg-[#a657f0] hover:bg-[#a657f0]/90"
              onClick={async () => {
                setIsCreatingDropbox(true)
                try {
                  let folderPath = null
                  if (dropboxOption === 'create') {
                    const res = await fetch(`/api/projects/${project.id}/dropbox-folder`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectName: project.name })
                    })
                    if (res.ok) folderPath = (await res.json()).folderPath
                  } else {
                    folderPath = dropboxFolderPath
                  }
                  await updateSection('dropbox', { dropboxFolder: folderPath })
                  setEditingField(null)
                } finally { setIsCreatingDropbox(false) }
              }}
            >
              {isCreatingDropbox ? 'Processing...' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditingField(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Folder className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No folder linked</p>
          <Button variant="outline" size="sm" onClick={() => setEditingField('dropbox')}>
            <FolderPlus className="w-4 h-4 mr-1.5" />
            Configure
          </Button>
        </div>
      )}
    </div>
  )

  // Danger Zone
  const renderDangerZone = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-red-600">Danger Zone</h3>
        <p className="text-sm text-gray-500">Irreversible actions</p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Delete Project</h4>
            <p className="text-sm text-gray-600 mt-1">Permanently delete this project and all data.</p>
            {session.user.role !== 'OWNER' && <p className="text-sm text-red-600 mt-2">Only owners can delete</p>}
          </div>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={session.user.role !== 'OWNER'}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex gap-8">
      {renderSidebar()}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {renderContent()}
        </div>
      </div>

      {/* Modals */}
      {showAddContractorDialog && (
        <Modal title="Add Contractor" onClose={() => setShowAddContractorDialog(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={newContractor.type} onChange={(e) => setNewContractor({ ...newContractor, type: e.target.value as any })} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="contractor">Contractor</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <Input value={newContractor.businessName} onChange={(e) => setNewContractor({ ...newContractor, businessName: e.target.value })} />
            </div>
            {newContractor.type === 'subcontractor' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty *</label>
                <Input value={newContractor.specialty} onChange={(e) => setNewContractor({ ...newContractor, specialty: e.target.value })} placeholder="Electrician, Plumber, etc." />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <Input type="email" value={newContractor.email} onChange={(e) => setNewContractor({ ...newContractor, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <Input value={newContractor.contactName} onChange={(e) => setNewContractor({ ...newContractor, contactName: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={() => setShowAddContractorDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={addContractor} disabled={!newContractor.businessName || !newContractor.email} className="bg-[#a657f0] hover:bg-[#a657f0]/90">Add</Button>
          </div>
        </Modal>
      )}

      {showSelectContractorDialog && (
        <Modal title="Select from Library" onClose={() => setShowSelectContractorDialog(false)}>
          <div className="mb-4">
            <Input placeholder="Search..." value={contractorSearchTerm} onChange={(e) => setContractorSearchTerm(e.target.value)} className="text-sm" />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableContractors.filter(c => c.businessName.toLowerCase().includes(contractorSearchTerm.toLowerCase())).map((c) => {
              const added = contractorsList.some((x: any) => x.id === c.id)
              return (
                <div key={c.id} onClick={() => {
                  if (!added) {
                    setContractorsList([...contractorsList, {
                      id: c.id,
                      businessName: c.businessName,
                      contactName: c.contactName,
                      email: c.email,
                      phone: c.phone,
                      address: c.address,
                      type: c.type.toLowerCase(),
                      specialty: c.specialty
                    }])
                    setShowSelectContractorDialog(false)
                  }
                }} className={`p-3 rounded-lg border cursor-pointer ${added ? 'bg-gray-50 opacity-50' : 'hover:bg-purple-50 hover:border-purple-200'}`}>
                  <p className="font-medium text-sm text-gray-900">{c.businessName}</p>
                  <p className="text-xs text-gray-500 capitalize">{c.type.toLowerCase()}{c.specialty ? ` • ${c.specialty}` : ''}</p>
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal title="Delete Project" onClose={() => setShowDeleteConfirm(false)}>
          <p className="text-sm text-gray-600 mb-4">Type <strong>{project.name}</strong> to confirm:</p>
          <Input value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="mb-4" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting || deleteConfirmation !== project.name}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}

      {editingContractor && (
        <Modal title="Edit Contractor" onClose={() => setEditingContractor(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={editContractorData.type} onChange={(e) => setEditContractorData({ ...editContractorData, type: e.target.value as any })} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="contractor">Contractor</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <Input value={editContractorData.businessName} onChange={(e) => setEditContractorData({ ...editContractorData, businessName: e.target.value })} />
            </div>
            {editContractorData.type === 'subcontractor' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty *</label>
                <Input value={editContractorData.specialty} onChange={(e) => setEditContractorData({ ...editContractorData, specialty: e.target.value })} placeholder="Electrician, Plumber, etc." />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <Input value={editContractorData.contactName} onChange={(e) => setEditContractorData({ ...editContractorData, contactName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <Input type="email" value={editContractorData.email} onChange={(e) => setEditContractorData({ ...editContractorData, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input value={editContractorData.phone} onChange={(e) => setEditContractorData({ ...editContractorData, phone: e.target.value })} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Input value={editContractorData.address} onChange={(e) => setEditContractorData({ ...editContractorData, address: e.target.value })} placeholder="123 Main St, City" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <Textarea value={editContractorData.notes} onChange={(e) => setEditContractorData({ ...editContractorData, notes: e.target.value })} rows={2} placeholder="Additional notes..." />
            </div>
          </div>
          <div className="flex items-center justify-between mt-6">
            <Button variant="destructive" size="sm" onClick={() => deleteContractor(editingContractor)} disabled={isDeletingContractor}>
              <Trash2 className="w-4 h-4 mr-1" />
              {isDeletingContractor ? 'Deleting...' : 'Delete'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingContractor(null)}>Cancel</Button>
              <Button size="sm" onClick={saveEditContractor} disabled={isSavingContractor || !editContractorData.businessName || !editContractorData.email} className="bg-[#a657f0] hover:bg-[#a657f0]/90">
                {isSavingContractor ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Helper Components
function FeatureToggle({ icon: Icon, title, color, register }: { icon: any; title: string; color: string; register: any }) {
  const bg = color === 'blue' ? 'bg-blue-100' : color === 'green' ? 'bg-green-100' : color === 'amber' ? 'bg-amber-100' : 'bg-purple-100'
  const ic = color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-purple-600'
  return (
    <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}><Icon className={`w-4 h-4 ${ic}`} /></div>
        <span className="font-medium text-gray-900 text-sm">{title}</span>
      </div>
      <input type="checkbox" {...register} className="h-4 w-4 rounded border-gray-300 text-purple-600" />
    </label>
  )
}

function FeatureStatus({ title, enabled, icon: Icon, color }: { title: string; enabled: boolean; icon: any; color: string }) {
  const bg = color === 'blue' ? 'bg-blue-100' : color === 'green' ? 'bg-green-100' : color === 'amber' ? 'bg-amber-100' : 'bg-purple-100'
  const ic = color === 'blue' ? 'text-blue-600' : color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-purple-600'
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}><Icon className={`w-4 h-4 ${ic}`} /></div>
        <span className="font-medium text-gray-900 text-sm">{title}</span>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {value ? (
        <p className="text-sm text-gray-900">{value}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">Not set</p>
      )}
    </div>
  )
}

function InfoRowSmall({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500">{label}</p>
      {value ? (
        <p className="text-sm font-medium text-gray-900">{value}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">—</p>
      )}
    </div>
  )
}
