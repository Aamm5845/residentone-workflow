'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Chrome, CheckCircle, ExternalLink, RefreshCw, FolderOpen, Settings, Loader2, Building2, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

