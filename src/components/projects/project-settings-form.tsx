'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Calendar, DollarSign, Trash2, Building, Camera, Folder } from 'lucide-react'
import Image from 'next/image'

// Form validation schema
const projectSettingsSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().optional(),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'HOSPITALITY']),
  budget: z.string().optional(),
  dueDate: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  coverImageUrl: z.string().url().optional().nullable(),
  dropboxFolder: z.string().optional().nullable(),
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
  const [currentCoverImage, setCurrentCoverImage] = useState(project.coverImageUrl)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch
  } = useForm<ProjectSettingsFormData>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: {
      name: project.name,
      description: project.description || '',
      type: project.type,
      budget: project.budget ? project.budget.toString() : '',
      dueDate: project.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : '',
      clientId: project.clientId,
      coverImageUrl: project.coverImageUrl || '',
      dropboxFolder: project.dropboxFolder || '',
    }
  })

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'project-cover')

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      setCurrentCoverImage(data.url)
      setValue('coverImageUrl', data.url, { shouldDirty: true })
      
      alert('Image uploaded successfully!')
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  const onSubmit = async (data: ProjectSettingsFormData) => {
    try {
      setIsLoading(true)
      console.log('Form data being submitted:', data)

      const submitData = {
        ...data,
        budget: data.budget ? parseFloat(data.budget) : null,
        dueDate: data.dueDate || null,
        coverImageUrl: currentCoverImage,
      }
      
      console.log('Processed submit data:', submitData)

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      console.log('Response status:', response.status)
      
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
      console.log('Update successful:', result)
      alert('Project updated successfully!')
      router.refresh()
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
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building className="w-5 h-5 mr-2" />
            Basic Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <Textarea
              {...register('description')}
              rows={3}
              placeholder="Describe this project..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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
        </div>

        {/* Client Information */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Client Information
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client *
            </label>
            <select
              {...register('clientId')}
              className={`flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.clientId ? 'border-red-500' : ''
              }`}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
            {errors.clientId && (
              <p className="text-sm text-red-600 mt-1">{errors.clientId.message}</p>
            )}
          </div>
        </div>

        {/* Project Cover Image */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Camera className="w-5 h-5 mr-2" />
            Project Cover Image
          </h2>
          
          <div className="flex items-center space-x-6">
            {currentCoverImage && (
              <div className="relative">
                <Image
                  src={currentCoverImage}
                  alt="Project cover"
                  width={120}
                  height={80}
                  className="rounded-lg object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCurrentCoverImage(null)
                    setValue('coverImageUrl', null, { shouldDirty: true })
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            )}
            
            <div>
              <input
                type="file"
                id="cover-image"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label htmlFor="cover-image">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingImage}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                  </span>
                </Button>
              </label>
              <p className="text-sm text-gray-500 mt-1">
                PNG, JPG, WebP up to 4MB
              </p>
            </div>
          </div>
        </div>

        {/* Dropbox Settings */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Folder className="w-5 h-5 mr-2" />
            File Storage
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Dropbox Folder
            </label>
            <Input
              {...register('dropboxFolder')}
              placeholder="/Custom/Project/Folder"
            />
            <p className="text-sm text-gray-500 mt-1">
              Optional: Specify a custom Dropbox folder for this project's files
            </p>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={session.user.role !== 'OWNER'}
              className="flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </Button>
            {session.user.role !== 'OWNER' && (
              <p className="text-sm text-gray-500 mt-1">
                Only project owners can delete projects
              </p>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !isDirty}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>

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
    </div>
  )
}