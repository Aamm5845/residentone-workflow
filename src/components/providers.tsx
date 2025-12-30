'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { TimerProvider } from '@/contexts/TimerContext'
import UpdateChecker from '@/components/update-checker'

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TimerProvider>
        {children}
        <Toaster position="top-right" />
        {/* Auto-update checker - refreshes when user is idle and update available */}
        <UpdateChecker
          checkInterval={5}           // Check for updates every 5 minutes
          idleTimeBeforeRefresh={3}   // Auto-refresh after 3 min of inactivity
        />
      </TimerProvider>
    </SessionProvider>
  )
}
