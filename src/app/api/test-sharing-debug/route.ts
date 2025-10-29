import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service-v2'

export async function GET(request: NextRequest) {
  try {
    
    // Get shared folders and examine their structure
    const sharedFolders = await dropboxService.listSharedFolders()

    sharedFolders.forEach((folder, index) => {
      console.log(`[TestSharingDebug] Folder ${index}:`, JSON.stringify(folder, null, 2))
    })
    
    // Focus on Meisner folder
    const meisnerFolder = sharedFolders.find(f => 
      f.name && f.name.includes('Meisner')
    )
    
    if (meisnerFolder) {
      console.log('[TestSharingDebug] Meisner folder details:', JSON.stringify(meisnerFolder, null, 2))
      
      // Try different path approaches
      const pathOptions = [
        meisnerFolder.path_lower,
        meisnerFolder.name,
        `/${meisnerFolder.name}`,
        meisnerFolder.shared_folder_id ? `/ns:${meisnerFolder.shared_folder_id}/` : null,
        meisnerFolder.shared_folder_id ? `ns:${meisnerFolder.shared_folder_id}` : null
      ].filter(Boolean)

      return NextResponse.json({
        success: true,
        message: 'Sharing debug completed',
        meisnerFolder,
        pathOptions,
        allSharedFolders: sharedFolders.map(f => ({
          name: f.name,
          shared_folder_id: f.shared_folder_id,
          path_lower: f.path_lower,
          access_type: f.access_type,
          is_team_folder: f.is_team_folder,
          policy: f.policy
        }))
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Meisner folder not found',
        allSharedFolders: sharedFolders.map(f => ({
          name: f.name,
          shared_folder_id: f.shared_folder_id,
          path_lower: f.path_lower,
          access_type: f.access_type,
          is_team_folder: f.is_team_folder
        }))
      })
    }
    
  } catch (error: any) {
    console.error('[TestSharingDebug] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error?.error?.error_summary || 'No details',
      stack: error.stack
    }, { status: 500 })
  }
}
