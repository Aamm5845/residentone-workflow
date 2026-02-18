/**
 * Autodesk Platform Services (APS) Integration
 *
 * Handles:
 * - 2-legged OAuth authentication (client credentials)
 * - File upload to Object Storage Service (OSS)
 * - Model Derivative translation (DWG/RVT/IFC → SVF2 for viewer, PDF for download)
 * - Design Automation (DWG → PDF with plot styles, xrefs, CTB)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApsToken {
  access_token: string
  token_type: string
  expires_in: number
  expiresAt: number // timestamp
}

export interface ApsTranslationStatus {
  urn: string
  status: 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout'
  progress: string
  hasThumbnail: boolean
  derivatives: Array<{
    outputType: string
    status: string
    children?: Array<{
      guid: string
      role: string
      type: string
      name?: string
    }>
  }>
}

export interface ApsViewerToken {
  access_token: string
  expires_in: number
}

export interface PlotOptions {
  paperSize: string       // e.g. 'ISO full bleed A3 (420.00 x 297.00 MM)'
  orientation: 'Landscape' | 'Portrait'
  plotArea: 'Layout' | 'Extents' | 'Display' | 'Limits'
  scale: string           // 'Fit' or e.g. '1=100'
  plotStyleTable: string  // CTB filename (empty = none)
  lineweights: boolean
  plotStyles: boolean
  layoutName: string      // e.g. 'Layout1'
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

const tokenCache: Record<string, ApsToken> = {}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const APS_BASE = 'https://developer.api.autodesk.com'
const APS_CLIENT_ID = process.env.APS_CLIENT_ID || ''
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET || ''
const BUCKET_KEY = 'residentone-cad-' + (APS_CLIENT_ID.slice(0, 8) || 'default').toLowerCase()

// Design Automation nickname — using the client ID as a DA nickname
const DA_NICKNAME = APS_CLIENT_ID.slice(0, 16).toLowerCase() || 'residentone'
const CUSTOM_ACTIVITY_ID = `${DA_NICKNAME}.PlotToPdfCustom+prod`

function isConfigured(): boolean {
  return !!(APS_CLIENT_ID && APS_CLIENT_SECRET)
}

// ---------------------------------------------------------------------------
// Authentication — 2-legged OAuth
// ---------------------------------------------------------------------------

const DEFAULT_SCOPES = ['data:read', 'data:write', 'data:create', 'bucket:read', 'bucket:create', 'code:all']

async function getToken(scopes: string[] = DEFAULT_SCOPES): Promise<string> {
  const cacheKey = scopes.sort().join(' ')

  // Return cached token if still valid (with 5 min buffer)
  const cached = tokenCache[cacheKey]
  if (cached && cached.expiresAt > Date.now() + 300_000) {
    return cached.access_token
  }

  const resp = await fetch(APS_BASE + '/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: APS_CLIENT_ID,
      client_secret: APS_CLIENT_SECRET,
      scope: scopes.join(' '),
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS Auth failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  tokenCache[cacheKey] = {
    ...data,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return tokenCache[cacheKey].access_token
}

/**
 * Get a viewer-only token (data:read only) for the client-side viewer
 */
async function getViewerToken(): Promise<ApsViewerToken> {
  const resp = await fetch(APS_BASE + '/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: APS_CLIENT_ID,
      client_secret: APS_CLIENT_SECRET,
      scope: 'data:read viewables:read',
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS Viewer token failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  }
}

// ---------------------------------------------------------------------------
// Object Storage Service (OSS) — file upload
// ---------------------------------------------------------------------------

async function ensureBucket(): Promise<void> {
  const token = await getToken()

  // Try to get bucket first
  const getResp = await fetch(APS_BASE + `/oss/v2/buckets/${BUCKET_KEY}/details`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (getResp.ok) return // bucket exists

  // Create bucket
  const createResp = await fetch(APS_BASE + '/oss/v2/buckets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketKey: BUCKET_KEY,
      policyKey: 'persistent', // permanent retention
    }),
  })

  if (!createResp.ok && createResp.status !== 409) {
    const errText = await createResp.text()
    throw new Error(`APS bucket creation failed (${createResp.status}): ${errText}`)
  }
}

