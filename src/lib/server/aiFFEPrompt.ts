/**
 * AI FFE (Furniture, Fixtures & Equipment) Detection Prompt Builder
 * 
 * Uses OpenAI Vision API to analyze 3D rendering images and detect FFE items
 */

import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'

// Limits to control token usage
const MAX_IMAGES = 8 // Max images to analyze
const MAX_ITEMS_PER_CATEGORY = 20 // Max items per category

export interface DetectedFFEItem {
  name: string
  description?: string
  category: string
  confidence: 'high' | 'medium' | 'low'
  customizable?: boolean // If true, user can choose standard or custom
}

/**
 * Configuration for linked sub-items when an item is marked as "custom"
 * Maps item type keywords to their linked component names
 */
export const CUSTOM_ITEM_LINKED_COMPONENTS: Record<string, string[]> = {
  // Bedroom items
  'bed': ['Fabric (Headboard)', 'Legs/Frame'],
  'headboard': ['Fabric', 'Frame'],
  
  // Seating
  'chair': ['Wood Color', 'Fabric'],
  'armchair': ['Wood Color', 'Fabric'],
  'dining chair': ['Wood Color', 'Fabric/Upholstery'],
  'accent chair': ['Wood Color', 'Fabric'],
  'lounge chair': ['Frame Finish', 'Fabric'],
  'sofa': ['Fabric', 'Legs'],
  'sectional': ['Fabric', 'Legs'],
  'loveseat': ['Fabric', 'Legs'],
  'ottoman': ['Fabric', 'Legs'],
  'bench': ['Fabric/Seat Material', 'Frame/Legs'],
  'stool': ['Seat Material', 'Frame Finish'],
  'bar stool': ['Seat Material', 'Frame Finish'],
  
  // Bathroom items
  'vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  'bathroom vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  'double vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  'single vanity': ['Counter/Top', 'Paint Color', 'Handles/Hardware'],
  
  // Kitchen items
  'cabinet': ['Finish/Paint', 'Hardware/Handles'],
  'kitchen cabinet': ['Finish/Paint', 'Hardware/Handles', 'Countertop'],
  'kitchen island': ['Counter/Top', 'Cabinet Finish', 'Hardware'],
  
  // Storage
  'wardrobe': ['Interior Configuration', 'Door Finish', 'Hardware'],
  'closet': ['Interior Configuration', 'Door Finish', 'Hardware'],
  'dresser': ['Finish', 'Hardware/Handles'],
  'nightstand': ['Finish', 'Hardware'],
  'bedside table': ['Finish', 'Hardware'],
  
  // Tables
  'dining table': ['Top Material', 'Base/Legs'],
  'coffee table': ['Top Material', 'Base/Legs'],
  'side table': ['Top Material', 'Base/Legs'],
  'console table': ['Top Material', 'Base/Legs'],
  'desk': ['Top Material', 'Frame/Legs'],
}

/**
 * Check if an item name matches any customizable item types
 * Returns the linked components if found
 */
export function getLinkedComponentsForItem(itemName: string): string[] | null {
  const normalizedName = itemName.toLowerCase().trim()
  
  // Direct match first
  if (CUSTOM_ITEM_LINKED_COMPONENTS[normalizedName]) {
    return CUSTOM_ITEM_LINKED_COMPONENTS[normalizedName]
  }
  
  // Check if item name contains any of the keywords
  for (const [keyword, components] of Object.entries(CUSTOM_ITEM_LINKED_COMPONENTS)) {
    if (normalizedName.includes(keyword)) {
      return components
    }
  }
  
  return null
}

export interface DetectedFFECategory {
  name: string
  items: DetectedFFEItem[]
}

export interface AIFFEDetectionResult {
  categories: DetectedFFECategory[]
  roomDescription: string
  designStyle: string
  totalItemsDetected: number
}

interface RoomContext {
  roomName: string
  roomType: string
  projectName: string
  sectionPresets?: Array<{ name: string; docCodePrefix: string; description?: string | null }>
}

/**
 * Build the system prompt for FFE detection
 */
