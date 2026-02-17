import { NextResponse } from 'next/server'

// Current extension version - update this when releasing new versions
const EXTENSION_VERSION = '1.2.3'

// Optional: URL where users can download the latest version
const DOWNLOAD_URL = '/settings' // Or a direct download link

// GET: Return the latest extension version
export async function GET() {
  return NextResponse.json({
    latestVersion: EXTENSION_VERSION,
    downloadUrl: DOWNLOAD_URL,
    releaseNotes: 'Smart fill improvements: AI no longer overwrites notes/description, auto-detects In Stock lead time from product pricing.',
    releasedAt: new Date().toISOString()
  })
}

