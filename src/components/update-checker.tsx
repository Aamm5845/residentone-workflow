'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, X, Download } from 'lucide-react'

// Generate a unique build ID based on deployment time
// This will change with each new deployment
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || Date.now().toString()

interface UpdateCheckerProps {
  // How often to check for updates (in minutes)
  checkInterval?: number
  // How long user must be idle before auto-refresh (in minutes)
  idleTimeBeforeRefresh?: number
}

export default function UpdateChecker({
  checkInterval = 5, // Check every 5 minutes
  idleTimeBeforeRefresh = 3 // Auto-refresh after 3 minutes of inactivity
}: UpdateCheckerProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const currentBuildRef = useRef(BUILD_ID)
  const hasCheckedRef = useRef(false)

  // Track user activity
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now())
  }, [])

  // Check if user is idle
  const isUserIdle = useCallback(() => {
    const idleTime = Date.now() - lastActivity
    const idleThreshold = idleTimeBeforeRefresh * 60 * 1000 // Convert to ms
    return idleTime > idleThreshold
  }, [lastActivity, idleTimeBeforeRefresh])

  // Check for updates by fetching version from server
  const checkForUpdates = useCallback(async () => {
    try {
      // Add cache-busting query param
      const response = await fetch(`/api/version?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const serverBuildId = data.buildId
        
        // If this is the first check, just store the current version
        if (!hasCheckedRef.current) {
          hasCheckedRef.current = true
          currentBuildRef.current = serverBuildId
          return
        }
        
        // Check if server has a newer version
        if (serverBuildId && serverBuildId !== currentBuildRef.current) {
          console.log('[UpdateChecker] New version detected:', serverBuildId)
          setUpdateAvailable(true)
          setShowNotification(true)
        }
      }
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.log('[UpdateChecker] Failed to check for updates:', error)
    }
  }, [])

  // Perform the refresh
  const doRefresh = useCallback(() => {
    setIsRefreshing(true)
    // Clear any service worker caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name)
        })
      })
    }
    // Force reload from server
    window.location.reload()
  }, [])

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity)
      })
    }
  }, [updateActivity])

  // Periodic update check
  useEffect(() => {
    // Initial check after a short delay
    const initialCheck = setTimeout(() => {
      checkForUpdates()
    }, 10000) // Wait 10 seconds before first check

    // Regular interval checks
    const intervalId = setInterval(() => {
      checkForUpdates()
    }, checkInterval * 60 * 1000)

    return () => {
      clearTimeout(initialCheck)
      clearInterval(intervalId)
    }
  }, [checkInterval, checkForUpdates])

  // Auto-refresh when idle and update is available
  useEffect(() => {
    if (!updateAvailable) return

    const checkIdleAndRefresh = setInterval(() => {
      if (isUserIdle()) {
        console.log('[UpdateChecker] User idle, auto-refreshing for update...')
        doRefresh()
      }
    }, 30000) // Check every 30 seconds if user is idle

    return () => clearInterval(checkIdleAndRefresh)
  }, [updateAvailable, isUserIdle, doRefresh])

  // Don't render anything if no update
  if (!showNotification || !updateAvailable) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl shadow-2xl p-4 max-w-sm border border-emerald-400">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">Update Available! 🎉</h4>
            <p className="text-xs text-white/90 mt-1">
              A new version is ready. We'll auto-refresh when you're not busy, or click below to update now.
            </p>
            
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={doRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-700 rounded-lg font-medium text-xs hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {isRefreshing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Update Now
                  </>
                )}
              </button>
              
              <button
                onClick={() => setShowNotification(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Remind me later"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-3 pt-2 border-t border-white/20">
          <p className="text-[10px] text-white/70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse"></span>
            Will auto-refresh after 3 min of inactivity
          </p>
        </div>
      </div>
    </div>
  )
}

