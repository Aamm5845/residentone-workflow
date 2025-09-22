'use client'

import { useState } from 'react'
import { generateMeisnerDeliveryEmailTemplate } from '@/lib/email-templates'

export default function EmailDemoPage() {
  const [previewHtml, setPreviewHtml] = useState('')
  const [layoutType, setLayoutType] = useState<'single' | 'multiple'>('multiple')

  const generatePreview = () => {
    const singleImageMockData = {
      clientName: 'Sarah Johnson',
      projectName: 'Modern Living Space',
      roomName: 'Boys Room',
      designPhase: 'Design Showcase',
      projectAddress: '123 Park Avenue, New York, NY',
      approvalUrl: '', // Not used in new template
      trackingPixelUrl: 'https://residentone.com/track/demo',
      assets: [
        {
          id: '1',
          url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=800&q=80',
          includeInEmail: true
        }
      ]
    }

    const multipleImageMockData = {
      clientName: 'Aaron & Family',
      projectName: 'Family Home Renovation',
      roomName: 'Living Room',
      designPhase: 'Design Showcase',
      projectAddress: '456 Maple Street, Toronto, ON',
      approvalUrl: '', // Not used in new template
      trackingPixelUrl: 'https://residentone.com/track/demo',
      assets: [
        {
          id: '1',
          url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600&q=80',
          includeInEmail: true
        },
        {
          id: '2', 
          url: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600&q=80',
          includeInEmail: true
        },
        {
          id: '3',
          url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600&q=80',
          includeInEmail: true
        },
        {
          id: '4',
          url: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600&q=80',
          includeInEmail: true
        }
      ]
    }

    const mockData = layoutType === 'single' ? singleImageMockData : multipleImageMockData

    const { html } = generateMeisnerDeliveryEmailTemplate(mockData)
    setPreviewHtml(html)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🎨 Meisner Interiors - Email System Demo
          </h1>
          
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">✨ New Email Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Modern luxury-branded email template</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Informational-only design (no approval buttons)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Beautiful rendering showcase</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Single hero image or grid layouts</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Download All Renderings button</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Professional, classy, not black design</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Email tracking & analytics</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">ZIP file generation for downloads</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
              <h2 className="text-xl font-semibold text-amber-900 mb-4">🚀 How to Use</h2>
              <ol className="list-decimal list-inside space-y-2 text-amber-800">
                <li>Go to any Client Approval stage in your workflow</li>
                <li>Click "Preview Email" to see how the email will look</li>
                <li>Click "Send Test Email" to send a test to yourself</li>
                <li>Use "Send to Client" to send the actual approval email</li>
                <li>View email analytics in the sidebar after sending</li>
              </ol>
            </div>

            <div className="text-center space-y-4">
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={() => setLayoutType('single')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    layoutType === 'single'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🇫 Single Hero Image
                </button>
                <button
                  onClick={() => setLayoutType('multiple')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    layoutType === 'multiple'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🖼️ Multiple Images Grid
                </button>
              </div>
              <button
                onClick={generatePreview}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                🎨 Generate Email Preview ({layoutType === 'single' ? 'Hero Layout' : 'Grid Layout'})
              </button>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        {previewHtml && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
              <p className="text-sm text-gray-600 mt-1">
                This is how the email will appear to your clients
              </p>
            </div>
            <div className="p-6">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-screen border border-gray-200 rounded-lg"
                title="Email Preview"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}