'use client'

import React from 'react'
import DesignConceptWorkspace from '@/components/design/DesignConceptWorkspace'

// Simple test page to verify our Design Concept Workspace integration
export default function TestDesignWorkspacePage() {
  // Mock IDs for testing
  const mockStageId = 'test-stage-123'
  const mockRoomId = 'test-room-123'
  const mockProjectId = 'test-project-123'

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Design Concept Workspace Test
          </h1>
          <p className="text-gray-600">
            Testing the Design Concept Workspace integration
          </p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <DesignConceptWorkspace 
            stageId={mockStageId}
            roomId={mockRoomId}
            projectId={mockProjectId}
          />
        </div>
      </div>
    </div>
  )
}
