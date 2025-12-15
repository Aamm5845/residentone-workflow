import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// GET: Download the extension ZIP file
export async function GET() {
  try {
    // Optional: Require authentication to download
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Please log in to download the extension' }, { status: 401 })
    }
    
    // Path to the extension ZIP file
    // In production, this would be in public folder or cloud storage
    const possiblePaths = [
      join(process.cwd(), 'public', 'downloads', 'meisner-ffe-clipper.zip'),
      join(process.cwd(), 'meisner-ffe-clipper-v1.2.0.zip'),
      join(process.cwd(), 'chrome-extension.zip')
    ]
    
    let zipPath: string | null = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        zipPath = path
        break
      }
    }
    
    if (!zipPath) {
      return NextResponse.json({ 
        error: 'Extension file not found. Please contact the administrator.',
        details: 'The extension ZIP file needs to be placed in the public/downloads folder.'
      }, { status: 404 })
    }
    
    // Read the file
    const fileBuffer = readFileSync(zipPath)
    
    // Return as downloadable file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="meisner-ffe-clipper.zip"',
        'Content-Length': fileBuffer.length.toString()
      }
    })
    
  } catch (error) {
    console.error('Extension download error:', error)
    return NextResponse.json({ error: 'Failed to download extension' }, { status: 500 })
  }
}

