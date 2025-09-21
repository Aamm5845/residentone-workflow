'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Home,
  AlertCircle,
  Check,
  X
} from 'lucide-react'

interface Floor {
  id: string
  name: string
  order: number
  rooms: Array<{
    id: string
    name?: string
    type: string
    status: string
  }>
}

interface FloorManagementProps {
  projectId: string
}

export default function FloorManagement({ projectId }: FloorManagementProps) {
  const [floors, setFloors] = useState<Floor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddFloor, setShowAddFloor] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const [editingFloor, setEditingFloor] = useState<string | null>(null)
  const [editFloorName, setEditFloorName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchFloors()
  }, [projectId])

  const fetchFloors = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/floors`)
      if (response.ok) {
        const floorsData = await response.json()
        setFloors(floorsData)
      } else {
        throw new Error('Failed to fetch floors')
      }
    } catch (err) {
      setError('Failed to load floors')
      console.error('Error fetching floors:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFloor = async () => {
    if (!newFloorName.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/floors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFloorName.trim() })
      })

      if (response.ok) {
        const newFloor = await response.json()
        setFloors(prev => [...prev, newFloor].sort((a, b) => a.order - b.order))
        setNewFloorName('')
        setShowAddFloor(false)
      } else {
        throw new Error('Failed to create floor')
      }
    } catch (err) {
      console.error('Error adding floor:', err)
      alert('Failed to add floor. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditFloor = async (floorId: string) => {
    if (!editFloorName.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/floors/${floorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editFloorName.trim() })
      })

      if (response.ok) {
        const updatedFloor = await response.json()
        setFloors(prev => prev.map(floor => 
          floor.id === floorId ? { ...floor, name: updatedFloor.name } : floor
        ))
        setEditingFloor(null)
        setEditFloorName('')
      } else {
        throw new Error('Failed to update floor')
      }
    } catch (err) {
      console.error('Error updating floor:', err)
      alert('Failed to update floor. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteFloor = async (floorId: string) => {
    const floor = floors.find(f => f.id === floorId)
    if (!floor) return

    if (floor.rooms.length > 0) {
      alert('Cannot delete floor with rooms. Please move or delete all rooms first.')
      return
    }

    if (!confirm(`Are you sure you want to delete "${floor.name}"?`)) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/floors/${floorId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setFloors(prev => prev.filter(floor => floor.id !== floorId))
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete floor')
      }
    } catch (err: any) {
      console.error('Error deleting floor:', err)
      alert(err.message || 'Failed to delete floor. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const moveFloor = async (floorId: string, direction: 'up' | 'down') => {
    const floorIndex = floors.findIndex(f => f.id === floorId)
    if (floorIndex === -1) return
    
    const newIndex = direction === 'up' ? floorIndex - 1 : floorIndex + 1
    if (newIndex < 0 || newIndex >= floors.length) return

    const floor = floors[floorIndex]
    const swapFloor = floors[newIndex]

    setIsSubmitting(true)
    try {
      // Update orders
      await Promise.all([
        fetch(`/api/projects/${projectId}/floors/${floor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: swapFloor.order })
        }),
        fetch(`/api/projects/${projectId}/floors/${swapFloor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: floor.order })
        })
      ])

      // Update local state
      const newFloors = [...floors]
      newFloors[floorIndex] = { ...floor, order: swapFloor.order }
      newFloors[newIndex] = { ...swapFloor, order: floor.order }
      setFloors(newFloors.sort((a, b) => a.order - b.order))
    } catch (err) {
      console.error('Error moving floor:', err)
      alert('Failed to reorder floor. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEdit = (floor: Floor) => {
    setEditingFloor(floor.id)
    setEditFloorName(floor.name)
  }

  const cancelEdit = () => {
    setEditingFloor(null)
    setEditFloorName('')
  }

  const formatRoomName = (room: any) => {
    return room.name || room.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Floor Management</h3>
          <p className="text-sm text-gray-600">Organize rooms by floors in your project</p>
        </div>
        <Button
          onClick={() => setShowAddFloor(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Floor
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Add Floor Form */}
      {showAddFloor && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Add New Floor</h4>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              placeholder="e.g., Ground Floor, Basement, Second Floor"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleAddFloor()}
              disabled={isSubmitting}
            />
            <Button
              onClick={handleAddFloor}
              disabled={!newFloorName.trim() || isSubmitting}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                setShowAddFloor(false)
                setNewFloorName('')
              }}
              variant="outline"
              size="sm"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Floors List */}
      <div className="space-y-3">
        {floors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No floors created yet</p>
            <p className="text-sm">Add floors to organize your rooms by level</p>
          </div>
        ) : (
          floors.map((floor, index) => (
            <div key={floor.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Building className="w-5 h-5 text-gray-600" />
                    {editingFloor === floor.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editFloorName}
                          onChange={(e) => setEditFloorName(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          onKeyPress={(e) => e.key === 'Enter' && handleEditFloor(floor.id)}
                          disabled={isSubmitting}
                          autoFocus
                        />
                        <Button
                          onClick={() => handleEditFloor(floor.id)}
                          size="sm"
                          variant="outline"
                          disabled={!editFloorName.trim() || isSubmitting}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={cancelEdit}
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-medium text-gray-900">{floor.name}</h4>
                        <p className="text-sm text-gray-600">
                          {floor.rooms.length} room{floor.rooms.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Move Up/Down */}
                    <Button
                      onClick={() => moveFloor(floor.id, 'up')}
                      size="sm"
                      variant="outline"
                      disabled={index === 0 || isSubmitting}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => moveFloor(floor.id, 'down')}
                      size="sm"
                      variant="outline"
                      disabled={index === floors.length - 1 || isSubmitting}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>

                    {editingFloor !== floor.id && (
                      <>
                        <Button
                          onClick={() => startEdit(floor)}
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteFloor(floor.id)}
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting || floor.rooms.length > 0}
                          className={floor.rooms.length > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50 hover:border-red-200 hover:text-red-600'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Rooms in this floor */}
                {floor.rooms.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {floor.rooms.map((room) => (
                        <div key={room.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <Home className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-900">{formatRoomName(room)}</span>
                          <Badge variant="outline" className="text-xs">
                            {room.status.replace('_', ' ').toLowerCase()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-blue-700">
            <p className="font-medium">Floor Organization</p>
            <p className="text-sm mt-1">
              Create floors to organize your rooms by level (e.g., Ground Floor, Basement, Second Floor). 
              When adding new rooms, you can assign them to specific floors for better organization.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}