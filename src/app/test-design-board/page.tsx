'use client'

import React from 'react'
import DesignBoard from '@/components/rooms/design-board'

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎨 Design Board Test Page
          </h1>
          <p className="text-gray-600">
            Testing the interactive design board with upload and messaging functionality
          </p>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Features to Test:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• ✅ Drag and drop file upload</li>
              <li>• ✅ Click to upload files</li>
              <li>• ✅ Image preview and file display</li>
              <li>• ✅ Post messages/comments</li>
              <li>• ✅ View existing messages</li>
              <li>• ✅ File type validation</li>
            </ul>
          </div>
        </div>

        {/* Design Board Component */}
        <div className="bg-white rounded-lg shadow-sm">
          <DesignBoard 
            section={mockSection}
            roomId={mockRoomId}
            projectId={mockProjectId}
          />
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2">📝 Instructions:</h3>
          <ol className="text-sm text-amber-800 space-y-2">
            <li><strong>1. Upload Test:</strong> Try uploading an image by clicking the + button or dragging files into the upload area</li>
            <li><strong>2. Message Test:</strong> Click the message icon and try posting a test comment</li>
            <li><strong>3. File Display:</strong> Uploaded files should appear in a grid below the upload area</li>
            <li><strong>4. Interaction Test:</strong> Click on uploaded files to preview them</li>
          </ol>
        </div>

        {/* API Status */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">🔗 API Endpoints:</h3>
          <div className="text-sm text-green-800 space-y-1">
            <div><strong>Upload API:</strong> <code>/api/upload</code> - Handles file uploads with database storage</div>
            <div><strong>Messages API:</strong> <code>/api/messages</code> - Handles comment creation and retrieval</div>
            <div><strong>File Retrieval:</strong> Files are automatically fetched when the component loads</div>
          </div>
        </div>
      </div>
    </div>
  )
}