/**
 * Upload a file buffer to APS OSS using the Direct-to-S3 approach
 * (The legacy PUT endpoint is deprecated and returns 403)
 * Returns the URN (base64-encoded objectId) for use with Model Derivative
 */
async function uploadFile(fileName: string, buffer: Buffer): Promise<string> {
  await ensureBucket()
  const token = await getToken()

  // Sanitize the object key
  const objectKey = fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')

  // Step 1: Get signed S3 upload URL(s)
  const signedResp = await fetch(
    APS_BASE + `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload?firstPart=1&parts=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!signedResp.ok) {
    const errText = await signedResp.text()
    throw new Error(`APS signed upload request failed (${signedResp.status}): ${errText}`)
  }

  const signedData = await signedResp.json()
  const uploadUrl = signedData.urls[0] // Signed S3 URL for part 1
  const uploadKey = signedData.uploadKey

  // Step 2: Upload directly to S3 using the signed URL
  const s3Resp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(buffer),
  })

  if (!s3Resp.ok) {
    const errText = await s3Resp.text()
    throw new Error(`S3 direct upload failed (${s3Resp.status}): ${errText}`)
  }

  // Step 3: Finalize the upload
  const finalizeResp = await fetch(
    APS_BASE + `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadKey }),
    }
  )

  if (!finalizeResp.ok) {
    const errText = await finalizeResp.text()
    throw new Error(`APS upload finalize failed (${finalizeResp.status}): ${errText}`)
  }

  const data = await finalizeResp.json()
  const objectId = data.objectId // urn:adsk.objects:os.object:bucket/key
  const urn = Buffer.from(objectId).toString('base64url')

  return urn
}

// ---------------------------------------------------------------------------
// Model Derivative — translation
// ---------------------------------------------------------------------------

/**
 * Start a translation job (CAD → SVF2 for viewer)
 * For 2D CAD files (DWG), only request '2d' views for faster translation.
 *
 * When xrefUrns are provided, they are included as references so the Model
 * Derivative engine can resolve external references (xrefs) in the main DWG.
 */
