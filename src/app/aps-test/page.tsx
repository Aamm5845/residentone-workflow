'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

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

export default function ApsTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [ctbFile, setCtbFile] = useState<File | null>(null)
  const [xrefFiles, setXrefFiles] = useState<File[]>([])
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ctbInputRef = useRef<HTMLInputElement>(null)
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const docRef = useRef<any>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${time}] ${msg}`])
  }, [])

  // Upload & process (translate or plot)
  const handleUpload = async () => {
    if (!file) return
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

    addLog(`Uploading "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)...`)
    addLog(`Output: ${outputFormat === 'svf2' ? '2D Viewer' : 'Plot to PDF (Design Automation)'}`)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('outputFormat', outputFormat)

      // Append xref files for BOTH viewer and PDF modes
      // Without xrefs, the viewer only shows dimensions/annotations from the main file
      if (xrefFiles.length > 0) {
        for (const xf of xrefFiles) {
          formData.append('xrefFiles', xf)
        }
        addLog(`Including ${xrefFiles.length} xref file(s): ${xrefFiles.map(f => f.name).join(', ')}`)
      }

      if (outputFormat === 'pdf') {
        // Append plot options as JSON
        formData.append('plotOptions', JSON.stringify(plotOptions))

        // Append CTB file if provided
        if (ctbFile) {
          formData.append('ctbFile', ctbFile)
          addLog(`Including CTB: ${ctbFile.name}`)
        }
      }

      const resp = await fetch('/api/aps/translate', {
        method: 'POST',
        body: formData,
      })

      const data = await resp.json()

      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      if (data.type === 'design-automation') {
        // Design Automation (DWG → PDF plotting)
        addLog(`Upload complete. Work item: ${data.workItemId}`)
        addLog(`Plot job submitted (status: ${data.status})`)
        setWorkItemId(data.workItemId)
        setPdfObjectKey(data.pdfObjectKey)
        setStatus(data.status)
        startWorkItemPolling(data.workItemId, data.pdfObjectKey)
      } else {
        // Model Derivative (SVF2 viewer)
        addLog(`Upload complete. URN: ${data.urn.slice(0, 30)}...`)
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
        addLog(`Status: ${data.status} | Progress: ${data.progress}`)

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

  // Poll for Design Automation work item status (PDF plotting)
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
          if (data.reportUrl) {
            addLog(`Report: ${data.reportUrl}`)
          }
          if (pollingRef.current) clearInterval(pollingRef.current)
        }

        if (data.status === 'failed') {
          addLog(`Plotting FAILED (${data.rawStatus})`)
          if (data.reportUrl) {
            addLog(`Report URL: ${data.reportUrl}`)
          }
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
      // Get viewer token
      const tokenResp = await fetch('/api/aps/token')
      const tokenData = await tokenResp.json()

      if (!tokenData.success) {
        addLog(`Viewer token error: ${tokenData.error}`)
        return
      }

      addLog('Viewer token obtained')

      // Load Autodesk scripts if not already loaded
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

        // Minimal config for 2D — only load essential extensions
        const config = {
          extensions: ['Autodesk.DocumentBrowser'],
        }

        const viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current, config)
        viewer.start()
        viewerRef.current = viewer

        // Fix inverted scroll zoom — reverse direction so scroll-up = zoom-in
        viewer.navigation.setReverseZoomDirection(true)

        addLog('Viewer initialized (zoom direction fixed, 2D-optimized)')

        Autodesk.Viewing.Document.load(
          `urn:${targetUrn}`,
          (doc: any) => {
            docRef.current = doc
            const root = doc.getRoot()

            // Collect all viewable items (sheets/layouts in a 2D DWG)
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

            // Listen for geometry loaded to fitToView and fix layout
            viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
              // Fit the entire drawing to viewport — fixes cropped/weird layout
              viewer.fitToView(undefined, undefined, true) // immediate=true, no animation
              // Re-apply zoom direction in case it was reset
              viewer.navigation.setReverseZoomDirection(true)
              addLog('Drawing fitted to view')
            })

            // Prefer 2D views — find first 2D viewable, fall back to default
            const first2d = sheetList.find(s => s.role === '2d') || sheetList[0]
            if (first2d) {
              const viewable = viewables.find((v: any) => v.guid() === first2d.guid) || viewables[0]
              // Load with performance options for faster 2D loading
              viewer.loadDocumentNode(doc, viewable, {
                skipPropertyDb: true, // Skip property database for faster load
              })
              setActiveSheet(first2d.guid)
              addLog(`Loading 2D view: "${first2d.name}" (optimized)`)
            } else {
              // Fallback — load default geometry
              const defaultGeom = root.getDefaultGeometry()
              viewer.loadDocumentNode(doc, defaultGeom, {
                skipPropertyDb: true,
              })
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

      // Listen for geometry loaded on new sheet to fit again
      viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
        viewer.fitToView(undefined, undefined, true)
        viewer.navigation.setReverseZoomDirection(true)
      }, { once: true })

      viewer.loadDocumentNode(docRef.current, target, {
        skipPropertyDb: true,
      })
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
  const isDwg = file ? /\.(dwg|dxf)$/i.test(file.name) : false

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Autodesk APS — 2D CAD Viewer & PDF Plot</h1>
        <p className="text-sm text-gray-500 mb-6">
          Upload a DWG/DXF file to view 2D drawings or plot to PDF using Design Automation
        </p>

        {/* Upload Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">1. Upload CAD File</h2>

          <div className="flex items-center gap-4 mb-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".dwg,.dxf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const allFiles = Array.from(e.target.files)
                  // First file = main DWG, rest = xrefs
                  setFile(allFiles[0])
                  if (allFiles.length > 1) {
                    setXrefFiles(allFiles.slice(1))
                  } else {
                    setXrefFiles([])
                  }
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Choose DWG / DXF Files
            </button>
            {file && (
              <span className="text-sm text-gray-600">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                {xrefFiles.length > 0 && (
                  <span className="text-blue-600 ml-1">+ {xrefFiles.length} xref(s)</span>
                )}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mb-4">
            Select all files together (main DWG + xref DWGs). First file = main drawing, rest = xrefs.
            <br />
            <strong>Tip:</strong> When used from Project Files, xrefs are fetched automatically from the same Dropbox folder.
          </p>

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

          {/* ---- Xref files info ---- */}
          {xrefFiles.length > 0 && (
            <div className="mb-4 bg-blue-50 rounded-lg border border-blue-200 p-3">
              <p className="text-xs font-semibold text-blue-800 mb-1">
                Xref files detected ({xrefFiles.length})
              </p>
              <div className="space-y-0.5">
                {xrefFiles.map((xf, i) => (
                  <p key={i} className="text-[11px] text-blue-700 font-mono">{xf.name}</p>
                ))}
              </div>
              <p className="text-[11px] text-blue-500 mt-1">
                These will be uploaded alongside the main file so xrefs are resolved properly.
              </p>
            </div>
          )}

          {/* ---- Plot Options (PDF only) ---- */}
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

                  {/* Paper Size */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Paper Size</label>
                      <select
                        value={plotOptions.paperSize}
                        onChange={e => setPlotOptions(o => ({ ...o, paperSize: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                      >
                        {PAPER_SIZES.map(ps => (
                          <option key={ps.value} value={ps.value}>{ps.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Orientation */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Orientation</label>
                      <select
                        value={plotOptions.orientation}
                        onChange={e => setPlotOptions(o => ({ ...o, orientation: e.target.value as 'Landscape' | 'Portrait' }))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                      >
                        <option value="Landscape">Landscape</option>
                        <option value="Portrait">Portrait</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Plot Area */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Plot Area</label>
                      <select
                        value={plotOptions.plotArea}
                        onChange={e => setPlotOptions(o => ({ ...o, plotArea: e.target.value as PlotOptions['plotArea'] }))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                      >
                        <option value="Layout">Layout</option>
                        <option value="Extents">Extents</option>
                        <option value="Display">Display</option>
                        <option value="Limits">Limits</option>
                      </select>
                    </div>

                    {/* Scale */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Scale</label>
                      <select
                        value={plotOptions.scale}
                        onChange={e => setPlotOptions(o => ({ ...o, scale: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                      >
                        {SCALES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Layout Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Layout Name</label>
                    <input
                      type="text"
                      value={plotOptions.layoutName}
                      onChange={e => setPlotOptions(o => ({ ...o, layoutName: e.target.value }))}
                      placeholder="Layout1"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-[11px] text-gray-400 mt-0.5">Enter the layout name from your DWG (e.g. Layout1, Model)</p>
                  </div>

                  {/* Checkboxes */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={plotOptions.plotStyles}
                        onChange={e => setPlotOptions(o => ({ ...o, plotStyles: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      Plot with plot styles
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={plotOptions.lineweights}
                        onChange={e => setPlotOptions(o => ({ ...o, lineweights: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      Plot lineweights
                    </label>
                  </div>

                  {/* CTB File */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Plot Style Table (.ctb)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={ctbInputRef}
                        type="file"
                        accept=".ctb,.stb"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setCtbFile(e.target.files[0])
                            setPlotOptions(o => ({ ...o, plotStyleTable: e.target.files![0].name }))
                          }
                        }}
                      />
                      <button
                        onClick={() => ctbInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Choose .ctb File
                      </button>
                      {ctbFile ? (
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          {ctbFile.name}
                          <button
                            onClick={() => { setCtbFile(null); setPlotOptions(o => ({ ...o, plotStyleTable: '' })) }}
                            className="text-red-400 hover:text-red-600 ml-1"
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No CTB selected (will use default)</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : outputFormat === 'pdf' ? 'Upload & Plot' : 'Upload & Process'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Status Section */}
        {showStatusSection && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              2. {workItemId ? 'Plot Status' : 'Translation Status'}
            </h2>

            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <p className={`text-sm font-semibold ${
                  status === 'success' ? 'text-green-600' :
                  status === 'failed' || status === 'timeout' ? 'text-red-600' :
                  'text-amber-600'
                }`}>
                  {status || 'Starting...'}
                </p>
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
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500 animate-pulse"
                  style={{ width: progress || '10%' }}
                />
              </div>
            )}
          </div>
        )}

        {/* PDF Download Section */}
        {pdfDownloadUrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">3. Download PDF</h2>
            <p className="text-sm text-gray-600 mb-4">
              Your DWG has been plotted to PDF using the AutoCAD engine with all layouts and plot styles.
            </p>
            <a
              href={pdfDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </a>
          </div>
        )}

        {/* Viewer Section */}
        {viewerReady && (
          <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">2D Drawing Viewer</h2>

              {/* Sheet/Layout switcher */}
              {sheets.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 mr-2">Layouts:</span>
                  {sheets.map((sheet) => (
                    <button
                      key={sheet.guid}
                      onClick={() => switchSheet(sheet.guid)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        activeSheet === sheet.guid
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              ref={viewerContainerRef}
              className="w-full bg-white"
              style={{ height: '700px' }}
            />

            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-400">
                Pan: Click + Drag &nbsp;|&nbsp; Zoom: Scroll wheel &nbsp;|&nbsp;
                Layers: Use the layer panel in the toolbar &nbsp;|&nbsp;
                Measure: Use the measure tool in the toolbar
              </p>
            </div>
          </div>
        )}

        {/* Log Section */}
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Logs</h2>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-xs text-gray-500 hover:text-gray-400"
              >
                Clear
              </button>
            )}
          </div>
          <div className="font-mono text-xs text-green-400 space-y-1 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity yet. Upload a DWG file to start.</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className={
                  log.includes('ERROR') || log.includes('FAILED') ? 'text-red-400' :
                  log.includes('complete') || log.includes('success') || log.includes('ready') || log.includes('fitted') ? 'text-emerald-400' :
                  log.includes('Warning') ? 'text-yellow-400' :
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
