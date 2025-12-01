'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle2, Camera, ArrowLeft } from 'lucide-react'
import PhotoCapture, { CapturedPhoto } from './PhotoCapture'
import RoomTagger, { Room } from './RoomTagger'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SiteSurveyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  rooms: Room[]
  onSuccess?: () => void
}

interface PhotoUploadResult {
  photoId: string
  success: boolean
  error?: string
}

export default function SiteSurveyDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  rooms,
  onSuccess
}: SiteSurveyDialogProps) {
  const router = useRouter()
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<PhotoUploadResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'photos' | 'batch-tag'>('photos')
  
  // Batch tagging state
  const [batchRoom, setBatchRoom] = useState<string | null>(null)
  const [batchTags, setBatchTags] = useState<string[]>([])
  const [batchTradeCategory, setBatchTradeCategory] = useState<string | null>(null)
  const [batchCustomArea, setBatchCustomArea] = useState('')
  
  // Survey metadata - default title with today's date
  const [updateTitle, setUpdateTitle] = useState(`Site Survey - ${new Date().toLocaleDateString()}`)
  const [updateDescription, setUpdateDescription] = useState('')

  const handleApplyBatchTags = () => {
    const updatedPhotos = photos.map(photo => ({
      ...photo,
      roomId: batchRoom || photo.roomId,
      tags: batchTags.length > 0 ? [...new Set([...photo.tags, ...batchTags])] : photo.tags,
      tradeCategory: batchTradeCategory || photo.tradeCategory,
      customArea: batchCustomArea || photo.customArea
    }))
    setPhotos(updatedPhotos)
    setActiveTab('photos')
  }

  const handleUpload = async () => {
    if (photos.length === 0) {
      setError('Please add at least one photo')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadResults([])
    setUploadProgress(0)

    try {
      // Step 1: Create the update (marked as internal so it doesn't show in Recent Updates feed)
      const updateResponse = await fetch(`/api/projects/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PHOTO',
          category: 'PROGRESS',
          priority: 'MEDIUM',
          title: updateTitle || `Site Survey - ${new Date().toLocaleDateString()}`,
          description: updateDescription || `${photos.length} photo${photos.length > 1 ? 's' : ''} from site survey`,
          metadata: { isInternal: true } // Flag as internal - won't show in Recent Updates feed
        })
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create update')
      }

      const update = await updateResponse.json()

      // Step 2: Upload photos with metadata
      const results: PhotoUploadResult[] = []
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        
        try {
          const formData = new FormData()
          formData.append('file', photo.file)
          formData.append('projectId', projectId)
          formData.append('updateId', update.id)
          formData.append('caption', photo.caption)
          formData.append('notes', photo.notes)
          formData.append('tags', JSON.stringify(photo.tags))
          
          if (photo.roomId) {
            formData.append('roomId', photo.roomId)
          }
          if (photo.customArea) {
            formData.append('customArea', photo.customArea)
          }
          if (photo.tradeCategory) {
            formData.append('tradeCategory', photo.tradeCategory)
          }
          if (photo.gpsCoordinates) {
            formData.append('gpsCoordinates', JSON.stringify(photo.gpsCoordinates))
          }
          formData.append('takenAt', photo.takenAt.toISOString())

          const response = await fetch(`/api/projects/${projectId}/updates/${update.id}/survey-photos`, {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to upload photo ${i + 1}`)
          }

          results.push({
            photoId: photo.id,
            success: true
          })
        } catch (err) {
          results.push({
            photoId: photo.id,
            success: false,
            error: err instanceof Error ? err.message : 'Upload failed'
          })
        }

        // Update progress
        setUploadProgress(((i + 1) / photos.length) * 100)
        setUploadResults([...results])
      }

      // Check if all uploads succeeded
      const allSuccess = results.every(r => r.success)
      
      if (allSuccess) {
        // Clean up photo previews
        photos.forEach(p => URL.revokeObjectURL(p.preview))
        
        // Success!
        onSuccess?.()
        router.refresh()
        
        // Close dialog after a brief delay
        setTimeout(() => {
          onOpenChange(false)
          // Reset state
          setPhotos([])
          setUpdateTitle(`Site Survey - ${new Date().toLocaleDateString()}`)
          setUpdateDescription('')
          setBatchRoom(null)
          setBatchTags([])
          setBatchTradeCategory(null)
          setBatchCustomArea('')
        }, 1000)
      } else {
        const failedCount = results.filter(r => !r.success).length
        setError(`${failedCount} photo${failedCount > 1 ? 's' : ''} failed to upload. Please try again.`)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload survey')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (isUploading) return
    
    if (photos.length > 0) {
      if (confirm('You have unsaved photos. Are you sure you want to close?')) {
        photos.forEach(p => URL.revokeObjectURL(p.preview))
        setPhotos([])
        onOpenChange(false)
      }
    } else {
      onOpenChange(false)
    }
  }

  const successCount = uploadResults.filter(r => r.success).length
  const failCount = uploadResults.filter(r => !r.success).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Camera className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl">On-Site Survey</DialogTitle>
              <DialogDescription>
                {projectName} • Upload and tag photos & videos from the job site
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Upload Status */}
            {isUploading && (
              <Alert>
                <Loader2 className="w-4 h-4 animate-spin" />
                <AlertDescription>
                  Uploading files to Dropbox... {successCount} of {photos.length} uploaded
                </AlertDescription>
                <Progress value={uploadProgress} className="mt-2" />
              </Alert>
            )}

            {/* Success Message */}
            {!isUploading && uploadResults.length > 0 && failCount === 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  All {successCount} files uploaded successfully!
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Survey Metadata */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="update-title">Survey Title</Label>
                <Input
                  id="update-title"
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  disabled={isUploading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="update-description">Notes (Optional)</Label>
                <Textarea
                  id="update-description"
                  placeholder="Add any notes about this survey..."
                  value={updateDescription}
                  onChange={(e) => setUpdateDescription(e.target.value)}
                  rows={2}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'photos' | 'batch-tag')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="photos">
                  Photos {photos.length > 0 && `(${photos.length})`}
                </TabsTrigger>
                <TabsTrigger value="batch-tag" disabled={photos.length === 0}>
                  Batch Tag {photos.length > 0 && `${photos.length} photos`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="photos" className="mt-6">
                <PhotoCapture
                  photos={photos}
                  onPhotosChange={setPhotos}
                  maxPhotos={50}
                  rooms={rooms}
                />
              </TabsContent>

              <TabsContent value="batch-tag" className="mt-6 space-y-6">
                <Alert>
                  <AlertDescription>
                    Apply tags, room, and trade category to all {photos.length} photos at once
                  </AlertDescription>
                </Alert>

                <RoomTagger
                  rooms={rooms}
                  selectedRoom={batchRoom}
                  selectedTags={batchTags}
                  selectedTradeCategory={batchTradeCategory}
                  customArea={batchCustomArea}
                  onRoomChange={setBatchRoom}
                  onTagsChange={setBatchTags}
                  onTradeCategoryChange={setBatchTradeCategory}
                  onCustomAreaChange={setBatchCustomArea}
                />

                <Button
                  onClick={handleApplyBatchTags}
                  className="w-full"
                  size="lg"
                >
                  Apply to All Photos
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-600">
              {photos.length > 0 ? (
                <span>{photos.length} file{photos.length !== 1 ? 's' : ''} ready to upload</span>
              ) : (
                <span>No files added yet</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isUploading}
              >
                {photos.length > 0 ? 'Cancel' : 'Close'}
              </Button>
              <Button
                onClick={handleUpload}
                disabled={photos.length === 0 || isUploading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading {successCount}/{photos.length}
                  </>
                ) : (
                  <>Upload {photos.length} File{photos.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
