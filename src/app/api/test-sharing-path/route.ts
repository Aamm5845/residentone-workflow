import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service'

export async function GET(request: NextRequest) {
  try {
    
    // Step 1: List shared folders to find team folder
    
    const sharedFolders = await dropboxService.listSharedFolders()
    
    console.log('[TestSharingPath] Found shared folders:', sharedFolders.map(f => ({
      name: f.name,
      shared_folder_id: f.shared_folder_id,
      path_lower: f.path_lower,
      access_type: f.access_type,
      is_team_folder: f.is_team_folder
    })))
    
    // Step 2: Find the Meisner team folder
    const teamFolder = sharedFolders.find(f => 
      f.name.includes('Meisner') && f.is_team_folder
    )
    
    if (!teamFolder) {
      return NextResponse.json({
        success: false,
        error: 'Meisner team folder not found',
        sharedFolders: sharedFolders.map(f => ({
          name: f.name,
          shared_folder_id: f.shared_folder_id,
          path_lower: f.path_lower,
          access_type: f.access_type,
          is_team_folder: f.is_team_folder
        }))
      }, { status: 404 })
    }

    // Step 3: Try to list contents using the path_lower
    if (teamFolder.path_lower) {
      
      try {
        const contents = await dropboxService.listFolder(teamFolder.path_lower)
        
        return NextResponse.json({
          success: true,
          message: 'Successfully accessed team folder via sharing API',
          teamFolder: {
            name: teamFolder.name,
            path_lower: teamFolder.path_lower,
            shared_folder_id: teamFolder.shared_folder_id,
            access_type: teamFolder.access_type
          },
          contents: {
            files: contents.files.length,
            folders: contents.folders.length,
            folderNames: contents.folders.map(f => f.name),
            fileNames: contents.files.map(f => f.name)
          }
        })
      } catch (listError: any) {
        console.error('[TestSharingPath] Failed to list folder contents:', listError)
        
        return NextResponse.json({
          success: false,
          error: 'Found team folder but failed to list contents',
          details: listError.message,
          teamFolder: {
            name: teamFolder.name,
            path_lower: teamFolder.path_lower,
            shared_folder_id: teamFolder.shared_folder_id
          }
        }, { status: 500 })
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Team folder found but has no path_lower',
        teamFolder: {
          name: teamFolder.name,
          shared_folder_id: teamFolder.shared_folder_id
        }
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('[TestSharingPath] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}