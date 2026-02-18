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
      const isZipBundle = formData.get('isZipBundle') === 'true'
      const rootFilename = formData.get('rootFilename') as string | null
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

        // For ZIP bundles, we need to extract the main DWG for Design Automation
        // Design Automation needs individual files, not a ZIP
        const actualFileName = isZipBundle && rootFilename ? rootFilename : file.name

        // Get xref files if provided (legacy non-ZIP mode)
        let xrefFiles: Array<{ name: string; buffer: Buffer }> | undefined
        if (!isZipBundle) {
          const xrefEntries = formData.getAll('xrefFiles') as File[]
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
        } else if (isZipBundle) {
          // For ZIP bundle: extract individual files from the ZIP for Design Automation
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

          // Also extract the main DWG from ZIP for the upload
          const mainEntry = zipData.file(rootFilename!)
          if (mainEntry) {
            const mainBuf = Buffer.from(await mainEntry.async('nodebuffer'))
            const result = await apsService.uploadAndPlotToPdf(actualFileName, mainBuf, {
              plotOptions,
              ctbFileName,
              ctbBuffer,
              xrefFiles,
            })
            return NextResponse.json({
              success: true,
              workItemId: result.workItemId,
              pdfObjectKey: result.pdfObjectKey,
              pdfUploadKey: result.pdfUploadKey,
              status: result.status,
              type: 'design-automation',
              message: 'Plot job submitted from ZIP bundle.',
            })
          }
        }

        const result = await apsService.uploadAndPlotToPdf(actualFileName, buffer, {
          plotOptions,
          ctbFileName,
          ctbBuffer,
          xrefFiles,
        })

        return NextResponse.json({
          success: true,
          workItemId: result.workItemId,
          pdfObjectKey: result.pdfObjectKey,
          pdfUploadKey: result.pdfUploadKey,
          status: result.status,
          type: 'design-automation',
          message: 'Plot job submitted. Poll /api/aps/workitem/status?id=<workItemId> for progress.',
        })
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
          return NextResponse.json({
            success: true,
            urn: result.urn,
            status: result.status,
            type: 'model-derivative',
            xrefCount: 0, // bundled in ZIP
            message: 'Translation started from ZIP bundle. Poll /api/aps/translate/status?urn=<urn> for progress.',
          })
        }

        // Fallback: individual xref files (legacy or single-file upload)
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

        const is2dCad = /\.(dwg|dxf)$/i.test(file.name)
        const result = await apsService.uploadFileWithXrefs(
          file.name,
          buffer,
          xrefFiles,
          is2dCad ? ['2d'] : ['2d', '3d']
        )
        return NextResponse.json({
          success: true,
          urn: result.urn,
          status: result.status,
          type: 'model-derivative',
          xrefCount: xrefFiles?.length || 0,
          message: 'Translation started. Poll /api/aps/translate/status?urn=<urn> for progress.',
        })
      }
    } else {
      // JSON body — supports fileUrl mode OR dropboxPath mode
      const body = await request.json()
      const { fileUrl, fileName, outputFormat = 'svf2', dropboxPath, projectId } = body

      // --- Dropbox path mode: auto-fetch xrefs from same folder ---
      if (dropboxPath && projectId) {
        const { default: prisma } = await import('@/lib/prisma')
        const { DropboxServiceV2 } = await import('@/lib/dropbox-service-v2')

        // Get the project to find the Dropbox folder
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { dropboxFolder: true },
        })
        if (!project?.dropboxFolder) {
          return NextResponse.json({ error: 'Project has no Dropbox folder' }, { status: 400 })
        }

        const dropboxService = new DropboxServiceV2()
        const mainFileName = dropboxPath.split('/').pop() || 'drawing.dwg'
        const isDwg = /\.(dwg|dxf)$/i.test(mainFileName)

        // Download the main file from Dropbox
        const mainBuffer = await dropboxService.downloadFile(dropboxPath)

        // Find the folder path and list all sibling files (xref DWGs + referenced images)
        const folderPath = dropboxPath.substring(0, dropboxPath.lastIndexOf('/'))
        const folderContents = await dropboxService.listFolder(folderPath)
        // Include DWG/DXF (xrefs), JPG/PNG (referenced images), and CTB files
        const siblingDwgs = folderContents.files.filter(f =>
          /\.(dwg|dxf|jpg|jpeg|png|ctb)$/i.test(f.name) &&
          f.path.toLowerCase() !== dropboxPath.toLowerCase() // Exclude the main file
        )

        // Download all sibling DWG files as potential xrefs
        let xrefFiles: Array<{ name: string; buffer: Buffer }> | undefined
        if (siblingDwgs.length > 0) {
          xrefFiles = []
          for (const xf of siblingDwgs) {
            try {
              const xrefBuffer = await dropboxService.downloadFile(xf.path)
              xrefFiles.push({ name: xf.name, buffer: xrefBuffer })
            } catch (err: any) {
              console.warn(`[aps/translate] Failed to download xref ${xf.name}:`, err.message)
            }
          }
          if (xrefFiles.length === 0) xrefFiles = undefined
        }

        if (outputFormat === 'pdf' && isDwg) {
          const result = await apsService.uploadAndPlotToPdf(mainFileName, mainBuffer, {
            xrefFiles,
          })
          return NextResponse.json({
            success: true,
            workItemId: result.workItemId,
            pdfObjectKey: result.pdfObjectKey,
            pdfUploadKey: result.pdfUploadKey,
            status: result.status,
            type: 'design-automation',
            xrefCount: xrefFiles?.length || 0,
            message: 'Plot job submitted with xrefs from Dropbox folder.',
          })
        } else {
          const result = await apsService.uploadFileWithXrefs(
            mainFileName,
            mainBuffer,
            xrefFiles,
            isDwg ? ['2d'] : ['2d', '3d']
          )
          return NextResponse.json({
            success: true,
            urn: result.urn,
            status: result.status,
            type: 'model-derivative',
            xrefCount: xrefFiles?.length || 0,
            message: `Translation started with ${xrefFiles?.length || 0} xref(s) from same folder.`,
          })
        }
      }

      // --- URL mode: direct file URL ---
      if (!fileUrl || !fileName) {
        return NextResponse.json({ error: 'fileUrl and fileName (or dropboxPath and projectId) are required' }, { status: 400 })
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
          pdfUploadKey: result.pdfUploadKey,
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
