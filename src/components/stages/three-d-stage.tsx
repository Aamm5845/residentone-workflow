'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle, User, Calendar, Box, Upload, MessageSquare, AlertTriangle, X, Image as ImageIcon } from 'lucide-react'

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
  onComplete,
  onUploadFile 
}: ThreeDStageProps) {
  const [uploadedAssets, setUploadedAssets] = useState(stage.assets?.filter((a: any) => a.type === 'RENDER') || [])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Create a preview for immediate feedback
        const previewUrl = URL.createObjectURL(file)
        const tempAsset = {
          id: `temp-${Date.now()}`,
          title: file.name,
          url: previewUrl,
          type: 'RENDER',
          uploading: true
        }
        setUploadedAssets(prev => [...prev, tempAsset])

        // Upload file via API directly
        const formData = new FormData()
        formData.append('file', file)
        formData.append('sectionId', 'GENERAL') // Use GENERAL section for 3D uploads
        
        const response = await fetch(`/api/stages/${stage.id}/upload`, {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
          const result = await response.json()
          // Update the uploaded assets with the real asset data
          setUploadedAssets(prev => {
            const filtered = prev.filter(a => a.id !== tempAsset.id)
            return [...filtered, result.asset]
          })
        } else {
          // Remove temp asset on error
          setUploadedAssets(prev => prev.filter(a => a.id !== tempAsset.id))
          console.error('Upload failed')
        }
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Ensure this component only renders for THREE_D stages
  if (stage.type !== 'THREE_D') {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-500 mb-2">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-semibold">Invalid Stage Type</h3>
        </div>
        <p className="text-gray-600">3D Rendering Stage component can only be used for 3D Rendering phases.</p>
        <p className="text-sm text-gray-500 mt-1">Current stage type: {stage.type}</p>
      </div>
    )
  }
  
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
        {/* Upload Area */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">3D Renderings</h3>
              <p className="text-sm text-gray-600">Upload high-quality 3D visualizations for client review</p>
            </div>
            <Button onClick={handleUploadClick} disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Renderings'}
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {/* Upload dropzone */}
          <div 
            onClick={handleUploadClick}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
          >
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-700 mb-2">Drop files here or click to upload</h4>
            <p className="text-sm text-gray-500">Supports JPG, PNG, PDF files up to 10MB each</p>
          </div>
        </div>

        {/* Uploaded Assets Gallery */}
        {uploadedAssets.length > 0 && (
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-900 mb-4">
              Uploaded Renderings ({uploadedAssets.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uploadedAssets.map((asset) => (
                <div key={asset.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="aspect-video bg-gray-100 relative">
                    {asset.type === 'RENDER' && asset.url && (
                      <img
                        src={asset.url}
                        alt={asset.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {asset.uploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-white text-sm">Uploading...</div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h5 className="font-medium text-gray-900 truncate">{asset.title}</h5>
                    <p className="text-sm text-gray-500 mt-1">3D Rendering</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-2">📝 Instructions</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Upload your finalized 3D renderings and visualizations</li>
            <li>• Ensure images are high resolution for client presentation</li>
            <li>• Each upload automatically creates version v1 for Client Approval</li>
            <li>• Mark this stage complete when all renderings are uploaded</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
