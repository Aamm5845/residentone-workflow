import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { uploadImage } from '@/lib/dropbox'
import { z } from 'zod'

// Validation schema
const uploadSchema = z.object({
  imageType: z.enum(['avatar', 'project-cover', 'general']).optional().default('general'),
})

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const imageTypeParam = formData.get('imageType') as string || 'general'

    // Validate parameters
    const { imageType } = uploadSchema.parse({
      imageType: imageTypeParam,
    })

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 4MB' 
      }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' 
      }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExtension}`

    try {
      // Upload to Dropbox
      const { url, path } = await uploadImage(
        buffer,
        fileName,
        session.user.orgId,
        imageType
      )

      return NextResponse.json({
        success: true,
        url,
        path,
        fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
      })
    } catch (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ 
        error: 'Failed to upload image to storage' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Image upload API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}