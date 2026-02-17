import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'

// ─── Constants ──────────────────────────────────────────
const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize'
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token'
const ZOOM_API_BASE = 'https://api.zoom.us/v2'

// ─── Environment ────────────────────────────────────────
function getZoomCredentials() {
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  const redirectUri = process.env.ZOOM_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Zoom OAuth credentials in environment variables')
  }
  return { clientId, clientSecret, redirectUri }
}

/**
 * Check if Zoom credentials are configured in environment
 */
export function isZoomConfigured(): boolean {
  return !!(
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET &&
    process.env.ZOOM_REDIRECT_URI
  )
}

// ─── OAuth URL Builder ──────────────────────────────────

/**
 * Build the Zoom OAuth authorization URL
 * @param state - Base64url-encoded state parameter for CSRF protection
 */
export function buildZoomAuthUrl(state: string): string {
  const { clientId, redirectUri } = getZoomCredentials()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  })
  return `${ZOOM_AUTH_URL}?${params.toString()}`
}

// ─── Token Exchange ─────────────────────────────────────

/**
 * Exchange an authorization code for access + refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}> {
  const { clientId, clientSecret, redirectUri } = getZoomCredentials()
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Zoom token exchange failed: ${error}`)
  }

  return response.json()
}

// ─── Token Refresh ──────────────────────────────────────

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(encryptedRefreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}> {
  const { clientId, clientSecret } = getZoomCredentials()
  const refreshToken = decrypt(encryptedRefreshToken)
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Zoom token refresh failed: ${error}`)
  }

  return response.json()
}

// ─── Get Valid Access Token ─────────────────────────────

/**
 * Get a valid access token for the organization.
 * Automatically refreshes if expired (with 5-minute buffer).
 * Returns null if no integration exists or tokens are invalid.
 */
export async function getValidAccessToken(orgId: string): Promise<string | null> {
  const integration = await prisma.zoomIntegration.findUnique({
    where: { orgId },
  })

  if (!integration || integration.status !== 'ACTIVE') {
    return null
  }

  const now = new Date()
  const bufferMs = 5 * 60 * 1000 // 5 minutes before actual expiry

  if (integration.tokenExpiresAt.getTime() - bufferMs > now.getTime()) {
    // Token still valid — decrypt and return
    return decrypt(integration.accessToken)
  }

  // Token expired or about to expire — refresh it
  try {
    const tokens = await refreshAccessToken(integration.refreshToken)
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await prisma.zoomIntegration.update({
      where: { orgId },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: newExpiresAt,
        scopes: tokens.scope || integration.scopes,
      },
    })

    return tokens.access_token
  } catch (error) {
    console.error('Zoom token refresh failed for org:', orgId, error)
    // Mark integration as errored so UI shows reconnect prompt
    await prisma.zoomIntegration.update({
      where: { orgId },
      data: { status: 'ERROR' },
    })
    return null
  }
}

// ─── Create Zoom Meeting ────────────────────────────────

/**
 * Create a Zoom meeting via the API.
 * Returns the meeting ID and join URL, or null if Zoom is not connected.
 */
export async function createZoomMeeting(
  orgId: string,
  options: {
    topic: string
    startTime: string   // ISO 8601 format
    duration: number     // minutes
    agenda?: string
  }
): Promise<{ meetingId: number; joinUrl: string; startUrl: string } | null> {
  const accessToken = await getValidAccessToken(orgId)
  if (!accessToken) return null

  const response = await fetch(`${ZOOM_API_BASE}/users/me/meetings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: options.topic,
      type: 2, // Scheduled meeting
      start_time: options.startTime,
      duration: options.duration,
      timezone: 'UTC',
      agenda: options.agenda || '',
      settings: {
        join_before_host: true,
        waiting_room: false,
        auto_recording: 'none',
        mute_upon_entry: true,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Zoom create meeting failed:', error)
    return null
  }

  const data = await response.json()
  return {
    meetingId: data.id,
    joinUrl: data.join_url,
    startUrl: data.start_url,
  }
}

// ─── Update Zoom Meeting ────────────────────────────────

/**
 * Update an existing Zoom meeting.
 * Returns true on success, false on failure.
 */
export async function updateZoomMeeting(
  orgId: string,
  zoomMeetingId: string,
  options: {
    topic?: string
    startTime?: string
    duration?: number
    agenda?: string
  }
): Promise<boolean> {
  const accessToken = await getValidAccessToken(orgId)
  if (!accessToken) return false

  const body: Record<string, unknown> = {}
  if (options.topic) body.topic = options.topic
  if (options.startTime) body.start_time = options.startTime
  if (options.duration) body.duration = options.duration
  if (options.agenda !== undefined) body.agenda = options.agenda

  const response = await fetch(`${ZOOM_API_BASE}/meetings/${zoomMeetingId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return response.ok // 204 on success
}

// ─── Delete Zoom Meeting ────────────────────────────────

/**
 * Delete a Zoom meeting.
 * Returns true on success, false on failure.
 */
export async function deleteZoomMeeting(
  orgId: string,
  zoomMeetingId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(orgId)
  if (!accessToken) return false

  const response = await fetch(`${ZOOM_API_BASE}/meetings/${zoomMeetingId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  return response.ok // 204 on success
}

// ─── Get Zoom User Info ─────────────────────────────────

/**
 * Fetch the Zoom user profile for the authorized account.
 * Used during OAuth callback to get the email for display.
 */
export async function getZoomUserInfo(accessToken: string): Promise<{
  id: string
  email: string
  first_name: string
  last_name: string
} | null> {
  const response = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!response.ok) return null
  return response.json()
}
