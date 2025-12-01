import { NextResponse } from 'next/server'

// This will be set at build time via environment variable
// Vercel automatically sets VERCEL_GIT_COMMIT_SHA on each deployment
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || 
                 process.env.NEXT_PUBLIC_BUILD_ID || 
                 process.env.BUILD_TIME ||
                 'development'

export async function GET() {
  // Return the current build ID with no-cache headers
  return NextResponse.json(
    { 
      buildId: BUILD_ID,
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    }
  )
}

