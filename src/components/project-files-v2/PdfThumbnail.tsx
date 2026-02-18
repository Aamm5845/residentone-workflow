'use client'

import { memo, useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface PdfThumbnailProps {
  url: string
  width?: number
  className?: string
}

function PdfThumbnailInner({ url, width = 280, className }: PdfThumbnailProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  // Measure the actual container width for responsive rendering
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const renderWidth = containerWidth > 0 ? containerWidth : width
  // Render at 2x for crisp display on retina screens
  const scale = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-50', className)}>
        <FileText className="w-12 h-12 text-red-300" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden bg-white', className)}>
      {/* Loading skeleton */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-50 animate-pulse flex items-center justify-center z-10">
          <FileText className="w-10 h-10 text-gray-300" />
        </div>
      )}
      <Document
        file={url}
        loading={null}
        error={null}
        onLoadSuccess={() => setLoaded(true)}
        onLoadError={() => setError(true)}
      >
        <Page
          pageNumber={1}
          width={renderWidth}
          scale={scale}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={null}
          className="[&_canvas]:!w-full [&_canvas]:!h-auto"
        />
      </Document>
    </div>
  )
}

export default memo(PdfThumbnailInner)
