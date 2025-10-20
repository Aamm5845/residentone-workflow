import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { uploadFile, generateFilePath, getContentType, isBlobConfigured, formatFileSize } from '@/lib/blob'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// File upload configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const sectionId = formData.get('sectionId') as string
    const roomId = formData.get('roomId') as string
    const projectId = formData.get('projectId') as string
    const userDescription = formData.get('description') as string | null

    // Validation
    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided',
        details: 'Please select a file to upload'
      }, { status: 400 })
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File too large',
        details: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
      }, { status: 400 })
    }

    // File type validation
    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      return NextResponse.json({ 
        error: 'Invalid file type',
        details: `File type ${file.type} is not supported. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`
      }, { status: 400 })
    }

    // Generate unique filename
    const fileExtension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    const uniqueId = uuidv4()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${uniqueId}_${originalName}`

    // Try to find or create the section for database storage
    let section = null
    if (sectionId) {
      section = await prisma.designSection.findFirst({
        where: {
          id: sectionId,
          stage: {
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        },
        include: {
          stage: {
            include: {
              room: {
                include: {
                  project: true
                }
              }
            }
          }
        }
      })
    }

    // If we have room info but no section, try to create one
    if (!section && roomId) {
      let stage = await prisma.stage.findFirst({
        where: {
          type: 'DESIGN_CONCEPT',
          roomId: roomId,
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        },
        include: {
          room: {
            include: {
              project: true
            }
          }
        }
      })

      if (stage) {
        section = await prisma.designSection.create({
          data: {
            type: 'GENERAL',
            stageId: stage.id,
            content: userDescription || 'Uploaded file'
          },
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        })
      }
    }

    try {
      let fileUrl: string
      let storageType: 'cloud' | 'local'
      
      // Convert file to buffer once
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      // Check if Vercel Blob is configured and try it first
      if (isBlobConfigured()) {
        
        try {

          // Generate structured file path
          const orgId = (session.user as any)?.orgId || 'default'
          const filePath = generateFilePath(
            orgId,
            projectId || 'general',
            roomId || undefined,
            sectionId || undefined,
            fileName
          )
          
          // Upload to Vercel Blob with proper content type
          const contentType = getContentType(fileName)
          const uploadResult = await uploadFile(buffer, filePath, {
            contentType,
            filename: fileName
          })

          fileUrl = uploadResult.url
          storageType = 'cloud'
          
        } catch (blobError) {
          console.error('❌ Vercel Blob upload failed:', blobError)
          
          // Fall back to local storage
          await mkdir(UPLOAD_DIR, { recursive: true })
          const projectDir = path.join(UPLOAD_DIR, projectId || 'general')
          await mkdir(projectDir, { recursive: true })
          
          const filePath = path.join(projectDir, fileName)
          await writeFile(filePath, buffer)
          fileUrl = `/uploads/${projectId || 'general'}/${fileName}`
          storageType = 'local'
        }
        
      } else {
        
        // Ensure upload directory exists
        await mkdir(UPLOAD_DIR, { recursive: true })
        const projectDir = path.join(UPLOAD_DIR, projectId || 'general')
        await mkdir(projectDir, { recursive: true })
        
        const filePath = path.join(projectDir, fileName)
        await writeFile(filePath, buffer)
        fileUrl = `/uploads/${projectId || 'general'}/${fileName}`
        storageType = 'local'
      }
      
      // Save to database if we have section info
      let asset = null
      if (section) {
        try {
          // Determine asset type
          let assetType: 'IMAGE' | 'PDF' | 'DOCUMENT' = 'DOCUMENT'
          if (file.type.startsWith('image/')) {
            assetType = 'IMAGE'
          } else if (file.type === 'application/pdf') {
            assetType = 'PDF'
          }

          // Create asset record in database
          asset = await prisma.asset.create({
            data: {
              title: file.name,
              filename: fileName,
              url: fileUrl,
              type: assetType,
              size: file.size,
              mimeType: file.type,
              provider: storageType === 'cloud' ? 'vercel' : 'local',
              metadata: JSON.stringify({
                originalName: file.name,
                uploadDate: new Date().toISOString(),
                stageId: section.stageId,
                sectionType: section.type,
                storageMethod: storageType === 'cloud' ? 'vercel_blob' : 'local_filesystem'
              }),
              userDescription: userDescription || null,
              uploadedBy: session.user.id,
              orgId: session.user.orgId,
              projectId: section.stage.room.project.id,
              roomId: section.stage.room.id,
              stageId: section.stage.id,
              sectionId: section.id
            }
          })

          // Log the activity
          await logActivity({
            session,
            action: ActivityActions.ASSET_UPLOADED,
            entity: EntityTypes.ASSET,
            entityId: asset.id,
            details: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              sectionType: section.type,
              sectionName: section.type,
              stageName: `${section.stage.type} - ${section.stage.room.name || section.stage.room.type}`,
              projectName: section.stage.room.project.name,
              hasDescription: !!userDescription,
              storageType: storageType
            },
            ipAddress
          })
        } catch (dbError) {
          console.error('Database save error:', dbError)
          // Continue without database save - file is still uploaded to storage
        }
      }

      // Create file metadata in format expected by design-board.tsx
      const fileData = {
        id: asset?.id || uniqueId,
        name: file.name,
        originalName: file.name,
        fileName: fileName,
        size: file.size,
        type: file.type.startsWith('image/') ? 'image' : 
              file.type === 'application/pdf' ? 'pdf' : 'document',
        mimeType: file.type,
        url: fileUrl,
        uploadedAt: asset?.createdAt || new Date(),
        uploadedBy: {
          id: session.user.id,
          name: session.user.name || 'Unknown User'
        },
        sectionId,
        roomId,
        projectId,
        storage: {
          type: storageType,
          location: storageType === 'cloud' ? 'Vercel Blob' : 'Local Filesystem'
        },
        metadata: {
          sizeFormatted: formatFileSize(file.size),
          extension: fileExtension,
          isImage: file.type.startsWith('image/'),
          isPDF: file.type === 'application/pdf'
        }
      }

      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        file: fileData
      })

    } catch (storageError) {
      console.error('File storage error:', storageError)
      return NextResponse.json({ 
        error: 'Storage failed',
        details: 'Failed to save file to storage. Please try again.'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: 'Upload failed',
      details: 'An unexpected error occurred during upload. Please try again.'
    }, { status: 500 })
  }
}

// Get uploaded files for a section/room
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')
    const roomId = searchParams.get('roomId')
    const projectId = searchParams.get('projectId')

    let whereClause: any = {
      orgId: session.user.orgId
    }

    if (sectionId) {
      whereClause.sectionId = sectionId
    } else if (roomId) {
      whereClause.roomId = roomId
    } else if (projectId) {
      whereClause.projectId = projectId
    }

    // Get assets from database
    const assets = await prisma.asset.findMany({
      where: whereClause,
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Convert to format expected by design-board.tsx
    const files = assets.map(asset => ({
      id: asset.id,
      name: asset.title,
      originalName: asset.title,
      type: asset.type === 'IMAGE' ? 'image' : asset.type === 'PDF' ? 'pdf' : 'document',
      url: asset.url,
      size: asset.size,
      uploadedAt: asset.createdAt,
      uploadedBy: asset.uploadedByUser,
      metadata: {
        sizeFormatted: formatFileSize(asset.size),
        extension: asset.filename?.split('.').pop() || '',
        isImage: asset.type === 'IMAGE',
        isPDF: asset.type === 'PDF'
      }
    }))

    return NextResponse.json({
      success: true,
      files: files
    })

  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

