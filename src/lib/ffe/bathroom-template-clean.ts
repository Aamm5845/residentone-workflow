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

export const BATHROOM_FFE_TEMPLATE: BathroomFFETemplate = {
  roomType: 'bathroom',
  categories: [
    {
      id: 'flooring',
      name: 'Flooring',
      order: 1,
      allowMultiple: true, // User can select multiple flooring types
      options: [
        {
          id: 'tiles',
          name: 'Tiles',
          type: 'single'
        },
        {
          id: 'hardwood',
          name: 'Hardwood',
          type: 'single'
        },
        {
          id: 'vinyl',
          name: 'Vinyl',
          type: 'single'
        },
        {
          id: 'carpet',
          name: 'Carpet',
          type: 'single'
        }
      ]
    },
    {
      id: 'wall',
      name: 'Wall',
      order: 2,
      allowMultiple: true,
      options: [
        {
          id: 'tiles',
          name: 'Tiles',
          type: 'single'
        },
        {
          id: 'paint',
          name: 'Paint',
          type: 'single'
        },
        {
          id: 'panelling',
          name: 'Panelling',
          type: 'single'
        }
      ]
    },
    {
      id: 'ceiling',
      name: 'Ceiling',
      order: 3,
      allowMultiple: false,
      options: [
        {
          id: 'paint',
          name: 'Paint',
          type: 'single'
        },
        {
          id: 'tiles',
          name: 'Tiles',
          type: 'single'
        }
      ]
    },
    {
      id: 'doors',
      name: 'Doors and Handles',
      order: 4,
      allowMultiple: true,
      options: [
        {
          id: 'doors',
          name: 'Doors',
          type: 'single'
        },
        {
          id: 'handles',
          name: 'Handles',
          type: 'single'
        }
      ]
    },
    {
      id: 'moulding',
      name: 'Moulding',
      order: 5,
      allowMultiple: false,
      options: [
        {
          id: 'moulding',
          name: 'Moulding',
          type: 'single'
        }
      ]
    },
    {
      id: 'lighting',
      name: 'Lighting',
      order: 6,
      allowMultiple: true,
      options: [
        {
          id: 'spots',
          name: 'Spots',
          type: 'single'
        },
        {
          id: 'fixture',
          name: 'Fixture',
          type: 'single'
        },
        {
          id: 'led',
          name: 'LED',
          type: 'single'
        }
      ]
    },
    {
      id: 'electric',
      name: 'Electric',
      order: 7,
      allowMultiple: true,
      options: [
        {
          id: 'fan',
          name: 'Fan',
          type: 'single'
        }
      ]
    },
    {
      id: 'plumbing',
      name: 'Plumbing',
      order: 8,
      allowMultiple: true,
      options: [
        {
          id: 'bathtub',
          name: 'Bathtub',
          type: 'single'
        },
        {
          id: 'shower_kit',
          name: 'Shower Kit',
          type: 'single'
        },
        {
          id: 'faucet',
          name: 'Faucet',
          type: 'single'
        },
        {
          id: 'drain',
          name: 'Drain',
          type: 'single'
        },
        {
          id: 'toilet',
          name: 'Toilet',
          type: 'conditional',
          conditionalTasks: {
            'freestanding': [
              {
                id: 'toilet_spec',
                name: 'Toilet Specification',
                description: 'Specify the toilet model and details'
              }
            ],
            'wall_mount': [
              {
                id: 'carrier',
                name: 'Carrier',
                description: 'Wall-mounted toilet carrier system'
              },
              {
                id: 'bowl',
                name: 'Bowl',
                description: 'Toilet bowl specification'
              },
              {
                id: 'seat',
                name: 'Seat',
                description: 'Toilet seat specification'
              },
              {
                id: 'flush_plate',
                name: 'Flush Plate',
                description: 'Wall-mounted flush plate'
              }
            ]
          }
        }
      ]
    },
    {
      id: 'accessories',
      name: 'Accessories',
      order: 9,
      allowMultiple: true,
      options: [
        {
          id: 'towel_bar',
          name: 'Towel Bar',
          type: 'single'
        },
        {
          id: 'tissue_holder',
          name: 'Tissue Holder',
          type: 'single'
        },
        {
          id: 'hook',
          name: 'Hook',
          type: 'single'
        },
        {
          id: 'towel_warmer',
          name: 'Towel Warmer',
          type: 'single'
        }
      ]
    }
  ]
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
  return BATHROOM_FFE_TEMPLATE.categories.flatMap(cat => cat.options)
}

export function getCategoryById(categoryId: string): FFECategory | undefined {
  return BATHROOM_FFE_TEMPLATE.categories.find(cat => cat.id === categoryId)
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