import { Dropbox } from 'dropbox'

// Custom fetch implementation that properly handles binary responses
const fetchImpl = async (url: string, options: any) => {
  const response = await fetch(url, options)
  
  // Add buffer method if it doesn't exist (for binary downloads)
  if (!response.buffer) {
    response.buffer = async () => {
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }
  }
  
  return response
}

interface DropboxFile {
  id: string
  name: string
  path: string
  size: number
  lastModified: Date
  revision: string
  isFolder: boolean
  thumbnailUrl?: string
}

interface DropboxFolder {
  files: DropboxFile[]
  folders: DropboxFile[]
  hasMore: boolean
  cursor?: string
}

class DropboxService {
  private dropbox: Dropbox | null = null
  private teamMemberId: string | null = null

  // Get a team client for team-level operations (no user selection)
  private getTeamClient() {
    const teamClient = new Dropbox({
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
      fetch: fetchImpl
      // No selectUser for team operations
    })
    return teamClient
  }

  // Get the team member ID from environment
  private getTeamMemberId(): string {
    // Support both DROPBOX_TEAM_MEMBER_ID and DROPBOX_API_SELECT_USER
    const teamMemberId = process.env.DROPBOX_TEAM_MEMBER_ID || process.env.DROPBOX_API_SELECT_USER
    
    if (!teamMemberId) {
      throw new Error('DROPBOX_TEAM_MEMBER_ID or DROPBOX_API_SELECT_USER environment variable is required for team operations')
    }
    return teamMemberId
  }

  /**
   * Check if Dropbox service is properly configured
   */
  isConfigured(): boolean {
    try {
      // Check for authentication credentials
      const hasRefreshToken = !!(process.env.DROPBOX_REFRESH_TOKEN && 
                                 process.env.DROPBOX_APP_KEY && 
                                 process.env.DROPBOX_APP_SECRET)
      const hasAccessToken = !!process.env.DROPBOX_ACCESS_TOKEN
      
      // Check for team member ID
      const hasTeamMember = !!(process.env.DROPBOX_TEAM_MEMBER_ID || 
                               process.env.DROPBOX_API_SELECT_USER)
      
      return (hasRefreshToken || hasAccessToken) && hasTeamMember
    } catch (error) {
      return false
    }
  }

  private getClient() {
    if (!this.dropbox) {
      const teamMemberId = this.getTeamMemberId()
      const rootNamespaceId = process.env.DROPBOX_ROOT_NAMESPACE_ID || '11510809107'
      
      // Create client configuration
      const config: any = {
        fetch: fetchImpl,
        selectUser: teamMemberId, // Sets Dropbox-API-Select-User header
      }
      
      // Add authentication - prefer refresh token for automatic renewal
      if (process.env.DROPBOX_REFRESH_TOKEN && process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET) {
        config.refreshToken = process.env.DROPBOX_REFRESH_TOKEN
        config.clientId = process.env.DROPBOX_APP_KEY
        config.clientSecret = process.env.DROPBOX_APP_SECRET
        console.log('[DropboxService] Using refresh token for authentication')
      } else if (process.env.DROPBOX_ACCESS_TOKEN) {
        config.accessToken = process.env.DROPBOX_ACCESS_TOKEN
        console.log('[DropboxService] Using access token for authentication')
      } else {
        throw new Error('Either DROPBOX_ACCESS_TOKEN or DROPBOX_REFRESH_TOKEN (with app credentials) is required')
      }
      
      // Add pathRoot for team folder access
      if (rootNamespaceId) {
        config.pathRoot = JSON.stringify({
          '.tag': 'root',
          'root': rootNamespaceId
        })
        console.log(`[DropboxService] Using pathRoot: ${config.pathRoot}`)
      }
      
      this.dropbox = new Dropbox(config)
    }
    return this.dropbox
  }

