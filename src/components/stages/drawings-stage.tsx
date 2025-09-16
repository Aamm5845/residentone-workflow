'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle, Pencil } from 'lucide-react'

export default function DrawingsStage({ 
  stage, 
  room, 
  project, 
  onComplete 
}: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <Pencil className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Technical Drawings Stage</h2>
              <p className="text-gray-600">{room.name || room.type} - {project.name}</p>
            </div>
          </div>
          <Button onClick={onComplete} className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Complete
          </Button>
        </div>
      </div>
      <div className="p-6">
        <div className="text-center py-12">
          <Pencil className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Technical Drawings Workspace</h3>
          <p className="text-gray-600">Technical drawings interface for Sammy coming soon.</p>
        </div>
      </div>
    </div>
  )
}
