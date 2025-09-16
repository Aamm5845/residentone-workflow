'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  User, 
  AlertCircle, 
  ChevronRight, 
  Plus,
  Settings,
  MessageSquare,
  FileText,
  Camera,
  Palette,
  Box,
  CheckCheck,
  Pencil,
  Users
} from 'lucide-react'

interface Room {
  id: string
  type: string
  name: string | null
  status: string
  currentStage: string | null
  progressFFE: number
  stages: Stage[]
  ffeItems: FFEItem[]
}

interface Stage {
  id: string
  type: string
  status: string
  assignedTo?: string
  assignedUser?: { name: string }
  dueDate?: string
  completedAt?: string
  designSections?: DesignSection[]
}

interface DesignSection {
  id: string
  type: string
  content?: string
}

interface FFEItem {
  id: string
  name: string
  status: string
  category: string
  price?: number
  supplierLink?: string
}

interface RoomManagementProps {
  room: Room
  projectId: string
  onRoomUpdate: (roomId: string, updates: any) => void
  onStageStart: (stageId: string) => void
  onStageComplete: (stageId: string) => void
}

const STAGE_CONFIG = {
  DESIGN: {
    name: 'Design',
    icon: Palette,
    color: 'bg-purple-500',
    description: 'Create design concepts and mood boards'
  },
  THREE_D: {
    name: '3D Rendering',
    icon: Box,
    color: 'bg-blue-500',
    description: 'Generate 3D visualizations and renderings'
  },
  CLIENT_APPROVAL: {
    name: 'Client Approval',
    icon: CheckCheck,
    color: 'bg-green-500',
    description: 'Client review and approval process'
  },
  DRAWINGS: {
    name: 'Technical Drawings',
    icon: Pencil,
    color: 'bg-orange-500',
    description: 'Create technical drawings and specifications'
  },
  FFE: {
    name: 'FFE Sourcing',
    icon: Settings,
    color: 'bg-indigo-500',
    description: 'Furniture, fixtures & equipment sourcing'
  }
}

