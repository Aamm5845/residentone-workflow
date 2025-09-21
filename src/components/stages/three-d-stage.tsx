'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [uploadedAssets, setUploadedAssets] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch all assets for this stage
  const fetchStageAssets = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching assets for stage:', stage.id)
      
      const response = await fetch(`/api/stages/${stage.id}`)
      console.log('📡 API Response status:', response.status)
      
      if (response.ok) {
        const stageData = await response.json()
        console.log('📦 Full stage data:', stageData)
        
        // Get all assets from all design sections that have type RENDER or IMAGE
        const allAssets: any[] = []
        
        console.log('🗂️ Design sections found:', stageData.stage?.designSections?.length || 0)
        
        stageData.stage?.designSections?.forEach((section: any, sectionIndex: number) => {
          console.log(`📁 Section ${sectionIndex}:`, section.type, 'has', section.assets?.length || 0, 'assets')
          
          section.assets?.forEach((asset: any, assetIndex: number) => {
            console.log(`  📄 Asset ${assetIndex}:`, {
              id: asset.id,
              title: asset.title,
              type: asset.type,
              url: asset.url ? 'has URL' : 'NO URL'
            })
            
            if (asset.type === 'RENDER' || asset.type === 'IMAGE') {
              allAssets.push(asset)
              console.log('  ✅ Added to gallery')
            } else {
              console.log('  ❌ Skipped (wrong type)')
            }
          })
        })
        
        console.log('🎨 Total assets for gallery:', allAssets.length)
        
        // Sort by newest first
        allAssets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setUploadedAssets(allAssets)
      } else {
        const errorText = await response.text()
        console.error('❌ API Error:', response.status, errorText)
      }
    } catch (error) {
      console.error('💥 Error fetching stage assets:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch assets on component mount
  useEffect(() => {
    fetchStageAssets()
  }, [stage.id])

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
          // Remove the temporary asset and refresh from server
          setUploadedAssets(prev => prev.filter(a => a.id !== tempAsset.id))
          // Refresh all assets to get the latest data
          await fetchStageAssets()
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

  const handleDeleteAsset = async (assetId: string) => {
    if (!window.confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return
    }

    // Find the asset to remove
    const assetToRemove = uploadedAssets.find(a => a.id === assetId)
    if (!assetToRemove) return

    // Optimistically remove from UI
    const previousAssets = [...uploadedAssets]
    setUploadedAssets(prev => prev.filter(a => a.id !== assetId))

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete asset')
      }

      console.log('✅ Asset deleted successfully:', assetToRemove.title)
      // Refresh assets from server to ensure consistency
      await fetchStageAssets()
    } catch (error) {
      console.error('❌ Failed to delete asset:', error)
      // Restore the asset on error
      setUploadedAssets(previousAssets)
      alert('Failed to delete asset. Please try again.')
    }
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
        {/* Simplified Upload Area - Only show when no assets or when not loading */}
        {!loading && uploadedAssets.length === 0 && (
          <div className="mb-8">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Your 3D Renderings</h3>
              <p className="text-sm text-gray-600">Upload high-quality visualizations for client review</p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {/* Single Upload Interface */}
            <div 
              onClick={handleUploadClick}
              className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all duration-200"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-xl font-medium text-gray-700 mb-2">
                {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
              </h4>
              <p className="text-sm text-gray-500 mb-4">Supports JPG, PNG, PDF files up to 10MB each</p>
              <Button 
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Choose Files'}
              </Button>
            </div>
          </div>
        )}

        {/* Show Upload Button Above Gallery When Assets Exist */}
        {!loading && uploadedAssets.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">3D Renderings</h3>
              <Button 
                onClick={handleUploadClick} 
                disabled={uploading} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Add More'}
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
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Loading Renderings...</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm animate-pulse">
                  <div className="aspect-video bg-gray-200"></div>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Assets Gallery - Only show when have assets */}
        {!loading && uploadedAssets.length > 0 && (
          <div className="mb-8">
            <p className="text-sm text-gray-600 mb-4">{uploadedAssets.length} rendering{uploadedAssets.length !== 1 ? 's' : ''} uploaded</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uploadedAssets.map((asset) => (
                <div key={asset.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm group">
                  <div className="aspect-video bg-gray-100 relative">
                    {(asset.type === 'RENDER' || asset.type === 'IMAGE') && asset.url && (
                      <img
                        src={asset.url}
                        alt={asset.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Image failed to load:', asset.url)
                          console.log('Asset details:', asset)
                        }}
                      />
                    )}
                    {asset.uploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-white text-sm">Uploading...</div>
                      </div>
                    )}
                    {/* Delete Button - Only show when not uploading */}
                    {!asset.uploading && (
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="absolute top-2 right-2 bg-white/70 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        aria-label={`Delete ${asset.title}`}
                        title="Delete asset"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    <h5 className="font-medium text-gray-900 truncate">{asset.title}</h5>
                    <p className="text-sm text-gray-500 mt-1">3D Rendering • {new Date(asset.createdAt).toLocaleDateString()}</p>
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
