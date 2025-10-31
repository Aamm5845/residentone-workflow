'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Save, X } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PersonalInformationFormProps {
  userId: string
  initialName?: string | null
  initialEmail?: string
  organizationName?: string | null
  canEdit?: boolean
}

export default function PersonalInformationForm({ 
  userId, 
  initialName, 
  initialEmail,
  organizationName,
  canEdit = true 
}: PersonalInformationFormProps) {
  const [name, setName] = useState(initialName || '')
  const [email, setEmail] = useState(initialEmail || '')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/users/${userId}/personal-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update personal information')
      }

      toast.success('Personal information updated!')
      setIsEditing(false)
      
      // Refresh the page to update the UI
      window.location.reload()
    } catch (error) {
      console.error('Error updating personal information:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update information')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setName(initialName || '')
    setEmail(initialEmail || '')
    setIsEditing(false)
  }

  if (!canEdit) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-gray-600">Full Name</Label>
            <p className="text-base font-medium">{name || 'Not set'}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-600">Email</Label>
            <p className="text-base font-medium">{email}</p>
          </div>
          {organizationName && (
            <div>
              <Label className="text-sm text-gray-600">Organization</Label>
              <p className="text-base font-medium">{organizationName}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
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
        <div>
          <Label htmlFor="name" className="text-sm font-medium text-gray-700">
            Full Name
          </Label>
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

        <div>
          <Label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isEditing}
            placeholder="Enter your email address"
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used for notifications and login
          </p>
        </div>

        {organizationName && (
          <div>
            <Label className="text-sm font-medium text-gray-700">Organization</Label>
            <p className="text-gray-900 mt-1">{organizationName}</p>
            <p className="text-xs text-gray-500 mt-1">
              Contact an administrator to change organization
            </p>
          </div>
        )}

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
