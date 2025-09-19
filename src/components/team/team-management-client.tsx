'use client'

import { useState } from 'react'
import { MoreVertical, Edit, UserMinus, RefreshCw, User, Upload, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'

interface TeamManagementClientProps {
  teamMembers: any[]
  currentUser: any
}

interface EditMemberDialogProps {
  member: any
  isOpen: boolean
  onClose: () => void
  onSave: (memberData: any) => void
  currentUserRole: string
}

function EditMemberDialog({ member, isOpen, onClose, onSave, currentUserRole }: EditMemberDialogProps) {
  const [formData, setFormData] = useState({
    name: member.name || '',
    email: member.email || '',
    role: member.role || 'DESIGNER',
    image: member.image || null
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
    console.log('🚀 Team member form submitted!')
    console.log('Form data:', formData)
    setIsLoading(true)

    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const canChangeRole = currentUserRole === 'OWNER' || (currentUserRole === 'ADMIN' && member.role !== 'OWNER')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Edit Team Member
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Picture
            </label>
            <div className="flex items-center space-x-4">
              <div className="relative">
                {formData.image ? (
                  <Image
                    src={formData.image}
                    alt="Profile"
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                {formData.image && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
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
                      {uploadingImage ? 'Uploading...' : 'Upload'}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter full name"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
              required
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              disabled={!canChangeRole}
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="DESIGNER">Designer</option>
              <option value="RENDERER">Renderer</option>
              <option value="DRAFTER">Drafter</option>
              <option value="FFE">FFE Specialist</option>
              <option value="VIEWER">Viewer</option>
            </select>
            {!canChangeRole && (
              <p className="text-xs text-gray-500 mt-1">
                You don't have permission to change this role
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TeamManagementClient({ teamMembers, currentUser }: TeamManagementClientProps) {
  const [editingMember, setEditingMember] = useState<any>(null)
  const [members, setMembers] = useState(teamMembers)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const canManageTeam = ['OWNER', 'ADMIN'].includes(currentUser.role)

  const handleEditMember = async (memberData: any) => {
    try {
      const response = await fetch(`/api/team/${editingMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update team member')
      }

      const updatedMember = await response.json()
      
      // Update local state
      setMembers(prev => prev.map(member => 
        member.id === editingMember.id ? updatedMember : member
      ))

      alert('Team member updated successfully!')
    } catch (error) {
      console.error('Update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update team member')
      throw error
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return
    }

    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove team member')
      }

      // Update local state
      setMembers(prev => prev.filter(member => member.id !== memberId))
      setOpenDropdown(null)

      alert('Team member removed successfully!')
    } catch (error) {
      console.error('Remove error:', error)
      alert(error instanceof Error ? error.message : 'Failed to remove team member')
    }
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: 'bg-purple-100 text-purple-800',
      ADMIN: 'bg-blue-100 text-blue-800',
      DESIGNER: 'bg-green-100 text-green-800',
      RENDERER: 'bg-orange-100 text-orange-800',
      DRAFTER: 'bg-indigo-100 text-indigo-800',
      FFE: 'bg-pink-100 text-pink-800',
      VIEWER: 'bg-gray-100 text-gray-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
        <p className="text-sm text-gray-600 mt-1">
          {members.length} team member{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active Stages
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contributions
              </th>
              {canManageTeam && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {member.name || 'No name'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {member.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {member._count?.assignedStages || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="space-y-1">
                    <div>{member._count?.comments || 0} comments</div>
                    <div>{member._count?.uploadedAssets || 0} files</div>
                  </div>
                </td>
                {canManageTeam && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === member.id ? null : member.id)}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      
                      {openDropdown === member.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setEditingMember(member)
                                setOpenDropdown(null)
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Member
                            </button>
                            
                            {currentUser.role === 'OWNER' && member.id !== currentUser.id && (
                              <button
                                onClick={() => handleRemoveMember(member.id, member.name)}
                                className="flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remove Member
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canManageTeam && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            You need owner or admin privileges to manage team members.
          </p>
        </div>
      )}

      {editingMember && (
        <EditMemberDialog
          member={editingMember}
          isOpen={true}
          onClose={() => setEditingMember(null)}
          onSave={handleEditMember}
          currentUserRole={currentUser.role}
        />
      )}

      {/* Click outside handler */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </div>
  )
}