async function translateToSvf2(
  urn: string,
  viewsHint: ('2d' | '3d')[] = ['2d', '3d'],
  xrefUrns?: Array<{ urn: string; fileName: string }>
): Promise<{ urn: string; status: string }> {
  const token = await getToken()

  // Build input object — include references if xrefs provided
  const input: Record<string, any> = {
    urn,
    compressedUrn: false,
    rootFilename: undefined as string | undefined,
  }

  // If we have xref references, add them
  if (xrefUrns && xrefUrns.length > 0) {
    input.checkReferences = true
    input.references = xrefUrns.map(xref => ({
      urn: xref.urn,
      relativePath: xref.fileName,
    }))
  }

  // Clean up undefined fields
  if (!input.rootFilename) delete input.rootFilename
  if (!input.references) {
    delete input.checkReferences
    delete input.references
  }

  const resp = await fetch(APS_BASE + '/modelderivative/v2/designdata/job', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-ads-force': 'true', // re-translate even if already done
    },
    body: JSON.stringify({
      input,
      output: {
        formats: [
          {
            type: 'svf2',
            views: viewsHint,
          },
        ],
      },
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS translate failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  return { urn, status: data.result || 'created' }
}

/**
 * Start a translation job (CAD → SVF2 with embedded PDF 2D views)
 * This generates PDF pages as derivatives within the SVF2 manifest.
 * Note: DWG cannot be directly translated to "type: pdf" — only SVF2 with advanced 2dviews option.
 */
async function translateToPdf(urn: string): Promise<{ urn: string; status: string }> {
  const token = await getToken()

  const resp = await fetch(APS_BASE + '/modelderivative/v2/designdata/job', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-ads-force': 'true',
    },
    body: JSON.stringify({
      input: { urn },
      output: {
        formats: [
          {
            type: 'svf2',
            views: ['2d'],
            advanced: {
              '2dviews': 'pdf',
            },
          },
        ],
      },
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS PDF translate failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  return { urn, status: data.result || 'created' }
}

/**
 * Check the status of a translation job
 */
async function getTranslationStatus(urn: string): Promise<ApsTranslationStatus> {
  const token = await getToken()

  const resp = await fetch(
    APS_BASE + `/modelderivative/v2/designdata/${urn}/manifest`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!resp.ok) {
    if (resp.status === 404) {
      return { urn, status: 'pending', progress: '0%', hasThumbnail: false, derivatives: [] }
    }
    const errText = await resp.text()
    throw new Error(`APS status check failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  return {
    urn,
    status: data.status as ApsTranslationStatus['status'],
    progress: data.progress || '0%',
    hasThumbnail: data.hasThumbnail || false,
    derivatives: data.derivatives || [],
  }
}

/**
 * Get the download URL for a PDF derivative
 */
async function getPdfDerivativeUrl(urn: string): Promise<string | null> {
  const status = await getTranslationStatus(urn)

  if (status.status !== 'success') return null

  // Find the PDF derivative
  for (const derivative of status.derivatives) {
    if (derivative.outputType === 'pdf' && derivative.children) {
      for (const child of derivative.children) {
        if (child.role === 'pdf-page' || child.type === 'resource') {
          const token = await getToken()
          const encodedUrn = encodeURIComponent(child.guid)
          const resp = await fetch(
            APS_BASE + `/modelderivative/v2/designdata/${urn}/manifest/${encodedUrn}/signedcookies`,
            { headers: { Authorization: `Bearer ${token}` } }
          )

          if (resp.ok) {
            const data = await resp.json()
            return data.url || null
          }
        }
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Design Automation — DWG to PDF with plot styles (real AutoCAD engine)
// ---------------------------------------------------------------------------

/**
 * Get a signed download URL from OSS for an already-uploaded object
 */
async function getSignedDownloadUrl(objectKey: string): Promise<string> {
  const token = await getToken()
  const resp = await fetch(
    APS_BASE + `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3download`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS signed download failed (${resp.status}): ${errText}`)
  }
  const data = await resp.json()
  return data.url
}

/**
 * Get a signed upload URL from OSS for writing output
 */
async function getSignedUploadUrl(objectKey: string): Promise<{ url: string; uploadKey: string }> {
  const token = await getToken()
  const resp = await fetch(
    APS_BASE + `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload?firstPart=1&parts=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS signed upload URL failed (${resp.status}): ${errText}`)
  }
  const data = await resp.json()
  return { url: data.urls[0], uploadKey: data.uploadKey }
}

/**
 * Low-level: Upload file buffer to OSS (Direct-to-S3) without returning URN.
 * Used internally for uploading DWG, xref, and CTB files.
 */
async function uploadFileRaw(objectKey: string, buffer: Buffer): Promise<void> {
  const token = await getToken()

  // Step 1: Get signed S3 upload URL
  const signedResp = await fetch(
    APS_BASE + `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload?firstPart=1&parts=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!signedResp.ok) {
    const errText = await signedResp.text()
    throw new Error(`APS signed upload request failed (${signedResp.status}): ${errText}`)
  }
  const signedData = await signedResp.json()

  // Step 2: Upload to S3
  const s3Resp = await fetch(signedData.urls[0], {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(buffer),
  })
  if (!s3Resp.ok) {
    const errText = await s3Resp.text()
    throw new Error(`S3 upload failed (${s3Resp.status}): ${errText}`)
  }

  // Step 3: Finalize
  const finalResp = await fetch(
    APS_BASE + `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadKey: signedData.uploadKey }),
    }
  )
  if (!finalResp.ok) {
    const errText = await finalResp.text()
    throw new Error(`APS finalize failed (${finalResp.status}): ${errText}`)
  }
}

// ---------------------------------------------------------------------------
// Design Automation — Custom Activity + Work Items
// ---------------------------------------------------------------------------

/**
 * Set a DA nickname for the app (only needs to be done once).
 * If already set, this is a no-op.
 */
