'use client'

import { useState, useEffect } from 'react'

interface DeviceType {
  isIPad: boolean
  isTablet: boolean
  isMobile: boolean
  isDesktop: boolean
  isTouchDevice: boolean
}

/**
 * Hook to detect device type for responsive styling
 * Specifically detects iPad for tablet-optimized layouts
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>({
    isIPad: false,
    isTablet: false,
    isMobile: false,
    isDesktop: true,
    isTouchDevice: false
  })

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent.toLowerCase()
      
      // Detect iPad specifically (including iPadOS 13+ which reports as Mac)
      const isIPad = /ipad/.test(ua) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
        (/macintosh/.test(ua) && 'ontouchend' in document)
      
      // Detect other tablets (Android tablets, etc.)
      const isAndroidTablet = /android/.test(ua) && !/mobile/.test(ua)
      const isTablet = isIPad || isAndroidTablet
      
      // Detect mobile phones
      const isMobile = /iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua)
      
      // Desktop is anything that's not tablet or mobile
      const isDesktop = !isTablet && !isMobile
      
      // Touch device detection
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      setDeviceType({
        isIPad,
        isTablet,
        isMobile,
        isDesktop,
        isTouchDevice
      })
    }

    checkDevice()
    
    // Re-check on resize (for responsive testing)
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  return deviceType
}

/**
 * CSS class helper for iPad-specific styling
 * Returns additional classes when on iPad/tablet
 */
export function useIPadStyles() {
  const { isIPad, isTablet } = useDeviceType()
  
  return {
    isIPad,
    isTablet,
    // Helper to conditionally add iPad classes
    ipadClass: (ipadClasses: string, defaultClasses: string = '') => {
      return isIPad || isTablet ? `${defaultClasses} ${ipadClasses}` : defaultClasses
    }
  }
}

