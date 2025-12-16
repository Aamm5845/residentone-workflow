import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/link-preview
 * Fetch page content and metadata for AI extraction
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch URL: ${response.status}` 
        }, { status: 400 })
      }

      const html = await response.text()

      // Extract metadata
      const result: any = {
        url,
        html: html.substring(0, 50000), // Limit HTML size
      }

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        result.title = decodeHtml(titleMatch[1]).trim()
      }

      // Extract Open Graph title
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
      if (ogTitleMatch) {
        result.title = decodeHtml(ogTitleMatch[1]).trim()
      }

      // Extract description
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      if (descMatch) {
        result.description = decodeHtml(descMatch[1]).trim()
      }

      // Extract Open Graph description
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
      if (ogDescMatch) {
        result.description = decodeHtml(ogDescMatch[1]).trim()
      }

      // Extract images - collect multiple sources
      const images: string[] = []
      
      // Open Graph image (usually the main product image)
      const ogImageMatches = html.matchAll(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/gi)
      for (const match of ogImageMatches) {
        const imgUrl = resolveUrl(match[1], urlObj)
        if (imgUrl && !images.includes(imgUrl)) {
          images.push(imgUrl)
        }
      }
      
      // Twitter card image
      const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
      if (twitterImageMatch) {
        const imgUrl = resolveUrl(twitterImageMatch[1], urlObj)
        if (imgUrl && !images.includes(imgUrl)) {
          images.push(imgUrl)
        }
      }
      
      // Product images from common e-commerce patterns
      // Look for large images in product containers
      const productImgPatterns = [
        /<img[^>]+(?:class|id)=["'][^"']*(?:product|gallery|main|primary|hero)[^"']*["'][^>]*src=["']([^"']+)["']/gi,
        /<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*(?:product|gallery|main|primary|hero)[^"']*["']/gi,
        /<img[^>]+data-src=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*(?:product|gallery)[^"']*["']/gi,
        /<img[^>]+(?:class|id)=["'][^"']*(?:zoom|large|full)[^"']*["'][^>]*src=["']([^"']+)["']/gi,
      ]
      
      for (const pattern of productImgPatterns) {
        const matches = html.matchAll(pattern)
        for (const match of matches) {
          const imgUrl = resolveUrl(match[1], urlObj)
          if (imgUrl && !images.includes(imgUrl) && isValidImageUrl(imgUrl)) {
            images.push(imgUrl)
          }
        }
      }
      
      // Also look for JSON-LD structured data which often contains product images
      const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
      for (const match of jsonLdMatches) {
        try {
          const jsonData = JSON.parse(match[1])
          if (jsonData.image) {
            const imgArray = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image]
            for (const img of imgArray) {
              const imgUrl = typeof img === 'string' ? img : img?.url
              if (imgUrl) {
                const resolved = resolveUrl(imgUrl, urlObj)
                if (resolved && !images.includes(resolved)) {
                  images.push(resolved)
                }
              }
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      }
      
      // Set first image as main and include all in images array
      if (images.length > 0) {
        result.image = images[0]
        result.images = images.slice(0, 10) // Limit to 10 images
      }

      // Extract main text content (remove scripts, styles, etc)
      let textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      result.textContent = textContent.substring(0, 15000)

      return NextResponse.json(result)
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timeout' }, { status: 408 })
      }
      throw error
    }
  } catch (error: any) {
    console.error('[Link Preview] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch URL' },
      { status: 500 }
    )
  }
}

function decodeHtml(html: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
  }
  
  return html.replace(/&[#\w]+;/g, (entity) => {
    return entities[entity] || entity
  })
}

function resolveUrl(urlString: string, baseUrl: URL): string {
  try {
    if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
      return urlString
    }
    if (urlString.startsWith('//')) {
      return `${baseUrl.protocol}${urlString}`
    }
    if (urlString.startsWith('/')) {
      return `${baseUrl.protocol}//${baseUrl.host}${urlString}`
    }
    return new URL(urlString, baseUrl.href).href
  } catch {
    return urlString
  }
}

function isValidImageUrl(url: string): boolean {
  // Filter out tracking pixels, icons, and very small images
  const invalidPatterns = [
    /pixel/i,
    /tracking/i,
    /analytics/i,
    /beacon/i,
    /\.gif$/i, // Often used for tracking
    /sprite/i,
    /icon/i,
    /logo/i,
    /thumb(?:nail)?/i,
    /1x1/i,
    /spacer/i,
  ]
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(url)) {
      return false
    }
  }
  
  // Must be a common image format
  return /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(url) || url.includes('image')
}

