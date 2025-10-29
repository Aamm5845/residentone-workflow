import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service-v2'

export async function GET(request: NextRequest) {
  try {
    
    // Test with the namespace path directly
    const namespacePath = process.env.DROPBOX_SHARED_FOLDER_NAME || '/ns:11511253139/'
    
    // Test listing folder contents using the simplified member client approach
    const result = await dropboxService.listFolder(namespacePath)

    return NextResponse.json({
      success: true,
      message: 'Member client test successful',
      namespacePath,
      result: {
        files: result.files.map(f => ({ name: f.name, path: f.path, size: f.size })),
        folders: result.folders.map(f => ({ name: f.name, path: f.path })),
        hasMore: result.hasMore,
        cursor: result.cursor
      }
    })
  } catch (error: any) {
    console.error('[TestMemberClient] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error?.error?.error_summary || 'No additional details',
      stack: error.stack
    }, { status: 500 })
  }
}
