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

// Cleared all hardcoded templates - users manage their own FFE items

// Cleared all hardcoded templates - users manage their own FFE items

// Template Registry - REMOVED ALL HARDCODED TEMPLATES
export const FFE_ROOM_TEMPLATES: Record<string, FFERoomTemplate> = {}

// Helper functions
export async function getTemplateForRoomType(roomType: string, orgId?: string): Promise<FFERoomTemplate | undefined> {
  // Convert room type formats (handle both MASTER_BEDROOM and master_bedroom)
  const normalizedType = roomType.toLowerCase().replace('_', '_')
  
  // First try to get from predefined templates
  const predefinedTemplate = FFE_ROOM_TEMPLATES[normalizedType]
  if (predefinedTemplate) {
    
    return predefinedTemplate
  }
  
  // If no predefined template found, try to generate from custom room management system
  if (orgId) {
    
    try {
      // Try different formats for the room type key
      let customTemplate = await generateTemplateFromCustomSystem(roomType, orgId)
      
      // If that doesn't work, try lowercase format
      if (!customTemplate) {
        
        customTemplate = await generateTemplateFromCustomSystem(roomType.toLowerCase(), orgId)
      }
      
      // If that doesn't work, try kebab-case format
      if (!customTemplate) {
        const kebabCase = roomType.toLowerCase().replace(/[_\s]+/g, '-')
        
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
  
  return createDynamicTemplate(roomType)
}

// Generate template from custom room management system
async function generateTemplateFromCustomSystem(roomType: string, orgId: string): Promise<FFERoomTemplate | null> {
  try {
    
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

          categoryItems = categorySpecificItems.map((item: any, index: number) => ({
            id: item.id,
            name: item.name, // Use the actual name from your custom system!
            category: category.name,
            itemType: 'standard_or_custom' as const,
            isRequired: item.isRequired || false,
            order: item.order || index + 1,
            hasStandardOption: true,
            hasCustomOption: true,
            // Add logic options if available (new format)
            logicOptions: item.logicRules && item.logicRules.length > 0 ? item.logicRules : undefined,
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
              subItems: [
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
          
        }
        
      } catch (itemError) {
        console.warn(`Error fetching items for category ${category.name}:`, itemError)
      }
    }
    
    // Only return template if it has categories with items
    if (Object.keys(templateCategories).length === 0) {
      
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
