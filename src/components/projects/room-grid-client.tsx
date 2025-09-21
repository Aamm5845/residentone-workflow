'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import AddRoomDialog from './add-room-dialog'

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

interface RoomGridClientProps {
  initialRooms: Room[]
  projectId: string
  roomCards: React.ReactNode[]
}

export default function RoomGridClient({ initialRooms, projectId, roomCards }: RoomGridClientProps) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [showAddRoomDialog, setShowAddRoomDialog] = useState(false)

  const handleRoomAdded = (newRoom: Room) => {
    setRooms(prev => [...prev, newRoom])
    // Refresh the page to show the new room with all its proper calculations
    window.location.reload()
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roomCards}
        
        {/* Add New Room Card - Now functional */}
        <div 
          onClick={() => setShowAddRoomDialog(true)}
          className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-purple-400 transition-colors cursor-pointer group"
        >
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-purple-600" />
            </div>
            <h3 className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">Add New Room</h3>
            <p className="text-sm text-gray-500 mt-1">Create a new room for this project</p>
          </div>
        </div>
      </div>

      {/* Add Room Dialog */}
      {showAddRoomDialog && (
        <AddRoomDialog
          projectId={projectId}
          onRoomAdded={handleRoomAdded}
          onClose={() => setShowAddRoomDialog(false)}
        />
      )}
    </>
  )
}
