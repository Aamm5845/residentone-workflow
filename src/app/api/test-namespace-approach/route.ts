import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service'

export async function GET(request: NextRequest) {
  try {
    
    // Step 1: List team namespaces
    
    const namespaces = await dropboxService.listTeamNamespaces()
    
    console.log('[TestNamespaceApproach] Found namespaces:', namespaces.map(ns => ({
      name: ns.name,
      type: ns.namespace_type?.['.tag'],
      id: ns.namespace_id
    })))
    
    // Step 2: Get Meisner team folder path
    
    const meisnerPath = await dropboxService.getMeisnerTeamFolderPath()
    
    // Step 3: Test listing with empty path (should default to namespace)
    console.log('[TestNamespaceApproach] Step 3: Testing empty path (should use namespace)')
    
    try {
      const contents = await dropboxService.listFolder('') // Empty path should use namespace
      
      return NextResponse.json({
        success: true,
        message: 'Successfully accessed team folder via namespace approach',
        environment: {
          memberID: process.env.DROPBOX_TEAM_MEMBER_ID,
          hasRefreshToken: !!process.env.DROPBOX_REFRESH_TOKEN,
          hasAccessToken: !!process.env.DROPBOX_ACCESS_TOKEN
        },
        namespaces: namespaces.map(ns => ({
          name: ns.name,
          type: ns.namespace_type?.['.tag'],
          id: ns.namespace_id
        })),
        meisnerPath,
        contents: {
          files: contents.files.length,
          folders: contents.folders.length,
          folderNames: contents.folders.map(f => f.name),
          fileNames: contents.files.map(f => f.name)
        }
      })
    } catch (listError: any) {
      console.error('[TestNamespaceApproach] Failed to list folder contents:', listError)
      
      return NextResponse.json({
        success: false,
        error: 'Failed to list team folder contents',
        details: listError.message,
        environment: {
          memberID: process.env.DROPBOX_TEAM_MEMBER_ID,
          hasRefreshToken: !!process.env.DROPBOX_REFRESH_TOKEN,
          hasAccessToken: !!process.env.DROPBOX_ACCESS_TOKEN
        },
        namespaces: namespaces.map(ns => ({
          name: ns.name,
          type: ns.namespace_type?.['.tag'],
          id: ns.namespace_id
        })),
        meisnerPath
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('[TestNamespaceApproach] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}