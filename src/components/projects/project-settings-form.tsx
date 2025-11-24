'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Calendar, DollarSign, Trash2, Building, Camera, Folder, Edit, X, User, Users, Plus, Settings as SettingsIcon, BookOpen, ClipboardList, Home, Search, FolderPlus, Link2, FolderX, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import ClientAccessManagement from './ClientAccessManagement'
import RoomsManagementSection from './rooms-management-section'
import { DropboxFolderBrowser } from './DropboxFolderBrowser'

// Form validation schema
const projectSettingsSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().optional(),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'HOSPITALITY']),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED']),
  budget: z.string().optional(),
  dueDate: z.string().optional(),
  address: z.string().optional(), // Legacy field
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  coverImages: z.array(z.string()).optional(),
  dropboxFolder: z.string().optional().nullable(),
  hasFloorplanApproval: z.boolean().optional(),
  hasSpecBook: z.boolean().optional(),
  hasProjectUpdates: z.boolean().optional(),
})

type ProjectSettingsFormData = z.infer<typeof projectSettingsSchema>

interface ProjectSettingsFormProps {
  project: any
  clients: any[]
  session: any
}

export default function ProjectSettingsForm({ project, clients, session }: ProjectSettingsFormProps) {
  
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [currentCoverImages, setCurrentCoverImages] = useState(() => {
    // Handle different formats: array, stringified array, single string, or null
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
  const [editingSection, setEditingSection] = useState<string | null>(null)
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
  const [dropboxOption, setDropboxOption] = useState<'create' | 'link' | 'skip'>('skip')
  const [dropboxFolderPath, setDropboxFolderPath] = useState('')
  const [isDropboxExpanded, setIsDropboxExpanded] = useState(false)
  const [isCreatingDropbox, setIsCreatingDropbox] = useState(false)
  const [showDropboxLinkModal, setShowDropboxLinkModal] = useState(false)
  const [clientFormData, setClientFormData] = useState({
    name: project.client?.name || '',
    email: project.client?.email || '',
    phone: project.client?.phone || '',
    company: project.client?.company || ''
  })

  // Track component lifecycle
  useEffect(() => {
    
    // Check for any immediate issues
    if (!project) {
      console.error('❌ PROJECT SETTINGS FORM - No project data provided!')
      return
    }
    
    if (!project.id) {
      console.error('❌ PROJECT SETTINGS FORM - Project missing ID:', project)
      return
    }

    // Cleanup function
    return () => {
      
    }
  }, [])
  
  // Log project changes
  useEffect(() => {
    
  }, [project])

  // Update client form data when entering edit mode
  useEffect(() => {
    if (editingSection === 'client') {
      setClientFormData({
        name: project.client?.name || '',
        email: project.client?.email || '',
        phone: project.client?.phone || '',
        company: project.client?.company || ''
      })
    }
  }, [editingSection, project.client])

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch
  } = useForm<ProjectSettingsFormData>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      type: project?.type || 'RESIDENTIAL',
      status: project?.status || 'DRAFT',
      budget: project?.budget ? project.budget.toString() : '',
      dueDate: project?.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : '',
      address: project?.address || '', // Legacy field
      streetAddress: project?.streetAddress || project?.address || '', // Fallback to legacy address if structured field is empty
      city: project?.city || '',
      postalCode: project?.postalCode || '',
      coverImages: (() => {
        // Handle different formats: array, stringified array, single string, or null
        if (!project?.coverImages) return []
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
      })(),
      dropboxFolder: project?.dropboxFolder || '',
      hasFloorplanApproval: project?.hasFloorplanApproval || false,
      hasSpecBook: project?.hasSpecBook || false,
      hasProjectUpdates: project?.hasProjectUpdates || false,
    }
  })

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    
    if (!files) {
      
      return
    }

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
          credentials: 'include' // Ensure cookies are included
        })

        const data = await response.json()
        
        // Check if we need to prompt for Dropbox linking
        if (data.errorCode === 'NO_DROPBOX_LINK') {
          setShowDropboxLinkModal(true)
          setUploadingImage(false)
          return // Stop upload process and show modal
        }

        if (!response.ok) {
          throw new Error(data.message || 'Failed to upload image')
        }

        uploadedUrls.push(data.url)
      }
      
      const newCoverImages = [...currentCoverImages, ...uploadedUrls]
      setCurrentCoverImages(newCoverImages)
      setValue('coverImages', newCoverImages, { shouldDirty: true })
      
      // Auto-save after upload
      await updateSection('cover images', { coverImages: newCoverImages })
      
      alert(`${uploadedUrls.length} image(s) uploaded successfully!`)
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async (index: number) => {
    const newCoverImages = currentCoverImages.filter((_: string, i: number) => i !== index)
    setCurrentCoverImages(newCoverImages)
    setValue('coverImages', newCoverImages, { shouldDirty: true })
    
    // Auto-save after removal
    await updateSection('cover images', { coverImages: newCoverImages })
  }

  const replaceImage = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      setUploadingImage(true)
      const file = files[0]
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
      })

      const data = await response.json()
      
      // Check if we need to prompt for Dropbox linking
      if (data.errorCode === 'NO_DROPBOX_LINK') {
        setShowDropboxLinkModal(true)
        setUploadingImage(false)
        return // Stop upload process and show modal
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload image')
      }
      
      const newCoverImages = [...currentCoverImages]
      newCoverImages[index] = data.url
      setCurrentCoverImages(newCoverImages)
      setValue('coverImages', newCoverImages, { shouldDirty: true })
      
      // Auto-save after replacement
      await updateSection('cover images', { coverImages: newCoverImages })
      
      alert('Image replaced successfully!')
    } catch (error) {
      console.error('Image replacement error:', error)
      alert('Failed to replace image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  const updateSection = async (sectionName: string, sectionData: any) => {

    try {
      setIsLoading(true)

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sectionData),
        credentials: 'include' // Ensure cookies are included
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        throw new Error(errorData.error || `Failed to update ${sectionName}`)
      }
      
      const result = await response.json()
      setEditingSection(null)
      
      // Refresh the page to show updated data
      router.refresh()
      
    } catch (error) {
      console.error(`Update error for ${sectionName}:`, error)
      alert(error instanceof Error ? error.message : `Failed to update ${sectionName}`)
    } finally {
      setIsLoading(false)
    }
  }

  const addContractor = async () => {
    if (!newContractor.businessName || !newContractor.email) {
      alert('Please fill in required fields: Business Name and Email')
      return
    }
    
    if (newContractor.type === 'subcontractor' && !newContractor.specialty) {
      alert('Please specify the specialty/trade for subcontractors (e.g., Electrician, Plumber, HVAC, etc.)')
      return
    }

    try {
      // Save to contractors library database
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
        
        // Add the saved contractor to the project's contractor list
        const contractor = {
          id: savedContractor.id,
          ...newContractor
        }

        setContractorsList([...contractorsList, contractor])
        setNewContractor({
          businessName: '',
          contactName: '',
          email: '',
          phone: '',
          address: '',
          type: 'contractor',
          specialty: ''
        })
        setShowAddContractorDialog(false)
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to save contractor to library')
      }
    } catch (error) {
      console.error('Error saving contractor:', error)
      alert('Failed to save contractor to library')
    }
  }

  const removeContractor = (index: number) => {
    setContractorsList(contractorsList.filter((_: any, i: number) => i !== index))
  }

  const saveContractors = async () => {
    await updateSection('contractors', { contractors: contractorsList })
  }

  const updateClient = async () => {
    
    try {
      setIsLoading(true)

      const response = await fetch(`/api/clients/${project.clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientFormData),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        throw new Error(errorData.error || 'Failed to update client')
      }
      
      const result = await response.json()
      
      setEditingSection(null)
      
      // Refresh the page to show updated client data
      router.refresh()
      
    } catch (error) {
      console.error('Client update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update client')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: ProjectSettingsFormData) => {

    try {
      setIsLoading(true)

      const submitData = {
        ...data,
        budget: data.budget ? parseFloat(data.budget) : null,
        dueDate: data.dueDate || null,
        coverImages: currentCoverImages,
      }

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
        credentials: 'include' // Ensure cookies are included
      })

      console.log('🗺️ Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error response:', errorText)
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update project`)
      }
      
      const result = await response.json()
      
      // Navigate back to the project page after successful save
      router.push(`/projects/${project.id}?saved=true`)
      // Note: You can add a toast notification here instead of alert if preferred
    } catch (error) {
      console.error('Update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update project')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmation.trim() !== project.name.trim()) {
      alert('Please enter the exact project name to confirm deletion.')
      return
    }

    try {
      setIsDeleting(true)

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmationName: deleteConfirmation,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete project')
      }

      alert('Project deleted successfully!')
      router.push('/projects')
    } catch (error) {
      console.error('Delete error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete project')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteConfirmation('')
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Project Information Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <Building className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Project Information</h2>
          </div>
          {editingSection !== 'project' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                
                setEditingSection('project')
              }}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="px-6 py-4">
          {editingSection === 'project' ? (
            <form onSubmit={handleSubmit((data) => {

              updateSection('project information', {
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
            })} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <Input
                    {...register('name')}
                    placeholder="Enter project name"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type
                  </label>
                  <select
                    {...register('type')}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="HOSPITALITY">Hospitality</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Status
                </label>
                <select
                  {...register('status')}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Address
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Input
                      {...register('streetAddress')}
                      placeholder="123 Main Street"
                      className="mb-2"
                    />
                    <label className="text-xs text-gray-500">Street Address</label>
                  </div>
                  <div>
                    <Input
                      {...register('city')}
                      placeholder="City"
                      className="mb-2"
                    />
                    <label className="text-xs text-gray-500">City</label>
                  </div>
                  <div>
                    <Input
                      {...register('postalCode')}
                      placeholder="12345"
                      className="mb-2"
                    />
                    <label className="text-xs text-gray-500">Postal Code</label>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Describe this project..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      {...register('budget')}
                      type="number"
                      placeholder="150000"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      {...register('dueDate')}
                      type="date"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => console.log('🔄 Save Changes button clicked (section form)')}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSection(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Project Name</p>
                  <p className="text-gray-900 mt-1">{project.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <p className="text-gray-900 mt-1">{project.type}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    project.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                    project.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                    project.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                    project.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    project.status === 'COMPLETED' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status === 'DRAFT' ? 'Draft' :
                     project.status === 'IN_PROGRESS' ? 'In Progress' :
                     project.status === 'PENDING_APPROVAL' ? 'Pending Approval' :
                     project.status === 'APPROVED' ? 'Approved' :
                     project.status === 'COMPLETED' ? 'Completed' :
                     project.status}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Project Address</p>
                <div className="text-gray-900 mt-1">
                  {project.streetAddress || project.city || project.postalCode ? (
                    <div className="space-y-1">
                      {project.streetAddress && <div>{project.streetAddress}</div>}
                      <div>
                        {project.city && <span>{project.city}</span>}
                        {project.city && project.postalCode && <span>, </span>}
                        {project.postalCode && <span>{project.postalCode}</span>}
                      </div>
                    </div>
                  ) : (
                    project.address || 'No address specified'
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Description</p>
                <p className="text-gray-900 mt-1">{project.description || 'No description provided'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Budget</p>
                  <p className="text-gray-900 mt-1">{project.budget ? `$${project.budget.toLocaleString()}` : 'No budget specified'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Due Date</p>
                  <p className="text-gray-900 mt-1">{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'No due date set'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 2. Client Information Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <User className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Client Information</h2>
          </div>
          {editingSection !== 'client' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSection('client')}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="px-6 py-4">
          {editingSection === 'client' ? (
            <form onSubmit={(e) => {
              e.preventDefault()
              updateClient()
            }} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Editing client information will update the client record across all projects.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <Input
                    value={clientFormData.name}
                    onChange={(e) => setClientFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter client name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={clientFormData.email}
                    onChange={(e) => setClientFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="client@email.com"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    value={clientFormData.phone}
                    onChange={(e) => setClientFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company
                  </label>
                  <Input
                    value={clientFormData.company}
                    onChange={(e) => setClientFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Company Name"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-3 pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingSection(null)
                    // Reset form data to original values
                    setClientFormData({
                      name: project.client?.name || '',
                      email: project.client?.email || '',
                      phone: project.client?.phone || '',
                      company: project.client?.company || ''
                    })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Client Name</p>
                  <p className="text-gray-900 mt-1">{project.client?.name || 'No client assigned'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-gray-900 mt-1">{project.client?.email || 'No email provided'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-gray-900 mt-1">{project.client?.phone || 'No phone provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Company</p>
                  <p className="text-gray-900 mt-1">{project.client?.company || 'No company specified'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 3. Contractor & Subcontractor Information Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <Users className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Contractor & Subcontractor Information</h2>
          </div>
          {editingSection !== 'contractors' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSection('contractors')}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="px-6 py-4">
          {editingSection === 'contractors' ? (
            <div className="space-y-4">
              {/* Current Contractors */}
              {contractorsList.length > 0 && (
                <div className="space-y-3">
                  {contractorsList.map((contractor: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
                      <button
                        onClick={() => removeContractor(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Business Name</p>
                          <p className="text-gray-900 mt-1">{contractor.businessName || contractor.name || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Type</p>
                          <p className="text-gray-900 mt-1 capitalize">{contractor.type}</p>
                        </div>
                      </div>
                      {contractor.specialty && (
                        <div className="mt-3 pr-8">
                          <p className="text-sm font-medium text-gray-500">Specialty</p>
                          <p className="text-gray-900 mt-1">{contractor.specialty}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pr-8">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Contact Name</p>
                          <p className="text-gray-900 mt-1">{contractor.contactName || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Email</p>
                          <p className="text-gray-900 mt-1">{contractor.email || 'Not specified'}</p>
                        </div>
                      </div>
                      {contractor.address && (
                        <div className="mt-3 pr-8">
                          <p className="text-sm font-medium text-gray-500">Address</p>
                          <p className="text-gray-900 mt-1">{contractor.address}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Contractor Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setLoadingContractors(true)
                    try {
                      const response = await fetch('/api/contractors')
                      if (response.ok) {
                        const data = await response.json()
                        setAvailableContractors(data)
                        setShowSelectContractorDialog(true)
                      }
                    } catch (error) {
                      console.error('Error loading contractors:', error)
                      alert('Failed to load contractors library')
                    } finally {
                      setLoadingContractors(false)
                    }
                  }}
                  className="border-2 border-blue-300 hover:border-blue-400 hover:bg-blue-50"
                  disabled={loadingContractors}
                >
                  <Building className="w-4 h-4 mr-2" />
                  {loadingContractors ? 'Loading...' : 'Select from Library'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddContractorDialog(true)}
                  className="border-dashed border-2 border-gray-300 hover:border-purple-400"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Contractor
                </Button>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-4 border-t">
                <Button
                  onClick={saveContractors}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingSection(null)
                    setContractorsList(project.contractors || []) // Reset changes
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {contractorsList.length > 0 ? (
                <div className="space-y-3">
                  {contractorsList.map((contractor: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Business Name</p>
                          <p className="text-gray-900 mt-1">{contractor.businessName || contractor.name || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Type</p>
                          <p className="text-gray-900 mt-1 capitalize">{contractor.type}</p>
                        </div>
                      </div>
                      {contractor.specialty && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-500">Specialty</p>
                          <p className="text-gray-900 mt-1">{contractor.specialty}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Contact Name</p>
                          <p className="text-gray-900 mt-1">{contractor.contactName || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Email</p>
                          <p className="text-gray-900 mt-1">{contractor.email || 'Not specified'}</p>
                        </div>
                      </div>
                      {contractor.address && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-500">Address</p>
                          <p className="text-gray-900 mt-1">{contractor.address}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No contractors or subcontractors assigned to this project</p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 4. Client Portal Section */}
      <ClientAccessManagement 
        projectId={project.id}
        projectName={project.name}
        clientName={project.client?.name || 'Client'}
      />
      
      {/* 5. Project Cover Images Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <Camera className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Project Cover Images</h2>
          </div>
          {editingSection !== 'images' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSection('images')}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="px-6 py-4">
          {editingSection === 'images' ? (
            <div className="space-y-4">
              {/* Existing Images */}
              {currentCoverImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {currentCoverImages.map((imageUrl: string, index: number) => (
                    <div key={index} className="relative group">
                      <Image
                        src={imageUrl}
                        alt={`Project cover ${index + 1}`}
                        width={150}
                        height={100}
                        className="rounded-lg object-cover border border-gray-200 w-full"
                      />
                      
                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      
                      {/* Replace Button */}
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input
                          type="file"
                          id={`replace-image-${index}`}
                          accept="image/*"
                          onChange={(e) => replaceImage(index, e)}
                          className="hidden"
                        />
                        <label htmlFor={`replace-image-${index}`}>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2 bg-blue-500 hover:bg-blue-600 text-white text-xs cursor-pointer"
                            asChild
                          >
                            <span title="Replace image">
                              Replace
                            </span>
                          </Button>
                        </label>
                      </div>
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
                    className="cursor-pointer border-dashed border-2 border-gray-300 hover:border-purple-400"
                    asChild
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingImage ? 'Uploading...' : 'Add More Images'}
                    </span>
                  </Button>
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Images are automatically saved after upload. PNG, JPG, WebP up to 4MB each.
                </p>
              </div>
              
              <div className="flex items-center space-x-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSection(null)}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {currentCoverImages.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-3">{currentCoverImages.length} Cover Image{currentCoverImages.length > 1 ? 's' : ''}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {currentCoverImages.map((imageUrl: string, index: number) => (
                      <div key={index} className="relative">
                        <Image
                          src={imageUrl}
                          alt={`Project cover ${index + 1}`}
                          width={150}
                          height={100}
                          className="rounded-lg object-cover border border-gray-200 w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 italic">No cover images uploaded</p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 6. File Storage Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <Folder className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">File Storage</h2>
          </div>
          {editingSection !== 'storage' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSection('storage')}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="px-6 py-4">
          {editingSection === 'storage' ? (
            <div className="space-y-6">
              {/* Dropbox Integration Options - Collapsible */}
              <div>
                <div 
                  className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setIsDropboxExpanded(!isDropboxExpanded)}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Dropbox Integration Options</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {dropboxOption === 'skip' 
                        ? 'Click to configure Dropbox folder'
                        : dropboxOption === 'create'
                        ? 'Create new project folder structure'
                        : 'Link to existing Dropbox folder'
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {dropboxOption !== 'skip' && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        Configured
                      </span>
                    )}
                    {isDropboxExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>
                
                {isDropboxExpanded && (
                  <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
                    {/* Create new folder option */}
                    <div 
                      onClick={() => setDropboxOption('create')}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        dropboxOption === 'create' 
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
                        <div className="ml-4 flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Create New Dropbox Folder</h4>
                          <p className="text-sm text-gray-600">
                            Automatically create a project folder with standard subfolders (1-CAD, 2-MAX, 3-RENDERING, etc.)
                          </p>
                        </div>
                        <div className="ml-auto">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            dropboxOption === 'create' 
                              ? 'border-purple-500 bg-purple-500' 
                              : 'border-gray-300'
                          }`}>
                            {dropboxOption === 'create' && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Link to existing folder option */}
                    <div 
                      onClick={() => setDropboxOption('link')}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        dropboxOption === 'link' 
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
                            Browse or enter the path to an existing Dropbox folder
                          </p>
                          {dropboxOption === 'link' && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={dropboxFolderPath}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  setDropboxFolderPath(e.target.value)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="/Meisner Interiors Team Folder/Project Name"
                              />
                              <p className="text-xs text-gray-500">Or browse below:</p>
                              <DropboxFolderBrowser
                                currentPath={dropboxFolderPath}
                                onSelect={(path) => setDropboxFolderPath(path)}
                              />
                            </div>
                          )}
                        </div>
                        <div className="ml-auto">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            dropboxOption === 'link' 
                              ? 'border-blue-500 bg-blue-500' 
                              : 'border-gray-300'
                          }`}>
                            {dropboxOption === 'link' && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Skip integration option */}
                    <div 
                      onClick={() => setDropboxOption('skip')}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        dropboxOption === 'skip' 
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
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">No Dropbox Integration</h4>
                          <p className="text-sm text-gray-600">
                            Don't link this project to a Dropbox folder
                          </p>
                        </div>
                        <div className="ml-auto">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            dropboxOption === 'skip' 
                              ? 'border-gray-500 bg-gray-500' 
                              : 'border-gray-300'
                          }`}>
                            {dropboxOption === 'skip' && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSection(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    setIsCreatingDropbox(true)
                    try {
                      let folderPath = null
                      
                      if (dropboxOption === 'create') {
                        // Call API to create Dropbox folder structure
                        const response = await fetch(`/api/projects/${project.id}/dropbox-folder`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectName: project.name })
                        })
                        
                        if (response.ok) {
                          const data = await response.json()
                          folderPath = data.folderPath
                          alert(`Dropbox folder created successfully!\n\n${folderPath}`)
                        } else {
                          throw new Error('Failed to create Dropbox folder')
                        }
                      } else if (dropboxOption === 'link') {
                        folderPath = dropboxFolderPath
                      }
                      
                      // Update project with folder path
                      await updateSection('file storage', { dropboxFolder: folderPath })
                      setValue('dropboxFolder', folderPath || '', { shouldDirty: true })
                      setEditingSection(null)
                    } catch (error) {
                      console.error('Error updating Dropbox folder:', error)
                      alert('Failed to update Dropbox folder. Please try again.')
                    } finally {
                      setIsCreatingDropbox(false)
                    }
                  }}
                  disabled={isCreatingDropbox || (dropboxOption === 'link' && !dropboxFolderPath)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isCreatingDropbox ? 'Processing...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {project.dropboxFolder ? (
                <div>
                  <p className="text-sm font-medium text-gray-500">Dropbox Folder Location</p>
                  <div className="flex items-center space-x-2 mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <Folder className="w-5 h-5 text-purple-600" />
                    <span className="text-gray-900 font-mono text-sm">{project.dropboxFolder}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    All project files will be organized in this Dropbox folder.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-500">No Dropbox folder linked</p>
                  <p className="text-gray-600 mt-1 text-sm">
                    Click "Edit" to link a Dropbox folder for this project.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Suggested Structure:</h4>
                    <p className="text-sm text-gray-600">/Projects/{project.name}/</p>
                    <ul className="text-sm text-gray-600 mt-2 space-y-1 ml-4">
                      <li>• Design Assets/</li>
                      <li>• 3D Renderings/</li>
                      <li>• Client Approvals/</li>
                      <li>• Technical Drawings/</li>
                      <li>• FFE Documentation/</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 7. Rooms Management Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Home className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Rooms Management</h2>
          </div>
        </div>
        <div className="px-6 py-4">
          <RoomsManagementSection projectId={project.id} />
        </div>
      </div>
      
      {/* 8. Project Features Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Project Features</h2>
          </div>
          {editingSection !== 'features' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSection('features')}
              className="flex items-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="px-6 py-4">
          {editingSection === 'features' ? (
            <form onSubmit={handleSubmit((data) => {
              updateSection('project features', {
                hasFloorplanApproval: data.hasFloorplanApproval || false,
                hasSpecBook: data.hasSpecBook || false,
                hasProjectUpdates: data.hasProjectUpdates || false,
              })
            })} className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Enable or disable project-level features for this project. Features can be toggled on or off at any time.
                </p>
                
                {/* Floorplan Approval */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Folder className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Floorplan Approval</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Manage floorplan reviews and client approvals independently from room workflows
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('hasFloorplanApproval')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
                
                {/* Spec Book */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Spec Book</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Organize spec options, generate PDFs, and link CAD files for client presentations
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('hasSpecBook')}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
                
                {/* Project Updates */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Project Updates</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Track onsite visits, manage revisions, and keep stakeholders informed of progress
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('hasProjectUpdates')}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSection(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Project-level features currently enabled for this project:
              </p>
              
              <div className="space-y-3">
                {/* Floorplan Approval Status */}
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Folder className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Floorplan Approval</h3>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {project.hasFloorplanApproval ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Spec Book Status */}
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Spec Book</h3>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {project.hasSpecBook ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Project Updates Status */}
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Project Updates</h3>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {project.hasProjectUpdates ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {(!project.hasFloorplanApproval && !project.hasSpecBook && !project.hasProjectUpdates) && (
                <div className="text-center py-8">
                  <p className="text-gray-500 italic">No project features are currently enabled</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Edit" to enable project features</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Danger Zone */}
      <div className="bg-white border border-red-200 rounded-lg">
        <div className="px-6 py-4 border-b border-red-200">
          <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
        </div>
        
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Delete Project</h3>
              <p className="text-sm text-gray-500">Permanently delete this project and all associated data</p>
              {session.user.role !== 'OWNER' && (
                <p className="text-sm text-red-500 mt-1">Only project owners can delete projects</p>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={session.user.role !== 'OWNER'}
              className="flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </Button>
          </div>
        </div>
      </div>

      {/* Add Contractor Dialog */}
      {showAddContractorDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add {newContractor.type === 'contractor' ? 'Contractor' : 'Subcontractor'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  value={newContractor.type}
                  onChange={(e) => setNewContractor({ ...newContractor, type: e.target.value as 'contractor' | 'subcontractor' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="contractor">Contractor</option>
                  <option value="subcontractor">Subcontractor</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <Input
                  value={newContractor.businessName}
                  onChange={(e) => setNewContractor({ ...newContractor, businessName: e.target.value })}
                  placeholder="Enter business name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name
                </label>
                <Input
                  value={newContractor.contactName}
                  onChange={(e) => setNewContractor({ ...newContractor, contactName: e.target.value })}
                  placeholder="Enter contact person name"
                />
              </div>
              
              {newContractor.type === 'subcontractor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specialty/Trade *
                  </label>
                  <Input
                    value={newContractor.specialty}
                    onChange={(e) => setNewContractor({ ...newContractor, specialty: e.target.value })}
                    placeholder="e.g., Electrician, Plumber, HVAC, Flooring, etc."
                    required={newContractor.type === 'subcontractor'}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Required for subcontractors - specify their trade or specialty
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <Input
                  type="email"
                  value={newContractor.email}
                  onChange={(e) => setNewContractor({ ...newContractor, email: e.target.value })}
                  placeholder="Enter email address"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <Input
                  type="tel"
                  value={newContractor.phone}
                  onChange={(e) => setNewContractor({ ...newContractor, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <Input
                  value={newContractor.address}
                  onChange={(e) => setNewContractor({ ...newContractor, address: e.target.value })}
                  placeholder="Enter business address (optional)"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddContractorDialog(false)
                  setNewContractor({
                    businessName: '',
                    contactName: '',
                    email: '',
                    phone: '',
                    address: '',
                    type: 'contractor',
                    specialty: ''
                  })
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={addContractor}
                disabled={!newContractor.businessName || !newContractor.email}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Add {newContractor.type === 'contractor' ? 'Contractor' : 'Subcontractor'}
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
                  Select Contractor from Library
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
                <Input
                  placeholder="Search contractors..."
                  value={contractorSearchTerm}
                  onChange={(e) => setContractorSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {availableContractors.filter(c => 
                c.businessName.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                c.contactName?.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                c.specialty?.toLowerCase().includes(contractorSearchTerm.toLowerCase())
              ).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No contractors found</p>
                  <p className="text-sm mt-1">Try adjusting your search or add contractors in Preferences</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableContractors
                    .filter(c => 
                      c.businessName.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                      c.contactName?.toLowerCase().includes(contractorSearchTerm.toLowerCase()) ||
                      c.specialty?.toLowerCase().includes(contractorSearchTerm.toLowerCase())
                    )
                    .map((contractor) => {
                      const isAlreadyAdded = contractorsList.some(
                        (c: any) => c.id === contractor.id || c.email === contractor.email
                      )
                      
                      return (
                        <div
                          key={contractor.id}
                          className={`border rounded-lg p-4 transition-all ${
                            isAlreadyAdded 
                              ? 'border-gray-200 bg-gray-50 opacity-60' 
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isAlreadyAdded) {
                              setContractorsList([...contractorsList, {
                                id: contractor.id,
                                businessName: contractor.businessName,
                                contactName: contractor.contactName,
                                email: contractor.email,
                                phone: contractor.phone,
                                address: contractor.address,
                                type: contractor.type.toLowerCase(),
                                specialty: contractor.specialty
                              }])
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Project
            </h3>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. This will permanently delete the project
              <strong className="text-gray-900"> "{project.name}" </strong>
              and all associated data.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Please type <strong>{project.name}</strong> to confirm:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={project.name}
              className="mb-6"
            />
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmation('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || deleteConfirmation.trim() !== project.name.trim()}
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dropbox Link Required Modal */}
      {showDropboxLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Folder className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  No Dropbox Folder Linked
                </h3>
                <p className="text-sm text-gray-600">
                  Project cover images are uploaded, but not archived to Dropbox
                </p>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-6">
              To archive cover images in your project's Dropbox folder, please link or create a Dropbox folder structure.
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={async () => {
                  setShowDropboxLinkModal(false)
                  setDropboxOption('create')
                  setIsDropboxExpanded(true)
                  setEditingSection('storage')
                  
                  // Auto-create Dropbox folder
                  try {
                    setIsCreatingDropbox(true)
                    const response = await fetch(`/api/projects/${project.id}/dropbox-folder`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'create' })
                    })
                    
                    if (response.ok) {
                      const data = await response.json()
                      router.refresh()
                      alert('Dropbox folder created successfully!')
                    } else {
                      throw new Error('Failed to create folder')
                    }
                  } catch (error) {
                    console.error('Error creating Dropbox folder:', error)
                    alert('Failed to create Dropbox folder. Please try again.')
                  } finally {
                    setIsCreatingDropbox(false)
                  }
                }}
                className="w-full flex items-center justify-between p-4 border-2 border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <FolderPlus className="w-5 h-5 text-purple-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Create New Folder</p>
                    <p className="text-xs text-gray-600">Auto-create with 10 standard subfolders</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowDropboxLinkModal(false)
                  setDropboxOption('link')
                  setIsDropboxExpanded(true)
                  setEditingSection('storage')
                }}
                className="w-full flex items-center justify-between p-4 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Link2 className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Link Existing Folder</p>
                    <p className="text-xs text-gray-600">Connect to an existing Dropbox folder</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDropboxLinkModal(false)}
              >
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
