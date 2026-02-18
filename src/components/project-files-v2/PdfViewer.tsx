'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
  Minimize2,
  FileText,
  Info,
  Search,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Ensure PDF worker is configured
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PdfFile {
  id: string
  name: string
  path: string
  size: number
  lastModified: string
  thumbnailUrl?: string
}

interface PdfViewerProps {
  /** The currently selected PDF */
  file: PdfFile
  /** All PDF files in the same folder (for sidebar navigation) */
  allPdfFiles: PdfFile[]
  /** Called when user selects a different PDF from the sidebar */
  onSelectFile: (file: PdfFile) => void
  /** Called to close the viewer */
  onClose: () => void
  /** Called to download the file */
  onDownload: (file: PdfFile) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

// ---------------------------------------------------------------------------
// Sidebar Thumbnail (small PDF preview for sidebar list)
// ---------------------------------------------------------------------------

const SidebarThumb = memo(function SidebarThumb({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <FileText className="w-5 h-5 text-gray-300" />
      </div>
    )
  }

  return (
    <div className="w-full h-full relative bg-white overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-300" />
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
          width={56}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={null}
        />
      </Document>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PdfViewer({
  file,
  allPdfFiles,
  onSelectFile,
  onClose,
  onDownload,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showProperties, setShowProperties] = useState(true)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const viewerRef = useRef<HTMLDivElement>(null)
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 })

  // Measure the viewer area
  useEffect(() => {
    if (!viewerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(viewerRef.current)
    return () => observer.disconnect()
  }, [])

  // Reset state when file changes
  useEffect(() => {
    setPageNumber(1)
    setZoom(1)
    setRotation(0)
    setLoading(true)
    setNumPages(0)
  }, [file.id])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && pageNumber > 1) setPageNumber((p) => p - 1)
      if (e.key === 'ArrowRight' && pageNumber < numPages) setPageNumber((p) => p + 1)
      if (e.key === '+' || (e.ctrlKey && e.key === '=')) { e.preventDefault(); zoomIn() }
      if (e.key === '-' || (e.ctrlKey && e.key === '-')) { e.preventDefault(); zoomOut() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pageNumber, numPages, onClose])

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total)
    setLoading(false)
  }, [])

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 4))
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25))
  const resetZoom = () => setZoom(1)
  const rotate = () => setRotation((r) => (r + 90) % 360)

  // Calculate the page width to fit in the viewer
  const pageWidth = viewerSize.width > 0
    ? Math.max((viewerSize.width - 80) * zoom, 200)
    : 800 * zoom

  // Filter sidebar PDFs
  const filteredPdfs = sidebarSearch
    ? allPdfFiles.filter((f) => f.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : allPdfFiles

  // Current file index
  const currentIndex = allPdfFiles.findIndex((f) => f.id === file.id)

  const goToPrevFile = () => {
    if (currentIndex > 0) onSelectFile(allPdfFiles[currentIndex - 1])
  }
  const goToNextFile = () => {
    if (currentIndex < allPdfFiles.length - 1) onSelectFile(allPdfFiles[currentIndex + 1])
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* ================================================================ */}
      {/* TOP TOOLBAR                                                      */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between h-12 px-3 bg-gray-800 border-b border-gray-700 shrink-0">
        {/* Left: close + nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Done
          </button>
          <div className="h-5 w-px bg-gray-700" />
          <button onClick={goToPrevFile} disabled={currentIndex <= 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToNextFile} disabled={currentIndex >= allPdfFiles.length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center: filename */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-white font-medium truncate max-w-md">{file.name}</span>
          {numPages > 0 && (
            <span className="text-xs text-gray-400">
              Page {pageNumber} of {numPages}
            </span>
          )}
        </div>

        {/* Right: tools */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetZoom} className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors rounded" title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-1" />
          <button onClick={rotate} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Rotate">
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDownload(file)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-1" />
          <button
            onClick={() => setShowProperties(!showProperties)}
            className={cn('p-1.5 transition-colors', showProperties ? 'text-blue-400' : 'text-gray-400 hover:text-white')}
            title="Toggle properties"
          >
            <Info className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors ml-1" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* BODY: sidebar + viewer + properties                              */}
      {/* ================================================================ */}
      <div className="flex flex-1 min-h-0">
        {/* ---- LEFT SIDEBAR: PDF file list ---- */}
        <div className="w-52 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
          <div className="p-2 border-b border-gray-700">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                PDFs ({allPdfFiles.length})
              </span>
            </div>
            {allPdfFiles.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded text-gray-300 placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredPdfs.map((pdf) => {
              const isActive = pdf.id === file.id
              return (
                <button
                  key={pdf.id}
                  onClick={() => onSelectFile(pdf)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors border-l-2',
                    isActive
                      ? 'bg-blue-900/40 border-blue-400 text-white'
                      : 'border-transparent text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                  )}
                >
                  {/* Mini thumbnail */}
                  <div className="w-10 h-10 rounded border border-gray-600 overflow-hidden shrink-0 bg-white">
                    {pdf.thumbnailUrl ? (
                      <SidebarThumb url={pdf.thumbnailUrl} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs font-medium truncate', isActive ? 'text-white' : 'text-gray-300')}>
                      {pdf.name.replace(/\.pdf$/i, '')}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {formatFileSize(pdf.size)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ---- MAIN VIEWER ---- */}
        <div ref={viewerRef} className="flex-1 overflow-auto bg-gray-700 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-sm text-gray-400">Loading PDF...</p>
              </div>
            </div>
          )}

          {file.thumbnailUrl ? (
            <div className="flex justify-center py-6 px-4">
              <Document
                file={file.thumbnailUrl}
                loading={null}
                error={
                  <div className="flex flex-col items-center gap-3 py-20">
                    <FileText className="w-16 h-16 text-gray-500" />
                    <p className="text-sm text-gray-400">Failed to load PDF</p>
                  </div>
                }
                onLoadSuccess={onDocumentLoadSuccess}
              >
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  rotate={rotation}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={null}
                  className="shadow-2xl [&_canvas]:rounded-sm"
                />
              </Document>
            </div>
          ) : !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText className="w-16 h-16 text-gray-500" />
              <p className="text-sm text-gray-400">PDF preview not available</p>
              <button
                onClick={() => onDownload(file)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download to view
              </button>
            </div>
          )}

          {/* Page navigation at bottom */}
          {numPages > 1 && (
            <div className="sticky bottom-4 flex justify-center">
              <div className="flex items-center gap-2 bg-gray-800/90 backdrop-blur rounded-full px-4 py-2 shadow-lg border border-gray-600">
                <button
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={numPages}
                    value={pageNumber}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (val >= 1 && val <= numPages) setPageNumber(val)
                    }}
                    className="w-10 text-center text-sm bg-gray-700 border border-gray-600 rounded text-white py-0.5 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-400">of {numPages}</span>
                </div>
                <button
                  onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                  disabled={pageNumber >= numPages}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---- RIGHT PROPERTIES PANEL ---- */}
        {showProperties && (
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
            </div>

            <div className="p-4 space-y-4">
              {/* File name */}
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">File Name</label>
                <p className="text-sm text-gray-900 break-words">{file.name}</p>
              </div>

              {/* Title (derived from filename) */}
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Title</label>
                <p className="text-sm text-gray-900">{file.name.replace(/\.pdf$/i, '')}</p>
              </div>

              {/* Size */}
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Size</label>
                <p className="text-sm text-gray-900">{formatFileSize(file.size)}</p>
              </div>

              {/* Pages */}
              {numPages > 0 && (
                <div>
                  <label className="text-xs font-medium text-blue-600 mb-1 block">Pages</label>
                  <p className="text-sm text-gray-900">{numPages}</p>
                </div>
              )}

              {/* Modified date */}
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Last Modified</label>
                <p className="text-sm text-gray-900">{formatDate(file.lastModified)}</p>
              </div>

              {/* Path */}
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Path</label>
                <p className="text-xs text-gray-500 break-all">{file.path}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto p-4 border-t border-gray-100">
              <button
                onClick={() => onDownload(file)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
