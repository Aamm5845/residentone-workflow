import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens, getZoomUserInfo } from '@/lib/zoom'
import { encrypt } from '@/lib/encryption'

/**
 * GET /api/integrations/zoom/callback
 * Handles the Zoom OAuth redirect after user authorizes.
 * Exchanges the authorization code for tokens, fetches user info,
 * stores encrypted tokens in ZoomIntegration, and redirects to settings.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.orgId) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle user denying access on Zoom
  if (error) {
    console.warn('Zoom OAuth denied:', error)
    return NextResponse.redirect(
      new URL('/settings/integrations?zoom=denied', req.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/integrations?zoom=error', req.url)
    )
  }

  // Validate state parameter to prevent CSRF
  try {
    const decoded = JSON.parse(
      Buffer.from(state || '', 'base64url').toString()
    )
    if (decoded.orgId !== session.user.orgId) {
      console.error('Zoom OAuth state mismatch:', decoded.orgId, '!==', session.user.orgId)
      return NextResponse.redirect(
        new URL('/settings/integrations?zoom=error', req.url)
      )
    }
  } catch {
    console.error('Zoom OAuth state parse error')
    return NextResponse.redirect(
      new URL('/settings/integrations?zoom=error', req.url)
    )
  }

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Fetch Zoom user info for display purposes
    const zoomUser = await getZoomUserInfo(tokens.access_token)

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Upsert: create new or update existing Zoom integration for this org
    await prisma.zoomIntegration.upsert({
      where: { orgId: session.user.orgId },
      create: {
        orgId: session.user.orgId,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        zoomAccountId: zoomUser?.id || null,
        zoomEmail: zoomUser?.email || null,
        scopes: tokens.scope || null,
        connectedById: session.user.id,
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        zoomAccountId: zoomUser?.id || null,
        zoomEmail: zoomUser?.email || null,
        scopes: tokens.scope || null,
        status: 'ACTIVE',
        connectedById: session.user.id,
      },
    })

    return NextResponse.redirect(
      new URL('/settings/integrations?zoom=connected', req.url)
    )
  } catch (err) {
    console.error('Zoom OAuth callback error:', err)
    return NextResponse.redirect(
      new URL('/settings/integrations?zoom=error', req.url)
    )
  }
}
