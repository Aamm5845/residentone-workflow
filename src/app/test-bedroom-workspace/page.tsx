'use client'

import React from 'react'
import BedroomDesignWorkspace from '@/components/design/BedroomDesignWorkspace'

// Test page to showcase the new Design Concept Workspace
export default function TestBedroomWorkspacePage() {
  // Mock IDs for testing
  const mockStageId = 'bedroom-stage-123'
  const mockRoomId = 'master-bedroom-456'
  const mockProjectId = 'luxury-home-789'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🛋️ Design Concept Workspace
              </h1>
              <p className="text-gray-600 mt-1">
                Master Bedroom - Modern with warm tones concept
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">
                <span className="font-medium">Status:</span> Draft
              </div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-yellow-700 font-medium">In Development</span>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div className="p-6">
          <BedroomDesignWorkspace 
            stageId={mockStageId}
            roomId={mockRoomId}
            projectId={mockProjectId}
            className="shadow-xl"
          />
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 mt-8">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>✨ Enhanced Design Concept Workspace</span>
              <span>•</span>
              <span>🎨 Pinterest-style Reference Board</span>
              <span>•</span>
              <span>💬 Threaded Comments System</span>
              <span>•</span>
              <span>✅ Interactive Checklists</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>All features operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
