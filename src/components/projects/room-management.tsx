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
import { WORKFLOW_STAGES, STAGE_CONFIG, getStageConfig, getStageStatusColor, getStageStatusTextColor, type StageStatus } from '@/constants/workflow'

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
  completed?: boolean
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

// Using centralized STAGE_CONFIG from constants/workflow.ts with 5 phases
// Design Concept → 3D Rendering → Client Approval → Drawings → FFE

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
  // Keep rooms collapsed by default to reduce visual clutter
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null)
  const [showAddItems, setShowAddItems] = useState(false)

  const currentStageIndex = room.stages.findIndex(stage => 
    ['IN_PROGRESS', 'NEEDS_ATTENTION'].includes(stage.status)
  )

  const getStageProgress = () => {
    let totalProgress = 0
    let progressCount = 0
    
    // Count all 5 main workflow stages, excluding NOT_APPLICABLE ones
    const relevantStages = room.stages.filter(stage => 
      WORKFLOW_STAGES.includes(stage.type as any) && stage.status !== 'NOT_APPLICABLE'
    )
    
    relevantStages.forEach(stage => {
      if (stage.status === 'COMPLETED') {
        totalProgress += 100
        progressCount += 1
      } else if (stage.status === 'IN_PROGRESS' && stage.type === 'DESIGN_CONCEPT' && stage.designSections) {
        // For design concept stage, calculate progress based on completed sections
        const completedSections = stage.designSections.filter((section: any) => section.completed).length
        const sectionProgress = (completedSections / stage.designSections.length) * 100
        totalProgress += sectionProgress
        progressCount += 1
      } else if (stage.status === 'IN_PROGRESS') {
        // For other stages in progress, assume 50% completion
        totalProgress += 50
        progressCount += 1
      } else {
        // Not started stages contribute 0
        progressCount += 1
      }
    })
    
    return progressCount > 0 ? totalProgress / progressCount : 0
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
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
      {/* Room Header - More Compact */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
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
              size="sm"
              onClick={() => setExpandedRoom(expandedRoom === room.id ? null : room.id)}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expandedRoom === room.id ? 'rotate-90' : ''}`} />
              {expandedRoom === room.id ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>

        {/* Compact Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span>{Math.round(getStageProgress())}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-500 to-blue-600 h-2 rounded-full transition-all duration-500"
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
              {room.stages.filter(stage => 
                WORKFLOW_STAGES.includes(stage.type as any)
              ).map((stage, index) => {
                // Map stage type for backwards compatibility
                let mappedStageType = stage.type
                if (stage.type === 'DESIGN') mappedStageType = 'DESIGN_CONCEPT'
                if (stage.type === 'RENDERING') mappedStageType = 'THREE_D'
                
                const stageConfig = getStageConfig(mappedStageType)
                const status = stage.status as StageStatus
                const isActive = status === 'IN_PROGRESS'
                const isCompleted = status === 'COMPLETED'
                const canStart = status === 'NOT_STARTED' // Allow any phase to start independently
                
                console.log('🏠 Room stage debug:', { 
                  originalType: stage.type, 
                  mappedType: mappedStageType, 
                  stageId: stage.id, 
                  status,
                  canStart 
                })

                return (
                  <div 
                    key={stage.id}
                    className={`p-5 rounded-xl transition-all duration-300 hover:shadow-lg group ${
                      getStageStatusColor(mappedStageType, status)
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <div className={`w-12 h-12 ${stageConfig.baseColor} rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                            <span className="text-lg text-white">{stageConfig.icon}</span>
                          </div>
                          {/* Status indicator */}
                          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                            isCompleted ? 'bg-green-500' :
                            isActive ? 'bg-blue-500 animate-pulse' :
                            'bg-gray-300'
                          }`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h5 className={`font-semibold text-lg ${
                              getStageStatusTextColor(mappedStageType, status)
                            }`}>{stageConfig.name}</h5>
                            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                              isCompleted ? 'bg-green-100 text-green-800' :
                              isActive ? 'bg-blue-100 text-blue-800 animate-pulse' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {isCompleted ? 'COMPLETED' : isActive ? 'IN PROGRESS' : 'NOT STARTED'}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{stageConfig.description}</p>
                          {stage.assignedUser && (
                            <div className="flex items-center space-x-2 mt-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600 font-medium">{stage.assignedUser.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        {stage.status === 'COMPLETED' && stage.completedAt && (
                          <span className="text-xs text-green-600 font-medium">
                            Completed {new Date(stage.completedAt).toLocaleDateString()}
                          </span>
                        )}
                        
                        <div className="flex space-x-2">
                          {canStart && (
                            <Button 
                              size="sm"
                              onClick={() => onStageStart(stage.id)}
                              className={`font-semibold text-white shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${
                                stageConfig.baseColor
                              }`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          )}
                          
                          {isActive && (
                            <>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`/stages/${stage.id}`, '_blank')}
                                className="border-2 hover:bg-gray-50 font-semibold"
                              >
                                Open Workspace
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => onStageComplete(stage.id)}
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md hover:shadow-lg"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Complete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Design Sections for Design Concept Stage */}
                    {stage.type === 'DESIGN_CONCEPT' && stage.designSections && isActive && (
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
