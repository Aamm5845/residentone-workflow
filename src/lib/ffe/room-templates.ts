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
export async function getTemplateForRoomType(roomType: string, orgId?: string): Promise<FFERoomTemplate | undefined> {
  // Convert room type formats (handle both MASTER_BEDROOM and master_bedroom)
  const normalizedType = roomType.toLowerCase().replace('_', '_')
  
  // First try to get from predefined templates
  const predefinedTemplate = FFE_ROOM_TEMPLATES[normalizedType]
  if (predefinedTemplate) {
    console.log(`✅ Using predefined template for room type: ${roomType}`)
    return predefinedTemplate
  }
  
  // If no predefined template found, try to generate from custom room management system
  if (orgId) {
    console.log(`🔍 No predefined template found for room type: ${roomType}. Attempting to generate from custom system for org: ${orgId}`)
    
    try {
      // Try different formats for the room type key
      let customTemplate = await generateTemplateFromCustomSystem(roomType, orgId)
      
      // If that doesn't work, try lowercase format
      if (!customTemplate) {
        console.log(`Trying lowercase format: ${roomType.toLowerCase()}`)
        customTemplate = await generateTemplateFromCustomSystem(roomType.toLowerCase(), orgId)
      }
      
      // If that doesn't work, try kebab-case format
      if (!customTemplate) {
        const kebabCase = roomType.toLowerCase().replace(/[_\s]+/g, '-')
        console.log(`Trying kebab-case format: ${kebabCase}`)
        customTemplate = await generateTemplateFromCustomSystem(kebabCase, orgId)
      }
      
      if (customTemplate) {
        return customTemplate
      }
    } catch (error) {
      console.warn('Failed to generate template from custom system:', error)
    }
  }
  
  // Fallback: create a dynamic template
  console.log(`⚠️ Creating dynamic fallback template for room type: ${roomType} (no custom items found)`)
  return createDynamicTemplate(roomType)
}

// Generate template from custom room management system
async function generateTemplateFromCustomSystem(roomType: string, orgId: string): Promise<FFERoomTemplate | null> {
  try {
    console.log(`Generating template for room type '${roomType}' from custom system for org: ${orgId}`)
    
    // Fetch categories for this room type from the custom system
    const categoriesResponse = await fetch(`/api/ffe/categories?orgId=${orgId}`)
    if (!categoriesResponse.ok) {
      console.warn('Failed to fetch categories from custom system')
      return null
    }
    
    const categoriesData = await categoriesResponse.json()
    const allCategories = categoriesData.categories || []
    
    // Filter categories that are applicable to this room type - match against the room type key
    const applicableCategories = allCategories.filter((cat: any) => 
      cat.roomTypeKeys && cat.roomTypeKeys.includes(roomType)
    )
    
    if (applicableCategories.length === 0) {
      console.log(`No custom categories found for room type: ${roomType}`)
      return null
    }
    
    console.log(`Found ${applicableCategories.length} custom categories for room type: ${roomType}`, applicableCategories.map(c => c.name))
    
    // Convert custom categories to FFE template format
    const templateCategories: { [categoryName: string]: FFEItemTemplate[] } = {}
    
    for (const category of applicableCategories) {
      // Fetch items for this category and room type
      try {
        const itemsResponse = await fetch(`/api/ffe/management/items?orgId=${orgId}&roomTypeKey=${roomType}`)
        
        let categoryItems: FFEItemTemplate[] = []
        
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json()
          const items = itemsData.items || []
          
          // Filter items that belong to this category
          const categorySpecificItems = items.filter((item: any) => 
            item.categoryKey === category.key
          )
          
          console.log(`Found ${categorySpecificItems.length} items for category '${category.name}' in room type '${roomType}'`)
          
          categoryItems = categorySpecificItems.map((item: any, index: number) => ({
            id: item.id,
            name: item.name, // Use the actual name from your custom system!
            category: category.name,
            itemType: 'standard_or_custom' as const,
            isRequired: item.isRequired || false,
            order: item.order || index + 1,
            hasStandardOption: true,
            hasCustomOption: true,
            standardConfig: {
              description: `Select from standard ${item.name.toLowerCase()} options`,
              options: [
                `Standard ${item.name} Option 1`,
                `Standard ${item.name} Option 2`,
                `Standard ${item.name} Option 3`
              ]
            },
            customConfig: {
              description: `Create custom ${item.name.toLowerCase()} specifications`,
              subItems: item.logicRules && item.logicRules.length > 0 ? 
                // Use logic rules from the custom system if available
                item.logicRules.flatMap((rule: any) => rule.expandsTo || []) : 
                // Otherwise use default sub-items
                [
                  {
                    id: 'material',
                    name: 'Material',
                    type: 'selection' as const,
                    options: ['Wood', 'Metal', 'Fabric', 'Glass', 'Stone', 'Composite'],
                    isRequired: true
                  },
                  {
                    id: 'color',
                    name: 'Color',
                    type: 'color' as const,
                    isRequired: true
                  },
                  {
                    id: 'dimensions',
                    name: 'Dimensions',
                    type: 'input' as const,
                    placeholder: 'L x W x H (e.g., 24" x 36" x 30")',
                    isRequired: true
                  }
                ]
            }
          }))
        } else {
          console.warn(`Failed to fetch items for category: ${category.name}`, itemsResponse.status)
        }
        
        // Only add categories that have items
        if (categoryItems.length > 0) {
          templateCategories[category.name] = categoryItems
        } else {
          console.log(`No items found for category '${category.name}' - skipping`)
        }
        
      } catch (itemError) {
        console.warn(`Error fetching items for category ${category.name}:`, itemError)
      }
    }
    
    // Only return template if it has categories with items
    if (Object.keys(templateCategories).length === 0) {
      console.log(`No categories with items found for room type: ${roomType}`)
      return null
    }
    
    const template: FFERoomTemplate = {
      roomType: roomType.toLowerCase(),
      name: formatRoomTypeName(roomType),
      categories: templateCategories
    }
    
    console.log(`✅ Generated custom template for ${roomType}:`, {
      roomType: template.roomType,
      categoryCount: Object.keys(template.categories).length,
      totalItems: Object.values(template.categories).reduce((sum, items) => sum + items.length, 0),
      categories: Object.keys(template.categories),
      items: Object.entries(template.categories).map(([cat, items]) => ({ [cat]: items.map(i => i.name) }))
    })
    
    return template
    
  } catch (error) {
    console.error('Error generating template from custom system:', error)
    return null
  }
}

