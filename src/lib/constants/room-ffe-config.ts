import { RoomType } from '@prisma/client'

// FFE Item States - Simple 3-state system for QA checklist
export type FFEItemState = 'pending' | 'confirmed' | 'not_needed'

// Sub-items for custom items that need to be broken down
export interface FFESubItem {
  id: string
  name: string
  required: boolean
  state?: FFEItemState
}

// Base FFE item template for room checklists
export interface FFEItemTemplate {
  id: string
  name: string
  category: string
  isRequired: boolean // Must be addressed (can still be marked "not needed")
  isStandard: boolean // true = single checkbox, false = expands to sub-items
  subItems?: FFESubItem[] // Only for custom items
  conditionalOn?: string[] // Show only if these item IDs are confirmed
  order?: number // Display order within category
}

// Category groupings for organized display
export interface FFECategory {
  id: string
  name: string
  order: number
  items: FFEItemTemplate[]
}

// Room-specific FFE configuration
export interface RoomFFEConfig {
  roomType: string
  categories: FFECategory[]
}

// Standard category definitions
export const FFE_CATEGORIES = {
  BASE_FINISHES: 'base-finishes',
  FURNITURE: 'furniture', 
  LIGHTING: 'lighting',
  TEXTILES: 'textiles',
  ACCESSORIES: 'accessories',
  PLUMBING: 'plumbing',
  APPLIANCES: 'appliances'
} as const

// Default FFE checklists by room type - simplified for now
export const ROOM_FFE_CONFIG: Record<string, RoomFFEConfig> = {
  'dining-room': {
    roomType: 'dining-room',
    categories: [
      {
        id: FFE_CATEGORIES.FURNITURE,
        name: 'Furniture',
        order: 1,
        items: [
          {
            id: 'dining-table',
            name: 'Dining Table',
            category: FFE_CATEGORIES.FURNITURE,
            isRequired: true,
            isStandard: false,
            subItems: [
              { id: 'table-size', name: 'Size/Dimensions', required: true },
              { id: 'table-material', name: 'Material', required: true },
              { id: 'table-finish', name: 'Finish', required: true }
            ]
          },
          {
            id: 'dining-chairs',
            name: 'Dining Chairs',
            category: FFE_CATEGORIES.FURNITURE,
            isRequired: true,
            isStandard: false,
            subItems: [
              { id: 'chair-quantity', name: 'Quantity', required: true },
              { id: 'chair-frame', name: 'Frame Material', required: true },
              { id: 'chair-upholstery', name: 'Upholstery', required: false }
            ]
          }
        ]
      }
    ]
  }
}

// Get default FFE configuration for a room type
export function getDefaultFFEConfig(roomType: string): RoomFFEConfig | null {
  return ROOM_FFE_CONFIG[roomType] || null
}

// Get all available FFE item templates
export function getAllFFEItems(): FFEItemTemplate[] {
  const allItems: FFEItemTemplate[] = []
  Object.values(ROOM_FFE_CONFIG).forEach(config => {
    config.categories.forEach(category => {
      allItems.push(...category.items)
    })
  })
  return allItems
}

// Get items by category
export function getFFEItemsByCategory(roomType: string, categoryId: string): FFEItemTemplate[] {
  const config = getDefaultFFEConfig(roomType)
  if (!config) return []
  
  const category = config.categories.find(cat => cat.id === categoryId)
  return category?.items || []
}

// Alias for backwards compatibility
export const getRoomFFEConfig = getDefaultFFEConfig
