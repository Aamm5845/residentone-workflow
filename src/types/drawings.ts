export interface DrawingAsset {
  id: string
  title: string
  filename: string | null
  url: string
  type: 'IMAGE' | 'PDF' | 'DRAWING' | 'DOCUMENT' | 'OTHER'
  size: number | null
  mimeType: string | null
  description: string | null
  userDescription: string | null
  uploadedBy: string
  createdAt: string
  updatedAt: string
  uploader: {
    id: string
    name: string
    email: string
  }
  drawingChecklistItemId: string | null
}

export interface DropboxFileLink {
  id: string
  sectionId?: string | null
  drawingChecklistItemId?: string | null
  dropboxPath: string
  dropboxFileId?: string | null
  fileName: string
  fileSize?: number | null
  lastModified?: Date | null
  dropboxRevision?: string | null
  cadToPdfCacheUrl?: string | null
  uploadedPdfUrl?: string | null
  cacheExpiry?: Date | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DrawingChecklistItem {
  id: string
  stageId: string
  type: 'LIGHTING' | 'ELEVATION' | 'MILLWORK' | 'FLOORPLAN' | 'CUSTOM'
  name: string
  description: string | null
  completed: boolean
  order: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  assets: DrawingAsset[]
  dropboxFiles?: DropboxFileLink[]
}

export interface DrawingActivityLog {
  id: string
  action: string
  entity: string
  entityId: string
  details: any
  createdAt: string
  actor: {
    id: string
    name: string
    email: string
  } | null
}

export interface DrawingWorkspaceState {
  stage: {
    id: string
    type: string
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
    room: {
      id: string
      name: string | null
      type: string
      project: {
        id: string
        name: string
        client: {
          name: string
          email: string
        }
        organization: {
          id: string
          name: string
        }
      }
    }
    assignedUser: {
      id: string
      name: string
      email: string
      role: string
    } | null
    dueDate: string | null
    completedAt: string | null
  }
  checklistItems: DrawingChecklistItem[]
  activity: DrawingActivityLog[]
}

export interface DrawingUploadResponse {
  success: boolean
  assets: DrawingAsset[]
  message: string
}

export interface DrawingChecklistUpdateResponse {
  success: boolean
  checklistItem: DrawingChecklistItem
}

export interface DrawingCompletionResponse {
  success: boolean
  stage: {
    id: string
    status: string
    completedAt: string | null
  }
  nextStage?: string
  message: string
}

// API Request/Response types
export interface AddCustomItemRequest {
  name: string
}

export interface AddCustomItemResponse {
  success: boolean
  checklistItem: DrawingChecklistItem
}

export interface LinkFilesRequest {
  dropboxFiles: Array<{
    path: string
    name: string
    size?: number
    lastModified?: Date | string
    id?: string
  }>
}

export interface LinkFilesResponse {
  success: boolean
  linkedFiles: DropboxFileLink[]
  checklistItem: {
    id: string
    name: string
  }
}

export interface UnlinkFileRequest {
  dropboxPath: string
}

export interface UnlinkFileResponse {
  success: boolean
  unlinkedCount: number
}

// Hook types
export interface UseDrawingsWorkspaceResult {
  // Data
  data: DrawingWorkspaceState | undefined
  isLoading: boolean
  error: any
  
  // Actions
  uploadFiles: (checklistItemId: string, files: FileList) => Promise<void>
  toggleChecklistItem: (checklistItemId: string, completed: boolean) => Promise<void>
  updateAssetDescription: (assetId: string, description: string) => Promise<void>
  deleteAsset: (assetId: string) => Promise<void>
  completeStage: () => Promise<void>
  addCustomChecklistItem: (name: string) => Promise<void>
  linkDropboxFiles: (checklistItemId: string, files: any[]) => Promise<void>
  unlinkDropboxFile: (checklistItemId: string, dropboxPath: string) => Promise<void>
  
  // State
  uploading: boolean
  completing: boolean
  linking: boolean
  
  // Utils
  getProgressPercentage: () => number
  canComplete: () => boolean
  mutate: () => Promise<DrawingWorkspaceState | undefined>
}
