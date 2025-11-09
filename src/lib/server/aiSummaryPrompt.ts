/**
 * AI Summary Prompt Builder
 * 
 * Shapes and compresses design concept data into optimal prompts for OpenAI Vision API
 */

import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'

// Limits to control token usage and costs
const MAX_ITEMS = 60 // Max items to include in summary
const MAX_NOTES_LENGTH = 600 // Max characters per item notes
const MAX_LINKS_PER_ITEM = 3 // Max product links per item
const MAX_IMAGES_TOTAL = 12 // Max images across all items
const MAX_IMAGES_PER_ITEM = 2 // Max images per individual item

interface DesignItem {
  id: string
  libraryItem: {
    name: string
    category: string
    description?: string | null
    icon?: string | null
  }
  notes?: string | null
  completedByRenderer: boolean
  images: Array<{
    url: string
    fileName?: string
    description?: string | null
  }>
  links: Array<{
    url: string
    title?: string | null
  }>
  createdAt: Date
  updatedAt: Date
}

interface StageContext {
  roomName: string
  roomType: string
  projectName: string
  clientName?: string
}

interface ProcessedData {
  textContent: string
  imageUrls: string[]
  counts: {
    total: number
    completed: number
    pending: number
  }
}

/**
 * Process and flatten design items into a compact structure
 */
export function prepareDesignData(
  items: DesignItem[],
  context: StageContext
): ProcessedData {
  // Sort by most recently updated first and limit
  const sortedItems = [...items]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, MAX_ITEMS)

  // Calculate counts
  const counts = {
    total: sortedItems.length,
    completed: sortedItems.filter(item => item.completedByRenderer).length,
    pending: sortedItems.filter(item => !item.completedByRenderer).length
  }

  // Collect images (prefer from pending items, limit total)
  const imageUrls: string[] = []
  const pendingItems = sortedItems.filter(item => !item.completedByRenderer)
  const completedItems = sortedItems.filter(item => item.completedByRenderer)
  
  // First, add images from pending items
  for (const item of pendingItems) {
    if (imageUrls.length >= MAX_IMAGES_TOTAL) break
    const itemImages = item.images
      .slice(0, MAX_IMAGES_PER_ITEM)
      .map(img => img.url)
    imageUrls.push(...itemImages)
  }
  
  // Then fill remaining slots with completed item images
  for (const item of completedItems) {
    if (imageUrls.length >= MAX_IMAGES_TOTAL) break
    const itemImages = item.images
      .slice(0, MAX_IMAGES_PER_ITEM)
      .map(img => img.url)
    imageUrls.push(...itemImages.slice(0, MAX_IMAGES_TOTAL - imageUrls.length))
  }

  // Build structured text content
  const textParts: string[] = []
  
  // Context header
  textParts.push(`# Design Concept Analysis Request`)
  textParts.push(``)
  textParts.push(`**Project**: ${context.projectName}`)
  if (context.clientName) {
    textParts.push(`**Client**: ${context.clientName}`)
  }
  textParts.push(`**Room**: ${context.roomName} (${context.roomType})`)
  textParts.push(``)
  textParts.push(`**Progress**: ${counts.completed} of ${counts.total} items completed`)
  textParts.push(``)
  
  // Items by category
  textParts.push(`## Design Items`)
  textParts.push(``)
  
  // Group items by category
  const byCategory = new Map<string, DesignItem[]>()
  for (const item of sortedItems) {
    const category = item.libraryItem.category || 'Other'
    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(item)
  }
  
  // Output by category
  for (const [category, categoryItems] of byCategory.entries()) {
    textParts.push(`### ${category} (${categoryItems.length} items)`)
    textParts.push(``)
    
    for (const item of categoryItems) {
      const status = item.completedByRenderer ? '✓ DONE' : '⏳ PENDING'
      const icon = item.libraryItem.icon || '•'
      textParts.push(`${icon} **${item.libraryItem.name}** [${status}]`)
      
      // Add notes if present (truncated)
      if (item.notes && item.notes.trim()) {
        const truncatedNotes = item.notes.length > MAX_NOTES_LENGTH
          ? item.notes.slice(0, MAX_NOTES_LENGTH) + '...'
          : item.notes
        textParts.push(`  Notes: ${truncatedNotes}`)
      }
      
      // Add links if present (limited)
      if (item.links.length > 0) {
        const limitedLinks = item.links.slice(0, MAX_LINKS_PER_ITEM)
        textParts.push(`  Product Links:`)
        for (const link of limitedLinks) {
          const title = link.title || 'Link'
          textParts.push(`  - ${title}: ${link.url}`)
        }
      }
      
      // Add image count
      if (item.images.length > 0) {
        textParts.push(`  Images: ${item.images.length} reference image(s)`)
      }
      
      textParts.push(``)
    }
  }

  return {
    textContent: textParts.join('\n'),
    imageUrls: imageUrls.slice(0, MAX_IMAGES_TOTAL),
    counts
  }
}

/**
 * Build the system prompt for the AI
 */
export function getSystemPrompt(): string {
  return `You are an interior design assistant. Analyze the design concept and provide a CONCISE summary.

**Your Response Must Be**:
- Maximum 150 words total
- 2-3 short paragraphs
- Focus ONLY on what matters
- Skip generic advice

**Format**:

**Paragraph 1** (2-3 sentences): Describe the overall design direction based on selected items and images. Be specific about style, colors, and mood.

**Paragraph 2** (2-3 sentences): List key items chosen and their categories. Mention completed vs pending status.

**Paragraph 3** (1-2 sentences): Suggest 1-2 specific missing elements that would complete the design.

**Rules**:
- NO generic statements like "consider adding" or "ensure that"
- NO safety warnings or obvious advice
- BE SPECIFIC: Use actual item names and categories
- ANALYZE IMAGES: Reference specific colors, materials, and styles you see
- KEEP IT SHORT: Maximum 150 words

Example good summary:
"Modern minimalist playroom with neutral palette. Reference image shows sleek white finishes and warm wood accents, suggesting Scandinavian influence.

Range appliance pending (1 item). Category: Appliances. Clean lines and contemporary aesthetic align with overall vision.

Needs: Soft seating (bean bags or floor cushions) and modular storage cubes to complete the functional layout."`
}

/**
 * Build the complete message array for OpenAI Chat Completion
 */
export function buildChatMessages(
  processedData: ProcessedData
): ChatCompletionContentPart[] {
  const content: ChatCompletionContentPart[] = []
  
  // Add text content
  content.push({
    type: 'text',
    text: processedData.textContent
  })
  
  // Add images (using OpenAI's image_url format)
  for (const imageUrl of processedData.imageUrls) {
    content.push({
      type: 'image_url',
      image_url: {
        url: imageUrl,
        detail: 'low' // Use 'low' detail to reduce token costs
      }
    })
  }
  
  return content
}

/**
 * Generate a default summary for stages with no items yet
 */
export function getEmptyStageSummary(context: StageContext): string {
  return `## Getting Started with ${context.roomName}

This design concept phase for **${context.roomName}** in the **${context.projectName}** project hasn't started yet. No design items have been added.

**Next Steps**:
- Browse the item library and start selecting furniture, fixtures, and materials that match your vision
- Add reference images to communicate the desired aesthetic and style
- Include notes with specific requirements, measurements, or client preferences
- Organize items by category (furniture, lighting, wall treatments, flooring, etc.)

Once items are added, I'll provide an intelligent analysis of the design direction, highlight what's been chosen, and suggest what else might be needed to complete the concept.`
}
