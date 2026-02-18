'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import JSZip from 'jszip'
import { uploadAndTranslate, translateFromUrn } from './actions'

// Threshold for using direct S3 upload (4 MB)
const DIRECT_S3_THRESHOLD = 4 * 1024 * 1024

// ----- Plot option types -----
interface PlotOptions {
  paperSize: string
  orientation: 'Landscape' | 'Portrait'
  plotArea: 'Layout' | 'Extents' | 'Display' | 'Limits'
  scale: string // 'Fit' or custom like '1:100'
  plotStyleTable: string // CTB filename or ''
  lineweights: boolean
  plotStyles: boolean
  layoutName: string
}

const PAPER_SIZES = [
  { label: 'A4 (210 × 297 mm)', value: 'ISO full bleed A4 (210.00 x 297.00 MM)' },
  { label: 'A3 (420 × 297 mm)', value: 'ISO full bleed A3 (420.00 x 297.00 MM)' },
  { label: 'A2 (594 × 420 mm)', value: 'ISO full bleed A2 (594.00 x 420.00 MM)' },
  { label: 'A1 (841 × 594 mm)', value: 'ISO full bleed A1 (841.00 x 594.00 MM)' },
  { label: 'A0 (1189 × 841 mm)', value: 'ISO full bleed A0 (1189.00 x 841.00 MM)' },
  { label: 'ANSI D (34 × 22 in)', value: 'ANSI full bleed D (34.00 x 22.00 Inches)' },
]

const SCALES = [
  { label: 'Fit to Page', value: 'Fit' },
  { label: '1:1', value: '1=1' },
  { label: '1:50', value: '1=50' },
  { label: '1:100', value: '1=100' },
  { label: '1:200', value: '1=200' },
  { label: '1:500', value: '1=500' },
]

const DEFAULT_PLOT_OPTIONS: PlotOptions = {
  paperSize: 'ISO full bleed A3 (420.00 x 297.00 MM)',
  orientation: 'Landscape',
  plotArea: 'Layout',
  scale: 'Fit',
  plotStyleTable: '',
  lineweights: true,
  plotStyles: true,
  layoutName: 'Layout1',
}

// File type icons/colors
function getFileTypeInfo(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'dwg' || ext === 'dxf') return { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'DWG' }
  if (ext === 'jpg' || ext === 'jpeg') return { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'JPG' }
  if (ext === 'png') return { color: 'text-green-600 bg-green-50 border-green-200', label: 'PNG' }
  if (ext === 'ctb' || ext === 'stb') return { color: 'text-purple-600 bg-purple-50 border-purple-200', label: 'CTB' }
  if (ext === 'pdf') return { color: 'text-red-600 bg-red-50 border-red-200', label: 'PDF' }
  return { color: 'text-gray-600 bg-gray-50 border-gray-200', label: ext.toUpperCase() }
}

