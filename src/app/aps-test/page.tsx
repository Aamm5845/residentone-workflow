'use client'

import { useState, useRef, useEffect } from 'react'

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
  const [viewerToken, setViewerToken] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${time}] ${msg}`])
  }

  // Upload & translate
  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    setUrn(null)
    setStatus('')
    setProgress('')
    setViewerReady(false)
    setLogs([])

    addLog(`Uploading "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)...`)
    addLog(`Output format: ${outputFormat}`)

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

      // Start polling for status
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
            addLog('Loading Autodesk Viewer...')
            setViewerReady(true)
            loadViewer(targetUrn)
          } else {
            addLog('PDF derivative ready. Check derivatives for download.')
            // Log the derivatives info
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
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      } catch (err: any) {
        addLog(`Polling error: ${err.message}`)
      }
    }, 5000) // poll every 5 seconds
  }

  // Load Autodesk Viewer
  const loadViewer = async (targetUrn: string) => {
    try {
      // Get viewer token
      const tokenResp = await fetch('/api/aps/token')
      const tokenData = await tokenResp.json()

      if (!tokenData.success) {
        addLog(`Viewer token error: ${tokenData.error}`)
        return
      }

      setViewerToken(tokenData.access_token)
      addLog('Viewer token obtained')

      // Wait for Autodesk scripts to be loaded
      if (typeof (window as any).Autodesk === 'undefined') {
        addLog('Loading Autodesk Viewer SDK scripts...')
        // Load CSS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.css'
        document.head.appendChild(link)

        // Load JS
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Autodesk Viewer SDK'))
          document.head.appendChild(script)
        })
        addLog('Autodesk Viewer SDK loaded')
      }

      // Initialize viewer
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

        const viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current)
        viewer.start()

        Autodesk.Viewing.Document.load(
          `urn:${targetUrn}`,
          (doc: any) => {
            const defaultModel = doc.getRoot().getDefaultGeometry()
            viewer.loadDocumentNode(doc, defaultModel)
            addLog('Model loaded in viewer!')
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Autodesk APS Test</h1>
        <p className="text-sm text-gray-500 mb-6">
          Upload a DWG/DXF/RVT file to test translation and viewing
        </p>

        {/* Upload Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">1. Upload CAD File</h2>

          <div className="flex items-center gap-4 mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".dwg,.dxf,.rvt,.ifc,.nwd,.nwc,.skp,.f3d,.sldprt,.sldasm,.ipt,.iam,.step,.stp,.iges,.igs,.stl,.obj,.fbx,.3ds"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setFile(e.target.files[0])
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Choose File
            </button>
            {file && (
              <span className="text-sm text-gray-600">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium text-gray-700">Output Format:</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as 'svf2' | 'pdf')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="svf2">SVF2 (3D Viewer)</option>
              <option value="pdf">PDF (Convert to PDF)</option>
            </select>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading & Starting Translation...' : 'Upload & Translate'}
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

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <p className={`text-sm font-medium ${
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
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">URN</p>
                <p className="text-xs font-mono text-gray-600 break-all">{urn}</p>
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
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">3. Autodesk Viewer</h2>
            <div
              ref={viewerContainerRef}
              className="w-full h-[600px] bg-gray-900 rounded-lg overflow-hidden"
            />
          </div>
        )}

        {/* Log Section */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Logs</h2>
          <div className="font-mono text-xs text-green-400 space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity yet. Upload a file to start.</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className={log.includes('ERROR') ? 'text-red-400' : ''}>{log}</p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
