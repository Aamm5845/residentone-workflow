import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { DropboxService } from '@/lib/dropbox-service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { put } from '@vercel/blob'

// Validation schema
const uploadSchema = z.object({
  imageType: z.enum(['avatar', 'project-cover', 'spec-item', 'quote-document', 'general']).optional().default('general'),
})

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB
const MAX_FILE_SIZE_QUOTE = 10 * 1024 * 1024 // 10MB for quote documents
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_TYPES_QUOTE = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']

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
    const projectId = formData.get('projectId') as string
    const projectDropboxFolder = formData.get('dropboxFolder') as string

    // Validate parameters
    const { imageType } = uploadSchema.parse({
      imageType: imageTypeParam,
    })
    
    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Use different limits for quote documents (PDF support, larger size)
    const isQuoteDocument = imageType === 'quote-document'
    const maxSize = isQuoteDocument ? MAX_FILE_SIZE_QUOTE : MAX_FILE_SIZE
    const allowedTypes = isQuoteDocument ? ALLOWED_TYPES_QUOTE : ALLOWED_TYPES

    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File too large. Maximum size is ${isQuoteDocument ? '10MB' : '4MB'}`
      }, { status: 400 })
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: isQuoteDocument
          ? 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed'
          : 'Invalid file type. Only JPEG, PNG, and WebP are allowed'
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
      // Map for Dropbox subfolders when used
      const folderMap: Record<string, string> = {
        'avatar': 'User Avatars',
        'project-cover': 'Project Covers',
        'general': 'General Assets'
      }

      // HYBRID STORAGE
      // 1) Avatars → Blob only
      // 2) Project Covers → Blob primary + mirror to Dropbox (under project folder)
      // 3) General → Dropbox (legacy behavior)

      // Case 1: Team member avatar → Blob
      if (imageType === 'avatar') {
        const blobFileName = `avatars/${session.user.id}/${timestamp}_${Math.random().toString(36).slice(2)}.${fileExtension}`
        const blob = await put(blobFileName, file, { access: 'public', contentType: file.type })

        return NextResponse.json({
          success: true,
          url: blob.url,
          path: blob.pathname || blob.url,
          fileName,
          originalName: file.name,
          size: file.size,
          type: file.type,
          storage: 'blob',
        })
      }

      // Case 2a: Spec item images (cropped from renderings) → Blob only (instant CDN)
      if (imageType === 'spec-item') {
        const blobFileName = `spec-items/${projectId || 'general'}/${timestamp}_${Math.random().toString(36).slice(2)}.${fileExtension}`
        const blob = await put(blobFileName, file, { access: 'public', contentType: file.type })

        return NextResponse.json({
          success: true,
          url: blob.url,
          path: blob.pathname || blob.url,
          fileName,
          originalName: file.name,
          size: file.size,
          type: file.type,
          storage: 'blob',
        })
      }

      // Case 2c: Quote documents (PDFs/images from suppliers) → Blob only
      if (imageType === 'quote-document') {
        const blobFileName = `quote-documents/${projectId || 'general'}/${timestamp}_${Math.random().toString(36).slice(2)}.${fileExtension}`
        const blob = await put(blobFileName, file, { access: 'public', contentType: file.type })

        return NextResponse.json({
          success: true,
          url: blob.url,
          path: blob.pathname || blob.url,
          fileName,
          originalName: file.name,
          size: file.size,
          type: file.type,
          storage: 'blob',
        })
      }

      // Case 2b: Project cover → Blob (instant) + Dropbox mirror (archival)
      if (imageType === 'project-cover') {
        // Upload to Blob first (instant display)
        const blobFileName = `project-covers/${projectId || 'temp'}/${timestamp}_${Math.random().toString(36).slice(2)}.${fileExtension}`
        const blob = await put(blobFileName, file, { access: 'public', contentType: file.type })

        // Mirror to Dropbox if folder is linked (don't fail if no link)
        if (projectDropboxFolder) {
          try {
            const basePath = `${projectDropboxFolder}/11- SOFTWARE UPLOADS`
            const subfolderPath = `${basePath}/${folderMap['project-cover']}`
            await dropboxService.createFolder(basePath)
            await dropboxService.createFolder(subfolderPath)
            const dropboxPath = `${subfolderPath}/${fileName}`
            
            await dropboxService.uploadFile(dropboxPath, buffer)
            console.log('[upload-image] Project cover mirrored to Dropbox:', dropboxPath)
          } catch (error) {
            console.error('[upload-image] Failed to mirror cover to Dropbox (non-fatal):', error)
            // Don't fail the upload - Blob is the primary storage
          }
        }

        return NextResponse.json({
          success: true,
          url: blob.url,
          path: blob.pathname || blob.url,
          fileName,
          originalName: file.name,
          size: file.size,
          type: file.type,
          storage: 'blob',
        })
      }

      // Case 3: General/default → Dropbox (kept as-is)
      const subfolder = folderMap[imageType] || 'General Assets'

      // Use org-wide location for non-project files
      const basePath = `/Meisner Interiors Team Folder/11- SOFTWARE UPLOADS`
      const subfolderPath = `${basePath}/${subfolder}`

      // Ensure folders
      try {
        await dropboxService.createFolder(basePath)
        await dropboxService.createFolder(subfolderPath)
      } catch {}

      const dropboxPath = `${subfolderPath}/${fileName}`
      console.log('[upload-image] Uploading to Dropbox:', dropboxPath)
      await dropboxService.uploadFile(dropboxPath, buffer)

      const sharedLink = await dropboxService.createSharedLink(dropboxPath)
      if (!sharedLink) {
        throw new Error('Failed to create shared link for uploaded file')
      }

      return NextResponse.json({
        success: true,
        url: sharedLink,
        path: dropboxPath,
        fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        storage: 'dropbox'
      })

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
