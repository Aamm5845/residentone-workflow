import { Dropbox } from 'dropbox'
import fetch from 'node-fetch'

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

  private getDropbox() {
    if (!this.dropbox) {
      if (!process.env.DROPBOX_ACCESS_TOKEN) {
        throw new Error('DROPBOX_ACCESS_TOKEN environment variable is required')
      }

      this.dropbox = new Dropbox({
        accessToken: process.env.DROPBOX_ACCESS_TOKEN,
        fetch: fetch as any
      })
    }
    return this.dropbox
  }

  /**
   * List files and folders in a Dropbox directory
   */
  async listFolder(path: string = '', cursor?: string): Promise<DropboxFolder> {
    try {
      let response

      if (cursor) {
        response = await this.getDropbox().filesListFolderContinue({ cursor })
      } else {
        response = await this.getDropbox().filesListFolder({
          path: path || '',
          recursive: false,
          include_media_info: false,
          include_deleted: false,
          include_has_explicit_shared_members: false
        })
      }

      const files: DropboxFile[] = []
      const folders: DropboxFile[] = []

      if (response?.result?.entries) {
        for (const entry of response.result.entries) {
          if (entry['.tag'] === 'file') {
            const file: DropboxFile = {
              id: entry.id || '',
              name: entry.name,
              path: entry.path_lower || entry.path_display || '',
              size: entry.size || 0,
              lastModified: new Date(entry.client_modified || entry.server_modified || new Date()),
              revision: entry.rev || '',
              isFolder: false
            }

            // Check if it's a CAD file
            const cadExtensions = ['.dwg', '.dxf', '.step', '.stp', '.iges', '.igs']
            const isCADFile = cadExtensions.some(ext => 
              file.name.toLowerCase().endsWith(ext)
            )

            if (isCADFile) {
              files.push(file)
            }
          } else if (entry['.tag'] === 'folder') {
            folders.push({
              id: entry.id || '',
              name: entry.name,
              path: entry.path_lower || entry.path_display || '',
              size: 0,
              lastModified: new Date(),
              revision: '',
              isFolder: true
            })
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
      console.error('Dropbox list folder error:', error)
      throw new Error(`Failed to list Dropbox folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Download a file from Dropbox
   */
  async downloadFile(path: string): Promise<Buffer> {
    try {
      const response = await this.getDropbox().filesDownload({ path })
      
      if (!response?.result?.fileBinary) {
        throw new Error('No file data received from Dropbox')
      }

      return Buffer.from(response.result.fileBinary as any)
    } catch (error) {
      console.error('Dropbox download error:', error)
      throw new Error(`Failed to download file from Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get file metadata from Dropbox
   */
  async getFileMetadata(path: string): Promise<DropboxFile | null> {
    try {
      const response = await this.getDropbox().filesGetMetadata({ path })
      
      if (response?.result?.['.tag'] === 'file') {
        const file = response.result
        return {
          id: file.id || '',
          name: file.name,
          path: file.path_lower || file.path_display || '',
          size: file.size || 0,
          lastModified: new Date(file.client_modified || file.server_modified || new Date()),
          revision: file.rev || '',
          isFolder: false
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
      const response = await this.getDropbox().filesSearchV2({
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
      const response = await this.getDropbox().filesGetTemporaryLink({ path })
      return response?.result?.link || null
    } catch (error) {
      console.error('Dropbox temporary link error:', error)
      return null
    }
  }
}

export const dropboxService = new DropboxService()
export type { DropboxFile, DropboxFolder }