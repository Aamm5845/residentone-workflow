'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { 
  Crop as CropIcon, 
  Sparkles,
  Check, 
  X, 
  Loader2,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ImageEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  imageTitle?: string
  onImageUpdated?: (newImageUrl: string) => void
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

export default function ImageEditorModal({
  open,
  onOpenChange,
  imageUrl,
  imageTitle,
  onImageUpdated
}: ImageEditorModalProps) {
  const [mode, setMode] = useState<'view' | 'crop'>('view')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [saving, setSaving] = useState(false)
  const [removingBackground, setRemovingBackground] = useState(false)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [corsProxyUrl, setCorsProxyUrl] = useState<string | null>(null)
  const [loadingProxy, setLoadingProxy] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Get the current display URL (processed or original, with CORS proxy fallback)
  const displayUrl = corsProxyUrl || processedImageUrl || imageUrl

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (mode === 'crop') {
      const { width, height } = e.currentTarget
      // Start with a centered square crop
      setCrop(centerAspectCrop(width, height, 1))
    }
  }, [mode])

  const handleStartCrop = async () => {
    setCrop(undefined)
    setCompletedCrop(undefined)

    // For cross-origin images, fetch and create a local blob URL to avoid tainted canvas
    const urlToFetch = processedImageUrl || imageUrl
    if (urlToFetch && !urlToFetch.startsWith('blob:') && !urlToFetch.startsWith('data:')) {
      setLoadingProxy(true)
      try {
        // Fetch the image through our proxy to avoid CORS issues
        const response = await fetch(`/api/image/proxy?url=${encodeURIComponent(urlToFetch)}`)
        if (response.ok) {
          const blob = await response.blob()
          const blobUrl = URL.createObjectURL(blob)
          setCorsProxyUrl(blobUrl)
        }
      } catch (error) {
        console.warn('Could not proxy image, will try direct load:', error)
      } finally {
        setLoadingProxy(false)
      }
    }
    setMode('crop')
  }

  const handleCancelCrop = () => {
    setMode('view')
    setCrop(undefined)
    setCompletedCrop(undefined)
    // Clean up blob URL
    if (corsProxyUrl) {
      URL.revokeObjectURL(corsProxyUrl)
      setCorsProxyUrl(null)
    }
  }

  const handleCropComplete = async () => {
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

      // Create the cropped image blob
      const croppedBlob = await getCroppedImg(
        imgRef.current,
        completedCrop,
        `cropped-${Date.now()}.jpg`
      )

      // Upload to the server with spec-item type for instant CDN loading
      const formData = new FormData()
      formData.append('file', croppedBlob, `cropped-${Date.now()}.jpg`)
      formData.append('imageType', 'spec-item')

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          setProcessedImageUrl(data.url)
          onImageUpdated?.(data.url)
          setMode('view')
          toast.success('Image cropped successfully!')
        }
      } else {
        throw new Error('Failed to upload cropped image')
      }
    } catch (error) {
      console.error('Error cropping image:', error)
      toast.error('Failed to crop image')
    } finally {
      setSaving(false)
      setCrop(undefined)
      setCompletedCrop(undefined)
      // Clean up blob URL
      if (corsProxyUrl) {
        URL.revokeObjectURL(corsProxyUrl)
        setCorsProxyUrl(null)
      }
    }
  }

  const handleRemoveBackground = async () => {
    try {
      setRemovingBackground(true)
      
      const formData = new FormData()
      formData.append('imageUrl', displayUrl)

      const response = await fetch('/api/image/remove-background', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setProcessedImageUrl(data.url)
        onImageUpdated?.(data.url)
        toast.success('Background removed successfully!')
      } else {
        throw new Error(data.message || 'Failed to remove background')
      }
    } catch (error) {
      console.error('Error removing background:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove background')
    } finally {
      setRemovingBackground(false)
    }
  }

  const handleReset = () => {
    setProcessedImageUrl(null)
    setMode('view')
    setCrop(undefined)
    setCompletedCrop(undefined)
    // Clean up blob URL
    if (corsProxyUrl) {
      URL.revokeObjectURL(corsProxyUrl)
      setCorsProxyUrl(null)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Clean up blob URL
    if (corsProxyUrl) {
      URL.revokeObjectURL(corsProxyUrl)
    }
    // Reset state after close animation
    setTimeout(() => {
      setMode('view')
      setCrop(undefined)
      setCompletedCrop(undefined)
      setProcessedImageUrl(null)
      setCorsProxyUrl(null)
      setImageError(false)
    }, 200)
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(displayUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = imageTitle || 'image.jpg'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Image downloaded!')
    } catch (error) {
      console.error('Error downloading image:', error)
      toast.error('Failed to download image')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white pr-12">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {imageTitle || 'Image Editor'}
            </h2>
            {processedImageUrl && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                Edited
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-50 border-b">
          {mode === 'view' ? (
            <>
              <Button
                variant="outline"
                onClick={handleStartCrop}
                disabled={saving || removingBackground || loadingProxy}
                className="gap-2"
              >
                {loadingProxy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CropIcon className="w-4 h-4" />
                    Crop Image
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleRemoveBackground}
                disabled={saving || removingBackground}
                className="gap-2"
              >
                {removingBackground ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Remove Background
                  </>
                )}
              </Button>
              {processedImageUrl && (
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  disabled={saving || removingBackground}
                  className="gap-2 text-gray-600"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={handleCancelCrop}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropComplete}
                disabled={saving || !completedCrop || completedCrop.width < 10}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply Crop
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-auto bg-gray-900 flex items-center justify-center p-4 min-h-[400px]">
          {imageError ? (
            <div className="flex flex-col items-center justify-center text-gray-400 gap-3">
              <div className="w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center">
                <X className="w-12 h-12 text-gray-600" />
              </div>
              <p className="text-sm">Unable to load image</p>
              <p className="text-xs text-gray-500 max-w-md text-center break-all">{displayUrl}</p>
            </div>
          ) : mode === 'crop' ? (
            <div className="max-w-full max-h-full">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-h-[60vh]"
              >
                <img
                  ref={imgRef}
                  src={displayUrl}
                  alt={imageTitle || 'Image to edit'}
                  onLoad={handleImageLoad}
                  onError={() => setImageError(true)}
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </ReactCrop>
            </div>
          ) : (
            <img
              src={displayUrl}
              alt={imageTitle || 'Image'}
              onError={() => setImageError(true)}
              className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
          )}
        </div>

        {/* Footer with crop info */}
        {mode === 'crop' && completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && (
          <div className="px-6 py-3 bg-white border-t text-center">
            <p className="text-sm text-gray-600">
              Selection: <span className="font-medium">{Math.round(completedCrop.width)} × {Math.round(completedCrop.height)}</span> pixels
            </p>
          </div>
        )}

        {mode === 'view' && (
          <div className="flex items-center justify-end gap-2 px-6 py-3 bg-white border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="gap-2 text-gray-600"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

