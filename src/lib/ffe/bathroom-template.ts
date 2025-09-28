// Bathroom FFE Template Configuration
// Comprehensive template for all bathroom types: Master Bathroom, Powder Room, Girls Bathroom, etc.
// Based on user requirements for preset library system

export interface FFESubItem {
  id: string
  name: string
  type: 'selection' | 'input' | 'checkbox' | 'color' | 'material' | 'measurement'
  options?: string[]
  isRequired?: boolean
  placeholder?: string
  dependsOn?: string[] // Other sub-items this depends on
  unit?: string // For measurements (e.g., 'inches', 'sq ft')
}

export interface FFEItemTemplate {
  id: string
  name: string
  category: string
  itemType: 'base' | 'standard_or_custom' | 'custom_only' | 'conditional'
  isRequired: boolean
  order: number
  options?: string[] // Direct options for simple items
  allowMultiple?: boolean // Allow multiple selections in workspace
  
  // Standard/Custom configuration  
  hasStandardOption?: boolean
  hasCustomOption?: boolean
  
  // Standard option - single selection (freestanding toilet)
  standardConfig?: {
    description: string
    options?: string[]
    taskCount?: number // 1 task for freestanding
    allowCustomInput?: boolean
  }
  
  // Custom option - multiple sub-items (wall-mount toilet)
  customConfig?: {
    description: string
    subItems: FFESubItem[]
    taskCount?: number // 4 tasks for wall-mount
  }
  
  // Toilet special logic
  specialLogic?: {
    type: 'toilet'
    freestandingTasks: number
    wallMountTasks: number
    wallMountSubItems: string[]
  }
  
  // Conditional display
  showWhen?: {
    itemId: string
    selectionType?: 'standard' | 'custom'
    value?: string
  }

  // Default state
  defaultState?: 'pending' | 'included' | 'not_needed'
}

export interface FFERoomTemplate {
  roomType: string
  name: string
  description: string
  applicableRoomTypes: string[]
  categories: {
    [categoryName: string]: FFEItemTemplate[]
  }
}

// Room types that can use this bathroom template
export const BATHROOM_ROOM_TYPES = [
  'MASTER_BATHROOM',
  'FAMILY_BATHROOM', 
  'POWDER_ROOM',
  'GUEST_BATHROOM',
  'GIRLS_BATHROOM',
  'BOYS_BATHROOM',
  'BATHROOM'
]

