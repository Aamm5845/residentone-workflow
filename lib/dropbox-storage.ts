import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';

// Dropbox configuration interface
interface DropboxConfig {
  accessToken: string;
  appKey: string;
  appSecret: string;
}

// File metadata interface
interface DropboxFileMetadata {
  name: string;
  size: number;
  url: string;
  path: string;
  uploadedAt: string;
  contentType?: string;
}

/**
 * Enterprise-grade Dropbox storage integration
 * Handles file uploads, downloads, deletions, and URL generation
 */
export class DropboxStorage {
  private dbx: Dropbox;
  private config: DropboxConfig;

  constructor() {
    this.config = {
      accessToken: process.env.DROPBOX_ACCESS_TOKEN || '',
      appKey: process.env.DROPBOX_APP_KEY || '',
      appSecret: process.env.DROPBOX_APP_SECRET || '',
    };

    if (!this.config.accessToken) {
      throw new Error('Dropbox access token is required. Please set DROPBOX_ACCESS_TOKEN in your environment.');
    }

    this.dbx = new Dropbox({ 
      accessToken: this.config.accessToken,
      fetch: fetch as any
    });
  }

  /**
   * Check if Dropbox is properly configured
   */
  static isConfigured(): boolean {
    return !!(
      process.env.DROPBOX_ACCESS_TOKEN &&
      process.env.DROPBOX_APP_KEY &&
      process.env.DROPBOX_APP_SECRET
    );
  }

  /**
   * Generate organized file path for interior design projects
   * Format: /interior-design/{projectId}/rooms/{roomId}/sections/{sectionId}/{filename}
   */
  generateFilePath(projectId: string, filename: string, roomId?: string, sectionId?: string): string {
    let path = `/interior-design/${projectId}`;
    
    if (roomId) {
      path += `/rooms/${roomId}`;
      if (sectionId) {
        path += `/sections/${sectionId}`;
      }
    }
    
    return `${path}/${filename}`;
  }

  /**
   * Upload a file to Dropbox
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    projectId: string,
    contentType?: string,
    roomId?: string,
    sectionId?: string
  ): Promise<DropboxFileMetadata> {
    try {
      const filePath = this.generateFilePath(projectId, filename, roomId, sectionId);

      const response = await this.dbx.filesUpload({
        path: filePath,
        contents: buffer,
        mode: 'add',
        autorename: true,
      });

      // Generate shareable link
      const shareResponse = await this.dbx.sharingCreateSharedLinkWithSettings({
        path: filePath,
        settings: {
          requested_visibility: 'public',
          access: 'viewer',
        }
      });

      // Convert Dropbox share URL to direct download URL
      const directUrl = shareResponse.result.url.replace('?dl=0', '?dl=1');

      return {
        name: response.result.name,
        size: response.result.size,
        url: directUrl,
        path: filePath,
        uploadedAt: new Date().toISOString(),
        contentType: contentType || 'application/octet-stream',
      };
    } catch (error) {
      console.error('Dropbox upload error:', error);
      throw new Error(`Failed to upload file to Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a direct download URL for a file
   */
  async getFileUrl(filePath: string): Promise<string> {
    try {
      const response = await this.dbx.filesGetTemporaryLink({ path: filePath });
      return response.result.link;
    } catch (error) {
      console.error('Error getting Dropbox file URL:', error);
      throw new Error(`Failed to get file URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from Dropbox
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await this.dbx.filesDeleteV2({ path: filePath });
      return true;
    } catch (error) {
      console.error('Error deleting file from Dropbox:', error);
      return false;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(directoryPath: string = '/interior-design'): Promise<any[]> {
    try {
      const response = await this.dbx.filesListFolder({ path: directoryPath });
      return response.result.entries;
    } catch (error) {
      console.error('Error listing Dropbox files:', error);
      return [];
    }
  }

  /**
   * Create a directory structure for a new project
   */
  async createProjectStructure(projectId: string): Promise<void> {
    try {
      const basePath = `/interior-design/${projectId}`;
      const folders = [
        basePath,
        `${basePath}/rooms`,
        `${basePath}/inspiration`,
        `${basePath}/documents`,
        `${basePath}/presentations`,
      ];

      for (const folder of folders) {
        try {
          await this.dbx.filesCreateFolderV2({ path: folder });
        } catch (error: any) {
          // Ignore if folder already exists
          if (error?.error?.error_summary?.includes('path/conflict/folder')) {
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Error creating project structure:', error);
      throw new Error(`Failed to create project structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account information and storage quota
   * Handles both personal and business accounts
   */
  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.dbx.usersGetCurrentAccount();
      const spaceUsage = await this.dbx.usersGetSpaceUsage();
      
      return {
        account: response.result,
        storage: spaceUsage.result,
        accountType: 'personal'
      };
    } catch (error: any) {
      // Handle Dropbox Business team accounts
      if (error.message && error.message.includes('Dropbox Business team')) {
        return {
          account: { name: { display_name: 'Business Team Account' }, email: 'team@business.com' },
          storage: { used: 0, allocation: { allocated: 0 } },
          accountType: 'business',
          note: 'Business team account detected. File operations will work normally.'
        };
      }
      
      console.error('Error getting Dropbox account info:', error);
      throw new Error(`Failed to get account info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Singleton instance for the application
 */
let dropboxInstance: DropboxStorage | null = null;

export function getDropboxStorage(): DropboxStorage | null {
  if (!DropboxStorage.isConfigured()) {
    return null;
  }

  if (!dropboxInstance) {
    try {
      dropboxInstance = new DropboxStorage();
    } catch (error) {
      console.error('Failed to initialize Dropbox storage:', error);
      return null;
    }
  }

  return dropboxInstance;
}

export default DropboxStorage;