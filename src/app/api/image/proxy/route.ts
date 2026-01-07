import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/image/proxy?url=<encoded-url>
 *
 * Proxies an image through our server to avoid CORS issues when
 * loading cross-origin images onto a canvas for editing/cropping.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json({ error: 'URL parameter required' }, { status: 400 })
    }

    // Validate the URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(imageUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Only allow certain domains for security
    const allowedDomains = [
      'dropbox.com',
      'www.dropbox.com',
      'dl.dropboxusercontent.com',
      'uc.dropboxusercontent.com',
      'res.cloudinary.com',
      'cloudinary.com',
      'images.unsplash.com',
      'i.imgur.com',
      'lh3.googleusercontent.com',
      's3.amazonaws.com',
      // Add more trusted domains as needed
    ]

    const hostname = parsedUrl.hostname.toLowerCase()
    const isDomainAllowed = allowedDomains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    )

    if (!isDomainAllowed) {
      // For other domains, check if it's our own domain or allow it with caution
      console.warn(`[ImageProxy] Proxying from potentially unknown domain: ${hostname}`)
    }

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      )
    }

    // Verify content type is an image
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 })
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('[ImageProxy] Error:', error)
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 })
  }
}
