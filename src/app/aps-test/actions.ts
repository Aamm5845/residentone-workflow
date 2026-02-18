'use server'

import { getSession } from '@/auth'
import { apsService } from '@/lib/aps-service'

/**
 * Server action to start translation from an already-uploaded file URN.
 * Used when the client uploads large files directly to S3 via signed URLs,
 * bypassing Vercel's serverless body size limit entirely.
 */
export async function translateFromUrn(params: {
  urn: string
  objectKey: string
  fileName: string
  rootFilename?: string
  isZipBundle: boolean
  outputFormat: 'svf2' | 'pdf'
  plotOptions?: any
  ctbFileName?: string
  ctbBase64?: string
}): Promise<{
  success: boolean
  urn?: string
  status?: string
  type?: string
  workItemId?: string
  pdfObjectKey?: string
  xrefCount?: number
  error?: string
  message?: string
}> {
  try {
    const session = await getSession()
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    if (!apsService.isConfigured()) {
      return { success: false, error: 'Autodesk APS is not configured' }
    }

    const {
      urn,
      objectKey,
      fileName,
      rootFilename,
      isZipBundle,
      outputFormat,
      plotOptions,
      ctbFileName,
      ctbBase64,
    } = params

    const isDwg = isZipBundle && rootFilename
      ? /\.(dwg|dxf)$/i.test(rootFilename)
      : /\.(dwg|dxf)$/i.test(fileName)

    if (outputFormat === 'pdf' && isDwg) {
      // For Design Automation (PDF plotting), we need to download the file
      // from S3 (server-to-server, no Vercel body limit) and process it
      const downloadUrl = await apsService.getSignedDownloadUrl(objectKey)
      const fileResp = await fetch(downloadUrl)
      if (!fileResp.ok) {
        throw new Error(`Failed to download from S3: ${fileResp.status}`)
      }
      const buffer = Buffer.from(await fileResp.arrayBuffer())

      let ctbBuffer: Buffer | undefined
      if (ctbBase64) {
        ctbBuffer = Buffer.from(ctbBase64, 'base64')
      }

      const actualFileName = isZipBundle && rootFilename ? rootFilename : fileName

      // Handle xref files from ZIP
      let xrefFiles: Array<{ name: string; buffer: Buffer }> | undefined
      if (isZipBundle && rootFilename) {
        const JSZipLib = (await import('jszip')).default
        const zipData = await JSZipLib.loadAsync(buffer)
        xrefFiles = []
        for (const [name, entry] of Object.entries(zipData.files)) {
          if (!entry.dir && name !== rootFilename) {
            const fileBuffer = Buffer.from(await entry.async('nodebuffer'))
            xrefFiles.push({ name, buffer: fileBuffer })
          }
        }
        if (xrefFiles.length === 0) xrefFiles = undefined

        // Extract the main DWG from ZIP
        const mainEntry = zipData.file(rootFilename)
        if (mainEntry) {
          const mainBuf = Buffer.from(await mainEntry.async('nodebuffer'))
          const result = await apsService.uploadAndPlotToPdf(actualFileName, mainBuf, {
            plotOptions,
            ctbFileName,
            ctbBuffer,
            xrefFiles,
          })
          return {
            success: true,
            workItemId: result.workItemId,
            pdfObjectKey: result.pdfObjectKey,
            status: result.status,
            type: 'design-automation',
            message: 'Plot job submitted from ZIP bundle (direct S3 upload).',
          }
        }
      }

      const result = await apsService.uploadAndPlotToPdf(actualFileName, buffer, {
        plotOptions,
        ctbFileName,
        ctbBuffer,
        xrefFiles,
      })

      return {
        success: true,
        workItemId: result.workItemId,
        pdfObjectKey: result.pdfObjectKey,
        status: result.status,
        type: 'design-automation',
        message: 'Plot job submitted (direct S3 upload).',
      }
    } else {
      // SVF2 viewer — file is already uploaded, just start translation
      if (isZipBundle && rootFilename) {
        const is2dCad = /\.(dwg|dxf)$/i.test(rootFilename)
        const result = await apsService.translateToSvf2Compressed(
          urn,
          rootFilename,
          is2dCad ? ['2d'] : ['2d', '3d']
        )
        return {
          success: true,
          urn: result.urn,
          status: result.status,
          type: 'model-derivative',
          xrefCount: 0,
          message: 'Translation started from ZIP bundle (direct S3 upload).',
        }
      }

      // Single file
      const is2dCad = /\.(dwg|dxf)$/i.test(fileName)
      const result = await apsService.translateToSvf2(
        urn,
        is2dCad ? ['2d'] : ['2d', '3d']
      )
      return {
        success: true,
        urn: result.urn,
        status: result.status,
        type: 'model-derivative',
        xrefCount: 0,
        message: 'Translation started (direct S3 upload).',
      }
    }
  } catch (error: any) {
    console.error('[aps/translateFromUrn] Error:', error)
    return { success: false, error: error.message || 'Translation failed' }
  }
}

