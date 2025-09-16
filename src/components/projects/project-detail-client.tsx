'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, DoorOpen, Navigation, Baby, UserCheck, Gamepad2, Bed, Bath, Settings, Home } from 'lucide-react'
import RoomManagement from './room-management'

interface Room {
  id: string
  type: string
  name: string | null
  status: string
  currentStage: string | null
  progressFFE: number
  stages: any[]
  ffeItems: any[]
}

interface ProjectDetailClientProps {
  project: any
  rooms: Room[]
}

const ROOM_CATEGORIES = {
  'Entry & Circulation': [
    { value: 'ENTRANCE', label: 'Entrance', icon: DoorOpen, color: 'bg-gray-600' },
    { value: 'FOYER', label: 'Foyer', icon: Home, color: 'bg-gray-500' },
    { value: 'STAIRCASE', label: 'Staircase', icon: Navigation, color: 'bg-gray-400' },
  ],
  'Living Spaces': [
    { value: 'LIVING_ROOM', label: 'Living Room', icon: Home, color: 'bg-green-500' },
    { value: 'DINING_ROOM', label: 'Dining Room', icon: Home, color: 'bg-orange-500' },
    { value: 'KITCHEN', label: 'Kitchen', icon: Home, color: 'bg-red-500' },
    { value: 'STUDY_ROOM', label: 'Study Room', icon: Settings, color: 'bg-purple-400' },
    { value: 'OFFICE', label: 'Office', icon: Settings, color: 'bg-purple-500' },
    { value: 'PLAYROOM', label: 'Playroom', icon: Gamepad2, color: 'bg-pink-500' },
  ],
  'Bedrooms': [
    { value: 'MASTER_BEDROOM', label: 'Master Bedroom', icon: Bed, color: 'bg-blue-600' },
    { value: 'GIRLS_ROOM', label: 'Girls Room', icon: Bed, color: 'bg-pink-400' },
    { value: 'BOYS_ROOM', label: 'Boys Room', icon: Bed, color: 'bg-blue-400' },
    { value: 'GUEST_BEDROOM', label: 'Guest Bedroom', icon: Bed, color: 'bg-indigo-400' },
  ],
  'Bathrooms': [
    { value: 'POWDER_ROOM', label: 'Powder Room', icon: Bath, color: 'bg-cyan-300' },
    { value: 'MASTER_BATHROOM', label: 'Master Bathroom', icon: Bath, color: 'bg-cyan-600' },
    { value: 'FAMILY_BATHROOM', label: 'Family Bathroom', icon: Bath, color: 'bg-cyan-500' },
    { value: 'GIRLS_BATHROOM', label: 'Girls Bathroom', icon: Bath, color: 'bg-pink-300' },
    { value: 'BOYS_BATHROOM', label: 'Boys Bathroom', icon: Bath, color: 'bg-blue-300' },
    { value: 'GUEST_BATHROOM', label: 'Guest Bathroom', icon: Bath, color: 'bg-cyan-400' },
  ],
  'Utility': [
    { value: 'LAUNDRY_ROOM', label: 'Laundry Room', icon: Settings, color: 'bg-indigo-500' },
  ],
  'Special': [
    { value: 'SUKKAH', label: 'Sukkah', icon: Home, color: 'bg-green-700' },
  ],
}

const ROOM_TYPES = Object.values(ROOM_CATEGORIES).flat()

export default function ProjectDetailClient({ project, rooms: initialRooms }: ProjectDetailClientProps) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [showAddRoomDialog, setShowAddRoomDialog] = useState(false)
  const [selectedRoomType, setSelectedRoomType] = useState('')
  const [customRoomName, setCustomRoomName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleRoomUpdate = (roomId: string, updates: any) => {
    setRooms(prev => prev.map(room => 
      room.id === roomId ? { ...room, ...updates } : room
    ))
  }

  const handleStageStart = async (stageId: string) => {
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        // Update the room in the state with the new stage data
        setRooms(prev => prev.map(room => 
          room.id === updatedStage.room.id ? updatedStage.room : room
        ))
      }
    } catch (error) {
      console.error('Error starting stage:', error)
    }
  }

  const handleStageComplete = async (stageId: string) => {
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        // Update the room in the state with the new stage data
        setRooms(prev => prev.map(room => 
          room.id === updatedStage.room.id ? updatedStage.room : room
        ))
      }
    } catch (error) {
      console.error('Error completing stage:', error)
    }
  }

  const addNewRoom = async () => {
    if (!selectedRoomType) return

    setIsAdding(true)
    try {
      const roomTypeData = ROOM_TYPES.find(r => r.value === selectedRoomType)
      const response = await fetch(`/api/projects/${project.id}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedRoomType,
          name: roomTypeData?.label,
          customName: customRoomName.trim() || null
        })
      })

      if (response.ok) {
        const newRoom = await response.json()
        setRooms(prev => [...prev, newRoom])
        setShowAddRoomDialog(false)
        setSelectedRoomType('')
        setCustomRoomName('')
      }
    } catch (error) {
      console.error('Error adding room:', error)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div>
      {/* Rooms Management Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Project Rooms</h3>
            <p className="text-sm text-gray-600">{rooms.length} rooms in this project</p>
          </div>
          <Button 
            onClick={() => setShowAddRoomDialog(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </Button>
        </div>
        
        <div className="p-6 space-y-6">
          {rooms.map(room => (
            <RoomManagement
              key={room.id}
              room={room}
              projectId={project.id}
              onRoomUpdate={handleRoomUpdate}
              onStageStart={handleStageStart}
              onStageComplete={handleStageComplete}
            />
          ))}
        </div>
      </div>

      {/* Add Room Dialog */}
      {showAddRoomDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Room</h3>
            
            <div className="space-y-6">
              {Object.entries(ROOM_CATEGORIES).map(([category, roomTypes]) => (
                <div key={category}>
                  <h4 className="text-md font-medium text-gray-900 mb-3">{category}</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {roomTypes.map((room) => {
                      const Icon = room.icon
                      const isSelected = selectedRoomType === room.value
                      
                      return (
                        <div
                          key={room.value}
                          onClick={() => setSelectedRoomType(room.value)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-center">
                            <div className={`w-10 h-10 ${room.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-sm font-medium text-gray-900">{room.label}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selectedRoomType && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Room Name (Optional)
                </label>
                <input
                  type="text"
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Boys Bedroom 2, Living Room - Main"
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddRoomDialog(false)
                  setSelectedRoomType('')
                  setCustomRoomName('')
                }}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button
                onClick={addNewRoom}
                disabled={!selectedRoomType || isAdding}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isAdding ? 'Adding...' : 'Add Room'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
