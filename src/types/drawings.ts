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
  
  // State
  uploading: boolean
  completing: boolean
  
  // Utils
  getProgressPercentage: () => number
  canComplete: () => boolean
  mutate: () => Promise<DrawingWorkspaceState | undefined>
}