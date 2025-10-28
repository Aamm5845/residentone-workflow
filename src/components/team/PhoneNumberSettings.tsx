'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Phone, Save, X } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PhoneNumberSettingsProps {
  userId: string
  initialPhoneNumber?: string | null
  initialSmsEnabled?: boolean
  canEdit?: boolean
}

export function PhoneNumberSettings({ 
  userId, 
  initialPhoneNumber, 
  initialSmsEnabled,
  canEdit = true 
}: PhoneNumberSettingsProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '')
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(initialSmsEnabled || false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Format phone number as user types
  const formatPhoneInput = (value: string) => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, '')
    
    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value)
    setPhoneNumber(formatted)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/users/${userId}/phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.replace(/\D/g, ''), // Send only digits
          smsNotificationsEnabled
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update phone number')
      }

      toast.success('Phone settings updated!')
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating phone number:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update phone settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setPhoneNumber(initialPhoneNumber || '')
    setSmsNotificationsEnabled(initialSmsEnabled || false)
    setIsEditing(false)
  }

  if (!canEdit) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">SMS Notifications</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-gray-600">Phone Number</Label>
            <p className="text-base font-medium">{phoneNumber || 'Not set'}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-600">SMS Notifications</Label>
            <p className="text-base font-medium">
              {smsNotificationsEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">SMS Notifications</h3>
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
          <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
            Phone Number
          </Label>
          <Input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder="(555) 123-4567"
            disabled={!isEditing}
            className="mt-1"
            maxLength={14}
          />
          <p className="text-xs text-gray-500 mt-1">
            US/Canada phone number for SMS notifications
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="smsEnabled" className="text-sm font-medium text-gray-700">
              Enable SMS Notifications
            </Label>
            <p className="text-xs text-gray-500">
              Get notified via SMS when mentioned in chat
            </p>
          </div>
          <Switch
            id="smsEnabled"
            checked={smsNotificationsEnabled}
            onCheckedChange={setSmsNotificationsEnabled}
            disabled={!isEditing || !phoneNumber}
          />
        </div>

        {isEditing && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
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