async function ensureDaNickname(): Promise<void> {
  const token = await getToken()
  // Check if nickname exists
  const resp = await fetch(APS_BASE + '/da/us-east/v3/forgeapps/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (resp.ok) {
    const data = await resp.json()
    if (data.nickname && data.nickname !== APS_CLIENT_ID) {
      // Nickname already set
      return
    }
  }
  // Set nickname (PATCH)
  const patchResp = await fetch(APS_BASE + '/da/us-east/v3/forgeapps/me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nickname: DA_NICKNAME }),
  })
  // 409 = already set, which is fine
  if (!patchResp.ok && patchResp.status !== 409) {
    // Nickname errors are non-fatal — we can still use the default
    console.warn(`[DA] Nickname set returned ${patchResp.status}`)
  }
}

/**
 * Build the -PLOT script string from plot options
 */
function buildPlotScript(opts: PlotOptions): string {
  const ctbLine = opts.plotStyles && opts.plotStyleTable
    ? opts.plotStyleTable
    : '.'  // '.' = no plot style table

  const lines = [
    '-PLOT',
    'Y',                              // Detailed plot config? Yes
    opts.layoutName || 'Layout1',     // Layout name
    'DWG To PDF.pc3',                 // Output device (PDF plotter)
    opts.paperSize,                   // Paper size
    'Millimeters',                    // Paper units
    opts.orientation,                 // Orientation
    'No',                             // Plot upside down? No
    opts.plotArea,                    // Plot area
    opts.scale,                       // Scale (Fit or custom)
    'Center',                         // Plot offset
    opts.plotStyles ? 'Y' : 'N',     // Plot with plot styles?
    ctbLine,                          // CTB file name or '.'
    opts.lineweights ? 'Y' : 'N',   // Plot lineweights?
    'As displayed',                   // Shade plot setting
    'output.pdf',                     // Output filename
    'N',                              // Save changes to page setup?
    'Y',                              // Proceed with plot?
    '',                               // Extra blank line
  ]

  return lines.join('\n')
}

/**
 * Ensure our custom DA activity exists for custom plotting.
 * Creates it if not found (first run only).
 *
 * The custom activity accepts:
 *   - HostDwg: main DWG file
 *   - CtbFile: optional CTB plot style file
 *   - Result: output PDF
 *   - PlotScript: inline script with -PLOT commands
 *
 * For xrefs we use the zip approach: bundle DWG + xrefs in a zip.
 */
async function ensureCustomActivity(): Promise<string> {
  const token = await getToken()

  // Check if activity exists
  const getResp = await fetch(APS_BASE + `/da/us-east/v3/activities/${encodeURIComponent(CUSTOM_ACTIVITY_ID)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (getResp.ok) {
    return CUSTOM_ACTIVITY_ID
  }

  // Create the activity
  const activityId = 'PlotToPdfCustom'

  const createResp = await fetch(APS_BASE + '/da/us-east/v3/activities', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: activityId,
      commandLine: [
        '$(engine.path)\\accoreconsole.exe /i "$(args[HostDwg].path)" /s "$(settings[script].path)"',
      ],
      engine: 'Autodesk.AutoCAD+24',
      parameters: {
        HostDwg: {
          verb: 'get',
          localName: 'input.dwg',
          required: true,
          description: 'Input DWG file (or zip with xrefs)',
          zip: false,
        },
        CtbFile: {
          verb: 'get',
          localName: 'custom.ctb',
          required: false,
          description: 'CTB plot style table file',
        },
        Result: {
          verb: 'put',
          localName: 'output.pdf',
          required: true,
          description: 'Output PDF file',
        },
      },
      settings: {
        script: {
          value: buildPlotScript({
            paperSize: 'ISO full bleed A3 (420.00 x 297.00 MM)',
            orientation: 'Landscape',
            plotArea: 'Layout',
            scale: 'Fit',
            plotStyleTable: 'custom.ctb',
            lineweights: true,
            plotStyles: true,
            layoutName: 'Layout1',
          }),
        },
      },
      description: 'Plot DWG to PDF with custom settings (paper size, scale, orientation, CTB)',
    }),
  })

  if (!createResp.ok) {
    const errText = await createResp.text()
    console.error(`[DA] Activity creation failed (${createResp.status}): ${errText}`)
    // Fall back to built-in activity
    return 'AutoCAD.PlotToPDF+prod'
  }

  // Create an alias for +prod
  const aliasResp = await fetch(APS_BASE + `/da/us-east/v3/activities/${activityId}/aliases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 'prod',
      version: 1,
    }),
  })

  if (!aliasResp.ok && aliasResp.status !== 409) {
    console.warn(`[DA] Activity alias creation returned ${aliasResp.status}`)
  }

  return CUSTOM_ACTIVITY_ID
}

