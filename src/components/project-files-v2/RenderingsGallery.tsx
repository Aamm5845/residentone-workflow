'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import useSWR from 'swr'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenderingAsset {
  id: string
  title: string
  filename: string | null
  url: string
  size: number | null
  mimeType: string | null
  createdAt: string
  roomName: string | null
  version: string
  customName: string | null
  pushedToClientAt: string | null
}

interface RenderingsResponse {
  success: boolean
  rooms: Array<{
    roomId: string
    roomName: string | null
  }>
  allAssets: RenderingAsset[]
  total: number
  error?: string
}

interface RenderingsGalleryProps {
  projectId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then(res => res.json())

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '--'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '--'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RenderingsGallery({ projectId }: RenderingsGalleryProps) {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Zoom state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const apiUrl = `/api/projects/${projectId}/project-files-v2/renderings`
  const { data, isLoading, error } = useSWR<RenderingsResponse>(apiUrl, fetcher)

  const allAssets = data?.allAssets ?? []
  const rooms = data?.rooms ?? []
  const total = data?.total ?? 0

  // Filter by selected room
  const filteredAssets = useMemo(() => {
    if (!selectedRoom) return allAssets
    return allAssets.filter(a => a.roomName === selectedRoom)
  }, [allAssets, selectedRoom])

  // Unique room names for filter chips
  const roomNames = useMemo(() => {
    const names = new Set<string>()
    for (const asset of allAssets) {
      if (asset.roomName) names.add(asset.roomName)
    }
    return Array.from(names).sort()
  }, [allAssets])

  // Reset zoom when switching images
  const resetZoom = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Lightbox
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
    resetZoom()
  }, [resetZoom])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
    resetZoom()
  }, [resetZoom])

  const goToNext = useCallback(() => {
    if (lightboxIndex !== null && lightboxIndex < filteredAssets.length - 1) {
      setLightboxIndex(lightboxIndex + 1)
      resetZoom()
    }
  }, [lightboxIndex, filteredAssets.length, resetZoom])

  const goToPrev = useCallback(() => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1)
      resetZoom()
    }
  }, [lightboxIndex, resetZoom])

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.5, 4))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(z => {
      const newZ = Math.max(z - 0.5, 1)
      if (newZ === 1) setPan({ x: 0, y: 0 })
      return newZ
    })
  }, [])

  const handleResetZoom = useCallback(() => {
    resetZoom()
  }, [resetZoom])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.25 : 0.25
    setZoom(z => {
      const newZ = Math.min(Math.max(z + delta, 1), 4)
      if (newZ === 1) setPan({ x: 0, y: 0 })
      return newZ
    })
  }, [])

  // Pan with mouse drag when zoomed
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsPanning(true)
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [zoom, pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy })
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback(() => {
    if (zoom > 1) {
      resetZoom()
    } else {
      setZoom(2)
    }
  }, [zoom, resetZoom])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext()
      else if (e.key === 'ArrowLeft') goToPrev()
      else if (e.key === 'Escape') closeLightbox()
      else if (e.key === '+' || e.key === '=') handleZoomIn()
      else if (e.key === '-') handleZoomOut()
      else if (e.key === '0') handleResetZoom()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, goToNext, goToPrev, closeLightbox, handleZoomIn, handleZoomOut, handleResetZoom])

  // Loading
  if (isLoading) {
    return <RenderingsSkeleton />
  }

  // Error
  if (error || (data && !data.success)) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ImageIcon className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Could not load renderings</h3>
        <p className="text-sm text-slate-500">{data?.error || 'An error occurred.'}</p>
      </div>
    )
  }

  // Empty
  if (allAssets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ImageIcon className="h-5 w-5 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">No renderings yet</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          3D renderings will appear here once they are pushed to the client from the rendering workspace.
        </p>
      </div>
    )
  }

  const lightboxAsset = lightboxIndex !== null ? filteredAssets[lightboxIndex] : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-slate-900">
            Renderings
            <span className="ml-1.5 text-xs text-slate-400 font-normal">({total})</span>
          </h3>
        </div>
      </div>

      {/* Room filter chips */}
      {roomNames.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSelectedRoom(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              !selectedRoom
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            All Rooms
          </button>
          {roomNames.map((name) => (
            <button
              key={name}
              onClick={() => setSelectedRoom(name)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                selectedRoom === name
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Rendering grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredAssets.map((asset, index) => (
          <div
            key={asset.id}
            className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all hover:shadow-md"
          >
            <button
              onClick={() => openLightbox(index)}
              className="w-full h-full"
            >
              <img
                src={asset.url}
                alt={asset.title || asset.filename || 'Rendering'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-xs text-white font-medium truncate">
                    {asset.title || asset.filename || 'Rendering'}
                  </p>
                  <p className="text-[10px] text-white/70">
                    {asset.roomName && `${asset.roomName} \u00B7 `}{asset.customName || asset.version}
                  </p>
                </div>
              </div>
            </button>

            {/* Room badge */}
            {asset.roomName && !selectedRoom && (
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium backdrop-blur-sm pointer-events-none">
                {asset.roomName}
              </div>
            )}

            {/* Version badge */}
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium backdrop-blur-sm pointer-events-none">
              {asset.customName || asset.version}
            </div>
          </div>
        ))}
      </div>

      {/* Filtered empty */}
      {selectedRoom && filteredAssets.length === 0 && (
        <div className="py-12 text-center">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No renderings in this room</p>
          <button
            onClick={() => setSelectedRoom(null)}
            className="text-sm text-slate-600 hover:text-slate-900 mt-2 underline"
          >
            View all rooms
          </button>
        </div>
      )}

      {/* Lightbox Dialog */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => { if (!open) closeLightbox() }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 gap-0 bg-black border-none overflow-hidden [&>button]:hidden">
          {lightboxAsset && (
            <div className="relative w-full h-full flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {lightboxAsset.title || lightboxAsset.filename || 'Rendering'}
                  </p>
                  <p className="text-xs text-white/50">
                    {lightboxAsset.roomName && `${lightboxAsset.roomName} \u00B7 `}
                    {lightboxAsset.customName || lightboxAsset.version}
                    {lightboxAsset.pushedToClientAt && ` \u00B7 ${formatDate(lightboxAsset.pushedToClientAt)}`}
                    {lightboxAsset.size ? ` \u00B7 ${formatFileSize(lightboxAsset.size)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Zoom controls */}
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 1}
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Zoom out (−)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-white/50 min-w-[3rem] text-center tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 4}
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Zoom in (+)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    title="Reset zoom (0)"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-white/20 mx-1" />

                  <a
                    href={lightboxAsset.url}
                    download={lightboxAsset.filename || lightboxAsset.title || 'rendering.jpg'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={closeLightbox}
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    title="Close (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Image with zoom + pan */}
              <div
                ref={imageContainerRef}
                className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden select-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
              >
                <img
                  src={lightboxAsset.url}
                  alt={lightboxAsset.title || 'Rendering'}
                  className="max-w-full max-h-full object-contain transition-transform duration-100"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center center',
                  }}
                  draggable={false}
                />

                {/* Prev/Next arrows */}
                {lightboxIndex !== null && lightboxIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goToPrev() }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {lightboxIndex !== null && lightboxIndex < filteredAssets.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goToNext() }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Bottom counter */}
              <div className="text-center py-2 bg-black/80 shrink-0">
                <span className="text-xs text-white/50">
                  {(lightboxIndex ?? 0) + 1} of {filteredAssets.length}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RenderingsSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-5 bg-slate-200 rounded w-24 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
