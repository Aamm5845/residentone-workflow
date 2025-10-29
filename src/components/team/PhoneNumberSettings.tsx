'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Phone, Save, X, Send } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  // Parse initial phone number to separate country code
  const parsePhoneNumber = (fullNumber: string | null | undefined) => {
    if (!fullNumber) return { countryCode: '+1', number: '' }
    
    // If it starts with +, extract country code
    if (fullNumber.startsWith('+')) {
      const match = fullNumber.match(/^(\+\d{1,3})(\d+)$/)
      if (match) {
        return { countryCode: match[1], number: match[2] }
      }
    }
    
    // Otherwise assume US/Canada and add +1
    return { countryCode: '+1', number: fullNumber.replace(/\D/g, '') }
  }
  
  const initial = parsePhoneNumber(initialPhoneNumber)
  const [countryCode, setCountryCode] = useState(initial.countryCode)
  const [phoneNumber, setPhoneNumber] = useState(initial.number)
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(initialSmsEnabled || false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)

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
      // Combine country code with phone number
      const fullPhoneNumber = countryCode + phoneNumber.replace(/\D/g, '')
      
      const response = await fetch(`/api/users/${userId}/phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: fullPhoneNumber,
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
    const initial = parsePhoneNumber(initialPhoneNumber)
    setCountryCode(initial.countryCode)
    setPhoneNumber(initial.number)
    setSmsNotificationsEnabled(initialSmsEnabled || false)
    setIsEditing(false)
  }

  const handleSendTestSMS = async () => {
    if (!phoneNumber || !smsNotificationsEnabled) {
      toast.error('Please save a phone number and enable SMS first')
      return
    }

    setIsSendingTest(true)
    try {
      const response = await fetch(`/api/users/${userId}/phone/test-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send test SMS')
      }

      const data = await response.json()
      toast.success('Test SMS sent! Check your phone.')
    } catch (error) {
      console.error('Error sending test SMS:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send test SMS')
    } finally {
      setIsSendingTest(false)
    }
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
            <p className="text-base font-medium">
              {phoneNumber ? `${countryCode} ${phoneNumber}` : 'Not set'}
            </p>
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
          <div className="flex gap-2 mt-1">
            <Select value={countryCode} onValueChange={setCountryCode} disabled={!isEditing}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+1">🇺🇸 +1</SelectItem>
                <SelectItem value="+44">🇬🇧 +44</SelectItem>
                <SelectItem value="+33">🇫🇷 +33</SelectItem>
                <SelectItem value="+49">🇩🇪 +49</SelectItem>
                <SelectItem value="+61">🇦🇺 +61</SelectItem>
                <SelectItem value="+91">🇮🇳 +91</SelectItem>
                <SelectItem value="+86">🇨🇳 +86</SelectItem>
                <SelectItem value="+81">🇯🇵 +81</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              disabled={!isEditing}
              className="flex-1"
              maxLength={14}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enter your phone number with country code for SMS notifications
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

        {/* Test SMS Button */}
        {!isEditing && phoneNumber && smsNotificationsEnabled && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTestSMS}
              disabled={isSendingTest}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSendingTest ? 'Sending...' : 'Send Test SMS'}
            </Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Send a test message to verify SMS notifications are working
            </p>
          </div>
        )}

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
