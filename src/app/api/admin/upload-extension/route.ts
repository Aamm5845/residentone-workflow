import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { dropboxService } from '@/lib/dropbox-service'
import * as fs from 'fs'
import * as path from 'path'
import archiver from 'archiver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Chrome Extension folder in Dropbox
const DROPBOX_EXTENSION_FOLDER = '/Meisner Interiors Team Folder/Chrome Extensions'

/**
 * POST /api/admin/upload-extension
 * Uploads the Chrome extension to Dropbox for team distribution
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Dropbox is configured
    if (!dropboxService.isConfigured()) {
      return NextResponse.json({ 
        error: 'Dropbox not configured' 
      }, { status: 503 })
    }

    // Create the Chrome Extensions folder if it doesn't exist
    console.log('[Upload Extension] Creating Dropbox folder:', DROPBOX_EXTENSION_FOLDER)
    await dropboxService.createFolder(DROPBOX_EXTENSION_FOLDER)

    // Path to chrome-extension folder
    const extensionPath = path.join(process.cwd(), 'chrome-extension')
    
    if (!fs.existsSync(extensionPath)) {
      return NextResponse.json({ 
        error: 'Chrome extension folder not found' 
      }, { status: 404 })
    }

    // Read the manifest to get version
    const manifestPath = path.join(extensionPath, 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    const version = manifest.version || '1.0.0'
    
    // Create ZIP in memory
    const zipBuffer = await createZipBuffer(extensionPath)
    
    // Generate filename with version and date
    const date = new Date().toISOString().split('T')[0]
    const filename = `meisner-ffe-clipper-v${version}-${date}.zip`
    const dropboxPath = `${DROPBOX_EXTENSION_FOLDER}/${filename}`
    
    // Upload to Dropbox
    console.log('[Upload Extension] Uploading to:', dropboxPath)
    const result = await dropboxService.uploadFile(dropboxPath, zipBuffer, { mode: 'add' })
    
    // Also upload/update a "latest" version
    const latestPath = `${DROPBOX_EXTENSION_FOLDER}/meisner-ffe-clipper-LATEST.zip`
    await dropboxService.uploadFile(latestPath, zipBuffer, { mode: 'overwrite' })
    
    console.log('[Upload Extension] ✅ Extension uploaded successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Extension uploaded to Dropbox',
      version,
      filename,
      dropboxPath,
      latestPath
    })

  } catch (error: any) {
    console.error('[Upload Extension] Error:', error)
    return NextResponse.json({
      error: 'Failed to upload extension',
      details: error?.message
    }, { status: 500 })
  }
}

/**
 * GET /api/admin/upload-extension
 * Get info about the extension
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read manifest
    const extensionPath = path.join(process.cwd(), 'chrome-extension')
    const manifestPath = path.join(extensionPath, 'manifest.json')
    
    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json({ 
        error: 'Extension not found' 
      }, { status: 404 })
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    
    return NextResponse.json({
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      dropboxFolder: DROPBOX_EXTENSION_FOLDER
    })

  } catch (error: any) {
    console.error('[Upload Extension] Error:', error)
    return NextResponse.json({
      error: 'Failed to get extension info',
      details: error?.message
    }, { status: 500 })
  }
}

// Helper function to create ZIP buffer
async function createZipBuffer(sourceDir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })
    
    archive.on('data', (chunk) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
    
    // Add all files from the directory
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}
