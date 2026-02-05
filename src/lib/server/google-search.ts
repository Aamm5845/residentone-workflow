/**
 * Server-only Google Custom Search API wrapper for product search
 *
 * IMPORTANT: This file must only be imported in server-side code (API routes, server components)
 * Never import this in client components or it will expose the API key
 */

export interface ProductSearchResult {
  title: string
  link: string
  snippet: string
  image?: string
  source: string  // domain name extracted from link
}

interface GoogleSearchItem {
  title: string
  link: string
  snippet?: string
  pagemap?: {
    cse_thumbnail?: Array<{ src: string }>
    cse_image?: Array<{ src: string }>
    metatags?: Array<Record<string, string>>
    product?: Array<{
      name?: string
      image?: string
      description?: string
    }>
  }
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[]
  searchInformation?: {
    totalResults: string
    searchTime: number
  }
  error?: {
    code: number
    message: string
  }
}

/**
 * Check if Google Custom Search API is configured
 */
export function isGoogleSearchConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CUSTOM_SEARCH_API_KEY &&
    process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
  )
}

/**
 * Get configuration status for diagnostics
 */
export function getConfigurationStatus(): {
  configured: boolean
  hasApiKey: boolean
  hasEngineId: boolean
} {
  return {
    configured: isGoogleSearchConfigured(),
    hasApiKey: !!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
    hasEngineId: !!process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
  }
}

/**
 * Extract domain name from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Extract the best available image from search result
 */
function extractImage(item: GoogleSearchItem): string | undefined {
  // Try product images first
  if (item.pagemap?.product?.[0]?.image) {
    return item.pagemap.product[0].image
  }

  // Try CSE thumbnail
  if (item.pagemap?.cse_thumbnail?.[0]?.src) {
    return item.pagemap.cse_thumbnail[0].src
  }

  // Try CSE image
  if (item.pagemap?.cse_image?.[0]?.src) {
    return item.pagemap.cse_image[0].src
  }

  // Try og:image from metatags
  if (item.pagemap?.metatags?.[0]?.['og:image']) {
    return item.pagemap.metatags[0]['og:image']
  }

  return undefined
}

/**
 * Build optimized search query for product search
 */
function buildSearchQuery(
  itemName: string,
  description?: string,
  category?: string
): string {
  const parts: string[] = [itemName]

  // Add key descriptors from description (first 3 words if present)
  if (description) {
    const descWords = description
      .split(/[,.\s]+/)
      .filter(w => w.length > 2)
      .slice(0, 3)
    if (descWords.length > 0) {
      parts.push(descWords.join(' '))
    }
  }

  // Add shopping intent keywords
  parts.push('buy')

  // Add category hint if it's helpful
  if (category && !itemName.toLowerCase().includes(category.toLowerCase())) {
    parts.push(category)
  }

  return parts.join(' ')
}

/**
 * Search for products using Google Custom Search API
 *
 * @param itemName - Name of the item to search for
 * @param description - Optional description to refine search
 * @param category - Optional category for context
 * @returns Array of product search results
 */
export async function searchProducts(
  itemName: string,
  description?: string,
  category?: string
): Promise<{ results: ProductSearchResult[]; query: string }> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID

  if (!apiKey || !searchEngineId) {
    throw new Error(
      'Google Custom Search is not configured. ' +
      'Set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID environment variables.'
    )
  }

  const query = buildSearchQuery(itemName, description, category)

  // Build Google Custom Search API URL
  const params = new URLSearchParams({
    key: apiKey,
    cx: searchEngineId,
    q: query,
    num: '5',  // Return top 5 results
    safe: 'active'
  })

  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[Google Search] API Error:', errorData)

      if (response.status === 429) {
        throw new Error('Search rate limit exceeded. Please try again later.')
      }

      if (response.status === 403) {
        throw new Error('Google Search API access denied. Check API key configuration.')
      }

      throw new Error(`Search failed: ${response.statusText}`)
    }

    const data: GoogleSearchResponse = await response.json()

    if (data.error) {
      throw new Error(data.error.message || 'Search failed')
    }

    // Transform results
    const results: ProductSearchResult[] = (data.items || []).map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet || '',
      image: extractImage(item),
      source: extractDomain(item.link)
    }))

    return { results, query }

  } catch (error: any) {
    console.error('[Google Search] Error:', error)
    throw error
  }
}