  /**
   * List team namespaces - shows all available team folders and shared folders
   */
  async listTeamNamespaces(): Promise<any[]> {
    try {
      const client = this.getTeamClient()
      const response = await client.teamNamespacesList({ limit: 50 })
      return response?.result?.namespaces || []
    } catch (error) {
      console.error('[DropboxService] Failed to list team namespaces:', error)
      return []
    }
  }


  /**
   * Get the correct namespace for Meisner Interiors Team Folder
   */
  async getMeisnerTeamFolderPath(): Promise<string> {
    try {
      const namespaces = await this.listTeamNamespaces()
      console.log('[DropboxService] Available namespaces:', namespaces.map(ns => ({
        name: ns.name,
        type: ns.namespace_type?.['.tag'],
        id: ns.namespace_id
      })))
      
      // Look for Meisner team folder
      const meisnerNamespace = namespaces.find(ns => 
        ns.name === 'Meisner Interiors Team Folder'
      )
      
      if (meisnerNamespace) {
        // Return the namespace ID for team-level access
        return meisnerNamespace.namespace_id
      }
      
      // Fallback to known namespace ID
      return '11511253139'
      
    } catch (error) {
      console.error('[DropboxService] Failed to get Meisner team folder path:', error)
      return '11511253139' // Fallback to known namespace ID
    }
  }

