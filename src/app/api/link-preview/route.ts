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
        let suggestExtension = false
        if (response.status === 403) {
          errorMessage = 'Website blocked the request'
          suggestExtension = true
        } else if (response.status === 404) {
          errorMessage = 'Page not found - check the URL is correct'
        } else if (response.status === 429) {
          errorMessage = 'Too many requests - wait a moment and try again'
        } else if (response.status >= 500) {
          errorMessage = 'Website is having issues - try again later'
        }
        console.log(`[Link Preview] Website returned ${response.status} for URL: ${url}`)
        return NextResponse.json({
          error: errorMessage,
          suggestExtension,
          websiteStatus: response.status
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

      // Extract images - focus on main product image, limit to 2 max
      const images: string[] = []
      const imageBaseUrls: string[] = [] // Track base URLs without query params for deduplication
      const MAX_IMAGES = 2

      // Helper to get base URL without query params for comparison
      const getBaseUrl = (imgUrl: string): string => {
        try {
          const parsed = new URL(imgUrl)
          return `${parsed.origin}${parsed.pathname}`.toLowerCase()
        } catch {
          return imgUrl.split('?')[0].toLowerCase()
        }
      }

      // Detect if this is an Amazon URL
      const isAmazon = /amazon\.(com|ca|co\.uk|de|fr|es|it|com\.au|co\.jp|in)/i.test(url)

      // Helper to add valid image (stops after MAX_IMAGES)
      const addImage = (imgUrl: string | undefined | null, skipValidation = false): boolean => {
        if (!imgUrl || images.length >= MAX_IMAGES) return false
        const resolved = resolveUrl(imgUrl, urlObj)
        if (!resolved) return false

        // Check for duplicates by comparing base URLs (without query params)
        const baseUrl = getBaseUrl(resolved)
        if (imageBaseUrls.includes(baseUrl)) return false

        // Also check exact match
        if (images.includes(resolved)) return false

        if (skipValidation || isValidImageUrl(resolved)) {
          images.push(resolved)
          imageBaseUrls.push(baseUrl)
          return true
        }
        return false
      }
      
      // Special handling for Amazon - extract main product image
      if (isAmazon && images.length < MAX_IMAGES) {
        // Amazon uses data-a-dynamic-image with JSON containing image URLs
        const dynamicImageMatch = html.match(/data-a-dynamic-image=["'](\{[^"']+\})["']/i)
        if (dynamicImageMatch) {
          try {
            // Replace HTML entities and parse JSON
            const jsonStr = dynamicImageMatch[1].replace(/&quot;/g, '"')
            const imageObj = JSON.parse(jsonStr)
            // Get the largest image (highest resolution key)
            const imageUrls = Object.keys(imageObj)
            if (imageUrls.length > 0) {
              // Find the largest image by dimensions
              let bestUrl = imageUrls[0]
              let bestSize = 0
              for (const imgUrl of imageUrls) {
                const dims = imageObj[imgUrl]
                if (Array.isArray(dims) && dims.length >= 2) {
                  const size = dims[0] * dims[1]
                  if (size > bestSize) {
                    bestSize = size
                    bestUrl = imgUrl
                  }
                }
              }
              addImage(bestUrl, true) // Skip validation for Amazon CDN images
            }
          } catch {
            // Failed to parse, continue with other methods
          }
        }
        
        // Amazon landing image (main product image)
        if (images.length < MAX_IMAGES) {
          const landingImageMatch = html.match(/id=["']landingImage["'][^>]*src=["']([^"']+)["']/i)
          if (landingImageMatch) {
            addImage(landingImageMatch[1], true)
          }
        }
        
        // Amazon image from imgTagWrapperId
        if (images.length < MAX_IMAGES) {
          const wrapperMatch = html.match(/id=["']imgTagWrapperId["'][\s\S]*?<img[^>]*src=["']([^"']+)["']/i)
          if (wrapperMatch) {
            addImage(wrapperMatch[1], true)
          }
        }
      }
      
      // Priority 1: Open Graph image (this is almost always THE main product image)
      const ogImagePatterns = [
        /<meta\s+(?:property|name)=["']og:image(?::url)?["']\s+content=["']([^"']+)["']/i,
        /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image(?::url)?["']/i,
      ]
      for (const pattern of ogImagePatterns) {
        if (images.length >= MAX_IMAGES) break
        const match = html.match(pattern)
        if (match) addImage(match[1])
      }
      
      // Priority 2: JSON-LD Product schema (first image only - usually the main one)
      if (images.length < MAX_IMAGES) {
        const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
        for (const match of jsonLdMatches) {
          if (images.length >= MAX_IMAGES) break
          try {
            const jsonData = JSON.parse(match[1])
            // Handle Product schema - only get first image
            if (jsonData['@type'] === 'Product' && jsonData.image) {
              const firstImg = Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image
              const imgUrl = typeof firstImg === 'string' ? firstImg : firstImg?.url || firstImg?.contentUrl
              addImage(imgUrl)
            }
            // Handle nested @graph structure
            if (jsonData['@graph']) {
              for (const item of jsonData['@graph']) {
                if (images.length >= MAX_IMAGES) break
                if (item['@type'] === 'Product' && item.image) {
                  const firstImg = Array.isArray(item.image) ? item.image[0] : item.image
                  const imgUrl = typeof firstImg === 'string' ? firstImg : firstImg?.url || firstImg?.contentUrl
                  addImage(imgUrl)
                }
              }
            }
          } catch {
            // Invalid JSON, skip
          }
        }
      }
      
      // Priority 3: Twitter card image
      if (images.length < MAX_IMAGES) {
        const twitterPatterns = [
          /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
          /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
        ]
        for (const pattern of twitterPatterns) {
          if (images.length >= MAX_IMAGES) break
          const match = html.match(pattern)
          if (match) addImage(match[1])
        }
      }
      
      // Priority 4: First main/primary product image from page
      if (images.length < MAX_IMAGES) {
        const mainImagePatterns = [
          // Main/primary/hero product images (first match only)
          /<img[^>]+(?:class|id)=["'][^"']*(?:main|primary|hero|featured)[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/i,
          /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*(?:main|primary|hero|featured)[^"']*["']/i,
          // WooCommerce main image
          /<img[^>]+(?:class|id)=["'][^"']*wp-post-image[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/i,
          // First product image
          /<img[^>]+(?:class|id)=["'][^"']*product[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/i,
        ]
        
        for (const pattern of mainImagePatterns) {
          if (images.length >= MAX_IMAGES) break
          const match = html.match(pattern)
          if (match) addImage(match[1])
        }
      }
      
      // Priority 5: First data-src/data-zoom image (often the main lazy-loaded image)
      if (images.length < MAX_IMAGES) {
        const lazyPatterns = [
          /data-(?:zoom|large|full|hi-res|hires)=["']([^"']+)["']/i,
          /data-src=["']([^"']+)["']/i,
        ]
        for (const pattern of lazyPatterns) {
          if (images.length >= MAX_IMAGES) break
          const match = html.match(pattern)
          if (match) addImage(match[1])
        }
      }
      
      // Priority 6: Fallback - find any reasonable image on the page
      if (images.length < MAX_IMAGES) {
        // Look for any img with src containing common image paths
        const fallbackPatterns = [
          /<img[^>]+src=["']([^"']+(?:\/uploads\/|\/images\/|\/media\/|\/products\/|\/content\/)[^"']+)["']/gi,
          /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
        ]
        
        for (const pattern of fallbackPatterns) {
          if (images.length >= MAX_IMAGES) break
          const matches = html.matchAll(pattern)
          for (const match of matches) {
            if (images.length >= MAX_IMAGES) break
            addImage(match[1])
          }
        }
      }
      
      // Priority 7: Last resort - any image that passes validation
      if (images.length === 0) {
        const allImgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
        for (const match of allImgMatches) {
          if (images.length >= MAX_IMAGES) break
          addImage(match[1])
        }
      }
      
      // Set first image as main
      if (images.length > 0) {
        result.image = images[0]
        result.images = images
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
      // Connection timeout (undici/Node.js fetch)
      if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message?.includes('Connect Timeout')) {
        return NextResponse.json({ error: 'Connection timed out - the website is not responding. It may be down or blocking requests.' }, { status: 408 })
      }
      // Other undici errors
      if (error.cause?.code?.startsWith('UND_ERR_')) {
        return NextResponse.json({ error: 'Could not connect to website - it may be blocking automated requests' }, { status: 400 })
      }
      throw error
    }
  } catch (error: any) {
    console.error('[Link Preview] Error:', error)
    // Check for connection timeout in outer catch as well
    const errorCause = error.cause?.code || ''
    if (errorCause === 'UND_ERR_CONNECT_TIMEOUT' || error.message?.includes('Connect Timeout')) {
      return NextResponse.json(
        { error: 'Connection timed out - the website is not responding. It may be down or blocking requests.' },
        { status: 408 }
      )
    }
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
  
  // Filter out clear non-images
  const invalidPatterns = [
    /pixel/i,
    /tracking/i,
    /analytics/i,
    /beacon/i,
    /sprite/i,
    /1x1\./i,
    /spacer/i,
    /placeholder/i,
    /spinner/i,
    /woocommerce-placeholder/i,
    /\/loader\./i,
    /\/ajax[-_]?loader/i,
  ]
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(url)) {
      return false
    }
  }
  
  // Filter out tiny icon sizes in URL
  if (/[-_](?:16|20|24|32)x(?:16|20|24|32)[-_\.]/i.test(url)) {
    return false
  }
  
  // Filter out favicons
  if (/favicon/i.test(url)) {
    return false
  }
  
  // Filter out .svg (usually icons, not product photos)
  if (/\.svg(\?|$)/i.test(url)) {
    return false
  }
  
  // Accept any URL that looks like an image
  // Has image extension
  if (/\.(jpg|jpeg|png|webp|avif|gif|jpe)(\?|#|$)/i.test(url)) {
    return true
  }
  
  // Has image-related path
  if (/\/(?:images?|photos?|media|uploads?|products?|gallery|content|wp-content)\//i.test(url)) {
    return true
  }
  
  // Is from a CDN or image service
  if (/(?:cloudinary|imgix|cloudfront|akamai|fastly|cdn|\.img\.|image-)/i.test(url)) {
    return true
  }
  
  // Has common image query params (WordPress, etc)
  if (/[?&](?:w|h|width|height|size|resize)=/i.test(url)) {
    return true
  }
  
  // Accept URLs that start with http and don't look like scripts/styles
  if (url.startsWith('http') && !/\.(js|css|json|xml|txt|pdf|doc|zip)(\?|#|$)/i.test(url)) {
    return true
  }
  
  return false
}

