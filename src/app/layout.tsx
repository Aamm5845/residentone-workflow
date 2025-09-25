import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import '../styles/mentions.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StudioFlow by Meisner Interiors - Interior Design Workflow',
  description: 'Project workflow management for interior designers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
