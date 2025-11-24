'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Save, X, Upload } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'

interface ProfileUpdateFormProps {
  userId: string
  initialName: string | null
  initialEmail: string
  initialImage: string | null
  canEdit?: boolean
}

export function ProfileUpdateForm({ 
  userId, 
  initialName, 
  initialEmail,
  initialImage,
  canEdit = true 
}: ProfileUpdateFormProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName || '')
  const [email, setEmail] = useState(initialEmail)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage)
  const [isSaving, setIsSaving] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB')
        return
      }
      
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (!name || !email) {
      toast.error('Name and email are required')
      return
    }

    setIsSaving(true)
    try {
      // If there's a new image, upload it first
      let imageUrl = initialImage
      
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        
        const uploadResponse = await fetch(`/api/users/${userId}/upload-image`, {
          method: 'POST',
          body: formData
        })
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }
        
        const uploadData = await uploadResponse.json()
        imageUrl = uploadData.imageUrl
      }
      
      // Update profile
      const response = await fetch(`/api/users/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          image: imageUrl
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }
      
      toast.success('Profile updated successfully!')
      setIsEditing(false)
      setImageFile(null)
      
      // Reload the page to reflect changes
      window.location.reload()
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setName(initialName || '')
    setEmail(initialEmail)
    setImagePreview(initialImage)
    setImageFile(null)
    setIsEditing(false)
  }

  if (!canEdit) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt={name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{name}</p>
              <p className="text-sm text-gray-500">{email}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <User className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>
      
      <div className="space-y-4">
        {/* Profile Photo */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2 block">Profile Photo</Label>
          <div className="flex items-center space-x-4">
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt={name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>
            )}
            {isEditing && (
              <div>
                <input
                  type="file"
                  id="profileImage"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('profileImage')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                <p className="text-xs text-gray-500 mt-1">Max 5MB</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Name */}
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditing}
            placeholder="Enter your full name"
            className="mt-1"
          />
        </div>
        
        {/* Email */}
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isEditing}
            placeholder="Enter your email"
            className="mt-1"
          />
        </div>
        
        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
