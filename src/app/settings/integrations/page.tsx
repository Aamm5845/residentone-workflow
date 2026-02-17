'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Video,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Unplug,
  Plug,
} from 'lucide-react'
import Link from 'next/link'

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Top Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Settings
              </Button>
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Integrations</h1>
              <p className="text-xs text-gray-500">Connect third-party services to enhance your workflow</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        <ZoomIntegrationCard />
        {/* Future integrations can be added here */}
      </div>
    </div>
  )
}

function ZoomIntegrationCard() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [configured, setConfigured] = useState(true)
  const [zoomEmail, setZoomEmail] = useState<string | null>(null)
  const [connectedBy, setConnectedBy] = useState<string | null>(null)
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [integrationStatus, setIntegrationStatus] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()

    // Show messages from OAuth redirect
    const params = new URLSearchParams(window.location.search)
    const zoomParam = params.get('zoom')
    if (zoomParam === 'connected') {
      setSuccessMessage('Zoom connected successfully!')
      window.history.replaceState({}, '', '/settings/integrations')
    } else if (zoomParam === 'denied') {
      setError('Zoom authorization was denied. Please try again.')
      window.history.replaceState({}, '', '/settings/integrations')
    } else if (zoomParam === 'error') {
      setError('Failed to connect Zoom. Please try again.')
      window.history.replaceState({}, '', '/settings/integrations')
    }
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/integrations/zoom/status')
      const data = await res.json()
      setConnected(data.connected)
      setConfigured(data.configured !== false)
      setZoomEmail(data.email || null)
      setConnectedBy(data.connectedBy || null)
      setConnectedAt(data.connectedAt || null)
      setIntegrationStatus(data.status || null)
    } catch {
      setError('Failed to check Zoom status')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = () => {
    // Redirect to the OAuth connect endpoint
    window.location.href = '/api/integrations/zoom/connect'
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/zoom/disconnect', { method: 'POST' })
      if (res.ok) {
        setConnected(false)
        setZoomEmail(null)
        setConnectedBy(null)
        setConnectedAt(null)
        setSuccessMessage('Zoom disconnected successfully')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to disconnect')
      }
    } catch {
      setError('Network error')
    } finally {
      setDisconnecting(false)
    }
  }

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(t)
    }
  }, [successMessage])

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 8000)
      return () => clearTimeout(t)
    }
  }, [error])

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Video className="w-5 h-5" />
                </div>
                {connected && (
                  <span className="text-sm font-medium text-blue-100 bg-white/10 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Connected
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold mb-2">Zoom Integration</h2>
              <p className="text-blue-100 max-w-md leading-relaxed">
                Automatically create Zoom meetings when scheduling virtual meetings. Your team can join with one click.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 rounded-xl p-4 border border-emerald-200">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 rounded-xl p-4 border border-red-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Connection Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking Zoom connection...
          </div>
        ) : !configured ? (
          /* Zoom not configured in environment */
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Video className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Zoom Not Configured</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Zoom OAuth credentials are not set up in the environment. Please configure ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_REDIRECT_URI to enable this integration.
            </p>
          </div>
        ) : connected ? (
          /* Connected state */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{zoomEmail || 'Zoom Account'}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {connectedBy && <span>Connected by {connectedBy}</span>}
                    {connectedAt && (
                      <span>
                        {connectedBy ? ' on ' : 'Connected '}
                        {new Date(connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Unplug className="w-4 h-4 mr-1.5" />
                )}
                Disconnect
              </Button>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h4 className="text-sm font-medium text-blue-900 mb-1.5">How it works</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                  When you schedule a virtual meeting, a Zoom room is automatically created
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                  Join links are included in meeting invitations and calendar events
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                  Cancelling a meeting automatically removes the Zoom room
                </li>
              </ul>
            </div>
          </div>
        ) : integrationStatus === 'ERROR' ? (
          /* Error state - needs reconnection */
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-3 bg-red-50 rounded-2xl flex items-center justify-center">
              <XCircle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Connection Error</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
              The Zoom connection has expired or been revoked. Please reconnect to continue auto-creating Zoom meetings.
            </p>
            <Button onClick={handleConnect} className="bg-blue-600 hover:bg-blue-700">
              <Plug className="w-4 h-4 mr-2" />
              Reconnect Zoom
            </Button>
          </div>
        ) : (
          /* Not connected */
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto mb-3 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Video className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Connect Your Zoom Account</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
              Link your organization&apos;s Zoom account to automatically create meeting rooms when scheduling virtual meetings.
            </p>
            <Button onClick={handleConnect} className="bg-blue-600 hover:bg-blue-700">
              <Plug className="w-4 h-4 mr-2" />
              Connect Zoom
            </Button>
            <p className="text-xs text-gray-400 mt-3">
              Only Owners and Admins can connect integrations.
              You&apos;ll be redirected to Zoom to authorize.
            </p>
          </div>
        )}
      </div>

      {/* Setup Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Zoom App Setup</h3>
        <p className="text-xs text-gray-500 mb-3">
          To use this integration, a Zoom OAuth app must be configured in the Zoom Marketplace.
        </p>
        <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
          <li>
            Go to{' '}
            <a
              href="https://marketplace.zoom.us/develop/create"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
            >
              Zoom Marketplace
              <ExternalLink className="w-3 h-3" />
            </a>{' '}
            and create a General App (OAuth type)
          </li>
          <li>Set the redirect URL to your app&apos;s callback endpoint</li>
          <li>Add scopes: <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">meeting:write:meeting</code> and <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">user:read</code></li>
          <li>Copy the Client ID and Client Secret to your environment variables</li>
        </ol>
      </div>
    </div>
  )
}
