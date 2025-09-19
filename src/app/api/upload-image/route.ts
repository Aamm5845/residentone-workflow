import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { uploadImage } from '@/lib/dropbox'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
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

    // For profile pictures and project covers, we can use local storage as fallback
    const useLocalStorage = !process.env.DROPBOX_ACCESS_TOKEN || 
                           process.env.DROPBOX_ACCESS_TOKEN === 'your-dropbox-access-token-here'
    
    if (useLocalStorage) {
      console.log('⚠️ Using local file storage (Dropbox not configured or unavailable)')
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
      let uploadResult
      
      if (useLocalStorage) {
        // Use local file storage
        uploadResult = await uploadImageLocally(buffer, fileName, imageType)
      } else {
        // Use Dropbox storage
        const { url, path } = await uploadImage(
          buffer,
          fileName,
          session.user.orgId,
          imageType
        )
        uploadResult = { url, path }
      }

      return NextResponse.json({
        success: true,
        url: uploadResult.url,
        path: uploadResult.path || uploadResult.url,
        fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        storage: useLocalStorage ? 'local' : 'dropbox'
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

// Local file storage function
async function uploadImageLocally(
  buffer: Buffer,
  fileName: string,
  imageType: 'avatar' | 'project-cover' | 'general'
): Promise<{ url: string; path: string }> {
  try {
    // Create organized folder structure
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images', imageType)
    await mkdir(uploadDir, { recursive: true })
    
    // Save file
    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)
    
    // Generate public URL
    const publicUrl = `/uploads/images/${imageType}/${fileName}`
    
    console.log(`✅ Image saved locally: ${publicUrl}`)
    
    return {
      url: publicUrl,
      path: filePath
    }
  } catch (error) {
    console.error('Local upload error:', error)
    throw new Error('Failed to save image locally')
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
