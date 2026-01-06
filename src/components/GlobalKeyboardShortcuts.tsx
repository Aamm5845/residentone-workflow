'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Global keyboard shortcuts that work throughout the app
 *
 * B or Backspace = Go back (when not in input/textarea)
 */
export default function GlobalKeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[role="dialog"]') || // Don't trigger in dialogs
        target.closest('[data-radix-popper-content-wrapper]') // Don't trigger in popovers
      ) {
        return
      }

      // B = Go back (only lowercase, not when holding modifiers)
      if (e.key === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        router.back()
        return
      }

      // Backspace = Go back (only when not in input)
      if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        router.back()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  // This component doesn't render anything visible
  return null
}
