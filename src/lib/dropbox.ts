import { Dropbox } from 'dropbox'

// Initialize Dropbox client only if token is available
let dbx: Dropbox | null = null

if (process.env.DROPBOX_ACCESS_TOKEN && process.env.DROPBOX_ACCESS_TOKEN !== 'your-dropbox-access-token-here') {
  dbx = new Dropbox({
    accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    fetch: fetch
  })
}

interface UploadContext {
  orgId: string
  projectId: string
  projectName: string
  roomId: string
  roomName: string
  stageType: string
  sectionType: string
}

/**
 * Creates a structured folder path for file organization
 * Format: /Organizations/{orgId}/Projects/{projectName}/Rooms/{roomName}/Stages/{stageType}/Sections/{sectionType}/
 */
export function createDropboxPath(context: UploadContext): string {
  const { orgId, projectName, roomName, stageType, sectionType } = context
  
  // Sanitize folder names (remove special characters, limit length)
  const sanitize = (str: string) => str
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
  
  const sanitizedProject = sanitize(projectName)
  const sanitizedRoom = sanitize(roomName)
  const sanitizedStage = sanitize(stageType.replace('_', ' '))
  const sanitizedSection = sanitize(sectionType.replace('_', ' '))
  
  return `/Organizations/${orgId}/Projects/${sanitizedProject}/Rooms/${sanitizedRoom}/Stages/${sanitizedStage}/Sections/${sanitizedSection}`
}

/**
 * Upload file to Dropbox with organized folder structure
 */
export async function uploadToDropbox(
  file: Buffer,
  fileName: string,
  context: UploadContext
): Promise<{ url: string; path: string }> {
  if (!dbx) {
    throw new Error('Dropbox not configured')
  }
  
  try {
    const folderPath = createDropboxPath(context)
    const fullPath = `${folderPath}/${fileName}`
    
    // Upload file to Dropbox
    const response = await dbx.filesUpload({
      path: fullPath,
      contents: file,
      mode: 'add',
      autorename: true
    })
    
    // Get a shared link for the file
    let sharedLink: string
    try {
      const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: response.result.path_lower!
      })
      sharedLink = linkResponse.result.url
    } catch (linkError) {
      // If link creation fails, use direct download URL
      sharedLink = `https://www.dropbox.com/s/${response.result.id}/direct`
    }
    
    return {
      url: sharedLink,
      path: response.result.path_lower!
    }
  } catch (error) {
    console.error('Dropbox upload error:', error)
    throw new Error('Failed to upload to Dropbox')
  }
}

/**
 * Delete file from Dropbox
 */
export async function deleteFromDropbox(dropboxPath: string): Promise<void> {
  if (!dbx) {
    throw new Error('Dropbox not configured')
  }
  
  try {
    await dbx.filesDeleteV2({
      path: dropboxPath
    })
  } catch (error) {
    console.error('Dropbox delete error:', error)
    throw new Error('Failed to delete from Dropbox')
  }
}

/**
 * Create folder structure in Dropbox (for initialization)
 */
export async function createFolderStructure(context: UploadContext): Promise<void> {
  if (!dbx) {
    throw new Error('Dropbox not configured')
  }
  
  try {
    const folderPath = createDropboxPath(context)
    
    // Check if folder exists, if not create it
    try {
      await dbx.filesGetMetadata({
        path: folderPath
      })
    } catch (error) {
      // Folder doesn't exist, create it
      await dbx.filesCreateFolderV2({
        path: folderPath,
        autorename: false
      })
    }
  } catch (error) {
    console.error('Folder creation error:', error)
    // Don't throw error for folder creation failures
  }
}

/**
 * List files in a Dropbox folder
 */
export async function listDropboxFiles(folderPath: string): Promise<any[]> {
  if (!dbx) {
    return []
  }
  
  try {
    const response = await dbx.filesListFolder({
      path: folderPath
    })
    return response.result.entries
  } catch (error) {
    console.error('Dropbox list error:', error)
    return []
  }
}