export function getFFEDetectionSystemPrompt(
  sectionPresets?: Array<{ name: string; docCodePrefix: string; description?: string | null }>
): string {
  // Build category list from presets or use defaults
  let categoryInstructions: string

  if (sectionPresets && sectionPresets.length > 0) {
    const presetList = sectionPresets
      .map((p, i) => `${i + 1}. **${p.name}** (${p.docCodePrefix})${p.description ? ` - ${p.description}` : ''}`)
      .join('\n')

    categoryInstructions = `**IMPORTANT - USE ONLY THESE CATEGORIES**:
You MUST categorize all items into one of these predefined sections. Do NOT create new categories.

${presetList}

If an item doesn't clearly fit any category, place it in the closest matching category.`
  } else {
    categoryInstructions = `**CATEGORIES TO LOOK FOR**:
1. **Furniture** - Sofas, chairs, tables, desks, beds, storage units, shelving, etc.
2. **Lighting** - Pendant lights, chandeliers, wall sconces, floor lamps, table lamps, recessed lights, LED strips, etc.
3. **Flooring** - Tiles, wood flooring, carpet, rugs, vinyl, stone, etc.
4. **Wall Finishes** - Paint colors, wallpaper, wall panels, stone cladding, tiles, accent walls, etc.
5. **Ceiling** - Ceiling type, coffers, beams, finishes, etc.
6. **Window Treatments** - Curtains, blinds, shutters, drapes, etc.
7. **Fixtures & Hardware** - Door handles, cabinet handles, hooks, pulls, hinges, etc.
8. **Plumbing** - Faucets, sinks, toilets, bathtubs, showers, bidets, etc.
9. **Appliances** - Kitchen appliances, bathroom appliances, HVAC units, etc.
10. **Decorative Items** - Artwork, mirrors, plants, vases, sculptures, accessories, etc.
11. **Textiles** - Cushions, throws, bedding, upholstery, etc.
12. **Millwork** - Built-in cabinets, wardrobes, vanities, shelving, trim, moldings, etc.
13. **Electrical** - Outlets, switches, panels, etc.
14. **Accessories** - Bathroom accessories, kitchen accessories, etc.`
  }

  return `You are an expert interior design and FFE (Furniture, Fixtures & Equipment) analyst. Your job is to analyze 3D rendering images and identify every visible item that would need to be tracked in an FFE schedule.

**Your Task**:
Examine the provided 3D rendering image(s) and create a comprehensive list of ALL items visible in the space. Be extremely thorough - identify every detail including:

${categoryInstructions}

**MULTI-IMAGE HANDLING**:
When analyzing MULTIPLE images of the same room:
- DEDUPLICATE items: If the same item appears in multiple images, list it ONLY ONCE
- If you see a bed in image 1 and the same bed in image 2, add it to the list ONLY ONCE
- Combine views: Use all images to get a complete picture, but avoid counting the same physical item twice
- Different angles of the same item = ONE item in your list
- Same type of item in different locations = MULTIPLE items (e.g., 2 bedside tables)

**CUSTOMIZABLE ITEMS**:
For certain items that are commonly custom-made, include a "customizable" flag set to true:
- Beds (may have custom fabric headboard, custom legs, custom frame)
- Chairs (may have custom wood color, custom fabric upholstery)
- Sofas (may have custom fabric, custom legs)
- Bathroom Vanities (may have custom counter, custom paint color, custom handles)
- Kitchen Cabinets (may have custom finish, custom hardware, custom countertop)
- Wardrobes/Closets (may have custom interior, custom doors, custom hardware)
- Dining Tables (may have custom top material, custom base)
- Headboards (may have custom fabric, custom shape)
- Ottomans/Benches (may have custom fabric, custom legs)

**RESPONSE FORMAT**:
Respond ONLY with a valid JSON object in this exact format:
{
  "roomDescription": "Brief description of the room's overall character",
  "designStyle": "The predominant design style (e.g., Modern, Contemporary, Traditional, Scandinavian, etc.)",
  "categories": [
    {
      "name": "Category Name",
      "items": [
        {
          "name": "Item Name",
          "description": "Brief description with color, material, or other details",
          "category": "Category Name",
          "confidence": "high|medium|low",
          "customizable": true
        }
      ]
    }
  ]
}

**RULES**:
- Be SPECIFIC: Use descriptive names like "Brass Pendant Light" not just "Light"
- Include MATERIALS: "Marble Countertop", "Oak Dining Table", "Velvet Sofa"
- Include COLORS: "Navy Blue Accent Wall", "White Ceramic Tiles", "Gold Cabinet Handles"
- HIGH confidence = clearly visible and identifiable
- MEDIUM confidence = partially visible or slightly unclear
- LOW confidence = inferred from context or partially hidden
- DO NOT include generic items that aren't visible
- DO NOT make up items that aren't in the image
- ONLY output valid JSON, no markdown code blocks or explanations
- DEDUPLICATE: Never list the same physical item twice, even if visible in multiple images`
}

