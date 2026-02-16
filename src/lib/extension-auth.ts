import { NextRequest } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * Authenticate a request via Extension API Key or session.
 * Returns the user object or null if unauthenticated.
 * Used by both extension endpoints and timeline endpoints
 * so the desktop timer app can use the same X-Extension-Key auth.
 */
export async function getAuthenticatedUser(request: NextRequest) {
  // First try API key from header
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

  // Fall back to session auth
  const session = await getSession() as any

  if (!session?.user?.id) {
    // Try by email
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
