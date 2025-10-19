import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { dropboxService } from '@/lib/dropbox-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId, filePath, fileName } = await request.json()

    console.log(`[TEST-DOWNLOAD] Downloading: ${fileName}`)
    console.log(`[TEST-DOWNLOAD] ID: ${fileId}`)
    console.log(`[TEST-DOWNLOAD] Path: ${filePath}`)

    // Use the path for shared link download (prefer path over ID)
    const downloadPath = filePath || fileId
    const fileBuffer = await dropboxService.downloadFile(downloadPath)

    console.log(`[TEST-DOWNLOAD] ✅ Success: ${fileBuffer.length} bytes`)

    return NextResponse.json({
      success: true,
      fileData: fileBuffer.toString('base64'),
      fileSize: fileBuffer.length,
      fileName: fileName
    })

  } catch (error) {
    console.error(`[TEST-DOWNLOAD] ❌ Failed:`, error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}