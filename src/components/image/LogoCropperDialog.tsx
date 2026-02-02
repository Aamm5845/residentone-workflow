'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Check, X, Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface LogoCropperDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageFile: File | null
  onCropComplete: (croppedBlob: Blob) => void
}

// Helper function to create a cropped image
async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  scale: number = 1
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  // Output size (square logo, max 400x400)
  const outputSize = Math.min(400, crop.width * scaleX, crop.height * scaleY)
  canvas.width = outputSize
  canvas.height = outputSize

  // Draw the cropped portion
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputSize,
    outputSize
  )

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        resolve(blob)
      },
      'image/png',
      0.95
    )
  })
}

// Helper to center crop on image load
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export default function LogoCropperDialog({
  open,
  onOpenChange,
  imageFile,
  onCropComplete
}: LogoCropperDialogProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [saving, setSaving] = useState(false)
  const [scale, setScale] = useState(1)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Load image when file changes
  useState(() => {
    if (imageFile && open) {
      const url = URL.createObjectURL(imageFile)
      setImageUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  })

  // Reset when dialog opens with new file
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && imageFile) {
      const url = URL.createObjectURL(imageFile)
      setImageUrl(url)
      setScale(1)
      setCrop(undefined)
      setCompletedCrop(undefined)
    } else if (!isOpen) {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      setImageUrl(null)
      setScale(1)
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
    onOpenChange(isOpen)
  }

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    // Start with a centered square crop
    setCrop(centerAspectCrop(width, height, 1))
  }, [])

  const handleSave = async () => {
    if (!imgRef.current || !completedCrop) {
      toast.error('Please select an area to crop')
      return
    }

    if (completedCrop.width < 10 || completedCrop.height < 10) {
      toast.error('Please select a larger area')
      return
    }

    try {
      setSaving(true)
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop, scale)
      onCropComplete(croppedBlob)
      handleOpenChange(false)
      toast.success('Logo cropped successfully!')
    } catch (error) {
      console.error('Error cropping image:', error)
      toast.error('Failed to crop image')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Crop Logo
          </DialogTitle>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4 min-h-[300px]">
          {imageUrl && (
            <div
              className="relative"
              style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
            >
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop={false}
                className="max-h-[50vh]"
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Logo to crop"
                  onLoad={handleImageLoad}
                  className="max-h-[50vh] max-w-full object-contain"
                  style={{ maxWidth: '100%' }}
                />
              </ReactCrop>
            </div>
          )}
        </div>

        {/* Zoom Control */}
        <div className="px-6 py-4 bg-gray-50 border-t">
          <div className="flex items-center gap-4">
            <ZoomOut className="w-4 h-4 text-gray-500" />
            <input
              type="range"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              min={0.5}
              max={2}
              step={0.1}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <ZoomIn className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 w-12 text-right">{Math.round(scale * 100)}%</span>
          </div>
        </div>

        {/* Preview & Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t gap-4">
          {/* Preview circle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Preview:</span>
            <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center">
              {imageUrl && completedCrop && completedCrop.width > 0 && (
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundPosition: `${-completedCrop.x * (48 / completedCrop.width)}px ${-completedCrop.y * (48 / completedCrop.height)}px`,
                    backgroundSize: `${(imgRef.current?.width || 100) * (48 / completedCrop.width)}px`
                  }}
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !completedCrop || completedCrop.width < 10}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Logo
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
