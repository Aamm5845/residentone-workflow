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
  
  try {
    // Check authentication
    const session = await getSession()
    
    if (!session?.user?.orgId) {
      console.error('❌ Upload unauthorized - no session or orgId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if we should use Vercel Blob (preferred) or local storage
    const useBlobStorage = isBlobConfigured()
    
    if (useBlobStorage) {
      
    } else {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ 
          error: 'File storage not configured properly. Please contact support.' 
        }, { status: 500 })
      }
      
    }

    // Parse form data
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const imageTypeParam = formData.get('imageType') as string || 'general'
    const typeParam = formData.get('type') as string // 'rendering' for spec book
    const roomIdParam = formData.get('roomId') as string

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
      let storageUsed = 'unknown'
      
      // Try Vercel Blob first if configured
      if (useBlobStorage) {
        try {
          
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
          
        } catch (blobError) {
          
          console.error('Vercel Blob error:', blobError)
          uploadResult = await uploadImageLocally(buffer, fileName, imageType)
          storageUsed = 'local-fallback'
        }
      } else {
        // Use local file storage when Vercel Blob not available
        
        uploadResult = await uploadImageLocally(buffer, fileName, imageType)
        storageUsed = 'local'
      }

      // If this is a rendering upload for spec book, update the database
      let renderingId = null
      if (typeParam === 'rendering' && roomIdParam) {
        try {
          // Import prisma here to avoid circular dependencies
          const { prisma } = await import('@/lib/prisma')
          
          // Update or create spec book section with rendering URL
          const specBook = await prisma.specBook.findFirst({
            where: {
              project: {
                rooms: {
                  some: { id: roomIdParam }
                }
              },
              isActive: true
            }
          })
          
          if (specBook) {
            const section = await prisma.specBookSection.upsert({
              where: {
                specBookId_type_roomId: {
                  specBookId: specBook.id,
                  type: 'ROOM',
                  roomId: roomIdParam
                }
              },
              update: {
                renderingUrl: uploadResult.url
              },
              create: {
                specBookId: specBook.id,
                type: 'ROOM',
                name: 'Room Rendering',
                roomId: roomIdParam,
                order: 100,
                renderingUrl: uploadResult.url
              }
            })
            renderingId = section.id
          }
        } catch (dbError) {
          console.error('Error updating rendering in database:', dbError)
          // Don't fail the upload, just log the error
        }
      }

      return NextResponse.json({
        success: true,
        url: uploadResult.url,
        path: uploadResult.path || uploadResult.url,
        fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        storage: storageUsed,
        renderingId
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
