// Clean Bathroom FFE Template
// Categories: Flooring, Wall, Ceiling, Doors, Moulding, Lighting, Electric, Plumbing, Accessories

export interface FFEOption {
  id: string
  name: string
  type: 'single' | 'multiple' | 'conditional'
  // For conditional items like toilet - shows different sub-tasks based on selection
  conditionalTasks?: {
    [optionValue: string]: FFESubTask[]
  }
}

export interface FFESubTask {
  id: string
  name: string
  description?: string
}

export interface FFECategory {
  id: string
  name: string
  order: number
  options: FFEOption[]
  allowMultiple: boolean // Can user add multiple items in this category
}

export interface BathroomFFETemplate {
  roomType: 'bathroom' // applies to all bathroom types
  categories: FFECategory[]
}

// Cleared all hardcoded data - users manage their own FFE items
export const BATHROOM_FFE_TEMPLATE: BathroomFFETemplate = {
  roomType: 'bathroom',
  categories: [] // Empty - no hardcoded categories or items
}

// Type definitions for workspace state
export interface FFECategorySelection {
  categoryId: string
  selectedOptions: string[] // IDs of selected options
  quantities?: { [optionId: string]: number } // For multiple quantities of same item
}

export interface FFEItemStatus {
  optionId: string
  categoryId: string
  status: 'pending' | 'chosen' | 'not_needed'
  conditionalSelection?: string // For toilet: 'freestanding' or 'wall_mount'
  subTaskStatuses?: { [taskId: string]: 'pending' | 'chosen' | 'not_needed' }
  quantity?: number
}

export interface BathroomFFEWorkspaceState {
  roomId: string
  roomType: string
  categorySelections: FFECategorySelection[] // What categories/options are required
  itemStatuses: FFEItemStatus[] // Individual item completion status
  completionPercentage: number
  lastUpdated: Date
}

// Helper functions
export function getConditionalTasks(optionId: string, selection: string): FFESubTask[] {
  const option = getAllOptions().find(opt => opt.id === optionId)
  if (!option?.conditionalTasks) return []
  return option.conditionalTasks[selection] || []
}

export function getAllOptions(): FFEOption[] {
  return [] // No hardcoded options - all user-managed
}

export function getCategoryById(categoryId: string): FFECategory | undefined {
  return undefined // No hardcoded categories - all user-managed
}

export function calculateCompletionPercentage(itemStatuses: FFEItemStatus[]): number {
  if (itemStatuses.length === 0) return 0
  
  let totalTasks = 0
  let completedTasks = 0
  
  itemStatuses.forEach(item => {
    if (item.status === 'not_needed') return // Skip items marked as not needed
    
    totalTasks++
    if (item.status === 'chosen') {
      completedTasks++
    }
    
    // Handle conditional sub-tasks (like toilet)
    if (item.subTaskStatuses) {
      Object.values(item.subTaskStatuses).forEach(subStatus => {
        if (subStatus !== 'not_needed') {
          totalTasks++
          if (subStatus === 'chosen') {
            completedTasks++
          }
        }
      })
    }
  })
  
  return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
}

// Apply to all bathroom room types
export const BATHROOM_ROOM_TYPES = [
  'BATHROOM',
  'MASTER_BATHROOM', 
  'FAMILY_BATHROOM',
  'GUEST_BATHROOM',
  'GIRLS_BATHROOM',
  'BOYS_BATHROOM',
  'POWDER_ROOM'
] as const

export function isApplicableRoomType(roomType: string): boolean {
  return BATHROOM_ROOM_TYPES.includes(roomType as any)
}
