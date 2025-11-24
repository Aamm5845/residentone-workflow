import { NextResponse } from 'next/server'

export async function GET() {
  try {
    
    const { Dropbox } = await import('dropbox')
    const fetchImpl = typeof fetch !== 'undefined' ? fetch : require('node-fetch')
    
    // Create member client with explicit team member ID
    const memberClient = new Dropbox({
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      fetch: fetchImpl,
      selectUser: process.env.DROPBOX_TEAM_MEMBER_ID
    })
    
    console.log('Testing direct access to ns:11511253139 (Meisner Interiors Team Folder)')
    
    // Try to access the namespace directly
    const response = await memberClient.filesListFolder({
      path: 'ns:11511253139',
      recursive: false,
      include_media_info: false,
      include_deleted: false
    })
    
    if (response?.result?.entries) {
      const entries = response.result.entries.map(entry => ({
        name: entry.name,
        type: entry['.tag'],
        path: entry.path_display || entry.path_lower,
        ...(entry['.tag'] === 'file' ? { size: entry.size || 0 } : {})
      }))

      console.log('Entries:', entries.map(e => e.name))
      
      return NextResponse.json({
        success: true,
        message: 'Direct namespace access successful!',
        data: {
          namespace: 'ns:11511253139',
          folderName: 'Meisner Interiors Team Folder',
          entriesFound: entries.length,
          entries: entries,
          hasMore: response.result.has_more || false,
          cursor: response.result.cursor || null
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'No entries found in response',
        data: {
          namespace: 'ns:11511253139',
          response: response?.result || null
        }
      })
    }
    
  } catch (error: any) {
    console.error('Direct namespace test error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Access failed',
      message: error?.message || 'Unknown error',
      details: {
        namespace: 'ns:11511253139',
        teamMemberId: process.env.DROPBOX_TEAM_MEMBER_ID,
        hasRefreshToken: !!process.env.DROPBOX_REFRESH_TOKEN,
        errorSummary: error?.error?.error_summary || 'No summary'
      }
    })
  }
}
