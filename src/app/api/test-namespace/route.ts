import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('=== TESTING NAMESPACE ACCESS ===')
    
    const { Dropbox } = await import('dropbox')
    const fetchImpl = typeof fetch !== 'undefined' ? fetch : require('node-fetch')
    
    // Create team root client (no selectUser)
    const teamClient = new Dropbox({
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      fetch: fetchImpl
    })
    
    // Also create a member-specific client
    const memberClient = new Dropbox({
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      fetch: fetchImpl,
      selectUser: process.env.DROPBOX_TEAM_MEMBER_ID
    })
    
    // First get available namespaces
    console.log('Getting team namespaces...')
    const namespacesResponse = await teamClient.teamNamespacesList({ limit: 50 })
    
    const namespaces = namespacesResponse.result.namespaces.map(ns => ({
      name: ns.name,
      namespace_id: ns.namespace_id,
      namespace_type: ns.namespace_type['.tag']
    }))
    
    console.log('Available namespaces:', namespaces)
    
    // Find Meisner Interiors Team Folder (look for both team_folder and shared_folder)
    const meisnerFolder = namespaces.find(ns => 
      ns.name.includes('Meisner') && (ns.namespace_type === 'shared_folder' || ns.namespace_type === 'team_folder')
    )
    
    let folderContent = null
    if (meisnerFolder) {
      
      // Try multiple approaches to access team folder
      let response = null
      let lastError = null
      
      try {
        console.log('Method 1: Team client with namespace path (no member header)...')
        response = await teamClient.filesListFolder({
          path: `ns:${meisnerFolder.namespace_id}`,
          recursive: false
        })
        console.log('Method 1 succeeded!')
      } catch (error1: any) {
        console.log('Method 1 failed:', error1.message)
        lastError = error1
        
        try {
          console.log('Method 2: Team client with member header...')
          const headers = { 'Dropbox-API-Select-User': process.env.DROPBOX_TEAM_MEMBER_ID }
          response = await teamClient.filesListFolder({
            path: `ns:${meisnerFolder.namespace_id}`,
            recursive: false
          }, headers)
          console.log('Method 2 succeeded!')
        } catch (error2: any) {
          console.log('Method 2 failed:', error2.message)
          lastError = error2
          
          try {
            console.log('Method 3: Member client with namespace path...')
            response = await memberClient.filesListFolder({
              path: `ns:${meisnerFolder.namespace_id}`,
              recursive: false
            })
            console.log('Method 3 succeeded!')
          } catch (error3: any) {
            console.log('Method 3 failed:', error3.message)
            lastError = error3
          }
        }
      }
      
      if (response?.result?.entries) {
        
        if (response?.result?.entries) {
          folderContent = response.result.entries.map(entry => ({
            name: entry.name,
            type: entry['.tag'],
            path: entry.path_display
          }))
        }
        
        console.log('Namespace access successful! Content:', folderContent)
      } else {
        console.log('All methods failed to access team folder')
        folderContent = { error: lastError?.message || 'All access methods failed' }
      }
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        totalNamespaces: namespaces.length,
        namespaces: namespaces,
        meisnerFolder: meisnerFolder || 'Not found',
        folderContent: folderContent,
        teamMemberId: process.env.DROPBOX_TEAM_MEMBER_ID
      }
    })
    
  } catch (error: any) {
    console.error('Test namespace error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Test error',
      debug: {
        errorMessage: error?.message || 'Unknown error'
      }
    })
  }
}
