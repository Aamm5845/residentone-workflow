import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { put } from '@vercel/blob'

export const maxDuration = 60

/**
 * POST /api/image/remove-background
 * Remove background from an image using remove.bg API
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if remove.bg API key is configured
    const removeBgApiKey = process.env.REMOVEBG_API_KEY
    if (!removeBgApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Background removal not configured',
        message: 'Please add REMOVEBG_API_KEY to your environment variables. Get a free API key at https://www.remove.bg/api'
      }, { status: 503 })
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const imageUrl = formData.get('imageUrl') as string | null

    if (!imageFile && !imageUrl) {
      return NextResponse.json({ 
        success: false,
        error: 'Either an image file or imageUrl is required' 
      }, { status: 400 })
    }

    console.log('[Background Removal] Processing request...')

    // Prepare the request to remove.bg API
    const removeBgFormData = new FormData()
    
    if (imageUrl) {
      // Use image URL
      removeBgFormData.append('image_url', imageUrl)
    } else if (imageFile) {
      // Use image file
      const arrayBuffer = await imageFile.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: imageFile.type })
      removeBgFormData.append('image_file', blob, imageFile.name)
    }

    // Set output format
    removeBgFormData.append('size', 'auto')
    removeBgFormData.append('format', 'png')
    removeBgFormData.append('bg_color', '') // Transparent background

    console.log('[Background Removal] Calling remove.bg API...')

    // Call remove.bg API
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': removeBgApiKey,
      },
      body: removeBgFormData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Background Removal] remove.bg API error:', response.status, errorText)
      
      let errorMessage = 'Failed to remove background'
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.errors) {
          errorMessage = errorJson.errors.map((e: any) => e.title).join(', ')
        }
      } catch {
        // Use default error message
      }
      
      return NextResponse.json({
        success: false,
        error: 'Background removal failed',
        message: errorMessage,
        details: `Status: ${response.status}`
      }, { status: 500 })
    }

    // Get the result image
    const resultBuffer = await response.arrayBuffer()
    
    console.log('[Background Removal] Got result, uploading to blob storage...')

    // Upload the result to blob storage
    const timestamp = Date.now()
    const resultFilename = `bg-removed-${timestamp}.png`
    const resultBlob = await put(`processed/${resultFilename}`, Buffer.from(resultBuffer), {
      access: 'public',
      contentType: 'image/png'
    })

    console.log('[Background Removal] Success:', resultBlob.url)

    return NextResponse.json({
      success: true,
      url: resultBlob.url,
      message: 'Background removed successfully'
    })

  } catch (error) {
    console.error('[Background Removal] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
