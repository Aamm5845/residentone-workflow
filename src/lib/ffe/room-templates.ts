// FFE Room Templates with Dynamic Standard/Custom Support
// This file defines the hierarchical structure for FFE items in different room types

export interface FFESubItem {
  id: string
  name: string
  type: 'selection' | 'input' | 'checkbox' | 'color' | 'material'
  options?: string[]
  isRequired?: boolean
  placeholder?: string
  dependsOn?: string[] // Other sub-items this depends on
}

export interface FFEItemTemplate {
  id: string
  name: string
  category: string
  itemType: 'base' | 'standard_or_custom' | 'custom_only' | 'conditional'
  isRequired: boolean
  order: number
  
  // Standard/Custom configuration
  hasStandardOption: boolean
  hasCustomOption: boolean
  
  // Standard option - single selection
  standardConfig?: {
    description: string
    options?: string[]
    allowCustomInput?: boolean
  }
  
  // Custom option - multiple sub-items
  customConfig?: {
    description: string
    subItems: FFESubItem[]
  }
  
  // Conditional display
  showWhen?: {
    itemId: string
    selectionType?: 'standard' | 'custom'
    value?: string
  }
}

export interface FFERoomTemplate {
  roomType: string
  name: string
  categories: {
    [categoryName: string]: FFEItemTemplate[]
  }
}

