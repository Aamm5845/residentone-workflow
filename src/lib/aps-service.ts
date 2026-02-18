/**
 * Autodesk Platform Services (APS) Integration
 *
 * Handles:
 * - 2-legged OAuth authentication (client credentials)
 * - File upload to Object Storage Service (OSS)
 * - Model Derivative translation (DWG/RVT/IFC → SVF2 for viewer, PDF for download)
 * - Design Automation (DWG → PDF with plot styles)
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

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

let cachedToken: ApsToken | null = null

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const APS_BASE = 'https://developer.api.autodesk.com'
const APS_CLIENT_ID = process.env.APS_CLIENT_ID || ''
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET || ''
const BUCKET_KEY = 'residentone-cad-' + (APS_CLIENT_ID.slice(0, 8) || 'default').toLowerCase()

function isConfigured(): boolean {
  return !!(APS_CLIENT_ID && APS_CLIENT_SECRET)
}

// ---------------------------------------------------------------------------
// Authentication — 2-legged OAuth
// ---------------------------------------------------------------------------

async function getToken(scopes: string[] = ['data:read', 'data:write', 'data:create', 'bucket:read', 'bucket:create']): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.access_token
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
  cachedToken = {
    ...data,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return cachedToken!.access_token
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
 * For 2D CAD files (DWG), only request '2d' views for faster translation
 */
async function translateToSvf2(urn: string, viewsHint: ('2d' | '3d')[] = ['2d', '3d']): Promise<{ urn: string; status: string }> {
  const token = await getToken()

  const resp = await fetch(APS_BASE + '/modelderivative/v2/designdata/job', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-ads-force': 'true', // re-translate even if already done
    },
    body: JSON.stringify({
      input: { urn },
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
 * Start a translation job (CAD → PDF)
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
            type: 'pdf',
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
// Design Automation — DWG to PDF with plot styles
// ---------------------------------------------------------------------------

/**
 * Plot a DWG to PDF using the AutoCAD cloud engine
 * Uses the built-in AutoCAD.PlotToPDF+Prod activity
 */
async function plotDwgToPdf(
  inputUrl: string,
  outputUrl: string,
  inputHeaders?: Record<string, string>,
  outputHeaders?: Record<string, string>
): Promise<{ workItemId: string; status: string }> {
  const token = await getToken()

  const resp = await fetch(APS_BASE + '/da/us-east/v3/workitems', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      activityId: 'AutoCAD.PlotToPDF+prod',
      arguments: {
        HostDwg: {
          url: inputUrl,
          ...(inputHeaders && { headers: inputHeaders }),
        },
        Result: {
          url: outputUrl,
          verb: 'put',
          ...(outputHeaders && { headers: outputHeaders }),
        },
      },
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`APS Design Automation failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  return {
    workItemId: data.id,
    status: data.status,
  }
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
// Convenience: Upload + Translate workflow
// ---------------------------------------------------------------------------

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
  translateToSvf2,
  translateToPdf,
  getTranslationStatus,
  getPdfDerivativeUrl,
  plotDwgToPdf,
  getWorkItemStatus,
  uploadFromUrlAndTranslate,
}
