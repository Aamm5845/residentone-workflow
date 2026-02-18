'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export default function ApsTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [urn, setUrn] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [outputFormat, setOutputFormat] = useState<'svf2' | 'pdf'>('svf2')
  const [viewerReady, setViewerReady] = useState(false)
  const [sheets, setSheets] = useState<Array<{ name: string; guid: string; role: string }>>([])
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const docRef = useRef<any>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${time}] ${msg}`])
  }, [])

  // Upload & translate
  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    setUrn(null)
    setStatus('')
    setProgress('')
    setViewerReady(false)
    setSheets([])
    setActiveSheet(null)
    setLogs([])

    addLog(`Uploading "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)...`)
    addLog(`Output: ${outputFormat === 'svf2' ? '2D Viewer' : 'PDF conversion'}`)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('outputFormat', outputFormat)

      const resp = await fetch('/api/aps/translate', {
        method: 'POST',
        body: formData,
      })

      const data = await resp.json()

      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      addLog(`Upload complete. URN: ${data.urn.slice(0, 30)}...`)
      addLog(`Translation started (status: ${data.status})`)
      setUrn(data.urn)
      setStatus(data.status)

      // Start polling
      startPolling(data.urn)
    } catch (err: any) {
      setError(err.message)
      addLog(`ERROR: ${err.message}`)
    }

    setUploading(false)
  }

  // Poll for translation status
  const startPolling = (targetUrn: string) => {
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
          if (outputFormat === 'svf2') {
            addLog('Loading 2D Viewer...')
            setViewerReady(true)
            loadViewer(targetUrn)
          } else {
            addLog('PDF derivative ready.')
            if (data.derivatives) {
              data.derivatives.forEach((d: any) => {
                addLog(`  Derivative: ${d.outputType} (${d.status})`)
                if (d.children) {
                  d.children.forEach((c: any) => {
                    addLog(`    - ${c.role}: ${c.type} ${c.name || ''}`)
                  })
                }
              })
            }
          }
          if (pollingRef.current) clearInterval(pollingRef.current)
        }

        if (data.status === 'failed' || data.status === 'timeout') {
          addLog(`Translation FAILED (${data.status})`)
          // Log derivatives for debugging
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

        // Use GuiViewer3D — it handles both 2D and 3D with toolbar
        const viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current)
        viewer.start()
        viewerRef.current = viewer

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

            // Prefer 2D views — find first 2D viewable, fall back to default
            const first2d = sheetList.find(s => s.role === '2d') || sheetList[0]
            if (first2d) {
              const viewable = viewables.find((v: any) => v.guid() === first2d.guid) || viewables[0]
              viewer.loadDocumentNode(doc, viewable)
              setActiveSheet(first2d.guid)
              addLog(`Loaded 2D view: "${first2d.name}"`)
            } else {
              // Fallback — load default geometry
              const defaultGeom = root.getDefaultGeometry()
              viewer.loadDocumentNode(doc, defaultGeom)
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
      viewerRef.current.loadDocumentNode(docRef.current, target)
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Autodesk APS — 2D CAD Viewer Test</h1>
        <p className="text-sm text-gray-500 mb-6">
          Upload a DWG/DXF file to view 2D drawings with all layers, dimensions, and details
        </p>

        {/* Upload Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">1. Upload CAD File</h2>

          <div className="flex items-center gap-4 mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".dwg,.dxf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setFile(e.target.files[0])
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Choose DWG / DXF File
            </button>
            {file && (
              <span className="text-sm text-gray-600">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            )}
          </div>

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
                Convert to PDF
              </button>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Status Section */}
        {urn && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">2. Translation Status</h2>

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
                  log.includes('ERROR') ? 'text-red-400' :
                  log.includes('complete') || log.includes('success') ? 'text-emerald-400' :
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
