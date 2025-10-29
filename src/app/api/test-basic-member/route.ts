import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service-v2'

export async function GET(request: NextRequest) {
  try {
    
    // First, test with root path to see if member client works at all
    
    const result = await dropboxService.listFolder('')
    
    return NextResponse.json({
      success: true,
      message: 'Basic member client test successful',
      result: {
        files: result.files.map(f => ({ name: f.name, path: f.path, size: f.size })),
        folders: result.folders.map(f => ({ name: f.name, path: f.path })),
        hasMore: result.hasMore
      }
    })
  } catch (error: any) {
    console.error('[TestBasicMember] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error?.error?.error_summary || 'No additional details',
      stack: error.stack
    }, { status: 500 })
  }
}
