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
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout

    try {
      // Use headers that match a real Chrome browser request
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Connection': 'keep-alive',
        },
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `The website returned an error (${response.status})`
        if (response.status === 403) {
          errorMessage = 'Website blocked the request - try using the Chrome extension instead'
        } else if (response.status === 404) {
          errorMessage = 'Page not found - check the URL is correct'
        } else if (response.status === 429) {
          errorMessage = 'Too many requests - wait a moment and try again'
        } else if (response.status >= 500) {
          errorMessage = 'Website is having issues - try again later'
        }
        return NextResponse.json({ error: errorMessage }, { status: 400 })
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
      
      // Helper to add valid image
      const addImage = (imgUrl: string | undefined | null) => {
        if (!imgUrl) return
        const resolved = resolveUrl(imgUrl, urlObj)
        if (resolved && !images.includes(resolved) && isValidImageUrl(resolved)) {
          images.push(resolved)
        }
      }
      
      // 1. JSON-LD structured data (highest quality - often has the best product images)
      const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
      for (const match of jsonLdMatches) {
        try {
          const jsonData = JSON.parse(match[1])
          // Handle Product schema
          if (jsonData['@type'] === 'Product' || jsonData.image) {
            const imgArray = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image]
            for (const img of imgArray) {
              const imgUrl = typeof img === 'string' ? img : img?.url || img?.contentUrl
              addImage(imgUrl)
            }
          }
          // Handle nested @graph structure
          if (jsonData['@graph']) {
            for (const item of jsonData['@graph']) {
              if (item['@type'] === 'Product' || item['@type'] === 'ImageObject' || item.image) {
                const imgArray = Array.isArray(item.image) ? item.image : [item.image]
                for (const img of imgArray) {
                  const imgUrl = typeof img === 'string' ? img : img?.url || img?.contentUrl
                  addImage(imgUrl)
                }
              }
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      }
      
      // 2. Open Graph images (usually good quality)
      const ogImageMatches = html.matchAll(/<meta\s+(?:property|name)=["']og:image(?::url)?["']\s+content=["']([^"']+)["']/gi)
      for (const match of ogImageMatches) {
        addImage(match[1])
      }
      // Also match reverse order (content before property)
      const ogImageMatches2 = html.matchAll(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image(?::url)?["']/gi)
      for (const match of ogImageMatches2) {
        addImage(match[1])
      }
      
      // 3. Twitter card image
      const twitterPatterns = [
        /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/gi,
        /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/gi,
      ]
      for (const pattern of twitterPatterns) {
        const matches = html.matchAll(pattern)
        for (const match of matches) {
          addImage(match[1])
        }
      }
      
      // 4. Extract ALL data-* attributes for lazy-loaded images (this catches most lazy loading)
      // Common lazy-load attributes: data-src, data-lazy-src, data-original, data-srcset, data-lazy, data-image
      const lazyLoadPatterns = [
        /data-(?:src|lazy-src|original|image|full|zoom|large|hi-res|hires)=["']([^"']+)["']/gi,
        /data-srcset=["']([^\s"']+)/gi, // First URL from srcset
      ]
      
      for (const pattern of lazyLoadPatterns) {
        const matches = html.matchAll(pattern)
        for (const match of matches) {
          addImage(match[1])
        }
      }
      
      // 5. Product images from common e-commerce patterns (class/id based)
      const productImgPatterns = [
        // Images with product-related classes
        /<img[^>]+(?:class|id)=["'][^"']*(?:product|gallery|main|primary|hero|featured|woocommerce-main)[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/gi,
        /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*(?:product|gallery|main|primary|hero|featured)[^"']*["']/gi,
        // Zoom/large images
        /<img[^>]+(?:class|id)=["'][^"']*(?:zoom|large|full|magnify)[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/gi,
        // WooCommerce specific
        /<img[^>]+(?:class|id)=["'][^"']*wp-post-image[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/gi,
        // Slick/swiper carousel images
        /<img[^>]+(?:class|id)=["'][^"']*(?:slick|swiper|carousel|slide)[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/gi,
      ]
      
      for (const pattern of productImgPatterns) {
        const matches = html.matchAll(pattern)
        for (const match of matches) {
          addImage(match[1])
        }
      }
      
      // 6. Look for srcset and extract the largest image
      const srcsetMatches = html.matchAll(/srcset=["']([^"']+)["']/gi)
      for (const match of srcsetMatches) {
        const srcset = match[1]
        // Parse srcset and get the largest image
        const sources = srcset.split(',').map(s => s.trim())
        let largestUrl = ''
        let largestSize = 0
        for (const source of sources) {
          const parts = source.split(/\s+/)
          const url = parts[0]
          const sizeStr = parts[1] || ''
          const size = parseInt(sizeStr.replace(/[^\d]/g, '')) || 0
          if (size > largestSize || (!largestSize && url)) {
            largestSize = size
            largestUrl = url
          }
        }
        if (largestUrl) {
          addImage(largestUrl)
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
        return NextResponse.json({ error: 'Request timed out - the website took too long to respond' }, { status: 408 })
      }
      // Network errors (connection refused, DNS lookup failed, etc)
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return NextResponse.json({ error: 'Could not connect to website - check the URL is correct' }, { status: 400 })
      }
      throw error
    }
  } catch (error: any) {
    console.error('[Link Preview] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch URL - try using the Chrome extension instead' },
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
  // Filter out base64 data URIs (often white placeholder images)
  if (url.startsWith('data:')) {
    return false
  }
  
  // Filter out tracking pixels, icons, placeholders, and small images
  const invalidPatterns = [
    /pixel/i,
    /tracking/i,
    /analytics/i,
    /beacon/i,
    /sprite/i,
    /1x1/i,
    /spacer/i,
    /blank/i,
    /placeholder/i,
    /loading/i,
    /spinner/i,
    /lazy/i, // lazy-load placeholder
    /default[-_]?image/i,
    /no[-_]?image/i,
    /missing/i,
    /empty/i,
    /transparent/i,
    /grey|gray/i, // grey placeholder
    /woocommerce-placeholder/i,
    /\/loader\./i,
    /\/ajax[-_]?loader/i,
  ]
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(url)) {
      return false
    }
  }
  
  // Filter out tiny images (dimension in URL)
  if (/[-_x](?:1|2|3|4|5|10|16|20|24|32)(?:x(?:1|2|3|4|5|10|16|20|24|32))?[-_\.]/i.test(url)) {
    return false
  }
  
  // Filter out common icon sizes
  if (/(?:favicon|icon).*\d+x\d+/i.test(url)) {
    return false
  }
  
  // Filter out .gif (often used for tracking, animations, or placeholders)
  // But allow if it's clearly a product image
  if (/\.gif(\?|$)/i.test(url) && !/product|gallery|main/i.test(url)) {
    return false
  }
  
  // Filter out .svg (usually icons, not product photos)
  if (/\.svg(\?|$)/i.test(url)) {
    return false
  }
  
  // Must be a common image format OR be from a CDN/image service
  const hasImageExtension = /\.(jpg|jpeg|png|webp|avif|jpe)(\?|$)/i.test(url)
  const isImageService = /(?:cloudinary|imgix|cloudfront|akamai|fastly|cdn|image|media|photo|upload|assets)/i.test(url)
  const hasImageInPath = /\/(?:images?|photos?|media|uploads?|products?|gallery)\//i.test(url)
  
  return hasImageExtension || isImageService || hasImageInPath
}

