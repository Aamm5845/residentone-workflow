import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { DropboxService } from '@/lib/dropbox-service'
import { prisma } from '@/lib/prisma'
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

    // Initialize Dropbox service
    const dropboxService = new DropboxService()

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
      // Get project info if available (for project-specific uploads)
      let projectFolder = null
      let dropboxPath = ''
      
      // Determine Dropbox folder based on image type
      const folderMap: Record<string, string> = {
        'avatar': 'User Avatars',
        'project-cover': 'Project Covers',
        'general': 'General Assets'
      }
      
      const subfolder = folderMap[imageType] || 'General Assets'
      
      // Try to get project from session or context
      // For now, use organization-level folder
      dropboxPath = `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS/${subfolder}/${fileName}`
      
      console.log('[upload-image] Uploading to Dropbox:', dropboxPath)
      
      // Upload to Dropbox
      const dropboxResult = await dropboxService.uploadFile(dropboxPath, buffer)
      
      // Get temporary link for immediate access
      const temporaryLink = await dropboxService.getTemporaryLink(dropboxPath)
      
      const uploadResult = {
        url: temporaryLink || dropboxPath, // Use temporary link or path
        path: dropboxPath
      }
      
      const storageUsed = 'dropbox'

      // If this is a rendering upload for spec book, update the database
      let renderingId = null
      if (typeParam === 'rendering' && roomIdParam) {
        try {
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
            // Get existing section to append to renderingUrls array
            const existingSection = await prisma.specBookSection.findUnique({
              where: {
                specBookId_type_roomId: {
                  specBookId: specBook.id,
                  type: 'ROOM',
                  roomId: roomIdParam
                }
              }
            })
            
            const currentUrls = existingSection?.renderingUrls || []
            const updatedUrls = [...currentUrls, uploadResult.url]
            
            const section = await prisma.specBookSection.upsert({
              where: {
                specBookId_type_roomId: {
                  specBookId: specBook.id,
                  type: 'ROOM',
                  roomId: roomIdParam
                }
              },
              update: {
                renderingUrl: uploadResult.url, // Keep for backward compatibility
                renderingUrls: updatedUrls
              },
              create: {
                specBookId: specBook.id,
                type: 'ROOM',
                name: 'Room Rendering',
                roomId: roomIdParam,
                order: 100,
                renderingUrl: uploadResult.url,
                renderingUrls: [uploadResult.url]
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