// Complete Bathroom FFE Template
export const BATHROOM_TEMPLATE: FFERoomTemplate = {
  roomType: 'bathroom',
  name: 'Bathroom',
  description: 'Comprehensive FFE template for all bathroom types with preset library items',
  applicableRoomTypes: BATHROOM_ROOM_TYPES,
  categories: {
    // 1. FLOORING - User can select multiple types
    'Flooring': [
      {
        id: 'tiles',
        name: 'Tiles',
        category: 'Flooring',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: true,
        defaultState: 'pending',
      },
      {
        id: 'hardwood',
        name: 'Hardwood',
        category: 'Flooring',
        itemType: 'base',
        isRequired: false,
        order: 2,
        allowMultiple: false,
        defaultState: 'pending',
      },
      {
        id: 'vinyl',
        name: 'Vinyl',
        category: 'Flooring',
        itemType: 'base',
        isRequired: false,
        order: 3,
        allowMultiple: false,
        defaultState: 'pending',
      },
      {
        id: 'carpet',
        name: 'Carpet',
        category: 'Flooring',
        itemType: 'base',
        isRequired: false,
        order: 4,
        allowMultiple: false,
        defaultState: 'pending',
      }
    ],

    // 2. WALL FINISHES
    'Wall': [
      {
        id: 'wall_tiles',
        name: 'Tiles',
        category: 'Wall',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: true,
        defaultState: 'pending',
      },
      {
        id: 'wall_paint',
        name: 'Paint',
        category: 'Wall',
        itemType: 'base',
        isRequired: false,
        order: 2,
        allowMultiple: false,
        defaultState: 'pending',
      },
      {
        id: 'wall_panelling',
        name: 'Panelling',
        category: 'Wall',
        itemType: 'base',
        isRequired: false,
        order: 3,
        allowMultiple: false,
        defaultState: 'pending',
      }
    ],

    // 3. CEILING
    'Ceiling': [
      {
        id: 'ceiling_paint',
        name: 'Paint',
        category: 'Ceiling',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: false,
        defaultState: 'pending',
      },
      {
        id: 'ceiling_tiles',
        name: 'Tiles',
        category: 'Ceiling',
        itemType: 'base',
        isRequired: false,
        order: 2,
        allowMultiple: false,
        defaultState: 'pending',
      }
    ],

    // 4. DOORS AND HANDLES
    'Doors and Handles': [
      {
        id: 'doors',
        name: 'Doors',
        category: 'Doors and Handles',
        itemType: 'base',
        isRequired: true,
        order: 1,
        allowMultiple: false,
        defaultState: 'pending',
      },
      {
        id: 'handles',
        name: 'Handles',
        category: 'Doors and Handles',
        itemType: 'base',
        isRequired: true,
        order: 2,
        allowMultiple: false,
        defaultState: 'pending',
      }
    ],

    // 5. MOULDING
    'Moulding': [
      {
        id: 'baseboard_moulding',
        name: 'Baseboard Moulding',
        category: 'Moulding',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: false,
        defaultState: 'pending',
      },
      {
        id: 'crown_moulding',
        name: 'Crown Moulding',
        category: 'Moulding',
        itemType: 'base',
        isRequired: false,
        order: 2,
        allowMultiple: false,
        defaultState: 'pending',
      }
    ],

    // 6. LIGHTING
    'Lighting': [
      {
        id: 'spots',
        name: 'Spots',
        category: 'Lighting',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          'Recessed Ceiling Spots',
          'Adjustable Spots',
          'Shower-Rated Spots',
          'Dimmer-Compatible Spots',
          'Color-Changing LED Spots'
        ]
      },
      {
        id: 'fixture',
        name: 'Fixture',
        category: 'Lighting',
        itemType: 'base',
        isRequired: false,
        order: 2,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          'Vanity Light Fixture',
          'Ceiling Fixture',
          'Wall Sconces',
          'Pendant Lights',
          'Mirror Lights',
          'Chandelier'
        ]
      },
      {
        id: 'led',
        name: 'LED',
        category: 'Lighting',
        itemType: 'base',
        isRequired: false,
        order: 3,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          'LED Strip Lights',
          'Under-Cabinet LED',
          'Mirror LED Backlighting',
          'Shower LED Lights',
          'Smart LED System'
        ]
      }
    ],

    // 7. ELECTRIC
    'Electric': [
      {
        id: 'fan',
        name: 'Fan',
        category: 'Electric',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          'Standard Exhaust Fan',
          'Quiet Exhaust Fan',
          'Exhaust Fan with Light',
          'Exhaust Fan with Heater',
          'Smart Exhaust Fan',
          'Ceiling Fan (if applicable)'
        ]
      }
    ],

    // 8. PLUMBING
    'Plumbing': [
      {
        id: 'bathtub',
        name: 'Bathtub',
        category: 'Plumbing',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: false,
        defaultState: 'pending',
        options: [
          'Standard Bathtub',
          'Deep Soaking Tub',
          'Jetted Tub',
          'Freestanding Tub',
          'Corner Tub',
          'Walk-in Tub'
        ]
      },
      {
        id: 'shower_kit',
        name: 'Shower Kit',
        category: 'Plumbing',
        itemType: 'base',
        isRequired: false,
        order: 2,
        allowMultiple: false,
        defaultState: 'pending',
        options: [
          'Standard Shower Kit',
          'Walk-in Shower',
          'Steam Shower',
          'Shower with Seat',
          'Corner Shower',
          'Roll-in Accessible Shower'
        ]
      },
      {
        id: 'faucet',
        name: 'Faucet',
        category: 'Plumbing',
        itemType: 'base',
        isRequired: false,
        order: 3,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          'Single Handle Faucet',
          'Widespread Faucet',
          'Wall-Mounted Faucet',
          'Vessel Sink Faucet',
          'Tub Faucet',
          'Smart Faucet'
        ]
      },
      {
        id: 'drain',
        name: 'Drain',
        category: 'Plumbing',
        itemType: 'base',
        isRequired: false,
        order: 4,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          'Standard Floor Drain',
          'Linear Drain',
          'Corner Drain',
          'Sink Pop-up Drain',
          'Tub Drain',
          'Decorative Drain Cover'
        ]
      },
      
      // TOILET - Special Logic Implementation
      {
        id: 'toilet',
        name: 'Toilet',
        category: 'Plumbing',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 5,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        
        // Freestanding Option - 1 Task
        standardConfig: {
          description: 'Freestanding toilet - simple selection (1 task)',
          taskCount: 1,
          options: [
            'Standard Two-Piece Toilet',
            'One-Piece Toilet',
            'Comfort Height Toilet',
            'Dual Flush Toilet',
            'Smart Toilet'
          ]
        },
        
        // Wall-Mount Option - 4 Sub-tasks
        customConfig: {
          description: 'Wall-mounted toilet system (4 tasks)',
          taskCount: 4,
          subItems: [
            {
              id: 'carrier',
              name: 'Carrier',
              type: 'selection',
              isRequired: true,
              options: [
                'Geberit Duofix Carrier',
                'TOTO In-Wall Carrier',
                'Kohler In-Wall Carrier',
                'Grohe Rapid SL Carrier'
              ]
            },
            {
              id: 'bowl',
              name: 'Bowl',
              type: 'selection',
              isRequired: true,
              options: [
                'TOTO Wall-Hung Bowl',
                'Kohler Veil Wall-Hung Bowl',
                'Duravit Starck 3 Bowl',
                'Geberit Aquaclean Bowl'
              ]
            },
            {
              id: 'seat',
              name: 'Seat',
              type: 'selection',
              isRequired: true,
              options: [
                'Standard Soft-Close Seat',
                'Heated Toilet Seat',
                'Bidet Seat - Basic',
                'Bidet Seat - Premium',
                'Smart Toilet Seat'
              ]
            },
            {
              id: 'flush_plate',
              name: 'Flush Plate',
              type: 'selection',
              isRequired: true,
              options: [
                'Chrome Dual Flush Plate',
                'Matte Black Dual Flush Plate',
                'White Dual Flush Plate',
                'Brass Dual Flush Plate',
                'Custom Color Match Plate'
              ]
            }
          ]
        },
        
        // Special toilet logic
        specialLogic: {
          type: 'toilet',
          freestandingTasks: 1,
          wallMountTasks: 4,
          wallMountSubItems: ['carrier', 'bowl', 'seat', 'flush_plate']
        }
      },
      
      // VANITY - Special Logic Implementation
      {
        id: 'vanity',
        name: 'Vanity',
        category: 'Plumbing',
        itemType: 'standard_or_custom',
        isRequired: false,
        order: 6,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        
        // Standard Option - 1 Task
        standardConfig: {
          description: 'Standard vanity - simple selection (1 task)',
          taskCount: 1,
          options: [
            'Single Sink Vanity',
            'Double Sink Vanity',
            'Floating Vanity',
            'Traditional Vanity',
            'Modern Vanity',
            'Corner Vanity'
          ]
        },
        
        // Custom Option - 4 Sub-tasks
        customConfig: {
          description: 'Custom vanity system (4 tasks)',
          taskCount: 4,
          subItems: [
            {
              id: 'cabinet',
              name: 'Cabinet',
              type: 'selection',
              isRequired: true,
              options: [
                'Shaker Style Cabinet',
                'Modern Flat Panel Cabinet',
                'Traditional Raised Panel Cabinet',
                'Open Shelf Cabinet',
                'Custom Built-in Cabinet'
              ]
            },
            {
              id: 'counter',
              name: 'Counter',
              type: 'selection',
              isRequired: true,
              options: [
                'Quartz Countertop',
                'Granite Countertop',
                'Marble Countertop',
                'Concrete Countertop',
                'Wood Countertop',
                'Solid Surface Countertop'
              ]
            },
            {
              id: 'handle',
              name: 'Handle',
              type: 'selection',
              isRequired: true,
              options: [
                'Bar Pulls - Brushed Nickel',
                'Bar Pulls - Matte Black',
                'Knobs - Brushed Gold',
                'Knobs - Chrome',
                'Modern Edge Pulls',
                'Traditional Cup Pulls'
              ]
            },
            {
              id: 'paint',
              name: 'Paint',
              type: 'selection',
              isRequired: true,
              options: [
                'White - Semi Gloss',
                'Off White - Satin',
                'Gray - Semi Gloss',
                'Navy Blue - Semi Gloss',
                'Natural Wood Stain',
                'Custom Color Match'
              ]
            }
          ]
        },
        
        // Special vanity logic
        specialLogic: {
          type: 'vanity',
          standardTasks: 1,
          customTasks: 4,
          customSubItems: ['cabinet', 'counter', 'handle', 'paint']
        }
      }
    ],

    // 9. ACCESSORIES
    'Accessories': [
      {
        id: 'towel_bar',
        name: 'Towel Bar',
        category: 'Accessories',
        itemType: 'base',
        isRequired: false,
        order: 1,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          '18-inch Towel Bar',
          '24-inch Towel Bar',
          'Double Towel Bar',
          'Swing-Arm Towel Bar',
          'Corner Towel Bar'
        ]
      },
      {
        id: 'tissue_holder',
        name: 'Tissue Holder',
        category: 'Accessories',
        itemType: 'base',
        isRequired: true,
        order: 2,
        allowMultiple: false,
        defaultState: 'pending',
        options: [
          'Standard Tissue Holder',
          'Recessed Tissue Holder',
          'Standing Tissue Holder',
          'Double Roll Holder',
          'Tissue Holder with Shelf'
        ]
      },
      {
        id: 'hook',
        name: 'Hook',
        category: 'Accessories',
        itemType: 'base',
        isRequired: false,
        order: 3,
        allowMultiple: true,
        defaultState: 'pending',
        options: [
          'Single Robe Hook',
          'Double Hook',
          'Over-Door Hooks',
          'Suction Cup Hooks',
          'Decorative Hooks'
        ]
      },
      {
        id: 'towel_warmer',
        name: 'Towel Warmer',
        category: 'Accessories',
        itemType: 'base',
        isRequired: false,
        order: 4,
        allowMultiple: false,
        defaultState: 'pending',
        options: [
          'Electric Towel Warmer',
          'Hydronic Towel Warmer',
          'Wall-Mounted Towel Warmer',
          'Freestanding Towel Warmer',
          'Ladder-Style Towel Warmer'
        ]
      }
    ]
  }
}

