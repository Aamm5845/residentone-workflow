'use client'

import React from 'react'
import DesignBoard from '@/components/rooms/design-board'
import InstructionsTooltip from '@/components/ui/InstructionsTooltip'

// Test page to verify design board functionality
export default function TestDesignBoardPage() {
  // Mock section data for testing
  const mockSection = {
    id: 'test-section-1',
    name: 'General Design',
    icon: '✨'
  }

  const mockRoomId = 'test-room-123'
  const mockProjectId = 'test-project-456'

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              🎨 Design Board Test Page
            </h1>
            <InstructionsTooltip title="📝 Instructions & API Info">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">How to Test:</h4>
                  <ol className="space-y-1 text-sm">
                    <li><strong>1. Upload Test:</strong> Try uploading an image by clicking the + button or dragging files into the upload area</li>
                    <li><strong>2. Message Test:</strong> Click the message icon and try posting a test comment</li>
                    <li><strong>3. File Display:</strong> Uploaded files should appear in a grid below the upload area</li>
                    <li><strong>4. Interaction Test:</strong> Click on uploaded files to preview them</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">🔗 API Endpoints:</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Upload API:</strong> <code className="bg-gray-100 px-1 rounded">/api/upload</code> - Handles file uploads with database storage</div>
                    <div><strong>Messages API:</strong> <code className="bg-gray-100 px-1 rounded">/api/messages</code> - Handles comment creation and retrieval</div>
                    <div><strong>File Retrieval:</strong> Files are automatically fetched when the component loads</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Features to Test:</h4>
                  <ul className="text-sm space-y-1">
                    <li>• ✅ Drag and drop file upload</li>
                    <li>• ✅ Click to upload files</li>
                    <li>• ✅ Image preview and file display</li>
                    <li>• ✅ Post messages/comments</li>
                    <li>• ✅ View existing messages</li>
                    <li>• ✅ File type validation</li>
                  </ul>
                </div>
              </div>
            </InstructionsTooltip>
          </div>
          <p className="text-gray-600">
            Testing the interactive design board with upload and messaging functionality
          </p>
          
        </div>

        {/* Design Board Component */}
        <div className="bg-white rounded-lg shadow-sm">
          <DesignBoard 
            section={mockSection}
            roomId={mockRoomId}
            projectId={mockProjectId}
          />
        </div>

      </div>
    </div>
  )
}