// Bedroom Template - Your specific example
export const BEDROOM_TEMPLATE: FFERoomTemplate = {
  roomType: 'bedroom',
  name: 'Bedroom',
  categories: {
    'Furniture': [
      {
        id: 'bed',
        name: 'Bed',
        category: 'Furniture',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 1,
        hasStandardOption: true,
        hasCustomOption: true,
        standardConfig: {
          description: 'Select from our standard bed collection',
          options: [
            'Platform Bed - King',
            'Platform Bed - Queen', 
            'Upholstered Bed - King',
            'Upholstered Bed - Queen'
          ]
        },
        customConfig: {
          description: 'Design a custom bed with your specifications',
          subItems: [
            {
              id: 'material',
              name: 'Material',
              type: 'selection',
              options: ['Fabric', 'Wood', 'Metal', 'Leather'],
              isRequired: true
            },
            {
              id: 'fabric_type',
              name: 'Fabric Type',
              type: 'selection',
              options: ['Linen', 'Velvet', 'Cotton', 'Bouclé', 'Performance Fabric'],
              dependsOn: ['material'],
              isRequired: true
            },
            {
              id: 'wood_type',
              name: 'Wood Type', 
              type: 'selection',
              options: ['Oak', 'Walnut', 'Maple', 'Cherry', 'Pine'],
              dependsOn: ['material'],
              isRequired: true
            },
            {
              id: 'metal_finish',
              name: 'Metal Finish',
              type: 'selection', 
              options: ['Brass', 'Chrome', 'Black Steel', 'Copper', 'Matte Gold'],
              dependsOn: ['material'],
              isRequired: true
            },
            {
              id: 'color',
              name: 'Color',
              type: 'color',
              isRequired: true
            },
            {
              id: 'size',
              name: 'Size',
              type: 'selection',
              options: ['Twin', 'Full', 'Queen', 'King', 'California King'],
              isRequired: true
            },
            {
              id: 'headboard_style',
              name: 'Headboard Style',
              type: 'selection',
              options: ['Upholstered', 'Panel', 'Wingback', 'Tufted', 'None'],
              isRequired: false
            }
          ]
        }
      },
      {
        id: 'nightstands',
        name: 'Nightstands',
        category: 'Furniture',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 2,
        hasStandardOption: true,
        hasCustomOption: true,
        standardConfig: {
          description: 'Select from our standard nightstand collection',
          options: [
            'Modern 2-Drawer Nightstand',
            'Traditional 3-Drawer Nightstand',
            'Floating Nightstand',
            'Round Pedestal Nightstand'
          ]
        },
        customConfig: {
          description: 'Design custom nightstands',
          subItems: [
            {
              id: 'cabinet_style',
              name: 'Cabinet Style',
              type: 'selection',
              options: ['Traditional', 'Modern', 'Transitional', 'Industrial', 'Mid-Century'],
              isRequired: true
            },
            {
              id: 'material',
              name: 'Material',
              type: 'selection',
              options: ['Wood', 'Metal', 'Glass', 'Stone', 'Mixed Materials'],
              isRequired: true
            },
            {
              id: 'color',
              name: 'Color/Finish',
              type: 'color',
              isRequired: true
            },
            {
              id: 'handles',
              name: 'Handles',
              type: 'selection',
              options: ['Brass Pull', 'Chrome Pull', 'Leather Pull', 'Wood Knob', 'No Handles'],
              isRequired: true
            },
            {
              id: 'drawers',
              name: 'Number of Drawers',
              type: 'selection',
              options: ['1', '2', '3', 'Open Shelf', 'Door + Drawer'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'closets',
        name: 'Closets',
        category: 'Furniture',
        itemType: 'standard_or_custom',
        isRequired: false,
        order: 3,
        hasStandardOption: true,
        hasCustomOption: true,
        standardConfig: {
          description: 'Standard closet organization system',
          options: [
            'Basic Closet System',
            'Premium Closet System',
            'Walk-in Closet System'
          ]
        },
        customConfig: {
          description: 'Custom closet design',
          subItems: [
            {
              id: 'system_type',
              name: 'System Type',
              type: 'selection',
              options: ['Wire', 'Wood', 'Metal', 'Mixed'],
              isRequired: true
            },
            {
              id: 'color',
              name: 'Color',
              type: 'color',
              isRequired: true
            },
            {
              id: 'components',
              name: 'Components',
              type: 'checkbox',
              options: ['Hanging Rods', 'Shelves', 'Drawers', 'Shoe Rack', 'Tie Rack', 'Belt Hooks'],
              isRequired: false
            }
          ]
        }
      }
    ]
  }
}

// Bathroom Template - Your vanity/toilet examples
export const BATHROOM_TEMPLATE: FFERoomTemplate = {
  roomType: 'bathroom',
  name: 'Bathroom',
  categories: {
    'Fixtures': [
      {
        id: 'vanity',
        name: 'Vanity',
        category: 'Fixtures',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 1,
        hasStandardOption: true,
        hasCustomOption: true,
        standardConfig: {
          description: 'Select from our standard vanity collection',
          options: [
            '24" Single Sink Vanity',
            '36" Single Sink Vanity', 
            '48" Single Sink Vanity',
            '60" Double Sink Vanity',
            '72" Double Sink Vanity'
          ]
        },
        customConfig: {
          description: 'Design a custom vanity',
          subItems: [
            {
              id: 'cabinet',
              name: 'Cabinet Style',
              type: 'selection',
              options: ['Shaker', 'Flat Panel', 'Raised Panel', 'Traditional', 'Modern'],
              isRequired: true
            },
            {
              id: 'color',
              name: 'Cabinet Color',
              type: 'color',
              isRequired: true
            },
            {
              id: 'counter',
              name: 'Counter Material',
              type: 'selection',
              options: ['Quartz', 'Marble', 'Granite', 'Solid Surface', 'Concrete'],
              isRequired: true
            },
            {
              id: 'handles',
              name: 'Handles',
              type: 'selection',
              options: ['Brushed Gold', 'Matte Black', 'Chrome', 'Brass', 'Oil Rubbed Bronze'],
              isRequired: true
            },
            {
              id: 'sink_count',
              name: 'Number of Sinks',
              type: 'selection',
              options: ['Single', 'Double'],
              isRequired: true
            },
            {
              id: 'sink_style',
              name: 'Sink Style',
              type: 'selection',
              options: ['Undermount', 'Vessel', 'Integrated', 'Drop-in'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'toilet',
        name: 'Toilet',
        category: 'Fixtures', 
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 2,
        hasStandardOption: true,
        hasCustomOption: true,
        standardConfig: {
          description: 'Standard floor-mounted toilet',
          options: [
            'Standard Two-Piece Toilet',
            'One-Piece Toilet',
            'Comfort Height Toilet'
          ]
        },
        customConfig: {
          description: 'Wall-mounted toilet system',
          subItems: [
            {
              id: 'carrier',
              name: 'Carrier System',
              type: 'selection',
              options: ['Geberit Duofix', 'TOTO In-Wall', 'Kohler In-Wall'],
              isRequired: true
            },
            {
              id: 'flush_plate',
              name: 'Flush Plate',
              type: 'selection',
              options: ['Chrome', 'Matte Black', 'White', 'Brass', 'Custom Color'],
              isRequired: true
            },
            {
              id: 'toilet_model',
              name: 'Toilet Model',
              type: 'selection',
              options: ['TOTO Wall-Hung', 'Kohler Veil', 'Duravit Starck', 'Geberit Aquaclean'],
              isRequired: true
            },
            {
              id: 'seat',
              name: 'Toilet Seat',
              type: 'selection',
              options: ['Standard Seat', 'Soft-Close Seat', 'Bidet Seat', 'Heated Seat'],
              isRequired: true
            }
          ]
        }
      }
    ]
  }
}

// Template Registry
export const FFE_ROOM_TEMPLATES: Record<string, FFERoomTemplate> = {
  'bedroom': BEDROOM_TEMPLATE,
  'master_bedroom': BEDROOM_TEMPLATE,
  'guest_bedroom': BEDROOM_TEMPLATE,
  'bathroom': BATHROOM_TEMPLATE,
  'master_bathroom': BATHROOM_TEMPLATE,
  'powder_room': BATHROOM_TEMPLATE
}

// Helper functions
export function getTemplateForRoomType(roomType: string): FFERoomTemplate | undefined {
  // Convert room type formats (handle both MASTER_BEDROOM and master_bedroom)
  const normalizedType = roomType.toLowerCase().replace('_', '_')
  return FFE_ROOM_TEMPLATES[normalizedType]
}

export function getItemById(template: FFERoomTemplate, itemId: string): FFEItemTemplate | undefined {
  for (const category of Object.values(template.categories)) {
    const item = category.find(item => item.id === itemId)
    if (item) return item
  }
  return undefined
}

export function getVisibleSubItems(item: FFEItemTemplate, selectedMaterial?: string): FFESubItem[] {
  if (!item.customConfig) return []
  
  return item.customConfig.subItems.filter(subItem => {
    if (!subItem.dependsOn || subItem.dependsOn.length === 0) return true
    
    // Show sub-item if its dependency matches the selected material
    if (selectedMaterial && subItem.dependsOn.includes('material')) {
      // Show fabric options only if fabric is selected, etc.
      return (
        (subItem.id === 'fabric_type' && selectedMaterial === 'Fabric') ||
        (subItem.id === 'wood_type' && selectedMaterial === 'Wood') ||
        (subItem.id === 'metal_finish' && selectedMaterial === 'Metal') ||
        !subItem.id.includes('_type') && !subItem.id.includes('_finish')
      )
    }
    
    return true
  })
}