import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { v4 as uuidv4 } from 'uuid'
import { uploadFile, generateFilePath, getContentType, isBlobConfigured, formatFileSize } from '@/lib/blob'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const sectionId = formData.get('sectionId') as string
    const roomId = formData.get('roomId') as string
    const projectId = formData.get('projectId') as string

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

    try {
      let fileUrl: string
      let storageType: 'cloud' | 'local'
      
      // Convert file to buffer once
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      // Check if Vercel Blob is configured and try it first
      if (isBlobConfigured()) {
        console.log('☁️ Using Vercel Blob cloud storage')
        
        try {
          console.log(`💾 Uploading file: ${fileName} (${formatFileSize(file.size)})`)
          console.log(`📁 Project: ${projectId}, Room: ${roomId}, Section: ${sectionId}`)
          
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
          
          console.log('✅ Vercel Blob upload successful:', uploadResult.url)
          fileUrl = uploadResult.url
          storageType = 'cloud'
          
        } catch (blobError) {
          console.error('❌ Vercel Blob upload failed:', blobError)
          console.log('🔄 Falling back to local storage')
          
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
        console.log('💾 Using local file storage (Vercel Blob not configured)')
        
        // Ensure upload directory exists
        await mkdir(UPLOAD_DIR, { recursive: true })
        const projectDir = path.join(UPLOAD_DIR, projectId || 'general')
        await mkdir(projectDir, { recursive: true })
        
        const filePath = path.join(projectDir, fileName)
        await writeFile(filePath, buffer)
        fileUrl = `/uploads/${projectId || 'general'}/${fileName}`
        storageType = 'local'
      }
      
      // Create file metadata
      const fileData = {
        id: uniqueId,
        name: file.name,
        originalName: file.name,
        fileName: fileName,
        size: file.size,
        type: file.type.startsWith('image/') ? 'image' : 
              file.type === 'application/pdf' ? 'pdf' : 'document',
        mimeType: file.type,
        url: fileUrl,
        uploadedAt: new Date().toISOString(),
        uploadedBy: {
          id: (session.user as any)?.id || 'unknown',
          name: session.user?.name || 'Unknown User'
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

      console.log(`✅ File uploaded successfully to ${storageType === 'cloud' ? 'Vercel Blob' : 'local storage'}: ${fileName} (${formatFileSize(file.size)})`)

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
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')
    const roomId = searchParams.get('roomId')
    const projectId = searchParams.get('projectId')

    // In production, this would query the database
    // For now, return empty array since we're in fallback mode
    console.log(`📁 Fetching files for section: ${sectionId}, room: ${roomId}, project: ${projectId}`)

    return NextResponse.json({
      success: true,
      files: [] // Would contain actual files in production
    })

  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

