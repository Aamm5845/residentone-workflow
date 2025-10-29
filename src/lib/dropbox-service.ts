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
    if (!process.env.DROPBOX_TEAM_MEMBER_ID) {
      throw new Error('DROPBOX_TEAM_MEMBER_ID environment variable is required for team operations')
    }
    return process.env.DROPBOX_TEAM_MEMBER_ID
  }

  private getClient() {
    if (!this.dropbox) {
      const teamMemberId = this.getTeamMemberId()
      
      if (process.env.DROPBOX_ACCESS_TOKEN) {
        this.dropbox = new Dropbox({
          accessToken: process.env.DROPBOX_ACCESS_TOKEN,
          fetch: fetchImpl,
          selectUser: teamMemberId
        })
      } else if (process.env.DROPBOX_REFRESH_TOKEN && process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET) {
        this.dropbox = new Dropbox({
          refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
          clientId: process.env.DROPBOX_APP_KEY,
          clientSecret: process.env.DROPBOX_APP_SECRET,
          fetch: fetchImpl,
          selectUser: teamMemberId
        })
      } else {
        throw new Error('Either DROPBOX_ACCESS_TOKEN or DROPBOX_REFRESH_TOKEN (with DROPBOX_APP_KEY and DROPBOX_APP_SECRET) environment variables are required')
      }
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
      
      console.log('[DropboxService] Downloading file via shared link:', path)
      
      try {
        // Method 1: Try sharingGetSharedLinkFile
        const response = await client.sharingGetSharedLinkFile({
          url: sharedLinkUrl,
          path: path
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
        
        // Method 2: Fallback to regular filesDownload (might work if file path is accessible)
        try {
          const response = await client.filesDownload({ path })
          
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
}

export const dropboxService = new DropboxService()
export type { DropboxFile, DropboxFolder }
