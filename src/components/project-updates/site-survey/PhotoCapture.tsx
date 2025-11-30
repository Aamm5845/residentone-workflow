'use client'

import React, { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Camera, Upload, X, Image as ImageIcon, Loader2, MapPin, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface CapturedPhoto {
  id: string
  file: File
  preview: string
  caption: string
  notes: string
  tags: string[]
  roomId: string | null
  customArea: string
  tradeCategory: string | null
  gpsCoordinates?: { lat: number; lng: number }
  takenAt: Date
}

interface PhotoCaptureProps {
  photos: CapturedPhoto[]
  onPhotosChange: (photos: CapturedPhoto[]) => void
  maxPhotos?: number
  acceptedFormats?: string
  rooms?: Array<{ id: string; name: string; type?: string }>
}

export default function PhotoCapture({
  photos,
  onPhotosChange,
  maxPhotos = 50,
  acceptedFormats = 'image/jpeg,image/jpg,image/png,image/heic,image/webp,video/mp4,video/mov,video/quicktime,video/webm',
  rooms = []
}: PhotoCaptureProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const selectedPhoto = photos.find(p => p.id === selectedPhotoId)

  // Get current GPS location if available
  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | undefined> => {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
          },
          () => resolve(undefined),
          { timeout: 5000, maximumAge: 60000 }
        )
      } else {
        resolve(undefined)
      }
    })
  }

  const processFiles = async (files: FileList) => {
    const filesArray = Array.from(files)
    
    if (photos.length + filesArray.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed. You can upload ${maxPhotos - photos.length} more.`)
      return
    }

    const gpsCoords = await getCurrentLocation()

    const newPhotos: CapturedPhoto[] = await Promise.all(
      filesArray.map(async (file) => {
        const preview = URL.createObjectURL(file)
        return {
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview,
          caption: '',
          notes: '',
          tags: [],
          roomId: null,
          customArea: '',
          tradeCategory: null,
          gpsCoordinates: gpsCoords,
          takenAt: new Date()
        }
      })
    )

    onPhotosChange([...photos, ...newPhotos])
    
    // Auto-select first new photo
    if (newPhotos.length > 0 && !selectedPhotoId) {
      setSelectedPhotoId(newPhotos[0].id)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files)
      e.target.value = '' // Reset input
    }
  }

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCapturing(true)
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files)
      e.target.value = '' // Reset input
    }
    setIsCapturing(false)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files)
    }
  }, [photos, maxPhotos])

  const removePhoto = (photoId: string) => {
    const photo = photos.find(p => p.id === photoId)
    if (photo) {
      URL.revokeObjectURL(photo.preview)
    }
    onPhotosChange(photos.filter(p => p.id !== photoId))
    if (selectedPhotoId === photoId) {
      setSelectedPhotoId(null)
    }
  }

  const updatePhotoCaption = (photoId: string, caption: string) => {
    onPhotosChange(
      photos.map(p => p.id === photoId ? { ...p, caption } : p)
    )
  }

  const updatePhotoNotes = (photoId: string, notes: string) => {
    onPhotosChange(
      photos.map(p => p.id === photoId ? { ...p, notes } : p)
    )
  }

  const updatePhotoRoom = (photoId: string, roomId: string | null, customArea: string) => {
    onPhotosChange(
      photos.map(p => p.id === photoId ? { ...p, roomId, customArea: roomId ? '' : customArea } : p)
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 transition-all text-center",
          isDragging 
            ? "border-purple-500 bg-purple-50" 
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-purple-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {photos.length === 0 ? 'Add Photos & Videos' : `${photos.length} file${photos.length !== 1 ? 's' : ''} added`}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop photos or videos, or use the buttons below
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {photos.length < maxPhotos 
                ? `Up to ${maxPhotos - photos.length} more files` 
                : 'Maximum files reached'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Camera Button - Mobile optimized */}
            <Button
              type="button"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={photos.length >= maxPhotos || isCapturing}
              className="gap-2"
            >
              {isCapturing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Take Photo
                </>
              )}
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept={acceptedFormats}
              capture="environment"
              onChange={handleCameraCapture}
              className="hidden"
              multiple
            />

            {/* Upload Button */}
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photos.length >= maxPhotos}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4" />
              Upload Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFormats}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
          </div>
        </div>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Photos ({photos.length}/{maxPhotos})
            </h3>
            {photos.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Remove all ${photos.length} photos?`)) {
                    photos.forEach(p => URL.revokeObjectURL(p.preview))
                    onPhotosChange([])
                    setSelectedPhotoId(null)
                  }
                }}
                className="text-red-600 hover:text-red-700"
              >
                Clear All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map((photo) => (
              <Card
                key={photo.id}
                className={cn(
                  "group relative cursor-pointer transition-all hover:shadow-lg",
                  selectedPhotoId === photo.id && "ring-2 ring-purple-500"
                )}
                onClick={() => setSelectedPhotoId(photo.id)}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-square">
                    {photo.file.type.startsWith('video/') ? (
                      <div className="w-full h-full bg-gray-900 rounded-t-lg flex items-center justify-center relative">
                        <video
                          src={photo.preview}
                          className="w-full h-full object-cover rounded-t-lg"
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                            <Video className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Image
                        src={photo.preview}
                        alt={photo.caption || 'Photo'}
                        fill
                        className="object-cover rounded-t-lg"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    )}
                    
                    {/* Remove button */}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        removePhoto(photo.id)
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>

                    {/* Video indicator */}
                    {photo.file.type.startsWith('video/') && (
                      <div className="absolute top-1 left-1">
                        <Badge variant="secondary" className="text-xs bg-purple-500 text-white">
                          <Video className="w-2 h-2 mr-1" />
                          Video
                        </Badge>
                      </div>
                    )}

                    {/* GPS indicator */}
                    {photo.gpsCoordinates && (
                      <div className="absolute bottom-1 left-1">
                        <Badge variant="secondary" className="text-xs bg-white/80 backdrop-blur">
                          <MapPin className="w-2 h-2 mr-1" />
                          GPS
                        </Badge>
                      </div>
                    )}

                    {/* Tag count */}
                    {photo.tags.length > 0 && (
                      <div className="absolute bottom-1 right-1">
                        <Badge variant="secondary" className="text-xs bg-white/80 backdrop-blur">
                          {photo.tags.length} tag{photo.tags.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-2 space-y-1">
                    <p className="text-xs text-gray-500 truncate">
                      {formatFileSize(photo.file.size)}
                    </p>
                    {photo.caption && (
                      <p className="text-xs text-gray-700 truncate font-medium">
                        {photo.caption}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Selected Photo Details */}
      {selectedPhoto && (
        <Card className="border-purple-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Photo Details</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPhotoId(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Caption</label>
                <Input
                  placeholder="Add a caption for this photo..."
                  value={selectedPhoto.caption}
                  onChange={(e) => updatePhotoCaption(selectedPhoto.id, e.target.value)}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <Textarea
                  placeholder="Add detailed notes about this photo..."
                  value={selectedPhoto.notes}
                  onChange={(e) => updatePhotoNotes(selectedPhoto.id, e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>

              {rooms.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Room / Area</label>
                  <select
                    value={selectedPhoto.roomId || 'general'}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === 'general') {
                        updatePhotoRoom(selectedPhoto.id, null, 'General')
                      } else {
                        updatePhotoRoom(selectedPhoto.id, value, '')
                      }
                    }}
                    className="w-full text-sm border rounded-md px-3 py-2"
                  >
                    <option value="general">General</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Size:</span> {formatFileSize(selectedPhoto.file.size)}
                </div>
                <div>
                  <span className="font-medium">Type:</span> {selectedPhoto.file.type.split('/')[1].toUpperCase()}
                </div>
                {selectedPhoto.gpsCoordinates && (
                  <>
                    <div className="col-span-2">
                      <span className="font-medium">Location:</span>{' '}
                      {selectedPhoto.gpsCoordinates.lat.toFixed(6)}, {selectedPhoto.gpsCoordinates.lng.toFixed(6)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
