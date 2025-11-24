'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ChangePasswordFormProps {
  userId: string
  canEdit?: boolean
}

export function ChangePasswordForm({ userId, canEdit = true }: ChangePasswordFormProps) {
  const [isChanging, setIsChanging] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required')
      return
    }
    
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    
    setIsSaving(true)
    try {
      const response = await fetch(`/api/team/${userId}/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to change password')
      }
      
      toast.success('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setIsChanging(false)
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setIsChanging(false)
  }

  if (!canEdit) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
        </div>
        <p className="text-sm text-gray-500">
          You don't have permission to change this user's password.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
        </div>
      </div>
      
      {!isChanging ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <p className="text-sm text-gray-500 mb-3">Manage your account password and security</p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setIsChanging(true)}
            >
              <Shield className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative mt-1">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>
          
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? 'Changing...' : 'Change Password'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
