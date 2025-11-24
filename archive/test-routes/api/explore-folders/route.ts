import { NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service-v2'

export async function GET() {
  try {
    
    // First get root folders
    const rootResult = await dropboxService.listFolder('')
    console.log('Root folders:', rootResult.folders.map(f => f.name))
    
    // Try to access each folder found at root
    const folderResults = []
    for (const folder of rootResult.folders) {
      try {
        
        const folderContent = await dropboxService.listFolder(folder.path)
        folderResults.push({
          name: folder.name,
          path: folder.path,
          success: true,
          filesCount: folderContent.files.length,
          foldersCount: folderContent.folders.length,
          subfolders: folderContent.folders.slice(0, 5).map(f => ({ name: f.name, path: f.path })),
          files: folderContent.files.slice(0, 3).map(f => ({ name: f.name, path: f.path }))
        })
      } catch (error: any) {
        
        folderResults.push({
          name: folder.name,
          path: folder.path,
          success: false,
          error: error.message
        })
      }
    }
    
    // Also try some common team folder patterns
    const teamFolderAttempts = []
    const commonPaths = [
      '/Meisner Interiors Team Folder',
      'Meisner Interiors Team Folder', // without leading slash
      '/Team Folder',
      '/Shared',
      '/Company'
    ]
    
    for (const path of commonPaths) {
      try {
        
        const result = await dropboxService.listFolder(path)
        teamFolderAttempts.push({
          path,
          success: true,
          filesCount: result.files.length,
          foldersCount: result.folders.length
        })
      } catch (error: any) {
        teamFolderAttempts.push({
          path,
          success: false,
          error: error.message
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        rootFolders: rootResult.folders.map(f => ({ name: f.name, path: f.path })),
        folderExploration: folderResults,
        teamFolderAttempts
      }
    })
    
  } catch (error: any) {
    console.error('Explore folders error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Explore error',
      debug: {
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack?.substring(0, 300) || 'No stack'
      }
    })
  }
}