export default function ApsTestPage() {
  // Step 1: Folder files
  const [folderFiles, setFolderFiles] = useState<File[]>([])
  const [folderName, setFolderName] = useState<string>('')
  // Step 2: Selected main file
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  // CTB for plotting
  const [ctbFile, setCtbFile] = useState<File | null>(null)
  // Processing state
  const [uploading, setUploading] = useState(false)
  const [urn, setUrn] = useState<string | null>(null)
  const [workItemId, setWorkItemId] = useState<string | null>(null)
  const [pdfObjectKey, setPdfObjectKey] = useState<string | null>(null)
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [outputFormat, setOutputFormat] = useState<'svf2' | 'pdf'>('svf2')
  const [viewerReady, setViewerReady] = useState(false)
  const [sheets, setSheets] = useState<Array<{ name: string; guid: string; role: string }>>([])
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [plotOptions, setPlotOptions] = useState<PlotOptions>(DEFAULT_PLOT_OPTIONS)
  const [showPlotOptions, setShowPlotOptions] = useState(false)
  const ctbInputRef = useRef<HTMLInputElement>(null)
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const docRef = useRef<any>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${time}] ${msg}`])
  }, [])

  // Derived: DWG/DXF files in the folder (the ones user can choose to open)
  const dwgFiles = folderFiles.filter(f => /\.(dwg|dxf)$/i.test(f.name))
  // Derived: All other files (xrefs, images, etc.)
  const otherFiles = folderFiles.filter(f => !/\.(dwg|dxf)$/i.test(f.name))
  // Derived: xref files = everything in folder except the selected main file
  const xrefFiles = selectedFile
    ? folderFiles.filter(f => f !== selectedFile)
    : []

  // Handle folder selection using File System Access API
  // This reads ONLY top-level files (no subfolders) and doesn't show the
  // scary "upload N files?" browser prompt
  const handleChooseFolder = async () => {
    try {
      // Use modern File System Access API — supported in Chrome/Edge
      const dirHandle = await (window as any).showDirectoryPicker()
      setFolderName(dirHandle.name)

      const files: File[] = []
      // Iterate ONLY direct children (not recursive into subfolders)
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && /\.(dwg|dxf|jpg|jpeg|png|ctb|stb|pdf)$/i.test(name)) {
          const file = await handle.getFile()
          files.push(file)
        }
      }

      setFolderFiles(files)
      setSelectedFile(null)

      // Auto-detect CTB file and auto-configure plot options
      const ctb = files.find(f => /\.(ctb|stb)$/i.test(f.name))
      if (ctb) {
        setCtbFile(ctb)
        setPlotOptions(o => ({ ...o, plotStyleTable: ctb.name, plotStyles: true }))
      } else {
        setCtbFile(null)
      }
    } catch (err: any) {
      // User cancelled the picker — ignore
      if (err.name !== 'AbortError') {
        console.error('Folder pick error:', err)
        setError(`Could not read folder: ${err.message}`)
      }
    }
  }

  // Upload & process
  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    setUrn(null)
    setWorkItemId(null)
    setPdfObjectKey(null)
    setPdfDownloadUrl(null)
    setStatus('')
    setProgress('')
    setViewerReady(false)
    setSheets([])
    setActiveSheet(null)
    setLogs([])

    addLog(`Main file: "${selectedFile.name}" (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB)`)
    addLog(`Folder: ${folderName} (${folderFiles.length} files total)`)
    addLog(`Bundled reference files: ${xrefFiles.length}`)
    if (ctbFile) addLog(`Plot style: ${ctbFile.name} (auto-detected)`)
    addLog(`Output: ${outputFormat === 'svf2' ? '2D Viewer' : 'Plot to PDF'}`)

    try {
      const formData = new FormData()
      formData.append('outputFormat', outputFormat)

      // Create ZIP on the client side — avoids body size limits for large folders
      if (xrefFiles.length > 0) {
        addLog(`Creating ZIP bundle with ${xrefFiles.length + 1} files (client-side)...`)
        const zip = new JSZip()

        // Add main file
        const mainBuffer = await selectedFile.arrayBuffer()
        zip.file(selectedFile.name, mainBuffer)

        // Add all xref/reference files
        for (const xf of xrefFiles) {
          const xfBuffer = await xf.arrayBuffer()
          zip.file(xf.name, xfBuffer)
        }

        // Generate ZIP blob
        let lastLoggedPercent = -1
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 3 }, // Fast compression
        }, (metadata) => {
          const pct = Math.floor(metadata.percent / 20) * 20 // 0, 20, 40, 60, 80, 100
          if (pct > lastLoggedPercent) {
            lastLoggedPercent = pct
            addLog(`ZIP progress: ${pct}%`)
          }
        })

        const zipFileName = selectedFile.name.replace(/\.\w+$/i, '') + '_bundle.zip'
        addLog(`ZIP created: ${zipFileName} (${(zipBlob.size / 1024 / 1024).toFixed(1)} MB)`)

        formData.append('file', zipBlob, zipFileName)
        formData.append('rootFilename', selectedFile.name)
        formData.append('isZipBundle', 'true')
      } else {
        // Single file, no xrefs — upload directly
        formData.append('file', selectedFile)
      }

      if (outputFormat === 'pdf') {
        formData.append('plotOptions', JSON.stringify(plotOptions))
        // Send CTB separately for Design Automation (it needs it as a distinct input)
        if (ctbFile) {
          formData.append('ctbFile', ctbFile)
          addLog(`CTB for plotting: ${ctbFile.name}`)
        }
      }

      // Determine total upload size
      const fileEntry = formData.get('file') as File | Blob
      const totalSize = fileEntry?.size || 0

      let data: any

      if (totalSize > DIRECT_S3_THRESHOLD) {
        // --- DIRECT S3 UPLOAD (bypasses Vercel body size limit entirely) ---
        addLog(`File is ${(totalSize / 1024 / 1024).toFixed(1)} MB — using direct S3 upload...`)

        // Step 1: Get signed S3 URL from our API
        addLog('Getting signed upload URL...')
        const isBundle = formData.get('isZipBundle') === 'true'
        const rootFn = formData.get('rootFilename') as string | null
        const zipFileName = isBundle
          ? (rootFn || 'upload').replace(/\.\w+$/i, '') + '_bundle.zip'
          : (fileEntry instanceof File ? fileEntry.name : 'upload.dwg')

        const signedResp = await fetch('/api/aps/signed-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: zipFileName }),
        })
        if (!signedResp.ok) {
          const errData = await signedResp.json().catch(() => ({}))
          throw new Error(errData.error || `Failed to get upload URL (${signedResp.status})`)
        }
        const { uploadUrl, uploadKey, objectKey } = await signedResp.json()
        addLog('Got signed URL. Uploading directly to S3...')

        // Step 2: Upload directly to S3 (no Vercel proxy involved)
        const s3Resp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: fileEntry,
        })
        if (!s3Resp.ok) {
          throw new Error(`S3 upload failed (${s3Resp.status})`)
        }
        addLog('S3 upload complete. Finalizing...')

        // Step 3: Finalize upload and get URN
        const finalizeResp = await fetch('/api/aps/signed-upload/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectKey, uploadKey }),
        })
        if (!finalizeResp.ok) {
          const errData = await finalizeResp.json().catch(() => ({}))
          throw new Error(errData.error || `Finalize failed (${finalizeResp.status})`)
        }
        const { urn } = await finalizeResp.json()
        addLog(`Upload finalized. URN: ${urn.slice(0, 30)}...`)

        // Step 4: Start translation via lightweight server action (no file transfer)
        addLog('Starting translation...')

        // Prepare CTB as base64 for the server action (CTB files are small, typically < 100KB)
        let ctbBase64: string | undefined
        let ctbFn: string | undefined
        const ctbEntry = formData.get('ctbFile') as File | null
        if (ctbEntry && ctbEntry.name) {
          ctbFn = ctbEntry.name
          const ctbBytes = new Uint8Array(await ctbEntry.arrayBuffer())
          // Use chunked btoa to avoid stack overflow on large arrays
          let binary = ''
          const chunkSize = 8192
          for (let i = 0; i < ctbBytes.length; i += chunkSize) {
            binary += String.fromCharCode(...ctbBytes.slice(i, i + chunkSize))
          }
          ctbBase64 = btoa(binary)
        }

        const plotOptsStr = formData.get('plotOptions') as string | null
        let parsedPlotOpts: any = undefined
        if (plotOptsStr) {
          try { parsedPlotOpts = JSON.parse(plotOptsStr) } catch {}
        }

        data = await translateFromUrn({
          urn,
          objectKey,
          fileName: zipFileName,
          rootFilename: rootFn || undefined,
          isZipBundle: isBundle,
          outputFormat,
          plotOptions: parsedPlotOpts,
          ctbFileName: ctbFn,
          ctbBase64,
        })
      } else {
        // --- STANDARD UPLOAD (small files via server action) ---
        addLog('Uploading to server...')
        data = await uploadAndTranslate(formData)
      }

      if (!data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      if (data.type === 'design-automation') {
        addLog(`Upload complete. Work item: ${data.workItemId}`)
        addLog(`Plot job submitted (status: ${data.status})`)
        setWorkItemId(data.workItemId)
        setPdfObjectKey(data.pdfObjectKey)
        setStatus(data.status)
        startWorkItemPolling(data.workItemId, data.pdfObjectKey)
      } else {
        addLog(`Upload complete. URN: ${data.urn.slice(0, 30)}...`)
        if (data.xrefCount > 0) {
          addLog(`ZIP bundle uploaded with ${data.xrefCount} xref(s)`)
        }
        addLog(`Translation started (status: ${data.status})`)
        setUrn(data.urn)
        setStatus(data.status)
        startTranslationPolling(data.urn)
      }
    } catch (err: any) {
      setError(err.message)
      addLog(`ERROR: ${err.message}`)
    }

    setUploading(false)
  }

  // Poll for Model Derivative translation status
  const startTranslationPolling = (targetUrn: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/aps/translate/status?urn=${encodeURIComponent(targetUrn)}`)
        const data = await resp.json()

        if (!resp.ok) {
          addLog(`Status check error: ${data.error}`)
          return
        }

        setStatus(data.status)
        setProgress(data.progress)

        // Log derivative-level messages (warnings, errors) even during inprogress
        let derivativeInfo = ''
        if (data.derivatives && data.derivatives.length > 0) {
          for (const d of data.derivatives) {
            if (d.messages) {
              for (const m of d.messages) {
                derivativeInfo += ` | ${m.type}: ${m.message}`
              }
            }
          }
        }
        addLog(`Status: ${data.status} | Progress: ${data.progress}${derivativeInfo}`)

        if (data.status === 'success') {
          addLog('Translation complete!')
          addLog('Loading 2D Viewer...')
          setViewerReady(true)
          loadViewer(targetUrn)
          if (pollingRef.current) clearInterval(pollingRef.current)
        }

        if (data.status === 'failed' || data.status === 'timeout') {
          addLog(`Translation FAILED (${data.status})`)
          if (data.derivatives) {
            data.derivatives.forEach((d: any) => {
              addLog(`  Derivative: ${d.outputType} (${d.status})`)
              if (d.messages) {
                d.messages.forEach((m: any) => addLog(`    msg: ${m.type} - ${m.message}`))
              }
            })
          }
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      } catch (err: any) {
        addLog(`Polling error: ${err.message}`)
      }
    }, 5000)
  }

  // Poll for Design Automation work item status
  const startWorkItemPolling = (itemId: string, pdfKey: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(
          `/api/aps/workitem/status?id=${encodeURIComponent(itemId)}&pdfObjectKey=${encodeURIComponent(pdfKey)}`
        )
        const data = await resp.json()

        if (!resp.ok) {
          addLog(`Work item status error: ${data.error}`)
          return
        }

        setStatus(data.status)
        setProgress(data.progress || '')
        addLog(`Plot status: ${data.status} (raw: ${data.rawStatus})${data.progress ? ` | ${data.progress}` : ''}`)

        if (data.status === 'success') {
          addLog('PDF plotting complete!')
          if (data.pdfDownloadUrl) {
            setPdfDownloadUrl(data.pdfDownloadUrl)
            addLog('PDF download URL ready.')
          } else {
            addLog('Warning: PDF plotted but no download URL returned.')
          }
          if (data.reportUrl) addLog(`Report: ${data.reportUrl}`)
          if (pollingRef.current) clearInterval(pollingRef.current)
        }

        if (data.status === 'failed') {
          addLog(`Plotting FAILED (${data.rawStatus})`)
          if (data.reportUrl) addLog(`Report URL: ${data.reportUrl}`)
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      } catch (err: any) {
        addLog(`Polling error: ${err.message}`)
      }
    }, 5000)
  }

  // Load Autodesk Viewer — optimized for 2D CAD
  const loadViewer = async (targetUrn: string) => {
    try {
      const tokenResp = await fetch('/api/aps/token')
      const tokenData = await tokenResp.json()

      if (!tokenData.success) {
        addLog(`Viewer token error: ${tokenData.error}`)
        return
      }

      addLog('Viewer token obtained')

      if (typeof (window as any).Autodesk === 'undefined') {
        addLog('Loading Autodesk Viewer SDK...')
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.css'
        document.head.appendChild(link)

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Autodesk Viewer SDK'))
          document.head.appendChild(script)
        })
        addLog('Viewer SDK loaded')
      }

      const Autodesk = (window as any).Autodesk
      const options = {
        env: 'AutodeskProduction2',
        api: 'streamingV2',
        getAccessToken: (callback: (token: string, expires: number) => void) => {
          callback(tokenData.access_token, tokenData.expires_in)
        },
      }

      Autodesk.Viewing.Initializer(options, () => {
        if (!viewerContainerRef.current) return

        const config = { extensions: ['Autodesk.DocumentBrowser'] }
        const viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current, config)
        viewer.start()
        viewerRef.current = viewer
        viewer.navigation.setReverseZoomDirection(true)

        addLog('Viewer initialized (zoom direction fixed, 2D-optimized)')

        Autodesk.Viewing.Document.load(
          `urn:${targetUrn}`,
          (doc: any) => {
            docRef.current = doc
            const root = doc.getRoot()
            const viewables = root.search({ type: 'geometry' })
            const sheetList: Array<{ name: string; guid: string; role: string }> = []

            for (const v of viewables) {
              sheetList.push({
                name: v.data?.name || v.name() || 'Unnamed',
                guid: v.guid(),
                role: v.data?.role || v.role || '2d',
              })
            }

            addLog(`Found ${sheetList.length} viewable(s): ${sheetList.map(s => s.name).join(', ')}`)
            setSheets(sheetList)

            viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
              viewer.fitToView(undefined, undefined, true)
              viewer.navigation.setReverseZoomDirection(true)
              addLog('Drawing fitted to view')
            })

            const first2d = sheetList.find(s => s.role === '2d') || sheetList[0]
            if (first2d) {
              const viewable = viewables.find((v: any) => v.guid() === first2d.guid) || viewables[0]
              viewer.loadDocumentNode(doc, viewable, { skipPropertyDb: true })
              setActiveSheet(first2d.guid)
              addLog(`Loading 2D view: "${first2d.name}" (optimized)`)
            } else {
              const defaultGeom = root.getDefaultGeometry()
              viewer.loadDocumentNode(doc, defaultGeom, { skipPropertyDb: true })
              addLog('Loaded default geometry')
            }
          },
          (errorCode: number, errorMsg: string) => {
            addLog(`Viewer load error: ${errorCode} - ${errorMsg}`)
          }
        )
      })
    } catch (err: any) {
      addLog(`Viewer error: ${err.message}`)
    }
  }

  // Switch between sheets/layouts
  const switchSheet = useCallback((guid: string) => {
    if (!viewerRef.current || !docRef.current) return
    const root = docRef.current.getRoot()
    const viewables = root.search({ type: 'geometry' })
    const target = viewables.find((v: any) => v.guid() === guid)
    if (target) {
      const Autodesk = (window as any).Autodesk
      const viewer = viewerRef.current

      viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
        viewer.fitToView(undefined, undefined, true)
        viewer.navigation.setReverseZoomDirection(true)
      }, { once: true })

      viewer.loadDocumentNode(docRef.current, target, { skipPropertyDb: true })
      setActiveSheet(guid)
      const sheet = sheets.find(s => s.guid === guid)
      addLog(`Switched to: "${sheet?.name}"`)
    }
  }, [sheets, addLog])

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (viewerRef.current) {
        viewerRef.current.finish()
        viewerRef.current = null
      }
    }
  }, [])

  const showStatusSection = !!(urn || workItemId)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Autodesk APS — 2D CAD Viewer & PDF Plot</h1>
        <p className="text-sm text-gray-500 mb-6">
          Select a CAD project folder, then choose which drawing to open
        </p>

        {/* Step 1: Select Folder */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">1. Select Project Folder</h2>
          <p className="text-xs text-gray-500 mb-4">
            Choose the folder containing your DWG files and references (xrefs, images, CTB).
            Just like AutoCAD — the engine reads the folder and automatically resolves what it needs.
          </p>

          <button
            onClick={handleChooseFolder}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Choose Folder
          </button>

          {folderName && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">{folderName}</span>
                <span className="text-xs text-gray-400">({folderFiles.length} files)</span>
              </div>

              {/* Files summary */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="font-bold text-blue-700 text-lg">{dwgFiles.length}</p>
                  <p className="text-blue-600">DWG/DXF</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <p className="font-bold text-amber-700 text-lg">{folderFiles.filter(f => /\.(jpg|jpeg)$/i.test(f.name)).length}</p>
                  <p className="text-amber-600">JPG</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="font-bold text-green-700 text-lg">{folderFiles.filter(f => /\.png$/i.test(f.name)).length}</p>
                  <p className="text-green-600">PNG</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <p className="font-bold text-purple-700 text-lg">{folderFiles.filter(f => /\.(ctb|stb)$/i.test(f.name)).length}</p>
                  <p className="text-purple-600">CTB</p>
                </div>
              </div>

              {/* CTB auto-detected notice */}
              {ctbFile && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-purple-700">
                    Plot style detected: <strong>{ctbFile.name}</strong> — will be used automatically when plotting to PDF
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Choose which DWG to open */}
        {dwgFiles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">2. Choose Drawing to Open</h2>
            <p className="text-xs text-gray-500 mb-4">
              Pick the main drawing to open. All other files (DWGs, images, CTB) are bundled automatically
              — the engine resolves only the references it needs, just like AutoCAD.
            </p>

            <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
              {dwgFiles.map((f, i) => {
                const info = getFileTypeInfo(f.name)
                const isSelected = selectedFile === f
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedFile(f)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${info.color}`}>
                      {info.label}
                    </span>
                    <span className={`text-sm flex-1 truncate ${isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                      {f.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Other files (xrefs) preview */}
            {xrefFiles.length > 0 && selectedFile && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Bundled with drawing ({xrefFiles.length} files — engine resolves what it needs):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {xrefFiles.slice(0, 15).map((f, i) => {
                    const info = getFileTypeInfo(f.name)
                    return (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${info.color}`}>
                        {info.label}: {f.name.length > 25 ? f.name.slice(0, 22) + '...' : f.name}
                      </span>
                    )
                  })}
                  {xrefFiles.length > 15 && (
                    <span className="text-[10px] text-gray-400">+{xrefFiles.length - 15} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Output format & action */}
            {selectedFile && (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <label className="text-sm font-medium text-gray-700">Output:</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOutputFormat('svf2')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        outputFormat === 'svf2'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      2D Viewer
                    </button>
                    <button
                      onClick={() => setOutputFormat('pdf')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        outputFormat === 'pdf'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      Plot to PDF
                    </button>
                  </div>
                </div>

                {/* Plot Options (PDF only) */}
                {outputFormat === 'pdf' && (
                  <div className="mb-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-amber-600">
                        Uses AutoCAD Design Automation engine for proper plotting with plot styles.
                      </p>
                      <button
                        onClick={() => setShowPlotOptions(v => !v)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {showPlotOptions ? 'Hide Options' : 'Show Plot Options'}
                      </button>
                    </div>

                    {showPlotOptions && (
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-800">Plot Settings</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Paper Size</label>
                            <select value={plotOptions.paperSize} onChange={e => setPlotOptions(o => ({ ...o, paperSize: e.target.value }))} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                              {PAPER_SIZES.map(ps => <option key={ps.value} value={ps.value}>{ps.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Orientation</label>
                            <select value={plotOptions.orientation} onChange={e => setPlotOptions(o => ({ ...o, orientation: e.target.value as 'Landscape' | 'Portrait' }))} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                              <option value="Landscape">Landscape</option>
                              <option value="Portrait">Portrait</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Plot Area</label>
                            <select value={plotOptions.plotArea} onChange={e => setPlotOptions(o => ({ ...o, plotArea: e.target.value as PlotOptions['plotArea'] }))} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                              <option value="Layout">Layout</option>
                              <option value="Extents">Extents</option>
                              <option value="Display">Display</option>
                              <option value="Limits">Limits</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Scale</label>
                            <select value={plotOptions.scale} onChange={e => setPlotOptions(o => ({ ...o, scale: e.target.value }))} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                              {SCALES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Layout Name</label>
                          <input type="text" value={plotOptions.layoutName} onChange={e => setPlotOptions(o => ({ ...o, layoutName: e.target.value }))} placeholder="Layout1" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={plotOptions.plotStyles} onChange={e => setPlotOptions(o => ({ ...o, plotStyles: e.target.checked }))} className="rounded border-gray-300" />
                            Plot with plot styles
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={plotOptions.lineweights} onChange={e => setPlotOptions(o => ({ ...o, lineweights: e.target.checked }))} className="rounded border-gray-300" />
                            Plot lineweights
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Plot Style Table (.ctb)</label>
                          <div className="flex items-center gap-3">
                            <input ref={ctbInputRef} type="file" accept=".ctb,.stb" className="hidden" onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setCtbFile(e.target.files[0])
                                setPlotOptions(o => ({ ...o, plotStyleTable: e.target.files![0].name, plotStyles: true }))
                              }
                            }} />
                            {ctbFile ? (
                              <span className="text-xs text-purple-700 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <strong>{ctbFile.name}</strong> (from folder)
                                <button onClick={() => { setCtbFile(null); setPlotOptions(o => ({ ...o, plotStyleTable: '', plotStyles: false })) }} className="text-purple-400 hover:text-red-600 ml-1">✕</button>
                              </span>
                            ) : (
                              <button onClick={() => ctbInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                Choose .ctb manually
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Processing...' : outputFormat === 'pdf' ? 'Upload & Plot' : 'Upload & View'}
                </button>
              </>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Status Section */}
        {showStatusSection && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              3. {workItemId ? 'Plot Status' : 'Translation Status'}
            </h2>
            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <p className={`text-sm font-semibold ${
                  status === 'success' ? 'text-green-600' :
                  status === 'failed' || status === 'timeout' ? 'text-red-600' :
                  'text-amber-600'
                }`}>{status || 'Starting...'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Progress</p>
                <p className="text-sm font-medium text-gray-900">{progress || '—'}</p>
              </div>
              {workItemId && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Engine</p>
                  <p className="text-sm font-medium text-gray-900">Design Automation</p>
                </div>
              )}
            </div>
            {status && status !== 'success' && status !== 'failed' && status !== 'timeout' && (
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500 animate-pulse" style={{ width: progress || '10%' }} />
              </div>
            )}
          </div>
        )}

        {/* PDF Download */}
        {pdfDownloadUrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Download PDF</h2>
            <a href={pdfDownloadUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </a>
          </div>
        )}

        {/* Viewer */}
        {viewerReady && (
          <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">2D Drawing Viewer</h2>
              {sheets.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 mr-2">Layouts:</span>
                  {sheets.map((sheet) => (
                    <button key={sheet.guid} onClick={() => switchSheet(sheet.guid)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        activeSheet === sheet.guid
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}>
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={viewerContainerRef} className="w-full bg-white" style={{ height: '700px' }} />
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-400">
                Pan: Click + Drag &nbsp;|&nbsp; Zoom: Scroll wheel &nbsp;|&nbsp;
                Layers: Use the layer panel in the toolbar &nbsp;|&nbsp;
                Measure: Use the measure tool in the toolbar
              </p>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Logs</h2>
            {logs.length > 0 && (
              <button onClick={() => setLogs([])} className="text-xs text-gray-500 hover:text-gray-400">Clear</button>
            )}
          </div>
          <div className="font-mono text-xs text-green-400 space-y-1 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity yet. Select a folder and choose a drawing to start.</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className={
                  log.includes('ERROR') || log.includes('FAILED') ? 'text-red-400' :
                  log.includes('complete') || log.includes('success') || log.includes('ready') || log.includes('fitted') ? 'text-emerald-400' :
                  log.includes('Warning') ? 'text-yellow-400' :
                  log.includes('Bundling') || log.includes('ZIP') ? 'text-cyan-400' :
                  ''
                }>{log}</p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
