'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { 
  Image as ImageIcon, 
  Crop as CropIcon, 
  Check, 
  X, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scissors
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface RenderingImage {
  id: string
  url: string
  filename: string
}

interface CropFromRenderingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  renderingImages: RenderingImage[]
  onImageCropped: (imageUrl: string) => void
}

// Helper function to create a cropped image
async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  fileName: string
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  // Set canvas size to the cropped area (at original resolution)
  canvas.width = crop.width * scaleX
  canvas.height = crop.height * scaleY

  // Draw the cropped portion
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
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
      'image/jpeg',
      0.9
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
        width: 50,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export default function CropFromRenderingDialog({
  open,
  onOpenChange,
  renderingImages,
  onImageCropped
}: CropFromRenderingDialogProps) {
  const [step, setStep] = useState<'select' | 'crop'>('select')
  const [selectedImage, setSelectedImage] = useState<RenderingImage | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [saving, setSaving] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    // Start with a centered square crop
    setCrop(centerAspectCrop(width, height, 1))
  }, [])

  const handleSelectImage = (image: RenderingImage) => {
    setSelectedImage(image)
    setCrop(undefined)
    setCompletedCrop(undefined)
    setStep('crop')
  }

  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop || !selectedImage) {
      toast.error('Please select an area to crop')
      return
    }

    if (completedCrop.width < 10 || completedCrop.height < 10) {
      toast.error('Please select a larger area')
      return
    }

    try {
      setSaving(true)

      // Create the cropped image blob
      const croppedBlob = await getCroppedImg(
        imgRef.current,
        completedCrop,
        `cropped-${Date.now()}.jpg`
      )

      // Upload to the server
      const formData = new FormData()
      formData.append('file', croppedBlob, `cropped-${Date.now()}.jpg`)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          onImageCropped(data.url)
          onOpenChange(false)
          toast.success('Image cropped and saved!')
          
          // Reset state
          setStep('select')
          setSelectedImage(null)
          setCrop(undefined)
          setCompletedCrop(undefined)
        }
      } else {
        throw new Error('Failed to upload cropped image')
      }
    } catch (error) {
      console.error('Error cropping image:', error)
      toast.error('Failed to crop image')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after close
    setTimeout(() => {
      setStep('select')
      setSelectedImage(null)
      setCrop(undefined)
      setCompletedCrop(undefined)
    }, 200)
  }

  const handleBack = () => {
    setStep('select')
    setSelectedImage(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
  }

  // If there's only one image, skip to crop step
  const effectiveStep = renderingImages.length === 1 && !selectedImage 
    ? (() => {
        if (!selectedImage) {
          setSelectedImage(renderingImages[0])
        }
        return 'crop'
      })()
    : step

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-purple-600" />
            {step === 'select' ? 'Select Rendering to Crop' : 'Crop Image'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Step 1: Select Rendering (only if multiple) */}
          {step === 'select' && renderingImages.length > 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a 3D rendering to crop from:
              </p>
              <div className="grid grid-cols-2 gap-4">
                {renderingImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleSelectImage(img)}
                    className="group relative rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <img
                      src={img.url}
                      alt={img.filename}
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5">
                        <CropIcon className="w-4 h-4" />
                        Select
                      </div>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-white text-xs truncate">{img.filename}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Crop the selected image */}
          {(step === 'crop' || renderingImages.length === 1) && (selectedImage || renderingImages.length === 1) && (
            <div className="space-y-4">
              {renderingImages.length > 1 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to selection
                </button>
              )}
              
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-800">
                  <strong>Tip:</strong> Click and drag to select the area you want to use as the product image. 
                  You can resize by dragging the corners.
                </p>
              </div>

              <div className="flex justify-center bg-gray-100 rounded-lg p-4">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  className="max-h-[50vh]"
                >
                  <img
                    ref={imgRef}
                    src={selectedImage?.url || renderingImages[0]?.url}
                    alt="Rendering to crop"
                    onLoad={handleImageLoad}
                    className="max-h-[50vh] object-contain"
                    crossOrigin="anonymous"
                  />
                </ReactCrop>
              </div>

              {completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && (
                <div className="text-center text-sm text-gray-600">
                  Selection: {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} pixels
                </div>
              )}
            </div>
          )}

          {/* No renderings available */}
          {renderingImages.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No rendering images available</p>
              <p className="text-sm text-gray-400 mt-1">
                Upload renderings in the 3D Rendering phase first
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {(step === 'crop' || renderingImages.length === 1) && (
            <Button 
              onClick={handleCropComplete}
              disabled={saving || !completedCrop || completedCrop.width < 10}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Use Cropped Image
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

