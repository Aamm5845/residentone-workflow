import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { uploadFile, generateUserFilePath, getContentType, isBlobConfigured } from '@/lib/blob'
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
  console.log('🖼️ POST /api/upload-image called')
  
  try {
    // Check authentication
    const session = await getSession()
    console.log('📊 Upload session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      orgId: session?.user?.orgId
    })
    
    if (!session?.user?.orgId) {
      console.error('❌ Upload unauthorized - no session or orgId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if we should use Vercel Blob (preferred) or local storage
    const useBlobStorage = isBlobConfigured()
    
    if (useBlobStorage) {
      console.log('☁️ Using Vercel Blob storage')
    } else {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ 
          error: 'File storage not configured properly. Please contact support.' 
        }, { status: 500 })
      }
      console.log('⚠️ Using local file storage (development only)')
    }

    // Parse form data
    console.log('📋 Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const imageTypeParam = formData.get('imageType') as string || 'general'
    
    console.log('📤 File upload details:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      imageType: imageTypeParam
    })

    // Validate parameters
    const { imageType } = uploadSchema.parse({
      imageType: imageTypeParam,
    })
    console.log('✅ Image type validated:', imageType)

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
      let storageUsed = 'unknown'
      
      // Try Vercel Blob first if configured
      if (useBlobStorage) {
        try {
          console.log('☁️ Uploading to Vercel Blob Storage...')
          
          // Generate structured path for the image
          const orgId = session.user.orgId
          const userId = session.user.id
          const filePath = generateUserFilePath(orgId, userId, fileName, imageType)
          
          // Upload with proper content type
          const contentType = getContentType(fileName)
          const blobResult = await uploadFile(buffer, filePath, {
            contentType,
            filename: fileName
          })
          
          uploadResult = { url: blobResult.url, path: blobResult.pathname }
          storageUsed = 'vercel-blob'
          console.log('✅ Vercel Blob upload successful:', blobResult.url)
          
        } catch (blobError) {
          console.log('❌ Vercel Blob upload failed, falling back to local storage')
          console.error('Vercel Blob error:', blobError)
          uploadResult = await uploadImageLocally(buffer, fileName, imageType)
          storageUsed = 'local-fallback'
        }
      } else {
        // Use local file storage when Vercel Blob not available
        console.log('📁 Uploading to local storage...')
        uploadResult = await uploadImageLocally(buffer, fileName, imageType)
        storageUsed = 'local'
      }

      return NextResponse.json({
        success: true,
        url: uploadResult.url,
        path: uploadResult.path || uploadResult.url,
        fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        storage: storageUsed
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