// Enhanced item state types
export type FFEItemState = 'pending' | 'included' | 'not_needed' | 'custom_expanded'

// Helper functions for the bathroom template
export function getBathroomCategoryItems(categoryId: string): FFEItemTemplate[] {
  const category = BATHROOM_TEMPLATE.categories[categoryId]
  return category || []
}

// Helper function to check if toilet is wall-mount and get sub-tasks
export function getToiletSubTasks(): FFESubItem[] {
  const toiletItem = getBathroomCategoryItems('Plumbing').find(item => item.id === 'toilet')
  return toiletItem?.customConfig?.subItems || []
}

// Helper function for toilet special logic
export function getToiletTaskCount(selectionType: 'standard' | 'custom'): number {
  const toiletItem = getBathroomCategoryItems('Plumbing').find(item => item.id === 'toilet')
  if (!toiletItem?.specialLogic) return 1
  
  return selectionType === 'standard' 
    ? toiletItem.specialLogic.freestandingTasks 
    : toiletItem.specialLogic.wallMountTasks
}

// Helper functions for conditional logic
export function isItemVisible(item: FFEItemTemplate, otherItems: Record<string, any>): boolean {
  if (!item.showWhen) return true
  
  const dependentItem = otherItems[item.showWhen.itemId]
  if (!dependentItem) return false
  
  if (item.showWhen.selectionType) {
    return dependentItem.selectionType === item.showWhen.selectionType
  }
  
  if (item.showWhen.value) {
    return dependentItem.value === item.showWhen.value
  }
  
  return dependentItem.state === 'included' || dependentItem.state === 'custom_expanded'
}