/**
 * Build the user message content with images
 */
export function buildFFEDetectionMessages(
  imageUrls: string[],
  context: RoomContext
): ChatCompletionContentPart[] {
  const content: ChatCompletionContentPart[] = []
  
  // Add context text
  content.push({
    type: 'text',
    text: `Analyze the 3D rendering(s) for: ${context.roomName} (${context.roomType}) in the ${context.projectName} project.

Please identify ALL FFE items visible in the image(s). Be thorough and specific.`
  })
  
  // Add images (limit to max)
  const limitedImages = imageUrls.slice(0, MAX_IMAGES)
  for (const imageUrl of limitedImages) {
    content.push({
      type: 'image_url',
      image_url: {
        url: imageUrl,
        detail: 'auto' // Let OpenAI decide - 'high' was causing timeouts
      }
    })
  }
  
  return content
}

/**
 * Parse the AI response into structured FFE detection result
 */
export function parseFFEDetectionResponse(responseText: string): AIFFEDetectionResult {
  try {
    // Remove any markdown code blocks if present
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    
    const parsed = JSON.parse(jsonText)
    
    // Validate and normalize the response
    const categories: DetectedFFECategory[] = []
    let totalItems = 0
    
    if (Array.isArray(parsed.categories)) {
      for (const cat of parsed.categories) {
        if (cat.name && Array.isArray(cat.items)) {
          const items: DetectedFFEItem[] = cat.items
            .slice(0, MAX_ITEMS_PER_CATEGORY)
            .map((item: any) => {
              const name = String(item.name || 'Unknown Item')
              // Check if item is customizable based on AI response or our config
              const isCustomizable = item.customizable === true || getLinkedComponentsForItem(name) !== null
              
              return {
                name,
                description: item.description ? String(item.description) : undefined,
                category: String(cat.name),
                confidence: ['high', 'medium', 'low'].includes(item.confidence) 
                  ? item.confidence 
                  : 'medium',
                customizable: isCustomizable || undefined
              }
            })
          
          if (items.length > 0) {
            categories.push({
              name: String(cat.name),
              items
            })
            totalItems += items.length
          }
        }
      }
    }
    
    return {
      categories,
      roomDescription: parsed.roomDescription || 'Room analyzed from 3D rendering',
      designStyle: parsed.designStyle || 'Contemporary',
      totalItemsDetected: totalItems
    }
    
  } catch (error) {
    console.error('Failed to parse AI FFE detection response:', error)
    console.error('Raw response:', responseText)
    
    // Return empty result on parse failure
    return {
      categories: [],
      roomDescription: 'Unable to analyze room',
      designStyle: 'Unknown',
      totalItemsDetected: 0
    }
  }
}

/**
 * Get fallback response when no images are available
 */
export function getNoImagesResponse(context: RoomContext): AIFFEDetectionResult {
  return {
    categories: [],
    roomDescription: `No 3D rendering images found for ${context.roomName}. Please upload rendering images first.`,
    designStyle: 'Unknown',
    totalItemsDetected: 0
  }
}
