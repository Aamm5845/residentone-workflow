'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  FileText,
  Info,
  Search,
  Loader2,
  Printer,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  Plus,
  Send,
  Clock,
  User,
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

interface DrawingInfo {
  id: string
  drawingNumber: string
  title: string
}

interface DrawingActivity {
  revisions: Array<{
    id: string
    revisionNumber: number
    notes: string | null
    createdAt: string
    issuedByUser?: { name: string | null } | null
  }>
  transmittals: Array<{
    id: string
    transmittalNumber: string
    recipientName: string
    sentAt: string | null
  }>
}

interface PdfViewerProps {
  file: PdfFile
  allPdfFiles: PdfFile[]
  onSelectFile: (file: PdfFile) => void
  onClose: () => void
  onDownload: (file: PdfFile) => void
  onRegisterAsDrawing?: (file: PdfFile) => void
  onSendTransmittal?: (drawingInfo: DrawingInfo) => void
  drawingInfo?: DrawingInfo | null
  drawingActivity?: DrawingActivity | null
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

/** Extract a drawing-like identifier from filename, e.g. "24010- 5573 PARK AVE" */
function extractDrawingId(name: string): string {
  const withoutExt = name.replace(/\.pdf$/i, '')
  // If name has a dash or space pattern like "P3-1.1" or "24010-", take first segment
  const match = withoutExt.match(/^([A-Z0-9][\w.-]*)/i)
  return match ? match[1] : withoutExt.substring(0, 12)
}

function extractTitle(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

// ---------------------------------------------------------------------------
// Sidebar Thumbnail
// ---------------------------------------------------------------------------

const SidebarThumb = memo(function SidebarThumb({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <FileText className="w-6 h-6 text-gray-300" />
      </div>
    )
  }

  return (
    <div className="w-full h-full relative bg-white overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 bg-gray-50 animate-pulse flex items-center justify-center">
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
          width={120}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={null}
          className="[&_canvas]:!w-full [&_canvas]:!h-auto"
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
  onRegisterAsDrawing,
  onSendTransmittal,
  drawingInfo,
  drawingActivity,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(0.75)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isLandscapePage, setIsLandscapePage] = useState(false)
  const [showProperties, setShowProperties] = useState(true)
  const [showSidebar, setShowSidebar] = useState(true)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [showFileDropdown, setShowFileDropdown] = useState(false)
  const viewerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 })