const ROOM_STATUS_CONFIG = {
  NOT_STARTED: { name: 'Not Started', color: 'bg-gray-100 text-gray-800', icon: Clock },
  IN_PROGRESS: { name: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: Play },
  ON_HOLD: { name: 'On Hold', color: 'bg-orange-100 text-orange-800', icon: Pause },
  COMPLETED: { name: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  NEEDS_ATTENTION: { name: 'Needs Attention', color: 'bg-red-100 text-red-800', icon: AlertCircle }
}

export default function RoomManagement({ 
  room, 
  projectId, 
  onRoomUpdate, 
  onStageStart, 
  onStageComplete 
}: RoomManagementProps) {
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null)
  const [showAddItems, setShowAddItems] = useState(false)

  const currentStageIndex = room.stages.findIndex(stage => 
    ['IN_PROGRESS', 'NEEDS_ATTENTION'].includes(stage.status)
  )

  const getStageProgress = () => {
    const completedStages = room.stages.filter(stage => stage.status === 'COMPLETED').length
    return (completedStages / room.stages.length) * 100
  }

  const getNextActionableStage = () => {
    return room.stages.find(stage => 
      stage.status === 'NOT_STARTED' || stage.status === 'IN_PROGRESS' || stage.status === 'NEEDS_ATTENTION'
    )
  }

  const startRoom = async () => {
    const firstStage = room.stages[0]
    if (firstStage && firstStage.status === 'NOT_STARTED') {
      await onStageStart(firstStage.id)
      onRoomUpdate(room.id, { status: 'IN_PROGRESS', currentStage: firstStage.type })
    }
  }

  const StatusIcon = ROOM_STATUS_CONFIG[room.status as keyof typeof ROOM_STATUS_CONFIG]?.icon || Clock

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Room Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {room.name || room.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </h3>
              <div className="flex items-center space-x-3 mt-1">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ROOM_STATUS_CONFIG[room.status as keyof typeof ROOM_STATUS_CONFIG]?.color}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {ROOM_STATUS_CONFIG[room.status as keyof typeof ROOM_STATUS_CONFIG]?.name}
                </div>
                <span className="text-sm text-gray-500">
                  {Math.round(getStageProgress())}% Complete
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {room.status === 'NOT_STARTED' && (
              <Button 
                onClick={startRoom}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Room
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => setExpandedRoom(expandedRoom === room.id ? null : room.id)}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expandedRoom === room.id ? 'rotate-90' : ''}`} />
              {expandedRoom === room.id ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span>{Math.round(getStageProgress())}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${getStageProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Room Details */}
      {expandedRoom === room.id && (
        <div className="p-6 space-y-6">
          {/* Stage Workflow */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">Workflow Stages</h4>
            <div className="space-y-3">
              {room.stages.map((stage, index) => {
                const StageConfig = STAGE_CONFIG[stage.type as keyof typeof STAGE_CONFIG]
                const StageIcon = StageConfig?.icon || Settings
                const isActive = currentStageIndex === index
                const isCompleted = stage.status === 'COMPLETED'
                const canStart = stage.status === 'NOT_STARTED' && (index === 0 || room.stages[index - 1].status === 'COMPLETED')

                return (
                  <div 
                    key={stage.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isActive 
                        ? 'border-purple-500 bg-purple-50' 
                        : isCompleted
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 ${StageConfig?.color} rounded-lg flex items-center justify-center`}>
                          <StageIcon className="w-5 h-5 text-white" />
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-gray-900">{StageConfig?.name}</h5>
                          <p className="text-sm text-gray-600">{StageConfig?.description}</p>
                          {stage.assignedUser && (
                            <div className="flex items-center space-x-1 mt-1">
                              <User className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{stage.assignedUser.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {stage.status === 'COMPLETED' && stage.completedAt && (
                          <span className="text-xs text-green-600">
                            Completed {new Date(stage.completedAt).toLocaleDateString()}
                          </span>
                        )}
                        
                        {canStart && (
                          <Button 
                            size="sm"
                            onClick={() => onStageStart(stage.id)}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            Start Stage
                          </Button>
                        )}
                        
                        {stage.status === 'IN_PROGRESS' && (
                          <>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`/stages/${stage.id}`, '_blank')}
                            >
                              Open Details
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => onStageComplete(stage.id)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Mark Complete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Design Sections for Design Stage */}
                    {stage.type === 'DESIGN' && stage.designSections && isActive && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h6 className="text-sm font-medium text-gray-900 mb-3">Design Sections</h6>
                        <div className="grid grid-cols-2 gap-3">
                          {stage.designSections.map(section => (
                            <div key={section.id} className="p-3 bg-white rounded border">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium capitalize">
                                  {section.type.toLowerCase()}
                                </span>
                                <Button size="sm" variant="outline">
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* FFE Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-semibold text-gray-900">FFE Items ({room.ffeItems.length})</h4>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowAddItems(!showAddItems)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Items
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {room.ffeItems.slice(0, 6).map(item => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h6 className="text-sm font-medium text-gray-900">{item.name}</h6>
                      <p className="text-xs text-gray-600">{item.category}</p>
                      {item.price && (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          ${item.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.status === 'COMPLETED' 
                        ? 'bg-green-100 text-green-800' 
                        : item.status === 'IN_PROGRESS'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status.replace('_', ' ').toLowerCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {room.ffeItems.length > 6 && (
              <div className="mt-3 text-center">
                <Button variant="outline" size="sm">
                  View All {room.ffeItems.length} Items
                </Button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" size="sm">
              <MessageSquare className="w-4 h-4 mr-2" />
              Add Comment
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
            <Button variant="outline" size="sm">
              <Camera className="w-4 h-4 mr-2" />
              Take Photo
            </Button>
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Assign Team
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
