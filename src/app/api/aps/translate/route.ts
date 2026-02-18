import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

export const runtime = 'nodejs'
export const maxDuration = 120 // up to 2 minutes for large file uploads

/**
 * POST /api/aps/translate
 * Upload a CAD file (from a URL or direct upload) and start translation
 *
 * Body: { fileUrl: string, fileName: string, outputFormat: 'svf2' | 'pdf' }
 * OR multipart form: file + outputFormat
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!apsService.isConfigured()) {
      return NextResponse.json({ error: 'Autodesk APS is not configured' }, { status: 500 })
    }

    const contentType = request.headers.get('content-type') || ''

    let urn: string
    let status: string

    if (contentType.includes('multipart/form-data')) {
      // Direct file upload
      const formData = await request.formData()
      const file = formData.get('file') as File
      const outputFormat = (formData.get('outputFormat') as string) || 'svf2'

      if (!file || !file.name) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Upload to APS
      urn = await apsService.uploadFile(file.name, buffer)

      // Start translation
      if (outputFormat === 'pdf') {
        const result = await apsService.translateToPdf(urn)
        status = result.status
      } else {
        const result = await apsService.translateToSvf2(urn)
        status = result.status
      }
    } else {
      // JSON body with fileUrl
      const body = await request.json()
      const { fileUrl, fileName, outputFormat = 'svf2' } = body

      if (!fileUrl || !fileName) {
        return NextResponse.json({ error: 'fileUrl and fileName are required' }, { status: 400 })
      }

      const result = await apsService.uploadFromUrlAndTranslate(fileUrl, fileName, outputFormat)
      urn = result.urn
      status = result.status
    }

    return NextResponse.json({
      success: true,
      urn,
      status,
      message: 'Translation started. Poll /api/aps/translate/status?urn=<urn> for progress.',
    })
  } catch (error: any) {
    console.error('[aps/translate] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    )
  }
}