// Create a dynamic template for custom room types
function createDynamicTemplate(roomType: string): FFERoomTemplate {
  const formattedName = formatRoomTypeName(roomType)
  
  return {
    roomType: roomType.toLowerCase(),
    name: formattedName,
    categories: {
      'Items': [
        {
          id: `${roomType.toLowerCase().replace(/\s+/g, '_')}_item_1`,
          name: `${formattedName} Item 1`,
          category: 'Items',
          itemType: 'standard_or_custom',
          isRequired: true,
          order: 1,
          hasStandardOption: true,
          hasCustomOption: true,
          standardConfig: {
            description: `Select from standard ${formattedName.toLowerCase()} options`,
            options: [
              `Standard ${formattedName} Option 1`,
              `Standard ${formattedName} Option 2`,
              `Standard ${formattedName} Option 3`
            ]
          },
          customConfig: {
            description: `Create custom ${formattedName.toLowerCase()} specifications`,
            subItems: [
              {
                id: 'material',
                name: 'Material',
                type: 'selection',
                options: ['Wood', 'Metal', 'Fabric', 'Glass', 'Stone', 'Composite'],
                isRequired: true
              },
              {
                id: 'finish',
                name: 'Finish',
                type: 'selection',
                options: ['Matte', 'Glossy', 'Satin', 'Textured', 'Natural'],
                isRequired: true
              },
              {
                id: 'color',
                name: 'Color',
                type: 'color',
                isRequired: true
              },
              {
                id: 'dimensions',
                name: 'Dimensions',
                type: 'input',
                placeholder: 'L x W x H (e.g., 24" x 36" x 30")',
                isRequired: true
              }
            ]
          }
        },
        {
          id: `${roomType.toLowerCase().replace(/\s+/g, '_')}_item_2`,
          name: `${formattedName} Item 2`,
          category: 'Items',
          itemType: 'standard_or_custom',
          isRequired: false,
          order: 2,
          hasStandardOption: true,
          hasCustomOption: true,
          standardConfig: {
            description: `Select from standard ${formattedName.toLowerCase()} options`,
            options: [
              `Standard ${formattedName} Option A`,
              `Standard ${formattedName} Option B`,
              `Standard ${formattedName} Option C`
            ]
          },
          customConfig: {
            description: `Create custom ${formattedName.toLowerCase()} specifications`,
            subItems: [
              {
                id: 'style',
                name: 'Style',
                type: 'selection',
                options: ['Modern', 'Traditional', 'Transitional', 'Contemporary', 'Industrial'],
                isRequired: true
              },
              {
                id: 'color',
                name: 'Color',
                type: 'color',
                isRequired: true
              }
            ]
          }
        }
      ]
    }
  }
}

// Format room type name for display
function formatRoomTypeName(roomType: string): string {
  return roomType
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Create a basic template for custom room types
function createBasicTemplate(roomType: string): FFERoomTemplate {
  return {
    roomType: roomType.toLowerCase(),
    name: roomType.charAt(0).toUpperCase() + roomType.slice(1).toLowerCase(),
    categories: {
      'General': [
        {
          id: 'basic_item_1',
          name: 'Basic Item 1',
          category: 'General',
          itemType: 'standard_or_custom',
          isRequired: false,
          order: 1,
          hasStandardOption: true,
          hasCustomOption: true,
          standardConfig: {
            description: 'Select from standard options',
            options: [
              'Option 1',
              'Option 2',
              'Option 3'
            ]
          },
          customConfig: {
            description: 'Create custom specifications',
            subItems: [
              {
                id: 'material',
                name: 'Material',
                type: 'selection',
                options: ['Wood', 'Metal', 'Fabric', 'Glass', 'Stone'],
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
                type: 'input',
                placeholder: 'Enter dimensions',
                isRequired: true
              }
            ]
          }
        }
      ]
    }
  }
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