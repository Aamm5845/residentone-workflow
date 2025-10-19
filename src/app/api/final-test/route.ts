import { NextResponse } from 'next/server'

export async function GET() {
  try {
    
    const { Dropbox } = await import('dropbox')
    const fetchImpl = typeof fetch !== 'undefined' ? fetch : require('node-fetch')
    
    const results = []
    
    // Method 1: Team client with header approach
    try {
      
      const teamClient = new Dropbox({
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        fetch: fetchImpl
      })
      
      const headers = {
        'Dropbox-API-Select-User': process.env.DROPBOX_TEAM_MEMBER_ID
      }
      
      const response = await teamClient.filesListFolder({
        path: 'ns:11511253139',
        recursive: false
      }, headers)
      
      results.push({
        method: 'Team client + header',
        success: true,
        entries: response?.result?.entries?.length || 0,
        items: response?.result?.entries?.slice(0, 5)?.map(e => ({ name: e.name, type: e['.tag'] })) || []
      })
      
    } catch (error1: any) {
      results.push({
        method: 'Team client + header',
        success: false,
        error: error1?.message || 'Unknown error',
        errorSummary: error1?.error?.error_summary || 'No summary'
      })
    }
    
    // Method 2: Member client with selectUser
    try {
      
      const memberClient = new Dropbox({
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        fetch: fetchImpl,
        selectUser: process.env.DROPBOX_TEAM_MEMBER_ID
      })
      
      const response = await memberClient.filesListFolder({
        path: 'ns:11511253139',
        recursive: false
      })
      
      results.push({
        method: 'Member client + selectUser',
        success: true,
        entries: response?.result?.entries?.length || 0,
        items: response?.result?.entries?.slice(0, 5)?.map(e => ({ name: e.name, type: e['.tag'] })) || []
      })
      
    } catch (error2: any) {
      results.push({
        method: 'Member client + selectUser',
        success: false,
        error: error2?.message || 'Unknown error',
        errorSummary: error2?.error?.error_summary || 'No summary'
      })
    }
    
    // Method 3: Try regular folder path with member client
    try {
      
      const memberClient = new Dropbox({
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        fetch: fetchImpl,
        selectUser: process.env.DROPBOX_TEAM_MEMBER_ID
      })
      
      const response = await memberClient.filesListFolder({
        path: '',  // Root of member space
        recursive: false
      })
      
      results.push({
        method: 'Member client root',
        success: true,
        entries: response?.result?.entries?.length || 0,
        items: response?.result?.entries?.slice(0, 5)?.map(e => ({ name: e.name, type: e['.tag'] })) || []
      })
      
    } catch (error3: any) {
      results.push({
        method: 'Member client root',
        success: false,
        error: error3?.message || 'Unknown error',
        errorSummary: error3?.error?.error_summary || 'No summary'
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Comprehensive test completed',
      data: {
        namespace: 'ns:11511253139',
        teamMemberId: process.env.DROPBOX_TEAM_MEMBER_ID,
        results
      }
    })
    
  } catch (error: any) {
    console.error('Final test error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error?.message || 'Unknown error'
    })
  }
}