import { Dropbox } from 'dropbox'

// Team member interface
export interface DropboxTeamMember {
  name: string
  email: string
  memberId: string
  role: 'team_admin' | 'member_only'
}

// File interface
export interface DropboxFile {
  id: string
  name: string
  path: string
  size: number
  lastModified: Date
  revision: string
  isFolder: boolean
  thumbnailUrl?: string
}

// Folder interface
export interface DropboxFolder {
  files: DropboxFile[]
  folders: DropboxFile[]
  hasMore: boolean
  cursor?: string
}

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

/**
 * Enhanced Dropbox service with proper team member support
 * Uses Dropbox-API-Select-User and Dropbox-API-Path-Root headers
 */
class DropboxServiceV2 {
  private teamMembers: DropboxTeamMember[] = []
  private rootNamespaceId: string
  private defaultMemberId: string

  constructor() {
    // Load team members from environment
    this.loadTeamMembers()
    this.rootNamespaceId = process.env.DROPBOX_ROOT_NAMESPACE_ID || '11510809107'
    this.defaultMemberId = process.env.DROPBOX_API_SELECT_USER || ''
  }

  /**
   * Load team members from environment variable
   */
  private loadTeamMembers() {
    try {
      const membersJson = process.env.DROPBOX_TEAM_MEMBERS
      if (membersJson) {
        this.teamMembers = JSON.parse(membersJson)
      }
    } catch (error) {
      console.error('[DropboxService] Failed to parse team members:', error)
      this.teamMembers = []
    }
  }

  /**
   * Get all team members
   */
  getTeamMembers(): DropboxTeamMember[] {
    return this.teamMembers
  }

  /**
   * Get team member by email
   */
  getTeamMemberByEmail(email: string): DropboxTeamMember | null {
    return this.teamMembers.find(m => m.email.toLowerCase() === email.toLowerCase()) || null
  }

  /**
   * Get team member by member ID
   */
  getTeamMemberById(memberId: string): DropboxTeamMember | null {
    return this.teamMembers.find(m => m.memberId === memberId) || null
  }

  /**
   * Create a Dropbox client for a specific team member
   * This is the key function that sets up proper headers
   */
  private getClient(memberId?: string): Dropbox {
    const memberIdToUse = memberId || this.defaultMemberId

    if (!memberIdToUse) {
      throw new Error('No team member ID specified and no default member ID configured')
    }

    // Get member info to check role
    const memberInfo = this.getTeamMemberById(memberIdToUse)

    // Create client configuration
    const config: any = {
      fetch: fetchImpl,
      selectUser: memberIdToUse, // Sets Dropbox-API-Select-User header
    }

    // Add authentication - prefer refresh token for automatic renewal
    if (process.env.DROPBOX_REFRESH_TOKEN && process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET) {
      config.refreshToken = process.env.DROPBOX_REFRESH_TOKEN
      config.clientId = process.env.DROPBOX_APP_KEY
      config.clientSecret = process.env.DROPBOX_APP_SECRET
      console.log(`[DropboxService] Using refresh token for authentication`)
    } else if (process.env.DROPBOX_ACCESS_TOKEN) {
      config.accessToken = process.env.DROPBOX_ACCESS_TOKEN
      console.log(`[DropboxService] Using access token for authentication`)
    } else {
      throw new Error('Either DROPBOX_ACCESS_TOKEN or DROPBOX_REFRESH_TOKEN (with app credentials) is required')
    }

    // Only add pathRoot for team_admin users
    // member_only users get 422 errors with pathRoot and should use their personal space
    if (this.rootNamespaceId && memberInfo?.role === 'team_admin') {
      config.pathRoot = JSON.stringify({
        '.tag': 'root',
        'root': this.rootNamespaceId
      })
      console.log(`[DropboxService] Using pathRoot for team_admin: ${config.pathRoot}`)
    } else {
      console.log(`[DropboxService] No pathRoot for ${memberInfo?.role || 'unknown role'} user`)
    }

    const client = new Dropbox(config)
    
    console.log(`[DropboxService] Created client for member: ${memberIdToUse} (${memberInfo?.name || 'unknown'})`)
    
    return client
  }

