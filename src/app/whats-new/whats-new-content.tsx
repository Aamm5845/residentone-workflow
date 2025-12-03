'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Sparkles, 
  Zap, 
  Wrench, 
  Megaphone, 
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Bell,
  Camera,
  Lock,
  Star,
  LucideIcon
} from 'lucide-react'
import { changelog, ChangelogEntry } from '@/data/changelog'

const typeConfig = {
  feature: {
    icon: Sparkles,
    label: 'New Feature',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-500'
  },
  improvement: {
    icon: Zap,
    label: 'Improvement',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-500'
  },
  fix: {
    icon: Wrench,
    label: 'Bug Fix',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    iconBg: 'bg-green-500'
  },
  announcement: {
    icon: Megaphone,
    label: 'Announcement',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-500'
  }
}

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  camera: Camera,
  clock: Clock,
  lock: Lock,
  megaphone: Megaphone,
  zap: Zap,
  wrench: Wrench,
  star: Star,
  bell: Bell,
  sparkles: Sparkles
}

// Get icon component for an entry
const getEntryIcon = (entry: ChangelogEntry): LucideIcon | null => {
  if (entry.icon && iconMap[entry.icon]) {
    return iconMap[entry.icon]
  }
  return null
}

const SEEN_UPDATES_KEY = 'studioflow-seen-updates'

export default function WhatsNewContent() {
  const [seenUpdates, setSeenUpdates] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load seen updates from localStorage
    const stored = localStorage.getItem(SEEN_UPDATES_KEY)
    if (stored) {
      setSeenUpdates(JSON.parse(stored))
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Mark all updates as seen after viewing the page
    const timer = setTimeout(() => {
      const allIds = changelog.map(entry => entry.id)
      localStorage.setItem(SEEN_UPDATES_KEY, JSON.stringify(allIds))
      setSeenUpdates(allIds)
      // Dispatch storage event so navigation badge updates
      window.dispatchEvent(new Event('storage'))
    }, 2000) // Mark as seen after 2 seconds on the page

    return () => clearTimeout(timer)
  }, [mounted])

  const isNew = (id: string) => !seenUpdates.includes(id)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#a657f0] rounded-2xl flex items-center justify-center shadow-lg">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">What's New</h1>
            <p className="text-gray-600 mt-1">See the latest updates and features added to StudioFlow</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#a657f0]/30 via-[#14b8a6]/30 to-gray-200"></div>

        {/* Entries */}
        <div className="space-y-6">
          {changelog.map((entry) => {
            const config = typeConfig[entry.type]
            const TypeIcon = config.icon
            const EntryIcon = getEntryIcon(entry)
            const isNewUpdate = isNew(entry.id)

            return (
              <div key={entry.id} className="relative pl-16">
                {/* Timeline dot */}
                <div className={`absolute left-4 w-5 h-5 rounded-full ${config.iconBg} border-4 border-white shadow-md flex items-center justify-center`}>
                  {isNewUpdate && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
                  )}
                </div>

                {/* Card */}
                <div className={`bg-white rounded-xl border ${isNewUpdate ? 'border-purple-300 shadow-lg shadow-purple-100' : 'border-gray-200 shadow-sm'} overflow-hidden transition-all hover:shadow-md`}>
                  {/* Card Header */}
                  <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.textColor}`}>
                            <TypeIcon className="w-3.5 h-3.5" />
                            {config.label}
                          </span>
                          {isNewUpdate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              NEW
                            </span>
                          )}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {entry.date}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          {EntryIcon && (
                            <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <EntryIcon className="w-4 h-4 text-gray-600" />
                            </span>
                          )}
                          {entry.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="px-5 py-4">
                    <p className="text-gray-600 text-sm leading-relaxed">{entry.description}</p>
                    
                    {entry.highlights && entry.highlights.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {entry.highlights.map((highlight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {/* Link to feature */}
                    {entry.link && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <Link
                          href={entry.link.href}
                          className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                          {entry.link.label}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
          <Bell className="w-4 h-4" />
          You'll see a badge when new updates are available
        </div>
      </div>
    </div>
  )
}