/**
 * Server action to upload a CAD ZIP bundle and start translation.
 * Uses server actions instead of route handlers because Next.js App Router
 * route handlers have a hard 1MB body size limit, while server actions
 * respect the bodySizeLimit config (set to 100mb in next.config.ts).
 *
 * NOTE: For large files (>4MB), prefer using the direct S3 upload flow:
 *   1. POST /api/aps/signed-upload → get signed S3 URL
 *   2. PUT to S3 URL directly from client
 *   3. POST /api/aps/signed-upload/finalize → get URN
 *   4. Call translateFromUrn() server action
 */
export async function uploadAndTranslate(formData: FormData): Promise<{
  success: boolean
  urn?: string
  status?: string
  type?: string
  workItemId?: string
  pdfObjectKey?: string
  xrefCount?: number
  error?: string
  message?: string
}> {
  try {
    const session = await getSession()
    if (!session?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    if (!apsService.isConfigured()) {
      return { success: false, error: 'Autodesk APS is not configured' }
    }

    const file = formData.get('file') as File
    const outputFormat = (formData.get('outputFormat') as string) || 'svf2'
    const isZipBundle = formData.get('isZipBundle') === 'true'
    const rootFilename = formData.get('rootFilename') as string | null

    if (!file || !file.name) {
      return { success: false, error: 'No file provided' }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Check if this is a DWG/DXF — for ZIP bundles, check the rootFilename
    const isDwg = isZipBundle && rootFilename
      ? /\.(dwg|dxf)$/i.test(rootFilename)
      : /\.(dwg|dxf)$/i.test(file.name)

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

      const actualFileName = isZipBundle && rootFilename ? rootFilename : file.name

      // Handle xref files
      let xrefFiles: Array<{ name: string; buffer: Buffer }> | undefined
      if (isZipBundle) {
        // Extract individual files from the ZIP for Design Automation
        const JSZipLib = (await import('jszip')).default
        const zipData = await JSZipLib.loadAsync(buffer)
        xrefFiles = []
        for (const [name, entry] of Object.entries(zipData.files)) {
          if (!entry.dir && name !== rootFilename) {
            const fileBuffer = Buffer.from(await entry.async('nodebuffer'))
            xrefFiles.push({ name, buffer: fileBuffer })
          }
        }
        if (xrefFiles.length === 0) xrefFiles = undefined

        // Extract the main DWG from ZIP
        const mainEntry = zipData.file(rootFilename!)
        if (mainEntry) {
          const mainBuf = Buffer.from(await mainEntry.async('nodebuffer'))
          const result = await apsService.uploadAndPlotToPdf(actualFileName, mainBuf, {
            plotOptions,
            ctbFileName,
            ctbBuffer,
            xrefFiles,
          })
          return {
            success: true,
            workItemId: result.workItemId,
            pdfObjectKey: result.pdfObjectKey,
            status: result.status,
            type: 'design-automation',
            message: 'Plot job submitted from ZIP bundle.',
          }
        }
      }

      const result = await apsService.uploadAndPlotToPdf(actualFileName, buffer, {
        plotOptions,
        ctbFileName,
        ctbBuffer,
        xrefFiles,
      })

      return {
        success: true,
        workItemId: result.workItemId,
        pdfObjectKey: result.pdfObjectKey,
        status: result.status,
        type: 'design-automation',
        message: 'Plot job submitted.',
      }
    } else {
      // Use Model Derivative for SVF2 viewer
      if (isZipBundle && rootFilename) {
        // Client already created the ZIP bundle — upload directly and translate
        const zipUrn = await apsService.uploadFile(file.name, buffer)
        const is2dCad = /\.(dwg|dxf)$/i.test(rootFilename)
        const result = await apsService.translateToSvf2Compressed(
          zipUrn,
          rootFilename,
          is2dCad ? ['2d'] : ['2d', '3d']
        )
        return {
          success: true,
          urn: result.urn,
          status: result.status,
          type: 'model-derivative',
          xrefCount: 0,
          message: 'Translation started from ZIP bundle.',
        }
      }

      // Single file upload (no xrefs)
      const is2dCad = /\.(dwg|dxf)$/i.test(file.name)
      const result = await apsService.uploadFileWithXrefs(
        file.name,
        buffer,
        undefined,
        is2dCad ? ['2d'] : ['2d', '3d']
      )
      return {
        success: true,
        urn: result.urn,
        status: result.status,
        type: 'model-derivative',
        xrefCount: 0,
        message: 'Translation started.',
      }
    }
  } catch (error: any) {
    console.error('[aps/uploadAndTranslate] Error:', error)
    return { success: false, error: error.message || 'Translation failed' }
  }
}