  /**
   * List files and folders using shared link approach
   */
  async listFolder(path: string = '', cursor?: string): Promise<DropboxFolder> {
    try {
      console.log('[DropboxService] Listing folder with path:', JSON.stringify(path))
      
      // Use the shared link for the main team folder
      const sharedLinkUrl = 'https://www.dropbox.com/scl/fo/7dk9gbqev0k04gw0ifm7t/AJH6jgqztvAlHM4DKJbtEL0?rlkey=xt236i59o7tevsfozuvd2zo2o&st=gjz3rjtp&dl=0'
      
      const client = this.getClient()
      let response
      
      if (cursor) {
        response = await client.filesListFolderContinue({ cursor })
      } else {
        console.log('[DropboxService] Using shared link to browse:', sharedLinkUrl)
        console.log('[DropboxService] Sub-path within shared link:', path || '(root)')
        
        // Use the sharing API to browse the shared link
        response = await client.filesListFolder({
          path: path, // path within the shared folder
          shared_link: {
            url: sharedLinkUrl
          },
          recursive: false,
          include_media_info: false,
          include_deleted: false
        })
      }

      const files: DropboxFile[] = []
      const folders: DropboxFile[] = []

      if (response?.result?.entries) {
        for (const entry of response.result.entries) {
          // Build the path relative to the shared link root
          let entryPath = entry.path_lower || entry.path_display
          if (!entryPath) {
            // If no path provided, construct it from current path + entry name
            entryPath = path ? `${path}/${entry.name}` : `/${entry.name}`
          }
          
          if (entry['.tag'] === 'file') {
            const file: DropboxFile = {
              id: entry.id || '',
              name: entry.name,
              path: entryPath,
              size: entry.size || 0,
              lastModified: new Date(entry.client_modified || entry.server_modified || new Date()),
              revision: entry.rev || '',
              isFolder: false
            }

            files.push(file)
            console.log('[DropboxService] Added file:', file.name)
            
          } else if (entry['.tag'] === 'folder') {
            const folder: DropboxFile = {
              id: entry.id || '',
              name: entry.name,
              path: entryPath,
              size: 0,
              lastModified: new Date(),
              revision: '',
              isFolder: true
            }
            folders.push(folder)
            console.log('[DropboxService] Added folder:', folder.name)
          }
        }
      }

      return {
        files,
        folders,
        hasMore: response?.result?.has_more || false,
        cursor: response?.result?.cursor
      }

    } catch (error) {
      console.error('[DropboxService] Shared link folder browsing error:', error)
      throw new Error(`Failed to list Dropbox folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Download a file from Dropbox using shared link
   */
  async downloadFile(path: string): Promise<Buffer> {
    try {
      const client = this.getClient()
      const sharedLinkUrl = 'https://www.dropbox.com/scl/fo/7dk9gbqev0k04gw0ifm7t/AJH6jgqztvAlHM4DKJbtEL0?rlkey=xt236i59o7tevsfozuvd2zo2o&st=gjz3rjtp&dl=0'
      
      // Strip the team folder prefix if present (shared link already points to team folder root)
      const teamFolderPrefix = '/meisner interiors team folder'
      let relativePath = path
      if (path.toLowerCase().startsWith(teamFolderPrefix.toLowerCase())) {
        relativePath = path.substring(teamFolderPrefix.length)
      }
      
      console.log('[DropboxService] Downloading file via shared link:', relativePath)
      
      try {
        // Method 1: Try sharingGetSharedLinkFile
        const response = await client.sharingGetSharedLinkFile({
          url: sharedLinkUrl,
          path: relativePath
        })
        
        console.log('[DropboxService] Shared link response keys:', Object.keys(response || {}))
        
        // Handle different response formats
        if (response?.result?.fileBinary) {
          return Buffer.from(response.result.fileBinary as any)
        } else if (response?.fileBinary) {
          return Buffer.from(response.fileBinary as any)
        } else if (response instanceof Buffer) {
          return response
        } else if (response) {
          // Sometimes the response itself is the binary data
          console.log('[DropboxService] Response type:', typeof response)
          return Buffer.from(response as any)
        }
        
        throw new Error('No file data in shared link response')
        
      } catch (sharedError) {
        console.warn('[DropboxService] Shared link download failed, trying regular download:', sharedError)
        
        // Method 2: Fallback to regular filesDownload (uses pathRoot config, so also needs relative path)
        try {
          const response = await client.filesDownload({ path: relativePath })
          
          if (!response?.result?.fileBinary) {
            throw new Error('No file data received from regular download')
          }
          
          return Buffer.from(response.result.fileBinary as any)
        } catch (regularError) {
          console.error('[DropboxService] Regular download also failed:', regularError)
          
          // Method 3: Final fallback - direct HTTP download
          try {
            console.log('[DropboxService] Trying direct HTTP download fallback')
            const directUrl = sharedLinkUrl.replace('?dl=0', '?dl=1') // Force download
            const httpResponse = await fetch(directUrl)
            
            if (!httpResponse.ok) {
              throw new Error(`HTTP download failed: ${httpResponse.status}`)
            }
            
            const arrayBuffer = await httpResponse.arrayBuffer()
            return Buffer.from(arrayBuffer)
            
          } catch (httpError) {
            console.error('[DropboxService] Direct HTTP download also failed:', httpError)
            throw sharedError // throw the original shared link error
          }
        }
      }
      
    } catch (error) {
      console.error('Dropbox download error:', error)
      throw new Error(`Failed to download file from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get file metadata from Dropbox using shared link
   */
  async getFileMetadata(path: string): Promise<DropboxFile | null> {
    try {
      const client = this.getClient()
      const sharedLinkUrl = 'https://www.dropbox.com/scl/fo/7dk9gbqev0k04gw0ifm7t/AJH6jgqztvAlHM4DKJbtEL0?rlkey=xt236i59o7tevsfozuvd2zo2o&st=gjz3rjtp&dl=0'
      
      console.log('[DropboxService] Getting metadata via shared link:', path)
      
      try {
        // Method 1: Try shared link metadata
        const response = await client.sharingGetSharedLinkMetadata({
          url: sharedLinkUrl,
          path: path
        })
        
        const file = response?.result
        if (file && file['.tag'] === 'file') {
          return {
            id: file.id || '',
            name: file.name,
            path: path, // Use the input path (shared link relative)
            size: file.size || 0,
            lastModified: new Date(file.client_modified || file.server_modified || new Date()),
            revision: file.rev || '',
            isFolder: false
          }
        }
      } catch (sharedError) {
        console.warn('[DropboxService] Shared link metadata failed, trying regular metadata:', sharedError)
        
        // Method 2: Fallback to regular metadata API
        try {
          const response = await client.filesGetMetadata({ path })
          
          if (response?.result?.['.tag'] === 'file') {
            const file = response.result
            return {
              id: file.id || '',
              name: file.name,
              path: file.path_lower || file.path_display || path,
              size: file.size || 0,
              lastModified: new Date(file.client_modified || file.server_modified || new Date()),
              revision: file.rev || '',
              isFolder: false
            }
          }
        } catch (regularError) {
          console.error('[DropboxService] Regular metadata also failed:', regularError)
        }
      }

      return null
    } catch (error) {
      console.error('Dropbox metadata error:', error)
      return null
    }
  }

  /**
   * Check if a file has been updated (revision changed)
   */
  async checkFileUpdated(path: string, lastKnownRevision: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(path)
      return metadata ? metadata.revision !== lastKnownRevision : false
    } catch (error) {
      console.error('Dropbox revision check error:', error)
      return false
    }
  }

  /**
   * Search for CAD files in Dropbox
   */
  async searchCADFiles(query: string, maxResults: number = 50): Promise<DropboxFile[]> {
    try {
      const client = this.getClient()
      const response = await client.filesSearchV2({
        query,
        options: {
          path: '',
          max_results: maxResults,
          file_extensions: ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs']
        }
      })

      const files: DropboxFile[] = []

      if (response?.result?.matches) {
        for (const match of response.result.matches) {
          if (match.match_type['.tag'] === 'filename' && 
              match.metadata.metadata['.tag'] === 'file') {
            const file = match.metadata.metadata
            files.push({
              id: file.id || '',
              name: file.name,
              path: file.path_lower || file.path_display || '',
              size: file.size || 0,
              lastModified: new Date(file.client_modified || file.server_modified || new Date()),
              revision: file.rev || '',
              isFolder: false
            })
          }
        }
      }

      return files
    } catch (error) {
      console.error('Dropbox search error:', error)
      return []
    }
  }

  /**
   * Get a temporary download link for a file (for client access)
   * Note: These links expire after 4 hours
   */
  async getTemporaryLink(path: string): Promise<string | null> {
    try {
      const client = this.getClient()
      const response = await client.filesGetTemporaryLink({ path })
      return response?.result?.link || null
    } catch (error) {
      console.error('Dropbox temporary link error:', error)
      return null
    }
  }

  /**
   * Create or get a permanent shared link for a file
   * These links don't expire and can be used for emails and downloads
   */
  async createSharedLink(path: string): Promise<string | null> {
    try {
      // Ensure path starts with / for Dropbox API
      if (!path.startsWith('/')) {
        path = '/' + path
      }
      
      console.log('[DropboxService] createSharedLink called with path:', path)
      
      const client = this.getClient()
      
      // Try to create a new shared link directly
      try {
        const createResponse = await client.sharingCreateSharedLinkWithSettings({
          path,
          settings: {
            requested_visibility: { '.tag': 'public' },
            audience: { '.tag': 'public' },
            access: { '.tag': 'viewer' }
          }
        })
        
        if (createResponse?.result?.url) {
          // Return the URL with dl=0 (we'll convert it as needed in the caller)
          // The URL format is: https://www.dropbox.com/scl/fi/.../file.jpg?rlkey=...&dl=0
          let sharedLink = createResponse.result.url
          
          // Convert to raw=1 for direct image embedding
          // Replace dl=0 with raw=1, or add raw=1 if no dl parameter exists
          let directLink = sharedLink
          if (directLink.includes('dl=0')) {
            directLink = directLink.replace('dl=0', 'raw=1')
          } else if (directLink.includes('dl=1')) {
            directLink = directLink.replace('dl=1', 'raw=1')
          } else {
            directLink += (directLink.includes('?') ? '&' : '?') + 'raw=1'
          }
          console.log('[DropboxService] Created new shared link:', directLink)
          return directLink
        }
      } catch (createError: any) {
        // If shared link already exists, retrieve it
        if (createError?.error?.error?.['.tag'] === 'shared_link_already_exists') {
          console.log('[DropboxService] Shared link already exists, retrieving it...')
          
          // Get the existing shared link for this specific file
          try {
            const listResponse = await client.sharingListSharedLinks({ 
              path,
              direct_only: true  // Only get links for this exact path, not parent folders
            })
            
            if (listResponse?.result?.links && listResponse.result.links.length > 0) {
              // Find the link that matches our exact path
              for (const link of listResponse.result.links) {
                if (link.path_lower === path.toLowerCase() || link.path_lower === path) {
                  let sharedLink = link.url
                  
                  // Convert to raw=1 for direct image embedding
                  let directLink = sharedLink
                  if (directLink.includes('dl=0')) {
                    directLink = directLink.replace('dl=0', 'raw=1')
                  } else if (directLink.includes('dl=1')) {
                    directLink = directLink.replace('dl=1', 'raw=1')
                  } else {
                    directLink += (directLink.includes('?') ? '&' : '?') + 'raw=1'
                  }
                  console.log('[DropboxService] Retrieved existing shared link:', directLink)
                  return directLink
                }
              }
              
              // Fallback: use first link if no exact match
              let sharedLink = listResponse.result.links[0].url
              let directLink = sharedLink
              if (directLink.includes('dl=0')) {
                directLink = directLink.replace('dl=0', 'raw=1')
              } else if (directLink.includes('dl=1')) {
                directLink = directLink.replace('dl=1', 'raw=1')
              } else {
                directLink += (directLink.includes('?') ? '&' : '?') + 'raw=1'
              }
              console.log('[DropboxService] Using first available shared link:', directLink)
              return directLink
            }
          } catch (listError) {
            console.error('[DropboxService] Failed to list existing shared links:', listError)
          }
        } else {
          console.error('[DropboxService] Failed to create shared link:', createError)
        }
      }
      
      return null
    } catch (error: any) {
      console.error('[DropboxService] Shared link error:', error)
      return null
    }
  }

  /**
   * Sanitize folder name for Dropbox
   * - Remove or replace special characters
   * - Handle spaces
   * - Ensure valid Dropbox folder name
   */
  private sanitizeFolderName(name: string): string {
    return name
      .trim()
      .replace(/[<>:"\/\\|?*]/g, '') // Remove invalid characters for file systems
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .replace(/\.$/, '') // Remove trailing period
      .substring(0, 255) // Dropbox has a 255 character limit for names
  }

  /**
   * Create a folder in Dropbox
   */
  async createFolder(path: string): Promise<any> {
    try {
      // Ensure path starts with / for Dropbox API
      if (!path.startsWith('/')) {
        path = '/' + path
      }
      
      console.log('[DropboxService] Creating folder:', path)
      const client = this.getClient()
      
      const response = await client.filesCreateFolderV2({
        path: path,
        autorename: false // Don't auto-rename if it exists
      })
      
      console.log('[DropboxService] ✅ Folder created successfully:', path)
      return response.result.metadata
    } catch (error: any) {
      // If folder already exists, that's okay (check multiple error structures)
      const isConflict = 
        (error?.error?.error?.['.tag'] === 'path' && error?.error?.error?.path?.['.tag'] === 'conflict') ||
        error?.status === 409 ||
        (error instanceof Error && error.message?.includes('409'))
      
      if (isConflict) {
        console.log('[DropboxService] ℹ️ Folder already exists:', path)
        return { path, exists: true }
      }
      
      console.error('[DropboxService] ❌ Failed to create folder:', path, error)
      console.error('[DropboxService] Error details:', JSON.stringify(error, null, 2))
      throw new Error(`Failed to create Dropbox folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Upload a file to Dropbox
   */
  async uploadFile(path: string, fileBuffer: Buffer, options?: { mode?: 'add' | 'overwrite' }): Promise<any> {
    try {
      // Ensure path starts with / for Dropbox API
      if (!path.startsWith('/')) {
        path = '/' + path
      }
      
      console.log('[DropboxService] Uploading file:', path)
      const client = this.getClient()
      
      const response = await client.filesUpload({
        path: path,
        contents: fileBuffer,
        mode: { '.tag': options?.mode || 'add' },
        autorename: true,
        mute: false
      })
      
      console.log('[DropboxService] ✅ File uploaded successfully:', path)
      return response.result
    } catch (error: any) {
      console.error('[DropboxService] ❌ Failed to upload file:', path, error)
      console.error('[DropboxService] Error details:', JSON.stringify(error, null, 2))
      
      // Check if it's a path conflict (file already exists with autorename=true)
      const isConflict = 
        error?.status === 409 ||
        (error instanceof Error && error.message?.includes('409'))
      
      if (isConflict) {
        console.warn('[DropboxService] File upload conflict (409), file may already exist or autorename failed')
      }
      
      throw new Error(`Failed to upload file to Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a file from Dropbox
   */
  async deleteFile(path: string): Promise<any> {
    try {
      console.log('[DropboxService] Deleting file:', path)
      const client = this.getClient()
      
      const response = await client.filesDeleteV2({
        path: path
      })
      
      console.log('[DropboxService] ✅ File deleted successfully:', path)
      return response.result
    } catch (error: any) {
      // If file doesn't exist, that's okay
      if (error?.error?.error?.['.tag'] === 'path_lookup' && 
          error?.error?.error?.path_lookup?.['.tag'] === 'not_found') {
        console.log('[DropboxService] ℹ️ File not found (already deleted):', path)
        return { path, notFound: true }
      }
      
      console.error('[DropboxService] ❌ Failed to delete file:', path, error)
      throw new Error(`Failed to delete file from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a folder from Dropbox
   */
  async deleteFolder(path: string): Promise<any> {
    try {
      console.log('[DropboxService] Deleting folder:', path)
      const client = this.getClient()
      
      const response = await client.filesDeleteV2({
        path: path
      })
      
      console.log('[DropboxService] ✅ Folder deleted successfully:', path)
      return response.result
    } catch (error: any) {
      // If folder doesn't exist, that's okay
      if (error?.error?.error?.['.tag'] === 'path_lookup' && 
          error?.error?.error?.path_lookup?.['.tag'] === 'not_found') {
        console.log('[DropboxService] ℹ️ Folder not found (already deleted):', path)
        return { path, notFound: true }
      }
      
      console.error('[DropboxService] ❌ Failed to delete folder:', path, error)
      throw new Error(`Failed to delete folder from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Upload a survey photo to the project's 7- SOURCES/Site Photos folder organized by date
   * Creates folder structure: /ProjectFolder/7- SOURCES/Site Photos/YYYY-MM-DD/
   */
  async uploadSurveyPhoto(
    projectFolderPath: string,
    date: Date,
    fileBuffer: Buffer,
    filename: string
  ): Promise<{ path: string; sharedLink?: string }> {
    try {
      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0]
      
      // Construct the path: /ProjectFolder/7- SOURCES/Site Photos/YYYY-MM-DD/
      const sitePhotosFolder = `${projectFolderPath}/7- SOURCES/Site Photos`
      const dateFolder = `${sitePhotosFolder}/${dateStr}`
      
      // Ensure Site Photos folder exists
      console.log('[DropboxService] Creating Site Photos folder:', sitePhotosFolder)
      await this.createFolder(sitePhotosFolder)
      
      // Ensure date folder exists
      console.log('[DropboxService] Creating survey photo date folder:', dateFolder)
      await this.createFolder(dateFolder)
      
      // Sanitize filename
      const sanitizedFilename = filename
        .replace(/[<>:"|?*]/g, '_')
        .replace(/\\/g, '-')
        .trim()
      
      // Upload the file
      const filePath = `${dateFolder}/${sanitizedFilename}`
      console.log('[DropboxService] Uploading survey photo to:', filePath)
      
      const uploadResult = await this.uploadFile(filePath, fileBuffer, { mode: 'add' })
      
      console.log('[DropboxService] ✅ Survey photo uploaded successfully')
      
      // Return the path
      return {
        path: filePath
      }
    } catch (error) {
      console.error('[DropboxService] ❌ Failed to upload survey photo:', error)
      throw new Error(`Failed to upload survey photo to Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create project folder structure in Dropbox
   * Creates: /Meisner Interiors Team Folder/{projectName}/
   * With subfolders: 1-CAD, 2-MAX, 3-RENDERING, 4-SENT, 5-RECIEVED, 6-SHOPPING, 7-SOURCES, 8-DRAWINGS, 9-SKP, 10-REFERENCE MOOD, 11-SOFTWARE UPLOADS
   */
  async createProjectFolderStructure(projectName: string): Promise<string> {
    try {
      console.log('[DropboxService] 📁 Creating project folder structure for:', projectName)
      
      // Sanitize project name for folder creation
      const sanitizedProjectName = this.sanitizeFolderName(projectName)
      
      if (!sanitizedProjectName) {
        throw new Error('Project name resulted in empty folder name after sanitization')
      }
      
      console.log('[DropboxService] 📝 Sanitized project name:', sanitizedProjectName)
      
      // Define the main project folder path
      const mainFolderPath = `/Meisner Interiors Team Folder/${sanitizedProjectName}`
      
      // Create main project folder
      console.log('[DropboxService] 📂 Creating main project folder:', mainFolderPath)
      await this.createFolder(mainFolderPath)
      
      // Define standard subfolders (with space after dash)
      const subfolders = [
        '1- CAD',
        '2- MAX',
        '3- RENDERING',
        '4- SENT',
        '5- RECIEVED',
        '6- SHOPPING',
        '7- SOURCES',
        '8- DRAWINGS',
        '9- SKP',
        '10- REFERENCE MOOD',
        '11- SOFTWARE UPLOADS'
      ]
      
      // Create each subfolder
      console.log(`[DropboxService] 📚 Creating ${subfolders.length} subfolders...`)
      let successCount = 0
      let failCount = 0
      
      for (const subfolder of subfolders) {
        const subfolderPath = `${mainFolderPath}/${subfolder}`
        console.log(`[DropboxService] 📁 Creating subfolder ${successCount + 1}/${subfolders.length}:`, subfolderPath)
        
        try {
          await this.createFolder(subfolderPath)
          successCount++
          console.log(`[DropboxService] ✅ Subfolder created: ${subfolder}`)
        } catch (error) {
          failCount++
          // Log error but continue with other folders
          console.error(`[DropboxService] ⚠️ Failed to create subfolder ${subfolder}:`, error)
        }
      }
      
      // Create common subfolders inside 11- SOFTWARE UPLOADS
      const softwareUploadsPath = `${mainFolderPath}/11- SOFTWARE UPLOADS`
      const softwareSubfolders = [
        'Project Covers',
        'Spec Books',
        'Spec Books/Generated',
        'Spec Books/Uploaded',
        'Floorplan Approvals',
        'Chat Attachments',
        'General Assets'
      ]
      
      console.log(`[DropboxService] 📚 Creating ${softwareSubfolders.length} subfolders in SOFTWARE UPLOADS...`)
      for (const subfolder of softwareSubfolders) {
        const subfolderPath = `${softwareUploadsPath}/${subfolder}`
        try {
          await this.createFolder(subfolderPath)
          successCount++
          console.log(`[DropboxService] ✅ SOFTWARE UPLOADS subfolder created: ${subfolder}`)
        } catch (error) {
          failCount++
          console.error(`[DropboxService] ⚠️ Failed to create SOFTWARE UPLOADS subfolder ${subfolder}:`, error)
        }
      }
      
      console.log(`[DropboxService] ✅ Project folder structure completed: ${successCount} folders created, ${failCount} failed`)
      console.log('[DropboxService] 📍 Main folder path:', mainFolderPath)
      return mainFolderPath
      
    } catch (error) {
      console.error('[DropboxService] ❌ Failed to create project folder structure:', error)
      throw new Error(`Failed to create Dropbox project folder structure: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export { DropboxService }
export const dropboxService = new DropboxService()
export type { DropboxFile, DropboxFolder }