  /**
   * List files and folders in a path
   * @param path - Path to list (empty string for root)
   * @param memberId - Optional team member ID, uses default if not provided
   */
  async listFolder(path: string = '', memberId?: string, cursor?: string): Promise<DropboxFolder> {
    try {
      const client = this.getClient(memberId)
      let response

      console.log(`[DropboxService] Listing folder: "${path}" for member: ${memberId || 'default'}`)

      if (cursor) {
        response = await client.filesListFolderContinue({ cursor })
      } else {
        // Normalize path
        const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
        
        response = await client.filesListFolder({
          path: normalizedPath,
          recursive: false,
          include_media_info: false,
          include_deleted: false,
          include_mounted_folders: true
        })
      }

      const files: DropboxFile[] = []
      const folders: DropboxFile[] = []

      if (response?.result?.entries) {
        for (const entry of response.result.entries) {
          const entryPath = entry.path_lower || entry.path_display || ''

          if (entry['.tag'] === 'file') {
            files.push({
              id: entry.id || '',
              name: entry.name,
              path: entryPath,
              size: entry.size || 0,
              lastModified: new Date(entry.client_modified || entry.server_modified || new Date()),
              revision: entry.rev || '',
              isFolder: false
            })
          } else if (entry['.tag'] === 'folder') {
            folders.push({
              id: entry.id || '',
              name: entry.name,
              path: entryPath,
              size: 0,
              lastModified: new Date(),
              revision: '',
              isFolder: true
            })
          }
        }
      }

      console.log(`[DropboxService] Found ${files.length} files and ${folders.length} folders`)

      return {
        files,
        folders,
        hasMore: response?.result?.has_more || false,
        cursor: response?.result?.cursor
      }

    } catch (error: any) {
      console.error('[DropboxService] Error listing folder:', error)
      throw new Error(`Failed to list Dropbox folder: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Download a file from Dropbox
   */
  async downloadFile(path: string, memberId?: string): Promise<Buffer> {
    try {
      const client = this.getClient(memberId)
      
      console.log(`[DropboxService] Downloading file: "${path}" for member: ${memberId || 'default'}`)

      const response = await client.filesDownload({ path })

      if (!response?.result?.fileBinary) {
        throw new Error('No file data received from Dropbox')
      }

      const buffer = Buffer.from(response.result.fileBinary as any)
      console.log(`[DropboxService] Downloaded ${buffer.length} bytes`)
      
      return buffer

    } catch (error: any) {
      console.error('[DropboxService] Error downloading file:', error)
      throw new Error(`Failed to download file from Dropbox: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string, memberId?: string): Promise<DropboxFile | null> {
    try {
      const client = this.getClient(memberId)
      
      console.log(`[DropboxService] Getting metadata for: "${path}"`)

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

      return null

    } catch (error: any) {
      console.error('[DropboxService] Error getting metadata:', error)
      return null
    }
  }

  /**
   * Get a temporary download link for a file (4 hours expiry)
   */
  async getTemporaryLink(path: string, memberId?: string): Promise<string | null> {
    try {
      const client = this.getClient(memberId)
      const response = await client.filesGetTemporaryLink({ path })
      return response?.result?.link || null
    } catch (error: any) {
      console.error('[DropboxService] Error getting temporary link:', error)
      return null
    }
  }

  /**
   * Check if a file has been updated (revision changed)
   */
  async checkFileUpdated(path: string, lastKnownRevision: string, memberId?: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(path, memberId)
      return metadata ? metadata.revision !== lastKnownRevision : false
    } catch (error) {
      console.error('[DropboxService] Error checking file update:', error)
      return false
    }
  }

  /**
   * Search for CAD files in Dropbox
   */
  async searchCADFiles(query: string, memberId?: string, maxResults: number = 50): Promise<DropboxFile[]> {
    try {
      const client = this.getClient(memberId)
      
      const response = await client.filesSearchV2({
        query,
        options: {
          path: '',
          max_results: maxResults,
          file_extensions: ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'ctb']
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

    } catch (error: any) {
      console.error('[DropboxService] Error searching CAD files:', error)
      return []
    }
  }

  /**
   * Test connection for a specific team member
   */
  async testConnection(memberId?: string): Promise<{
    success: boolean
    memberInfo?: DropboxTeamMember
    error?: string
    rootPath?: string
  }> {
    try {
      const memberIdToUse = memberId || this.defaultMemberId
      const memberInfo = this.getTeamMemberById(memberIdToUse)

      console.log(`[DropboxService] Testing connection for member: ${memberIdToUse}`)

      // Try to list root folder
      const result = await this.listFolder('', memberIdToUse)

      return {
        success: true,
        memberInfo: memberInfo || undefined,
        rootPath: this.rootNamespaceId
      }

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error'
      }
    }
  }
}

// Export singleton instance
export const dropboxService = new DropboxServiceV2()
export type { DropboxFile, DropboxFolder, DropboxTeamMember }