  // Lock body scroll when viewer is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

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
    setZoom(0.75)
    setRotation(0)
    setLoading(true)
    setNumPages(0)
    setIsLandscapePage(false)
  }, [file.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowFileDropdown(false)
      }
    }
    if (showFileDropdown) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showFileDropdown])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFileDropdown) { setShowFileDropdown(false); return }
        onClose()
      }
      if (e.key === 'ArrowLeft' && pageNumber > 1) setPageNumber((p) => p - 1)
      if (e.key === 'ArrowRight' && pageNumber < numPages) setPageNumber((p) => p + 1)
      if (e.key === '+' || (e.ctrlKey && e.key === '=')) { e.preventDefault(); handleZoomIn() }
      if (e.key === '-' || (e.ctrlKey && e.key === '-')) { e.preventDefault(); handleZoomOut() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pageNumber, numPages, onClose, showFileDropdown])

  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages)
    setLoading(false)

    // Detect page dimensions for smart initial zoom
    try {
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1 })
      // Store whether page is landscape so we can adjust zoom
      setIsLandscapePage(viewport.width > viewport.height)
    } catch {
      // Ignore errors
    }
  }, [])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25))
  const resetZoom = () => setZoom(0.75)
  const rotate = () => setRotation((r) => (r + 90) % 360)

  const handlePrint = () => {
    if (file.thumbnailUrl) {
      const printWindow = window.open(file.thumbnailUrl, '_blank')
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print()
        })
      }
    }
  }

  // Calculate the page width to fit in the viewer
  const pageWidth = viewerSize.width > 0
    ? Math.max((viewerSize.width - 48) * zoom, 200)
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
      <div className="flex items-center justify-between h-11 px-2 bg-gray-800 border-b border-gray-700 shrink-0">
        {/* Left: Done + print/refresh + nav arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Done</span>
          </button>
          <div className="h-5 w-px bg-gray-700 mx-0.5" />
          <button onClick={handlePrint} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Print">
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setLoading(true); setNumPages(0) }}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-0.5" />
          <button onClick={goToPrevFile} disabled={currentIndex <= 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors" title="Previous file">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToNextFile} disabled={currentIndex >= allPdfFiles.length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors" title="Next file">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center: file selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowFileDropdown(!showFileDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-white hover:bg-gray-700 rounded-md transition-colors max-w-lg"
          >
            <span className="truncate font-medium">{extractTitle(file.name)}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform', showFileDropdown && 'rotate-180')} />
          </button>

          {/* Dropdown list */}
          {showFileDropdown && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-80 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
              {allPdfFiles.map((pdf) => (
                <button
                  key={pdf.id}
                  onClick={() => { onSelectFile(pdf); setShowFileDropdown(false) }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center gap-2',
                    pdf.id === file.id ? 'bg-blue-900/40 text-white' : 'text-gray-300'
                  )}
                >
                  <FileText className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="truncate">{extractTitle(pdf.name)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: zoom, rotate, download, properties, close */}
        <div className="flex items-center gap-0.5">
          <button onClick={handleZoomOut} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetZoom} className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors rounded min-w-[3rem] text-center" title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={handleZoomIn} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-0.5" />
          <button onClick={rotate} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Rotate">
            <RotateCw className="w-4 h-4" />
          </button>
          <button onClick={() => onDownload(file)} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Download">
            <Download className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-0.5" />
          <button
            onClick={() => setShowProperties(!showProperties)}
            className={cn('p-1.5 transition-colors', showProperties ? 'text-blue-400' : 'text-gray-400 hover:text-white')}
            title="Toggle properties"
          >
            <Info className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors ml-0.5" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* BODY                                                             */}
      {/* ================================================================ */}
      <div className="flex flex-1 min-h-0">
        {/* ---- LEFT SIDEBAR ---- */}
        {showSidebar && (
          <div className="w-[200px] bg-white border-r border-gray-200 flex flex-col shrink-0">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900">
                  Drawings ({allPdfFiles.length})
                </span>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search */}
            {allPdfFiles.length > 3 && (
              <div className="px-2 py-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Search drawings..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20"
                  />
                </div>
              </div>
            )}

            {/* PDF list */}
            <div className="flex-1 overflow-y-auto">
              {filteredPdfs.map((pdf) => {
                const isActive = pdf.id === file.id
                return (
                  <button
                    key={pdf.id}
                    onClick={() => onSelectFile(pdf)}
                    className={cn(
                      'w-full text-left transition-colors border-l-3 px-2 py-2',
                      isActive
                        ? 'bg-blue-50 border-blue-500'
                        : 'border-transparent hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {/* Thumbnail */}
                      <div className="w-14 h-10 rounded border border-gray-200 overflow-hidden shrink-0 bg-white shadow-sm">
                        {pdf.thumbnailUrl ? (
                          <SidebarThumb url={pdf.thumbnailUrl} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <FileText className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                      {/* Info + status */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className={cn(
                            'text-xs font-semibold truncate',
                            isActive ? 'text-blue-700' : 'text-gray-900'
                          )}>
                            {extractDrawingId(pdf.name)}
                          </p>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate leading-tight">
                          {extractTitle(pdf.name)}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Sidebar toggle when closed */}
        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            className="w-8 bg-gray-800 border-r border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shrink-0"
            title="Show drawings"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* ---- MAIN VIEWER ---- */}
        <div ref={viewerRef} className="flex-1 overflow-auto bg-gray-900 relative scroll-smooth">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-sm text-gray-400">Loading drawing...</p>
              </div>
            </div>
          )}

          {file.thumbnailUrl ? (
            <div className="flex justify-center py-4 px-4 min-h-full">
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
                  className="shadow-2xl"
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
            <div className="sticky bottom-3 flex justify-center pointer-events-none">
              <div className="flex items-center gap-2 bg-gray-800/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-xl border border-gray-600 pointer-events-auto">
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
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-blue-600 mb-1.5 block">Status</label>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500 text-white">
                    Current
                  </span>
                </div>

                {/* Number / ID */}
                <div>
                  <label className="text-xs font-medium text-blue-600 mb-1 block">Number</label>
                  <p className="text-sm text-gray-900 font-medium">{extractDrawingId(file.name)}</p>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-medium text-blue-600 mb-1 block">Title</label>
                  <p className="text-sm text-gray-900">{extractTitle(file.name)}</p>
                </div>

                {/* Pages */}
                {numPages > 0 && (
                  <div>
                    <label className="text-xs font-medium text-blue-600 mb-1 block">Pages</label>
                    <p className="text-sm text-gray-900">{numPages}</p>
                  </div>
                )}

                {/* Rev. date */}
                <div>
                  <label className="text-xs font-medium text-blue-600 mb-1 block">Rev. date</label>
                  <p className="text-sm text-gray-900">{formatDate(file.lastModified)}</p>
                </div>

                {/* Size */}
                <div>
                  <label className="text-xs font-medium text-blue-600 mb-1 block">Size</label>
                  <p className="text-sm text-gray-900">{formatFileSize(file.size)}</p>
                </div>

                {/* Path */}
                <div>
                  <label className="text-xs font-medium text-blue-600 mb-1 block">Location</label>
                  <p className="text-xs text-gray-500 break-all leading-relaxed">{file.path}</p>
                </div>

                {/* Drawing Register info */}
                {drawingInfo && (
                  <div className="pt-3 mt-3 border-t border-gray-100">
                    <label className="text-xs font-medium text-emerald-600 mb-1 block">In Drawing Register</label>
                    <p className="text-sm text-gray-900 font-medium">{drawingInfo.drawingNumber}</p>
                    <p className="text-xs text-gray-500">{drawingInfo.title}</p>
                  </div>
                )}

                {/* Revision History */}
                {drawingActivity && drawingActivity.revisions.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-gray-100">
                    <label className="text-xs font-medium text-blue-600 mb-2 block">Revisions</label>
                    <div className="space-y-2">
                      {drawingActivity.revisions.slice(0, 5).map((rev) => (
                        <div key={rev.id} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-blue-700">{rev.revisionNumber}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            {rev.notes && <p className="text-xs text-gray-700 line-clamp-1">{rev.notes}</p>}
                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                              <Clock className="w-3 h-3" />
                              {formatDate(rev.createdAt)}
                              {rev.issuedByUser?.name && (
                                <>
                                  <span className="mx-0.5">&middot;</span>
                                  <User className="w-3 h-3" />
                                  {rev.issuedByUser.name}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transmittal History */}
                {drawingActivity && drawingActivity.transmittals.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-gray-100">
                    <label className="text-xs font-medium text-blue-600 mb-2 block">Transmittals</label>
                    <div className="space-y-2">
                      {drawingActivity.transmittals.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-start gap-2">
                          <Send className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-700 font-medium">{t.transmittalNumber}</p>
                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                              <span>{t.recipientName}</span>
                              {t.sentAt && (
                                <>
                                  <span className="mx-0.5">&middot;</span>
                                  {formatDate(t.sentAt)}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              {/* Download */}
              <button
                onClick={() => onDownload(file)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>

              {/* Send Transmittal — only when file is in Drawing Register */}
              {drawingInfo && onSendTransmittal && (
                <button
                  onClick={() => onSendTransmittal(drawingInfo)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send Transmittal
                </button>
              )}

              {/* Register as Drawing — only when file is NOT in Drawing Register */}
              {!drawingInfo && onRegisterAsDrawing && (
                <button
                  onClick={() => onRegisterAsDrawing(file)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                >
                  <Plus className="w-4 h-4" />
                  Add to Drawing Register
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
