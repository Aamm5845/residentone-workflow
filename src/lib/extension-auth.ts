import { NextRequest } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
)

/**
 * Authenticate a request via:
 *   1. Bearer JWT token (from /api/auth/mobile-login — used by desktop timer)
 *   2. Extension API Key (X-Extension-Key header — used by Chrome extension, Gmail add-on)
 *   3. Session cookie (used by the web app)
 *
 * Returns the user object or null if unauthenticated.
 */
export async function getAuthenticatedUser(request: NextRequest) {
  // 1. Try Bearer token (JWT from mobile-login)
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const { payload } = await jwtVerify(token, JWT_SECRET)
      const userId = payload.userId as string

      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, orgId: true, role: true }
        })
        if (user) return user
      }
    } catch {
      // Token invalid/expired — fall through to other methods
    }
  }

  // 2. Try API key from header
  const apiKey = request.headers.get('X-Extension-Key')

  if (apiKey) {
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        token: apiKey,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            orgId: true,
            role: true
          }
        }
      }
    })

    if (token?.createdBy) {
      return {
        id: token.createdBy.id,
        name: token.createdBy.name,
        email: token.createdBy.email,
        orgId: token.createdBy.orgId,
        role: token.createdBy.role,
      }
    }
  }

  // 3. Fall back to session auth
  const session = await getSession() as any

  if (!session?.user?.id) {
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          name: true,
          email: true,
          orgId: true,
          role: true
        }
      })
      return user
    }
    return null
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    orgId: session.user.orgId,
    role: session.user.role,
  }
}