export function getVisibleSubItems(item: FFEItemTemplate, currentSelections?: Record<string, any>): FFESubItem[] {
  if (!item.customConfig) return []
  
  return item.customConfig.subItems.filter(subItem => {
    if (!subItem.dependsOn || !currentSelections) return true
    
    return subItem.dependsOn.some(dependency => {
      const selectedValue = currentSelections[dependency]
      return selectedValue && selectedValue !== ''
    })
  })
}

// Helper function to validate bathroom FFE completion
export function validateBathroomFFECompletion(selectedItems: Record<string, any>): {
  isValid: boolean
  missingRequired: string[]
  warnings: string[]
} {
  const missingRequired: string[] = []
  const warnings: string[] = []
  
  // Check required items across all categories
  Object.values(BATHROOM_TEMPLATE.categories).flat().forEach(item => {
    if (item.isRequired) {
      const itemStatus = selectedItems[item.id]
      if (!itemStatus || itemStatus.state === 'not_needed' || itemStatus.state === 'pending') {
        missingRequired.push(item.name)
      }
    }
  })
  
  // Check toilet special logic
  const toiletStatus = selectedItems.toilet
  if (toiletStatus && toiletStatus.selectionType === 'custom') {
    const requiredSubTasks = ['carrier', 'bowl', 'seat', 'flush_plate']
    for (const subTask of requiredSubTasks) {
      const subTaskStatus = toiletStatus.customOptions?.[subTask]
      if (!subTaskStatus || subTaskStatus === '') {
        missingRequired.push(`Toilet ${subTask.charAt(0).toUpperCase() + subTask.slice(1)}`)
      }
    }
  }
  
  // Check for recommended items
  if (!selectedItems.tissue_holder || selectedItems.tissue_holder.state !== 'included') {
    warnings.push('Tissue holder is recommended for all bathrooms')
  }
  
  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    warnings
  }
}

