import { NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service-v2'

export async function GET() {
  try {
    console.log('=== DROPBOX DEBUG TEST ===')
    
    // Check environment variables
    const hasRefreshToken = !!(process.env.DROPBOX_REFRESH_TOKEN && process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET)
    const hasAccessToken = !!process.env.DROPBOX_ACCESS_TOKEN
    const refreshTokenLength = process.env.DROPBOX_REFRESH_TOKEN?.length || 0
    const accessTokenLength = process.env.DROPBOX_ACCESS_TOKEN?.length || 0
    
    console.log('Environment check:', {
      hasRefreshToken,
      hasAccessToken,
      refreshTokenLength,
      accessTokenLength,
      appKey: process.env.DROPBOX_APP_KEY ? 'Present' : 'Missing',
      appSecret: process.env.DROPBOX_APP_SECRET ? 'Present' : 'Missing',
      selectUser: process.env.DROPBOX_SELECT_USER || 'Not set',
      teamFolder: process.env.DROPBOX_TEAM_FOLDER_PATH || 'Not set',
      teamMemberId: process.env.DROPBOX_TEAM_MEMBER_ID || 'Not set',
      sharedFolderName: process.env.DROPBOX_SHARED_FOLDER_NAME || 'Not set',
      apiBaseUrl: process.env.DROPBOX_API_BASE_URL || 'Not set'
    })

    if (!hasRefreshToken && !hasAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'No Dropbox credentials found',
        debug: { hasRefreshToken, hasAccessToken }
      })
    }

    // Test using the DropboxService
    try {
      console.log('Testing DropboxService integration...')
      
      // Test root folder access
      console.log('Testing root folder access...')
      let rootResult = null
      let rootError = null
      
      try {
        rootResult = await dropboxService.listFolder('')
        console.log('Root folder access successful - found', rootResult.folders.length, 'folders and', rootResult.files.length, 'files')
      } catch (error: any) {
        console.log('Root folder access failed:', error.message)
        rootError = error.message
      }
      
      // Test configured shared/team folder access if set
      let teamFolderResult = null
      let teamFolderError = null
      const folderToTest = process.env.DROPBOX_SHARED_FOLDER_NAME || process.env.DROPBOX_TEAM_FOLDER_PATH
      if (folderToTest && rootResult) {
        try {
          console.log('Testing shared/team folder access:', folderToTest)
          teamFolderResult = await dropboxService.listFolder(folderToTest)
        } catch (teamError: any) {
          console.log('Shared/team folder access failed:', teamError.message)
          teamFolderError = teamError.message
        }
      }

      return NextResponse.json({
        success: true,
        debug: {
          hasRefreshToken,
          hasAccessToken,
          refreshTokenLength,
          accessTokenLength,
          rootFolderAccess: rootResult ? {
            success: true,
            filesCount: rootResult.files.length,
            foldersCount: rootResult.folders.length,
            totalEntries: rootResult.files.length + rootResult.folders.length,
            files: rootResult.files.slice(0, 3).map(f => ({ name: f.name, type: 'file' })),
            folders: rootResult.folders.slice(0, 3).map(f => ({ name: f.name, type: 'folder' }))
          } : {
            success: false,
            error: rootError
          },
          teamFolderAccess: teamFolderResult ? {
            success: true,
            path: process.env.DROPBOX_TEAM_FOLDER_PATH,
            filesCount: teamFolderResult.files.length,
            foldersCount: teamFolderResult.folders.length,
            files: teamFolderResult.files.slice(0, 3).map(f => ({ name: f.name, type: 'file' })),
            folders: teamFolderResult.folders.slice(0, 3).map(f => ({ name: f.name, type: 'folder' }))
          } : {
            success: false,
            path: process.env.DROPBOX_TEAM_FOLDER_PATH,
            error: teamFolderError,
            suggestion: 'Check the folder names in rootFolderAccess.folders above to find the correct team folder path'
          }
        }
      })

    } catch (dropboxError: any) {
      console.error('DropboxService error:', dropboxError)
      
      return NextResponse.json({
        success: false,
        error: 'DropboxService error',
        debug: {
          hasRefreshToken,
          hasAccessToken,
          refreshTokenLength,
          accessTokenLength,
          errorMessage: dropboxError?.message || 'Unknown error',
          errorStack: dropboxError?.stack?.substring(0, 300) || 'No stack'
        }
      })
    }

  } catch (error: any) {
    console.error('General error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      debug: {
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack?.substring(0, 200) || 'No stack'
      }
    })
  }
}
