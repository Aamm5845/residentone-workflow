'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Home,
  Plus,
  Trash2,
  AlertCircle,
  Layers,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical
} from 'lucide-react'
import AddRoomDialog from './add-room-dialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Room {
  id: string
  name?: string
  type: string
  status: string
  projectId: string
  sectionId?: string | null
  order: number
  createdAt?: string
  section?: {
    id: string
    name: string
  } | null
}

interface Section {
  id: string
  name: string
}

interface RoomsManagementSectionProps {
  projectId: string
}

// Sortable Room Item Component
function SortableRoomItem({ room, sections, isSubmitting, onMoveToSection, onDelete, formatRoomName, formatStatus }: {
  room: Room
  sections: Section[]
  isSubmitting: boolean
  onMoveToSection: (roomId: string, sectionId: string | null) => void
  onDelete: (roomId: string) => void
  formatRoomName: (room: Room) => string
  formatStatus: (status: string) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between bg-white"
    >
      <div className="flex items-center space-x-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <Home className="w-5 h-5 text-gray-500" />
        <div>
          <h5 className="font-medium text-gray-900">{formatRoomName(room)}</h5>
          <p className="text-sm text-gray-500">{room.type.replace(/_/g, ' ')}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {formatStatus(room.status)}
        </Badge>
      </div>
      <div className="flex items-center space-x-2">
        <select
          value={room.sectionId || ''}
          onChange={(e) => onMoveToSection(room.id, e.target.value || null)}
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isSubmitting}
        >
          <option value="">Unassigned</option>
          {sections.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Button
          onClick={() => onDelete(room.id)}
          size="sm"
          variant="outline"
          disabled={isSubmitting}
          className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

export default function RoomsManagementSection({ projectId }: RoomsManagementSectionProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAddRoomDialog, setShowAddRoomDialog] = useState(false)
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editSectionName, setEditSectionName] = useState('')

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Helper function to check and fix duplicate order values
  const checkAndFixDuplicateOrders = (rooms: Room[]) => {
    let needsFix = false
    
    // Group rooms by section
    const roomsBySection = rooms.reduce((acc, room) => {
      const key = room.sectionId || 'unassigned'
      if (!acc[key]) acc[key] = []
      acc[key].push(room)
      return acc
    }, {} as Record<string, Room[]>)
    
    // Check each section for duplicate orders
    Object.values(roomsBySection).forEach(sectionRooms => {
      const orders = sectionRooms.map(r => r.order || 0)
      const hasDuplicates = orders.length !== new Set(orders).size
      
      if (hasDuplicates || orders.some(o => o === undefined)) {
        needsFix = true
        // Reindex rooms in this section
        sectionRooms
          .sort((a, b) => {
            // Sort by existing order first, then by creation date as tiebreaker
            if (a.order === b.order) {
              return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
            }
            return (a.order || 0) - (b.order || 0)
          })
          .forEach((room, index) => {
            room.order = index
          })
      }
    })
    
    return needsFix
  }

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const projectResponse = await fetch(`/api/projects/${projectId}`)
      
      if (!projectResponse.ok) {
        throw new Error('Failed to fetch project data')
      }
      
      const projectData = await projectResponse.json()
      
      let roomsData = projectData.rooms && Array.isArray(projectData.rooms) ? projectData.rooms : []
      
      // Check for duplicate orders and fix them if needed
      const needsReindexing = checkAndFixDuplicateOrders(roomsData)
      if (needsReindexing) {
        // Save the fixed orders to database
        await Promise.all(
          roomsData.map(room =>
            fetch(`/api/rooms/${room.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: room.order })
            }).catch(err => console.error('Error updating room order:', err))
          )
        )
      }
      
      setRooms(roomsData)
      
      // Load sections from database API
      if (projectData.roomSections && Array.isArray(projectData.roomSections)) {
        setSections(projectData.roomSections)
      } else {
        setSections([])
      }
      
    } catch (err: any) {
      console.error('Error fetching data:', err)
      setError(err.message || 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }


  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections)
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId)
    } else {
      newCollapsed.add(sectionId)
    }
    setCollapsedSections(newCollapsed)
  }

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName.trim() })
      })

      if (response.ok) {
        const newSection = await response.json()
        setSections(prev => [...prev, newSection])
        setNewSectionName('')
        setShowAddSection(false)
      } else {
        throw new Error('Failed to create section')
      }
    } catch (err) {
      console.error('Error adding section:', err)
      alert('Failed to add section. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateSection = async (sectionId: string) => {
    if (!editSectionName.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/sections/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editSectionName.trim() })
      })

      if (response.ok) {
        const updatedSection = await response.json()
        setSections(prev => prev.map(s => 
          s.id === sectionId ? updatedSection : s
        ))
        setEditingSection(null)
        setEditSectionName('')
      } else {
        throw new Error('Failed to update section')
      }
    } catch (err) {
      console.error('Error updating section:', err)
      alert('Failed to update section. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSection = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const roomsInSection = rooms.filter(r => r.sectionId === sectionId)
    if (roomsInSection.length > 0) {
      alert(`Cannot delete section "${section.name}" because it contains ${roomsInSection.length} room(s). Please move or delete the rooms first.`)
      return
    }

    if (!confirm(`Are you sure you want to delete section "${section.name}"?`)) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/sections/${sectionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSections(prev => prev.filter(s => s.id !== sectionId))
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to delete section')
      }
    } catch (err: any) {
      console.error('Error deleting section:', err)
      alert(err.message || 'Failed to delete section. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMoveRoomToSection = async (roomId: string, sectionId: string | null) => {
    setIsSubmitting(true)
    try {
      // Calculate the new order for the room (place it at the end of the target section)
      const roomsInTargetSection = rooms.filter(r => 
        r.id !== roomId && (sectionId === null ? !r.sectionId : r.sectionId === sectionId)
      )
      const maxOrder = roomsInTargetSection.length > 0 
        ? Math.max(...roomsInTargetSection.map(r => r.order || 0))
        : -1
      const newOrder = maxOrder + 1

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, order: newOrder })
      })

      if (response.ok) {
        const updatedRoom = await response.json()
        
        // Update local state immediately
        setRooms(prev => prev.map(r => 
          r.id === roomId ? updatedRoom : r
        ))
      } else {
        throw new Error('Failed to move room')
      }
    } catch (err) {
      console.error('Error moving room:', err)
      alert('Failed to move room. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent, sectionId: string | null) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const roomsInSection = getRoomsForSection(sectionId)
    const oldIndex = roomsInSection.findIndex(r => r.id === active.id)
    const newIndex = roomsInSection.findIndex(r => r.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reorderedRooms = arrayMove(roomsInSection, oldIndex, newIndex)

    // Optimistically update UI
    const updatedRooms = rooms.map(room => {
      const indexInReordered = reorderedRooms.findIndex(r => r.id === room.id)
      if (indexInReordered !== -1) {
        return { ...room, order: indexInReordered }
      }
      return room
    })
    setRooms(updatedRooms)

    // Save to database
    setIsSubmitting(true)
    try {
      const updates = reorderedRooms.map((room, index) => ({
        id: room.id,
        order: index
      }))

      await Promise.all(
        updates.map(update =>
          fetch(`/api/rooms/${update.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: update.order })
          })
        )
      )
    } catch (err) {
      console.error('Error reordering rooms:', err)
      alert('Failed to save room order. Please try again.')
      // Refresh to get correct order from server
      await fetchData()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    if (!room) return

    const roomName = formatRoomName(room)
    if (!confirm(`Are you sure you want to delete "${roomName}"? This will delete all associated data (stages, FFE items, etc.) and cannot be undone.`)) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setRooms(prev => prev.filter(r => r.id !== roomId))
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to delete room')
      }
    } catch (err: any) {
      console.error('Error deleting room:', err)
      alert(err.message || 'Failed to delete room. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatRoomName = (room: Room) => {
    return room.name || room.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
  }

  const handleRoomAdded = (newRoom: Room) => {
    setRooms(prev => [...prev, newRoom])
    setShowAddRoomDialog(false)
  }

  // Group rooms by section and apply ordering
  const getRoomsForSection = (sectionId: string | null) => {
    const sectionRooms = rooms.filter(room => 
      sectionId === null 
        ? !room.sectionId 
        : room.sectionId === sectionId
    )
    
    // Sort by database order field
    return sectionRooms.sort((a, b) => (a.order || 0) - (b.order || 0))
  }
  
  const unassignedRooms = getRoomsForSection(null)
  const roomsBySection = sections.reduce((acc, section) => {
    acc[section.id] = getRoomsForSection(section.id)
    return acc
  }, {} as Record<string, Room[]>)

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
          <h3 className="text-lg font-semibold text-gray-900">Rooms Management</h3>
          <p className="text-sm text-gray-600">View and manage all rooms in this project</p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowAddSection(true)}
            variant="outline"
            className="border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            <Layers className="w-4 h-4 mr-2" />
            Add Section
          </Button>
          <Button
            onClick={() => setShowAddRoomDialog(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Add Section Dialog */}
      {showAddSection && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Add New Section</h4>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="e.g., Ground Floor, Basement, Second Floor"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAddSection()}
              autoFocus
            />
            <Button
              onClick={handleAddSection}
              disabled={!newSectionName.trim()}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                setShowAddSection(false)
                setNewSectionName('')
              }}
              variant="outline"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const sectionRooms = roomsBySection[section.id] || []

          return (
            <div key={section.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {collapsedSections.has(section.id) ? (
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                  <Layers className="w-5 h-5 text-gray-600 mr-2" />
                  {editingSection === section.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editSectionName}
                        onChange={(e) => setEditSectionName(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateSection(section.id)}
                        autoFocus
                      />
                      <Button
                        onClick={() => handleUpdateSection(section.id)}
                        size="sm"
                        variant="outline"
                        disabled={!editSectionName.trim()}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingSection(null)
                          setEditSectionName('')
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-medium text-gray-900">{section.name}</h4>
                      <Badge variant="outline" className="ml-3 text-xs">
                        {sectionRooms.length} room{sectionRooms.length !== 1 ? 's' : ''}
                      </Badge>
                    </>
                  )}
                </div>
                {editingSection !== section.id && (
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => {
                        setEditingSection(section.id)
                        setEditSectionName(section.name)
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteSection(section.id)}
                      size="sm"
                      variant="outline"
                      className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>

              {!collapsedSections.has(section.id) && sectionRooms.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, section.id)}
                >
                  <SortableContext
                    items={sectionRooms.map(r => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="divide-y divide-gray-100">
                      {sectionRooms.map((room) => (
                        <SortableRoomItem
                          key={room.id}
                          room={room}
                          sections={sections}
                          isSubmitting={isSubmitting}
                          onMoveToSection={handleMoveRoomToSection}
                          onDelete={handleDeleteRoom}
                          formatRoomName={formatRoomName}
                          formatStatus={formatStatus}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              
              {!collapsedSections.has(section.id) && sectionRooms.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No rooms in this section
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned Rooms */}
        {(unassignedRooms.length > 0 || rooms.length === 0) && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center">
              <Home className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">
                {sections.length > 0 ? 'Unassigned Rooms' : 'All Rooms'}
              </h4>
              <Badge variant="outline" className="ml-3 text-xs">
                {unassignedRooms.length} room{unassignedRooms.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {unassignedRooms.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, null)}
              >
                <SortableContext
                  items={unassignedRooms.map(r => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="divide-y divide-gray-100">
                    {unassignedRooms.map((room) => (
                      <SortableRoomItem
                        key={room.id}
                        room={room}
                        sections={sections}
                        isSubmitting={isSubmitting}
                        onMoveToSection={handleMoveRoomToSection}
                        onDelete={handleDeleteRoom}
                        formatRoomName={formatRoomName}
                        formatStatus={formatStatus}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Home className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No rooms yet</p>
                <p className="text-sm mt-1">Add rooms to start organizing your project</p>
                <Button
                  onClick={() => setShowAddRoomDialog(true)}
                  className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Room
                </Button>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Add Room Dialog */}
      {showAddRoomDialog && (
        <AddRoomDialog
          projectId={projectId}
          onRoomAdded={handleRoomAdded}
          onClose={() => setShowAddRoomDialog(false)}
        />
      )}
    </div>
  )
}
