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
  Edit3,
  Calendar,
  Users,
  ArrowRight,
  RotateCcw,
  Eye
} from 'lucide-react'

interface StageControlsProps {
  stage: {
    id: string
    type: string
    status: string
    assignedUser?: { name: string; id?: string }
    dueDate?: string
    completedAt?: string
  }
  canStart: boolean
  canComplete: boolean
  onStart: (assignedTo?: string) => void
  onComplete: () => void
  onPause?: () => void
  onReopen?: () => void
  onAssign?: (userId: string) => void
}

const STAGE_CONFIG = {
  DESIGN: {
    name: 'Design Development',
    icon: Edit3,
    color: 'bg-purple-500',
    description: 'Create design concepts and mood boards',
    defaultAssignee: 'Designer'
  },
  THREE_D: {
    name: '3D Rendering',
    icon: Eye,
    color: 'bg-blue-500',
    description: 'Generate 3D visualizations and renderings',
    defaultAssignee: 'Renderer'
  },
  CLIENT_APPROVAL: {
    name: 'Client Review',
    icon: Users,
    color: 'bg-green-500',
    description: 'Client review and approval process',
    defaultAssignee: 'Project Manager'
  },
  DRAWINGS: {
    name: 'Technical Drawings',
    icon: Edit3,
    color: 'bg-orange-500',
    description: 'Create construction drawings and specifications',
    defaultAssignee: 'Drafter'
  },
  FFE: {
    name: 'FFE Sourcing',
    icon: Users,
    color: 'bg-indigo-500',
    description: 'Furniture, fixtures & equipment procurement',
    defaultAssignee: 'FFE Specialist'
  }
}

const STATUS_CONFIG = {
  NOT_STARTED: { name: 'Ready to Start', color: 'bg-gray-100 text-gray-800', icon: Clock },
  IN_PROGRESS: { name: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: Play },
  COMPLETED: { name: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  ON_HOLD: { name: 'On Hold', color: 'bg-orange-100 text-orange-800', icon: Pause },
  NEEDS_ATTENTION: { name: 'Needs Attention', color: 'bg-red-100 text-red-800', icon: AlertCircle }
}

// Mock team members for demo
const TEAM_MEMBERS = [
  { id: 'designer-1', name: 'Sarah Chen', role: 'Senior Designer', avatar: '👩‍🎨' },
  { id: 'renderer-1', name: 'Mike Rodriguez', role: '3D Renderer', avatar: '👨‍💻' },
  { id: 'drafter-1', name: 'Emily Zhang', role: 'Technical Drafter', avatar: '👩‍💼' },
  { id: 'ffe-1', name: 'Alex Kumar', role: 'FFE Specialist', avatar: '🧑‍💼' },
  { id: 'pm-1', name: 'Jessica Wilson', role: 'Project Manager', avatar: '👩‍💻' }
]

export default function StageControls({
  stage,
  canStart,
  canComplete,
  onStart,
  onComplete,
  onPause,
  onReopen,
  onAssign
}: StageControlsProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedAssignee, setSelectedAssignee] = useState('')

  const stageConfig = STAGE_CONFIG[stage.type as keyof typeof STAGE_CONFIG]
  const statusConfig = STATUS_CONFIG[stage.status as keyof typeof STATUS_CONFIG]
  const StageIcon = stageConfig?.icon || Clock
  const StatusIcon = statusConfig?.icon || Clock

  const handleStartStage = () => {
    if (selectedAssignee) {
      onStart(selectedAssignee)
      setShowAssignDialog(false)
      setSelectedAssignee('')
    } else {
      // Auto-assign based on stage type
      const defaultMember = TEAM_MEMBERS.find(member => 
        member.role.toLowerCase().includes(stageConfig?.defaultAssignee?.toLowerCase() || '')
      )
      onStart(defaultMember?.id)
    }
  }

  const getRecommendedAssignee = () => {
    return TEAM_MEMBERS.find(member => 
      member.role.toLowerCase().includes(stageConfig?.defaultAssignee?.toLowerCase() || '')
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Stage Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${stageConfig?.color} rounded-lg flex items-center justify-center shadow-sm`}>
              <StageIcon className="w-5 h-5 text-white" />
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900">{stageConfig?.name}</h3>
              <p className="text-sm text-gray-600">{stageConfig?.description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Status Badge */}
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig?.color}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig?.name}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Details */}
      <div className="p-4 space-y-4">
        {/* Assignment Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Assigned to:</span>
            {stage.assignedUser ? (
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">
                    {stage.assignedUser.name.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {stage.assignedUser.name}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">Unassigned</span>
            )}
          </div>
          
          {onAssign && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAssignDialog(true)}
            >
              Assign
            </Button>
          )}
        </div>

        {/* Due Date */}
        {stage.dueDate && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Due: {new Date(stage.dueDate).toLocaleDateString()}</span>
          </div>
        )}

        {/* Completion Date */}
        {stage.completedAt && (
          <div className="flex items-center space-x-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Completed: {new Date(stage.completedAt).toLocaleDateString()}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
          {canStart && stage.status === 'NOT_STARTED' && (
            <Button 
              onClick={() => setShowAssignDialog(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Stage
            </Button>
          )}
          
          {stage.status === 'IN_PROGRESS' && (
            <>
              {canComplete && (
                <Button 
                  onClick={onComplete}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete
                </Button>
              )}
              
              {onPause && (
                <Button 
                  variant="outline"
                  onClick={onPause}
                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => window.open(`/stages/${stage.id}`, '_blank')}
                className="flex-1"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Open Workspace
              </Button>
            </>
          )}
          
          {stage.status === 'COMPLETED' && onReopen && (
            <Button 
              variant="outline"
              onClick={onReopen}
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reopen for Revision
            </Button>
          )}
          
          {stage.status === 'ON_HOLD' && (
            <Button 
              onClick={() => onStart()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* Assignment Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign {stageConfig?.name}
            </h3>
            
            {/* Recommended Assignee */}
            {getRecommendedAssignee() && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-700 mb-2">Recommended:</p>
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getRecommendedAssignee()?.avatar}</span>
                  <div>
                    <p className="font-medium text-gray-900">{getRecommendedAssignee()?.name}</p>
                    <p className="text-sm text-gray-600">{getRecommendedAssignee()?.role}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedAssignee(getRecommendedAssignee()?.id || '')
                      handleStartStage()
                    }}
                    className="ml-auto bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Assign & Start
                  </Button>
                </div>
              </div>
            )}
            
            {/* Team Members */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {TEAM_MEMBERS.map((member) => (
                <div
                  key={member.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedAssignee === member.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedAssignee(member.id)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{member.avatar}</span>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false)
                  setSelectedAssignee('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartStage}
                disabled={!selectedAssignee}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Start Stage
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}