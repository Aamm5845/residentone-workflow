import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service'

export async function GET(request: NextRequest) {
  try {
    
    // First, list all shared folders the user has access to
    const sharedFolders = await dropboxService.listSharedFolders()
    
    console.log('[TestSharingAPI] Found shared folders:', sharedFolders.map(f => ({
      name: f.name,
      path_lower: f.path_lower,
      access_type: f.access_type,
      is_team_folder: f.is_team_folder
    })))
    
    // Look for the Meisner folder
    const meisnerFolder = sharedFolders.find(f => 
      f.name.includes('Meisner') || f.name.includes('Team')
    )
    
    if (meisnerFolder) {
      
      // Try to access its contents using the path_lower
      
      try {
        const folderContents = await dropboxService.listFolder(meisnerFolder.path_lower)
        
        return NextResponse.json({
          success: true,
          message: 'Sharing API test successful',
          sharedFolders: sharedFolders.map(f => ({
            name: f.name,
            path_lower: f.path_lower,
            access_type: f.access_type,
            is_team_folder: f.is_team_folder
          })),
          meisnerFolder: {
            name: meisnerFolder.name,
            path_lower: meisnerFolder.path_lower,
            access_type: meisnerFolder.access_type
          },
          folderContents: {
            files: folderContents.files.length,
            folders: folderContents.folders.length,
            folderNames: folderContents.folders.map(f => f.name)
          }
        })
      } catch (contentError: any) {
        console.error('[TestSharingAPI] Failed to list folder contents:', contentError)
        
        return NextResponse.json({
          success: false,
          message: 'Found shared folder but failed to list contents',
          error: contentError.message,
          sharedFolders: sharedFolders.map(f => ({
            name: f.name,
            path_lower: f.path_lower,
            access_type: f.access_type,
            is_team_folder: f.is_team_folder
          })),
          meisnerFolder: {
            name: meisnerFolder.name,
            path_lower: meisnerFolder.path_lower,
            access_type: meisnerFolder.access_type
          }
        }, { status: 500 })
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'Meisner folder not found in shared folders',
        sharedFolders: sharedFolders.map(f => ({
          name: f.name,
          path_lower: f.path_lower,
          access_type: f.access_type,
          is_team_folder: f.is_team_folder
        }))
      }, { status: 404 })
    }
    
  } catch (error: any) {
    console.error('[TestSharingAPI] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error?.error?.error_summary || 'No additional details',
      stack: error.stack
    }, { status: 500 })
  }
}