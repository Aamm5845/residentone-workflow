'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, User, Mail, Shield, Upload, Camera } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface InviteTeamMemberFormProps {
  currentUser: {
    id: string
    role: string
  }
}

export default function InviteTeamMemberForm({ currentUser }: InviteTeamMemberFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'DESIGNER',
    image: null as string | null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('imageType', 'avatar')

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      setFormData(prev => ({ ...prev, image: data.url }))
      
      alert('Image uploaded successfully!')
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to invite team member')
      }

      alert('Team member invited successfully!')
      router.push('/team')
    } catch (error) {
      console.error('Invite error:', error)
      alert(error instanceof Error ? error.message : 'Failed to invite team member')
    } finally {
      setIsLoading(false)
    }
  }

  const canAssignRole = (role: string) => {
    if (currentUser.role === 'OWNER') return true
    if (currentUser.role === 'ADMIN' && role !== 'OWNER') return true
    return false
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Link href="/team">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Team
            </Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Profile Picture (Optional)
          </label>
          <div className="flex items-center space-x-4">
            <div className="relative">
              {formData.image ? (
                <Image
                  src={formData.image}
                  alt="Profile preview"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-10 w-10 text-gray-400" />
                </div>
              )}
              {formData.image && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>
            
            <div>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label htmlFor="avatar-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    <Camera className="w-4 h-4 mr-2" />
                    {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter full name"
            required
            className="w-full"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="Enter email address"
            required
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            An invitation email will be sent to this address
          </p>
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
            Role *
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
            className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {canAssignRole('OWNER') && (
              <option value="OWNER">Owner</option>
            )}
            {canAssignRole('ADMIN') && (
              <option value="ADMIN">Admin</option>
            )}
            <option value="DESIGNER">Designer</option>
            <option value="RENDERER">Renderer</option>
            <option value="DRAFTER">Drafter</option>
            <option value="FFE">FFE Specialist</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Role-based Auto-assignment:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <strong>Renderer:</strong> Automatically assigned to all 3D rendering phases</li>
              <li>• <strong>Drafter:</strong> Automatically assigned to all technical drawing phases</li>
              <li>• <strong>FFE:</strong> Automatically assigned to all furniture & equipment phases</li>
              <li>• <strong>Designer:</strong> Automatically assigned to all design concept phases</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Link href="/team">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Sending Invitation...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}