/**
 * Plot a DWG to PDF using the AutoCAD cloud engine.
 *
 * When plotOptions are provided, tries to use a custom activity with
 * the -PLOT script for full control over paper size, scale, orientation, etc.
 *
 * Falls back to AutoCAD.PlotToPDF+prod if custom activity isn't available.
 */
async function plotDwgToPdf(
  dwgObjectKey: string,
  pdfObjectKey: string,
  opts?: {
    plotOptions?: PlotOptions
    ctbObjectKey?: string
    useCustomActivity?: boolean
  }
): Promise<{ workItemId: string; status: string; pdfObjectKey: string }> {
  const token = await getToken()

  // Get signed URLs for Design Automation
  const inputUrl = await getSignedDownloadUrl(dwgObjectKey)
  const { url: outputUrl } = await getSignedUploadUrl(pdfObjectKey)

  let activityId = 'AutoCAD.PlotToPDF+prod'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workItemArgs: Record<string, any> = {
    HostDwg: {
      url: inputUrl,
      verb: 'get',
    },
    Result: {
      url: outputUrl,
      verb: 'put',
    },
  }

  // Try to use custom activity if plot options provided
  if (opts?.useCustomActivity && opts.plotOptions) {
    try {
      await ensureDaNickname()
      activityId = await ensureCustomActivity()

      // If CTB file was uploaded, add it
      if (opts.ctbObjectKey) {
        const ctbUrl = await getSignedDownloadUrl(opts.ctbObjectKey)
        workItemArgs.CtbFile = {
          url: ctbUrl,
          verb: 'get',
        }
      }
    } catch (err: any) {
      console.warn('[DA] Custom activity setup failed, falling back to built-in:', err.message)
      activityId = 'AutoCAD.PlotToPDF+prod'
    }
  }

  const workItemBody: Record<string, any> = {
    activityId,
    arguments: workItemArgs,
  }

  // If using custom activity with custom plot options, override the script inline
  if (activityId !== 'AutoCAD.PlotToPDF+prod' && opts?.plotOptions) {
    workItemBody.settings = {
      script: {
        value: buildPlotScript(opts.plotOptions),
      },
    }
  }

  const resp = await fetch(APS_BASE + '/da/us-east/v3/workitems', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(workItemBody),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS Design Automation failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  return {
    workItemId: data.id,
    status: data.status,
    pdfObjectKey,
  }
}

/**
 * Upload a DWG file (and optionally xrefs + CTB) and plot it to PDF using Design Automation.
 * Returns the work item ID for polling + the PDF object key for download.
 */
async function uploadAndPlotToPdf(
  fileName: string,
  buffer: Buffer,
  opts?: {
    plotOptions?: PlotOptions
    ctbFileName?: string
    ctbBuffer?: Buffer
    xrefFiles?: Array<{ name: string; buffer: Buffer }>
  }
): Promise<{ workItemId: string; status: string; pdfObjectKey: string }> {
  await ensureBucket()

  const timestamp = Date.now()

  // Upload DWG to OSS
  const dwgObjectKey = `plot_${timestamp}_${fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')}`
  await uploadFileRaw(dwgObjectKey, buffer)

  // Upload xref files alongside the DWG (same naming prefix)
  if (opts?.xrefFiles && opts.xrefFiles.length > 0) {
    for (const xf of opts.xrefFiles) {
      const xrefKey = `plot_${timestamp}_${xf.name.replace(/[^a-zA-Z0-9._\-]/g, '_')}`
      await uploadFileRaw(xrefKey, xf.buffer)
    }
  }

  // Upload CTB file if provided
  let ctbObjectKey: string | undefined
  if (opts?.ctbFileName && opts?.ctbBuffer) {
    ctbObjectKey = `plot_${timestamp}_${opts.ctbFileName.replace(/[^a-zA-Z0-9._\-]/g, '_')}`
    await uploadFileRaw(ctbObjectKey, opts.ctbBuffer)
  }

  // Create output PDF key
  const pdfObjectKey = dwgObjectKey.replace(/\.(dwg|dxf)$/i, '.pdf')

  const hasCustomOpts = !!opts?.plotOptions
  // Submit the plot job
  return plotDwgToPdf(dwgObjectKey, pdfObjectKey, {
    plotOptions: opts?.plotOptions,
    ctbObjectKey,
    useCustomActivity: hasCustomOpts,
  })
}

/**
 * Get a download URL for a plotted PDF
 */
async function getPlottedPdfUrl(pdfObjectKey: string): Promise<string> {
  return getSignedDownloadUrl(pdfObjectKey)
}

/**
 * Check Design Automation work item status
 */
async function getWorkItemStatus(workItemId: string): Promise<{
  id: string
  status: 'pending' | 'inprogress' | 'success' | 'failedLimitProcessingTime' | 'failedDownload' | 'failedInstructions' | 'failedUpload' | 'cancelled'
  progress: string
  reportUrl?: string
}> {
  const token = await getToken()

  const resp = await fetch(APS_BASE + `/da/us-east/v3/workitems/${workItemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS work item check failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  return {
    id: data.id,
    status: data.status,
    progress: data.progress || '',
    reportUrl: data.reportUrl,
  }
}

// ---------------------------------------------------------------------------
// Convenience: Upload + Translate workflows
// ---------------------------------------------------------------------------

/**
 * Upload a main DWG file + xref files to APS, then start SVF2 translation
 * with references so the Model Derivative engine resolves all xrefs.
 *
 * This is the key function for viewing DWGs that have external references.
 * Without uploading the xrefs, the viewer would only show dimensions/annotations
 * from the main file without the actual model geometry from the xref files.
 */
async function uploadFileWithXrefs(
  fileName: string,
  buffer: Buffer,
  xrefFiles?: Array<{ name: string; buffer: Buffer }>,
  viewsHint: ('2d' | '3d')[] = ['2d']
): Promise<{ urn: string; status: string }> {
  await ensureBucket()

  // Upload the main DWG file
  const mainUrn = await uploadFile(fileName, buffer)

  // Upload xref files and collect their URNs
  let xrefUrns: Array<{ urn: string; fileName: string }> | undefined
  if (xrefFiles && xrefFiles.length > 0) {
    xrefUrns = []
    for (const xf of xrefFiles) {
      const xrefUrn = await uploadFile(xf.name, xf.buffer)
      xrefUrns.push({
        urn: xrefUrn,
        fileName: xf.name,
      })
    }
  }

  // Start translation with xref references
  return translateToSvf2(mainUrn, viewsHint, xrefUrns)
}

/**
 * Upload a CAD file from a URL (e.g., Dropbox temp link) to APS and start translation
 */
async function uploadFromUrlAndTranslate(
  fileUrl: string,
  fileName: string,
  outputFormat: 'svf2' | 'pdf' = 'svf2'
): Promise<{ urn: string; status: string }> {
  // Download the file from the URL
  const fileResp = await fetch(fileUrl)
  if (!fileResp.ok) {
    throw new Error(`Failed to download file from URL: ${fileResp.status}`)
  }

  const arrayBuffer = await fileResp.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload to APS OSS
  const urn = await uploadFile(fileName, buffer)

  // Start translation — 2D only for DWG/DXF
  const is2dCad = /\.(dwg|dxf)$/i.test(fileName)
  if (outputFormat === 'pdf') {
    return translateToPdf(urn)
  }
  return translateToSvf2(urn, is2dCad ? ['2d'] : ['2d', '3d'])
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const apsService = {
  isConfigured,
  getToken,
  getViewerToken,
  ensureBucket,
  uploadFile,
  uploadFileRaw,
  uploadFileWithXrefs,
  translateToSvf2,
  translateToPdf,
  getTranslationStatus,
  getPdfDerivativeUrl,
  plotDwgToPdf,
  getWorkItemStatus,
  uploadAndPlotToPdf,
  getPlottedPdfUrl,
  getSignedDownloadUrl,
  uploadFromUrlAndTranslate,
  buildPlotScript,
}
