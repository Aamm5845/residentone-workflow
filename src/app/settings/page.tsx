'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Download, Chrome, CheckCircle, ExternalLink, RefreshCw,
  FolderOpen, Settings, Loader2, Building2, FileSpreadsheet,
  CreditCard, KeyRound, Copy, Trash2, AlertTriangle, Timer,
  Monitor, ChevronRight, Shield, Puzzle, Wrench, Package,
  ArrowLeft, Clock, Zap, MousePointerClick, Eye, Globe,
  Laptop, Mail, Info
} from 'lucide-react'
import Link from 'next/link'

// ─── Version Constants ───────────────────────────────────────
const TIMER_VERSION = '1.2.0'
const CLIPPER_VERSION = '1.2.0'

// ─── Sidebar Nav Items ───────────────────────────────────────
const navSections = [
  {
    label: 'Tools & Downloads',
    items: [
      { id: 'timer', label: 'Desktop Timer', icon: Timer, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { id: 'clipper', label: 'FFE Clipper', icon: Chrome, color: 'text-blue-600', bg: 'bg-blue-50' },
      { id: 'api-key', label: 'API Key', icon: KeyRound, color: 'text-violet-600', bg: 'bg-violet-50' },
    ]
  },
  {
    label: 'Configuration',
    items: [
      { id: 'business', label: 'Business Profile', icon: Building2, color: 'text-orange-600', bg: 'bg-orange-50', href: '/settings/business' },
      { id: 'payment', label: 'Payment Methods', icon: CreditCard, color: 'text-pink-600', bg: 'bg-pink-50', href: '/settings/payment-methods' },
      { id: 'library', label: 'Item Library', icon: FolderOpen, color: 'text-amber-600', bg: 'bg-amber-50', href: '/settings/item-library' },
      { id: 'import', label: 'Programa Import', icon: FileSpreadsheet, color: 'text-teal-600', bg: 'bg-teal-50', href: '/settings/programa-import' },
      { id: 'preferences', label: 'Preferences', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-100', href: '/preferences' },
    ]
  },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('timer')

  // Chrome extension download
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

  // ─── Handlers ──────────────────────────────────────────────

  const handleDownload = () => {
    setDownloading(true)
    setError(null)
    const link = document.createElement('a')
    link.href = '/downloads/meisner-ffe-clipper.zip'
    link.download = 'meisner-ffe-clipper.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setDownloadSuccess(true)
    setDownloading(false)
  }

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
      // Silently fail
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
        setMaskedKey(null)
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

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Top Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Dashboard
              </Button>
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content: Sidebar + Main */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="sticky top-20 space-y-6">
              {navSections.map((section) => (
                <div key={section.label}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1.5">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const isLink = 'href' in item && item.href
                      const isActive = !isLink && activeSection === item.id

                      if (isLink) {
                        return (
                          <Link
                            key={item.id}
                            href={(item as any).href}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors group"
                          >
                            <Icon className={`w-4 h-4 ${item.color}`} />
                            <span className="flex-1">{item.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400" />
                          </Link>
                        )
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60 font-medium'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? item.color : 'text-gray-400'}`} />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {activeSection === 'timer' && <TimerSection />}
            {activeSection === 'clipper' && (
              <ClipperSection
                downloading={downloading}
                downloadSuccess={downloadSuccess}
                error={error}
                handleDownload={handleDownload}
              />
            )}
            {activeSection === 'api-key' && (
              <ApiKeySection
                keyLoading={keyLoading}
                hasKey={hasKey}
                maskedKey={maskedKey}
                keyCreatedAt={keyCreatedAt}
                fullKey={fullKey}
                generating={generating}
                revoking={revoking}
                copied={copied}
                keyError={keyError}
                handleGenerateKey={handleGenerateKey}
                handleRevokeKey={handleRevokeKey}
                handleCopyKey={handleCopyKey}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// SECTION: Desktop Timer
// ═══════════════════════════════════════════════════════════════

function TimerSection() {
  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Timer className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-emerald-100 bg-white/10 px-2.5 py-0.5 rounded-full">
                  v{TIMER_VERSION}
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Desktop Time Tracker</h2>
              <p className="text-emerald-100 max-w-md leading-relaxed">
                A lightweight floating timer that sits on your desktop. Start, stop, and switch project timers with one click.
              </p>
            </div>
            <a href="/downloads/StudioFlow-Timer-Setup.exe" download className="flex-shrink-0">
              <Button className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-lg shadow-emerald-900/20 font-semibold h-11 px-6">
                <Download className="w-4 h-4 mr-2" />
                Download v{TIMER_VERSION}
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Quick Setup Steps */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          Quick Setup
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Install', desc: 'Run the .exe installer. It creates a desktop shortcut automatically.', icon: Package },
            { step: '2', title: 'Sign In', desc: 'Log in with your StudioFlow email and password.', icon: KeyRound },
            { step: '3', title: 'Track', desc: 'Click any project to start a timer. Entries sync to your Timeline.', icon: Clock },
          ].map((s) => (
            <div key={s.step} className="relative">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Features</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Laptop, label: 'Always-on-top floating window', color: 'text-blue-500' },
            { icon: MousePointerClick, label: 'One-click project switching', color: 'text-violet-500' },
            { icon: Clock, label: 'Start / Stop / Pause timers', color: 'text-emerald-500' },
            { icon: Zap, label: 'Auto-stop on project switch', color: 'text-amber-500' },
            { icon: Eye, label: 'Minimize to system tray', color: 'text-pink-500' },
            { icon: Globe, label: 'Syncs live with your Timeline', color: 'text-teal-500' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2.5 text-sm text-gray-700 py-1.5">
              <f.icon className={`w-4 h-4 ${f.color} flex-shrink-0`} />
              {f.label}
            </div>
          ))}
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-emerald-900 text-sm">Per-member tracking</p>
          <p className="text-sm text-emerald-700 mt-0.5">
            Each team member signs in with their own StudioFlow email and password. All hours are automatically tracked under their profile.
          </p>
        </div>
      </div>

      {/* Version History */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          Version History
        </h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <div className="w-px flex-1 bg-gray-200 mt-1" />
            </div>
            <div className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 text-sm">v1.2.0</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Latest</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li>Email &amp; password login (no more API key needed!)</li>
                <li>Sign in with the same account you use on the website</li>
                <li>Session stays active for 7 days</li>
                <li>Fixed close button (X) not quitting the app</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-gray-50" />
              <div className="w-px flex-1 bg-gray-200 mt-1" />
            </div>
            <div className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 text-sm">v1.1.0</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li>User profile bar, SF icon, performance improvements</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-gray-50" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 text-sm">v1.0.0</span>
                <span className="text-xs text-gray-500">Initial Release</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li>Desktop timer with project list</li>
                <li>Start, stop, pause functionality</li>
                <li>System tray support</li>
                <li>Windows installer (.exe)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// SECTION: FFE Clipper Extension
// ═══════════════════════════════════════════════════════════════

function ClipperSection({
  downloading,
  downloadSuccess,
  error,
  handleDownload,
}: {
  downloading: boolean
  downloadSuccess: boolean
  error: string | null
  handleDownload: () => void
}) {
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
                  <Chrome className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-blue-100 bg-white/10 px-2.5 py-0.5 rounded-full">
                  v{CLIPPER_VERSION}
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-2">FFE Clipper Extension</h2>
              <p className="text-blue-100 max-w-md leading-relaxed">
                Clip products from any website directly to your FFE schedules. Works with Chrome, Edge, and Brave.
              </p>
            </div>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg shadow-blue-900/20 font-semibold h-11 px-6 flex-shrink-0"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download v{CLIPPER_VERSION}
                </>
              )}
            </Button>
          </div>
          {downloadSuccess && (
            <div className="mt-4 flex items-center gap-2 text-emerald-200 text-sm bg-white/10 rounded-lg px-3 py-2 w-fit">
              <CheckCircle className="w-4 h-4" />
              Download started! Check your downloads folder.
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-200 text-sm bg-white/10 rounded-lg px-3 py-2 w-fit">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Installation Steps */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-gray-400" />
          Installation Steps
        </h3>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Extract the ZIP', desc: <>Unzip to a folder like <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">C:\Extensions\meisner-ffe-clipper</code></> },
            { step: '2', title: 'Open Chrome Extensions', desc: <>Go to <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">chrome://extensions</code> and turn on <strong>Developer mode</strong></> },
            { step: '3', title: 'Load Unpacked', desc: <>Click <strong>Load unpacked</strong> and select the extracted folder</> },
            { step: '4', title: 'Done!', desc: <>Click the extension icon and log in with your StudioFlow account</> },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                s.step === '4' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {s.step === '4' ? <CheckCircle className="w-4 h-4" /> : s.step}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Features</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Zap, label: 'AI-powered smart fill', color: 'text-amber-500' },
            { icon: MousePointerClick, label: 'Right-click image clipping', color: 'text-violet-500' },
            { icon: Puzzle, label: 'Link to FFE items', color: 'text-blue-500' },
            { icon: FolderOpen, label: 'Multi-room product linking', color: 'text-emerald-500' },
            { icon: FileSpreadsheet, label: 'PDF attachment detection', color: 'text-rose-500' },
            { icon: Globe, label: 'Supplier integration', color: 'text-teal-500' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2.5 text-sm text-gray-700 py-1.5">
              <f.icon className={`w-4 h-4 ${f.color} flex-shrink-0`} />
              {f.label}
            </div>
          ))}
        </div>
      </div>

      {/* Update Note */}
      <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 flex items-start gap-3">
        <RefreshCw className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-amber-900 text-sm">Updating the Extension</p>
          <p className="text-sm text-amber-700 mt-0.5">
            Download the new ZIP, extract it over your existing folder, then go to <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">chrome://extensions</code> and click the refresh icon.
          </p>
        </div>
      </div>

      {/* Version History */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          Version History
        </h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-50" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 text-sm">v{CLIPPER_VERSION}</span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Latest</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li>AI-powered smart fill for FFE items</li>
                <li>Right-click image clipping</li>
                <li>PDF attachment detection</li>
                <li>Multi-room product linking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// SECTION: API Key Management
// ═══════════════════════════════════════════════════════════════

function ApiKeySection({
  keyLoading, hasKey, maskedKey, keyCreatedAt, fullKey,
  generating, revoking, copied, keyError,
  handleGenerateKey, handleRevokeKey, handleCopyKey,
}: {
  keyLoading: boolean
  hasKey: boolean
  maskedKey: string | null
  keyCreatedAt: string | null
  fullKey: string | null
  generating: boolean
  revoking: boolean
  copied: boolean
  keyError: string | null
  handleGenerateKey: () => void
  handleRevokeKey: () => void
  handleCopyKey: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-violet-500 via-violet-600 to-purple-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <KeyRound className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Extension API Key</h2>
          <p className="text-violet-100 max-w-lg leading-relaxed">
            Your personal API key connects the Desktop Timer, Chrome Extension, and Gmail Add-on to your StudioFlow account. Each team member needs their own key.
          </p>
        </div>
      </div>

      {/* Key Management Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-500" />
          Your API Key
        </h3>

        {keyLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking key status...
          </div>
        ) : fullKey ? (
          /* Just generated — show the full key */
          <div className="space-y-4">
            <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
              <div className="flex items-center justify-between gap-3">
                <code className="text-sm font-mono text-violet-900 break-all flex-1 select-all">
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
                      <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
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
            <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-4 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>Save this key now</strong> — you won&apos;t see it again after leaving this page. Paste it into the Desktop Timer, Gmail Add-on, or Chrome Extension.
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
                {revoking ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                Revoke Key
              </Button>
            </div>
          </div>
        ) : hasKey ? (
          /* Has existing key — show masked */
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <code className="text-sm font-mono text-gray-600">
                    {maskedKey}
                  </code>
                  {keyCreatedAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(keyCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              The full key is only shown once when first generated. To get a new one, revoke this key and generate a new one.
            </p>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleRevokeKey()
                  setTimeout(() => handleGenerateKey(), 500)
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
                {revoking ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                Revoke
              </Button>
            </div>
          </div>
        ) : (
          /* No key — generate */
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-3 bg-violet-50 rounded-2xl flex items-center justify-center">
                <KeyRound className="w-7 h-7 text-violet-400" />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                No API key yet. Generate one to connect external tools to your account.
              </p>
              <Button
                onClick={handleGenerateKey}
                disabled={generating}
                className="bg-violet-600 hover:bg-violet-700"
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
          </div>
        )}

        {keyError && (
          <div className="flex items-center gap-2 text-red-600 text-sm mt-4 bg-red-50 rounded-lg p-3 border border-red-100">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {keyError}
          </div>
        )}
      </div>

      {/* What uses your API key */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Where is it used?</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Timer, label: 'Desktop Timer', desc: 'Track hours from your desktop', color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { icon: Chrome, label: 'FFE Clipper', desc: 'Clip products from websites', color: 'text-blue-500', bg: 'bg-blue-50' },
            { icon: Mail, label: 'Gmail Add-on', desc: 'Match emails to projects', color: 'text-red-500', bg: 'bg-red-50' },
          ].map((t) => (
            <div key={t.label} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
              <div className={`w-9 h-9 ${t.bg} rounded-lg flex items-center justify-center mb-2`}>
                <t.icon className={`w-4 h-4 ${t.color}`} />
              </div>
              <p className="font-medium text-gray-900 text-sm">{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
