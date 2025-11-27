'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import { TimerProvider } from '@/contexts/TimerContext'

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TimerProvider>
        {children}
      </TimerProvider>
    </SessionProvider>
  )
}
