'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle, User, Calendar, Box, Upload, MessageSquare } from 'lucide-react'

interface ThreeDStageProps {
  stage: any
  room: any
  project: any
  onComplete: () => void
  onAddComment: (sectionId: string, content: string, mentions: string[]) => void
  onUploadFile: (sectionId: string, file: File) => void
  onUpdateSection: (sectionId: string, content: string) => void
}

export default function ThreeDStage({ 
  stage, 
  room, 
  project, 
  onComplete 
}: ThreeDStageProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Stage Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Box className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900">3D Rendering Stage</h2>
              <p className="text-gray-600">{room.name || room.type} - {project.name}</p>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center text-sm text-gray-500">
                  <User className="w-4 h-4 mr-1" />
                  {stage.assignedUser?.name || 'Unassigned'}
                </div>
                {stage.dueDate && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    Due {new Date(stage.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <Button 
            onClick={onComplete}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Complete
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="text-center py-12">
          <Box className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">3D Rendering Workspace</h3>
          <p className="text-gray-600 mb-6">
            This is where Vitor creates stunning 3D visualizations based on the approved design.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="p-4 border border-gray-200 rounded-lg">
              <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900">Upload Renders</h4>
              <p className="text-sm text-gray-600">Add 3D renderings and visualizations</p>
            </div>
            
            <div className="p-4 border border-gray-200 rounded-lg">
              <MessageSquare className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900">Feedback</h4>
              <p className="text-sm text-gray-600">Collaborate on rendering revisions</p>
            </div>
            
            <div className="p-4 border border-gray-200 rounded-lg">
              <CheckCircle className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900">Approve</h4>
              <p className="text-sm text-gray-600">Mark renders ready for client</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