// Validation helpers
export function validateItemConfiguration(item: FFEItemTemplate, status: any): string[] {
  const errors: string[] = []
  
  if (item.isRequired && status.state !== 'included' && status.state !== 'custom_expanded') {
    errors.push(`${item.name} is required but not included`)
  }
  
  if (status.state === 'custom_expanded' && item.customConfig) {
    const requiredSubItems = item.customConfig.subItems.filter(sub => sub.isRequired)
    
    requiredSubItems.forEach(subItem => {
      const subValue = status.customOptions?.[subItem.id]
      if (!subValue || subValue === '') {
        errors.push(`${item.name}: ${subItem.name} is required`)
      }
    })
  }
  
  return errors
}

// Template registry
export const FFE_ROOM_TEMPLATES: Record<string, FFERoomTemplate> = {
  'bathroom': BATHROOM_TEMPLATE,
  'master_bathroom': BATHROOM_TEMPLATE,
  'family_bathroom': BATHROOM_TEMPLATE,
  'guest_bathroom': BATHROOM_TEMPLATE,
  'powder_room': BATHROOM_TEMPLATE,
  'girls_bathroom': BATHROOM_TEMPLATE,
  'boys_bathroom': BATHROOM_TEMPLATE
}

export function getTemplateForRoomType(roomType: string): FFERoomTemplate | undefined {
  const normalizedType = roomType.toLowerCase().replace(/_/g, '_')
  return FFE_ROOM_TEMPLATES[normalizedType]
}

// Get all categories for a room
export function getBathroomCategories(): string[] {
  return Object.keys(BATHROOM_TEMPLATE.categories)
}

// Get items that allow multiple selections
export function getMultipleSelectionItems(): FFEItemTemplate[] {
  return Object.values(BATHROOM_TEMPLATE.categories)
    .flat()
    .filter(item => item.allowMultiple === true)
}

