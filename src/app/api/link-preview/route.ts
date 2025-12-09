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

      // Extract image
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
      if (ogImageMatch) {
        result.image = resolveUrl(ogImageMatch[1], urlObj)
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

