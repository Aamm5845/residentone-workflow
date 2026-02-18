import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

export const runtime = 'nodejs'
export const maxDuration = 120 // up to 2 minutes for large file uploads

/**
 * POST /api/aps/translate
 * Upload a CAD file and start translation or plotting
 *
 * For SVF2 viewer output: uses Model Derivative API
 * For PDF output on DWG/DXF: uses Design Automation (AutoCAD engine) for proper plotting
 *
 * Multipart form fields:
 *   - file: DWG/DXF file (required)
 *   - outputFormat: 'svf2' | 'pdf'
 *   - plotOptions: JSON string with { paperSize, orientation, plotArea, scale, plotStyleTable, lineweights, plotStyles, layoutName }
 *   - ctbFile: optional .ctb/.stb plot style file
 *   - xrefFiles: optional multiple xref DWG files
 *
 * OR JSON body: { fileUrl, fileName, outputFormat }
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
      const isDwg = /\.(dwg|dxf)$/i.test(file.name)

      if (outputFormat === 'pdf' && isDwg) {
        // Use Design Automation for proper DWG → PDF plotting

        // Parse plot options if provided
        let plotOptions: any = undefined
        const plotOptionsStr = formData.get('plotOptions') as string
        if (plotOptionsStr) {
          try {
            plotOptions = JSON.parse(plotOptionsStr)
          } catch {
            // Ignore parse errors, use defaults
          }
        }

        // Get CTB file if provided
        let ctbFileName: string | undefined
        let ctbBuffer: Buffer | undefined
        const ctbFile = formData.get('ctbFile') as File | null
        if (ctbFile && ctbFile.name) {
          ctbFileName = ctbFile.name
          ctbBuffer = Buffer.from(await ctbFile.arrayBuffer())
        }

        // Get xref files if provided
        const xrefEntries = formData.getAll('xrefFiles') as File[]
        let xrefFiles: Array<{ name: string; buffer: Buffer }> | undefined
        if (xrefEntries && xrefEntries.length > 0) {
          xrefFiles = []
          for (const xf of xrefEntries) {
            if (xf && xf.name && xf.size > 0) {
              xrefFiles.push({
                name: xf.name,
                buffer: Buffer.from(await xf.arrayBuffer()),
              })
            }
          }
          if (xrefFiles.length === 0) xrefFiles = undefined
        }

        const result = await apsService.uploadAndPlotToPdf(file.name, buffer, {
          plotOptions,
          ctbFileName,
          ctbBuffer,
          xrefFiles,
        })

        return NextResponse.json({
          success: true,
          workItemId: result.workItemId,
          pdfObjectKey: result.pdfObjectKey,
          status: result.status,
          type: 'design-automation',
          message: 'Plot job submitted. Poll /api/aps/workitem/status?id=<workItemId> for progress.',
        })
      } else {
        // Use Model Derivative for SVF2 viewer
        const urn = await apsService.uploadFile(file.name, buffer)
        const is2dCad = /\.(dwg|dxf)$/i.test(file.name)
        const result = await apsService.translateToSvf2(urn, is2dCad ? ['2d'] : ['2d', '3d'])
        return NextResponse.json({
          success: true,
          urn: result.urn,
          status: result.status,
          type: 'model-derivative',
          message: 'Translation started. Poll /api/aps/translate/status?urn=<urn> for progress.',
        })
      }
    } else {
      // JSON body with fileUrl
      const body = await request.json()
      const { fileUrl, fileName, outputFormat = 'svf2' } = body

      if (!fileUrl || !fileName) {
        return NextResponse.json({ error: 'fileUrl and fileName are required' }, { status: 400 })
      }

      const isDwg = /\.(dwg|dxf)$/i.test(fileName)

      if (outputFormat === 'pdf' && isDwg) {
        // Download file, then use Design Automation
        const fileResp = await fetch(fileUrl)
        if (!fileResp.ok) {
          throw new Error(`Failed to download file from URL: ${fileResp.status}`)
        }
        const arrayBuffer = await fileResp.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const result = await apsService.uploadAndPlotToPdf(fileName, buffer)
        return NextResponse.json({
          success: true,
          workItemId: result.workItemId,
          pdfObjectKey: result.pdfObjectKey,
          status: result.status,
          type: 'design-automation',
          message: 'Plot job submitted. Poll /api/aps/workitem/status?id=<workItemId> for progress.',
        })
      } else {
        const result = await apsService.uploadFromUrlAndTranslate(fileUrl, fileName, outputFormat)
        return NextResponse.json({
          success: true,
          urn: result.urn,
          status: result.status,
          type: 'model-derivative',
          message: 'Translation started. Poll /api/aps/translate/status?urn=<urn> for progress.',
        })
      }
    }
  } catch (error: any) {
    console.error('[aps/translate] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    )
  }
}
