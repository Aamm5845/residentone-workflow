import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { dropboxService } from '@/lib/dropbox-service-v2'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Dropbox is configured
    const hasAccessToken = !!process.env.DROPBOX_ACCESS_TOKEN
    
    if (!hasAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'Dropbox access token not configured',
        debug: {
          hasAccessToken: false,
          envVars: {
            DROPBOX_ACCESS_TOKEN: process.env.DROPBOX_ACCESS_TOKEN ? 'SET' : 'NOT SET'
          }
        }
      })
    }

    try {
      // Try to list the root folder
      const rootFolder = await dropboxService.listFolder('/')
      
      return NextResponse.json({
        success: true,
        message: 'Dropbox connection successful',
        debug: {
          hasAccessToken: true,
          rootFolderFiles: rootFolder.files.length,
          rootFolderFolders: rootFolder.folders.length,
          sampleFiles: rootFolder.files.slice(0, 3).map(f => ({
            name: f.name,
            path: f.path,
            size: f.size
          })),
          sampleFolders: rootFolder.folders.slice(0, 3).map(f => ({
            name: f.name,
            path: f.path
          }))
        }
      })
    } catch (dropboxError) {
      return NextResponse.json({
        success: false,
        error: 'Dropbox API error',
        details: dropboxError instanceof Error ? dropboxError.message : 'Unknown error',
        debug: {
          hasAccessToken: true,
          errorType: dropboxError?.constructor?.name || 'UnknownError'
        }
      })
    }

  } catch (error) {
    console.error('Dropbox debug API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
