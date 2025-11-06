import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { DropboxService } from '@/lib/dropbox-service'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }

    // Validate file size (max 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 })
    }

    // Upload to Dropbox
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}-${file.name}`
    
    const dropboxService = new DropboxService()
    
    // Ensure folder structure exists
    const basePath = `/Meisner Interiors Team Folder/10- SOFTWARE UPLOADS`
    const pdfFolder = `${basePath}/PDFs`
    const typeFolder = `${pdfFolder}/${type || 'general'}`
    try {
      await dropboxService.createFolder(basePath)
      await dropboxService.createFolder(pdfFolder)
      await dropboxService.createFolder(typeFolder)
    } catch (folderError) {
      console.log('[upload-pdf] Folders already exist or created successfully')
    }
    
    const dropboxPath = `${typeFolder}/${uniqueFileName}`
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadResult = await dropboxService.uploadFile(dropboxPath, buffer)
    const sharedLink = await dropboxService.createSharedLink(uploadResult.path_display!)
    
    if (!sharedLink) {
      return NextResponse.json({ 
        error: 'Failed to create shared link for PDF' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      url: sharedLink,
      fileName: file.name,
      fileSize: file.size
    })

  } catch (error) {
    console.error('PDF upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    )
  }
}
