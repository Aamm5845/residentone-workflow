'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Chrome, CheckCircle, ExternalLink, RefreshCw, FolderOpen, Settings, Loader2, Building2, FileSpreadsheet, CreditCard, KeyRound, Copy, Trash2, AlertTriangle, Timer, Monitor } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extension API Key state
  const [keyLoading, setKeyLoading] = useState(true)
  const [hasKey, setHasKey] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [keyCreatedAt, setKeyCreatedAt] = useState<string | null>(null)
  const [fullKey, setFullKey] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  const handleDownload = () => {
    setDownloading(true)
    setError(null)

    // Direct download from public folder
    const link = document.createElement('a')
    link.href = '/downloads/meisner-ffe-clipper.zip'
    link.download = 'meisner-ffe-clipper.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setDownloadSuccess(true)
    setDownloading(false)
  }

  // Fetch key status on mount
  useEffect(() => {
    fetchKeyStatus()
  }, [])

  const fetchKeyStatus = async () => {
    setKeyLoading(true)
    try {
      const res = await fetch('/api/extension/auth/key-status')
      if (res.ok) {
        const data = await res.json()
        setHasKey(data.hasKey)
        setMaskedKey(data.maskedKey || null)
        setKeyCreatedAt(data.createdAt || null)
      }
    } catch {
      // Silently fail — just show generate button
    } finally {
      setKeyLoading(false)
    }
  }

  const handleGenerateKey = async () => {
    setGenerating(true)
    setKeyError(null)
    try {
      const res = await fetch('/api/extension/auth', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.apiKey) {
        setFullKey(data.apiKey)
        setHasKey(true)
        setMaskedKey(null) // We have the full key, no need for masked
      } else {
        setKeyError(data.error || 'Failed to generate key')
      }
    } catch {
      setKeyError('Network error. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleRevokeKey = async () => {
    setRevoking(true)
    setKeyError(null)
    try {
      const res = await fetch('/api/extension/auth', { method: 'DELETE' })
      if (res.ok) {
        setHasKey(false)
        setMaskedKey(null)
        setFullKey(null)
        setKeyCreatedAt(null)
      } else {
        const data = await res.json()
        setKeyError(data.error || 'Failed to revoke key')
      }
    } catch {
      setKeyError('Network error. Please try again.')
    } finally {
      setRevoking(false)
    }
  }

  const handleCopyKey = async () => {
    if (!fullKey) return
    try {
      await navigator.clipboard.writeText(fullKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = fullKey
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                ← Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">Extensions and tools</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Chrome Extension Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Chrome className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>FFE Clipper Extension</CardTitle>
                <CardDescription>
                  Clip products from any website directly to your FFE schedules
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Download Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Download Extension</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Version 1.2.0 • Works with Chrome, Edge, and Brave
                    </p>
                    {downloadSuccess && (
                      <div className="flex items-center gap-2 text-green-600 text-sm mb-3">
                        <CheckCircle className="w-4 h-4" />
                        Download started! Check your downloads folder.
                      </div>
                    )}
                    {error && (
                      <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
                        <span>⚠️</span>
                        {error}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download ZIP
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Installation Instructions */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Installation Steps</h4>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                    <div>
                      <p className="font-medium text-gray-900">Extract the ZIP</p>
                      <p className="text-sm text-gray-500">Extract to a folder like <code className="bg-gray-100 px-1.5 py-0.5 rounded">C:\Extensions\meisner-ffe-clipper</code></p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                    <div>
                      <p className="font-medium text-gray-900">Open Chrome Extensions</p>
                      <p className="text-sm text-gray-500">
                        Go to <code className="bg-gray-100 px-1.5 py-0.5 rounded">chrome://extensions</code> and enable <strong>Developer mode</strong>
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                    <div>
                      <p className="font-medium text-gray-900">Load Unpacked</p>
                      <p className="text-sm text-gray-500">Click <strong>Load unpacked</strong> and select the extracted folder</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">✓</span>
                    <div>
                      <p className="font-medium text-gray-900">Done!</p>
                      <p className="text-sm text-gray-500">Click the extension icon and log in with your StudioFlow account</p>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Update Instructions */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <div className="flex items-start gap-3">
                  <RefreshCw className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900">Updating the Extension</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      When a new version is released, download the new ZIP, extract it over your existing folder,
                      then go to <code className="bg-amber-100 px-1 py-0.5 rounded">chrome://extensions</code> and click the refresh icon on the extension.
                    </p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Features</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    AI-powered smart fill
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Right-click image clipping
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Link to FFE items
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Multi-room product linking
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    PDF attachment detection
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Supplier integration
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integrations / Extension API Key Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>Extension API Key</CardTitle>
                <CardDescription>
                  Generate an API key for external integrations like the Gmail Add-on and Chrome Extension. Each team member generates their own key.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {keyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking key status...
                </div>
              ) : fullKey ? (
                /* Just generated — show the full key */
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center justify-between gap-3">
                      <code className="text-sm font-mono text-purple-900 break-all flex-1 select-all">
                        {fullKey}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyKey}
                        className="shrink-0"
                      >
                        {copied ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1.5 text-green-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800">
                      Save this key now — you won&apos;t be able to see it again after you leave this page.
                      Paste it into the Gmail Add-on or any integration that requires it.
                    </p>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRevokeKey}
                      disabled={revoking}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {revoking ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-1.5" />
                      )}
                      Revoke Key
                    </Button>
                  </div>
                </div>
              ) : hasKey ? (
                /* Has an existing key (revisiting page) — show masked */
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <code className="text-sm font-mono text-gray-600">
                          {maskedKey}
                        </code>
                        {keyCreatedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Created {new Date(keyCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    For security, the full key is only shown once when generated. To get a new key, revoke this one and generate a new one.
                  </p>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHasKey(false)
                        setMaskedKey(null)
                        handleRevokeKey().then(() => handleGenerateKey())
                      }}
                      disabled={revoking || generating}
                    >
                      {(revoking || generating) ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-1.5" />
                      )}
                      Regenerate Key
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRevokeKey}
                      disabled={revoking}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {revoking ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-1.5" />
                      )}
                      Revoke Key
                    </Button>
                  </div>
                </div>
              ) : (
                /* No key — show generate button */
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    You don&apos;t have an API key yet. Generate one to use with the Gmail Add-on or other integrations.
                  </p>
                  <Button
                    onClick={handleGenerateKey}
                    disabled={generating}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4 mr-2" />
                        Generate API Key
                      </>
                    )}
                  </Button>
                </div>
              )}

              {keyError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <span>⚠️</span>
                  {keyError}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Desktop Timer Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Timer className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <CardTitle>Desktop Time Tracker</CardTitle>
                <CardDescription>
                  A lightweight floating timer for your desktop — start, stop, and switch project timers with one click so you never forget to log hours.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Download Section */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Download Desktop Timer</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      Version 1.0.0 • Windows, Mac, Linux
                    </p>
                    <p className="text-xs text-gray-500">
                      Requires <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Node.js</a> (LTS) installed on the computer
                    </p>
                  </div>
                  <a
                    href="https://github.com/Aamm5845/residentone-workflow/archive/refs/heads/main.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Download className="w-4 h-4 mr-2" />
                      Download ZIP
                    </Button>
                  </a>
                </div>
              </div>

              {/* Installation Instructions */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Setup Instructions</h4>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                    <div>
                      <p className="font-medium text-gray-900">Install Node.js</p>
                      <p className="text-sm text-gray-500">
                        Download and install from <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">nodejs.org</a> (LTS version). Skip if already installed.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                    <div>
                      <p className="font-medium text-gray-900">Extract the ZIP</p>
                      <p className="text-sm text-gray-500">
                        Extract the downloaded ZIP. Navigate into the <code className="bg-gray-100 px-1.5 py-0.5 rounded">desktop-timer</code> folder.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                    <div>
                      <p className="font-medium text-gray-900">Install &amp; Run</p>
                      <p className="text-sm text-gray-500">
                        Open a terminal in the <code className="bg-gray-100 px-1.5 py-0.5 rounded">desktop-timer</code> folder and run:
                      </p>
                      <div className="mt-2 bg-gray-900 text-gray-100 rounded-lg p-3 text-sm font-mono">
                        <div>npm install</div>
                        <div>npm start</div>
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                    <div>
                      <p className="font-medium text-gray-900">Connect with your API Key</p>
                      <p className="text-sm text-gray-500">
                        On first launch, paste your <strong>Extension API Key</strong> (from the section above). The timer connects to StudioFlow automatically.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">✓</span>
                    <div>
                      <p className="font-medium text-gray-900">Start tracking!</p>
                      <p className="text-sm text-gray-500">
                        Click any project to start a timer. Click another project to auto-switch. All entries appear in your Timeline.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Features */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Features</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Always-on-top floating window
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    One-click project switching
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Start / Stop / Pause timers
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Auto-stop on project switch
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Minimize to system tray
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Syncs live with Timeline
                  </div>
                </div>
              </div>

              {/* Tip */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <div className="flex items-start gap-3">
                  <Monitor className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Quick Tip</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Each team member needs their own Extension API Key. Generate one above, then paste it into the desktop timer on first launch. The key is saved locally — you only need to enter it once per computer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other Settings Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">More Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Link href="/settings/business" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Business Profile</p>
                    <p className="text-sm text-gray-500">Logo, tax numbers, and invoice settings</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="/settings/payment-methods" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Payment Methods</p>
                    <p className="text-sm text-gray-500">Saved credit cards for supplier payments</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="/settings/item-library" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Item Library</p>
                    <p className="text-sm text-gray-500">Manage your product library</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="/settings/programa-import" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Programa Import</p>
                    <p className="text-sm text-gray-500">Import items from Excel and link to FFE</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="/preferences" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Preferences</p>
                    <p className="text-sm text-gray-500">Notification and display settings</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
