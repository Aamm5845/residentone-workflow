'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Bell, Mail, MessageSquare, Save, X, Send } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NotificationPreferencesProps {
  userId: string
  initialEmailEnabled?: boolean
  initialSmsEnabled?: boolean
  initialPhoneNumber?: string | null
  canEdit?: boolean
}

export function NotificationPreferences({ 
  userId, 
  initialEmailEnabled = true,
  initialSmsEnabled = false,
  initialPhoneNumber,
  canEdit = true 
}: NotificationPreferencesProps) {
  // Parse initial phone number to separate country code
  const parsePhoneNumber = (fullNumber: string | null | undefined) => {
    if (!fullNumber) return { countryCode: '+1', number: '' }
    
    if (fullNumber.startsWith('+')) {
      const match = fullNumber.match(/^(\+\d{1,3})(\d+)$/)
      if (match) {
        return { countryCode: match[1], number: match[2] }
      }
    }
    
    return { countryCode: '+1', number: fullNumber.replace(/\D/g, '') }
  }
  
  const initial = parsePhoneNumber(initialPhoneNumber)
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled)
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled)
  const [countryCode, setCountryCode] = useState(initial.countryCode)
  const [phoneNumber, setPhoneNumber] = useState(initial.number)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [isSendingEmailTest, setIsSendingEmailTest] = useState(false)

  // Format phone number as user types
  const formatPhoneInput = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    
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
    // Validate: if SMS enabled, phone number is required
    if (smsEnabled && !phoneNumber) {
      toast.error('Phone number is required for SMS notifications')
      return
    }

    setIsSaving(true)
    try {
      const fullPhoneNumber = phoneNumber ? countryCode + phoneNumber.replace(/\D/g, '') : null
      
      const response = await fetch(`/api/users/${userId}/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailNotificationsEnabled: emailEnabled,
          smsNotificationsEnabled: smsEnabled,
          phoneNumber: fullPhoneNumber
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update notification preferences')
      }

      toast.success('Notification preferences updated!')
      setIsEditing(false)
      
      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    const initial = parsePhoneNumber(initialPhoneNumber)
    setEmailEnabled(initialEmailEnabled)
    setSmsEnabled(initialSmsEnabled)
    setCountryCode(initial.countryCode)
    setPhoneNumber(initial.number)
    setIsEditing(false)
  }

  const handleSendTestSMS = async () => {
    if (!phoneNumber || !smsEnabled) {
      toast.error('Please save SMS settings first')
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

      toast.success('Test SMS sent! Check your phone.')
    } catch (error) {
      console.error('Error sending test SMS:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send test SMS')
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!emailEnabled) {
      toast.error('Please save Email settings first')
      return
    }

    setIsSendingEmailTest(true)
    try {
      const response = await fetch(`/api/users/${userId}/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send test email')
      }

      toast.success('Test email sent! Check your inbox.')
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send test email')
    } finally {
      setIsSendingEmailTest(false)
    }
  }

  const getNotificationSummary = () => {
    if (emailEnabled && smsEnabled) return 'Email & SMS'
    if (emailEnabled) return 'Email Only'
    if (smsEnabled) return 'SMS Only'
    return 'Disabled'
  }

  if (!canEdit) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-gray-600">Notifications</Label>
            <p className="text-base font-medium">{getNotificationSummary()}</p>
          </div>
          {phoneNumber && (
            <div>
              <Label className="text-sm text-gray-600">Phone Number</Label>
              <p className="text-base font-medium">{countryCode} {phoneNumber}</p>
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
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
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

      <p className="text-sm text-gray-600 mb-6">
        Choose how you want to be notified when someone sends a message in phases you're assigned to.
      </p>

      <div className="space-y-6">
        {/* Email Notifications */}
        <div className="flex items-start justify-between pb-4 border-b">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-blue-100 rounded-lg mt-1">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-1 flex-1">
              <Label htmlFor="emailEnabled" className="text-base font-medium text-gray-900">
                Email Notifications
              </Label>
              <p className="text-sm text-gray-500">
                Get email alerts for new chat messages
              </p>
            </div>
          </div>
          <Switch
            id="emailEnabled"
            checked={emailEnabled}
            onCheckedChange={setEmailEnabled}
            disabled={!isEditing}
          />
        </div>

        {/* SMS Notifications */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-green-100 rounded-lg mt-1">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor="smsEnabled" className="text-base font-medium text-gray-900">
                  SMS Notifications
                </Label>
                <p className="text-sm text-gray-500">
                  Get text messages for new chat messages
                </p>
              </div>
            </div>
            <Switch
              id="smsEnabled"
              checked={smsEnabled}
              onCheckedChange={setSmsEnabled}
              disabled={!isEditing || !phoneNumber}
            />
          </div>

          {/* Phone Number Input */}
          <div className="ml-11">
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
              Required for SMS notifications
            </p>
          </div>

          {/* Test Actions */}
          {!isEditing && (
            <div className="ml-11 pt-2 space-y-2">
              {phoneNumber && smsEnabled && (
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
              )}
              {emailEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestEmail}
                  disabled={isSendingEmailTest}
                  className="w-full"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {isSendingEmailTest ? 'Sending...' : 'Send Test Email'}
                </Button>
              )}
            </div>
          )}
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
              {isSaving ? 'Saving...' : 'Save Preferences'}
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
