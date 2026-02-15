import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Helper to get user from API key or session (same pattern as /api/extension/projects)
async function getAuthenticatedUser(request: NextRequest) {
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
      return token.createdBy
    }
  }

  // Fall back to session
  const session = await getSession()
  if (!session?.user?.email) return null

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

// GET: Get organization members for the assignee dropdown
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    const members = await prisma.user.findMany({
      where: {
        orgId: user.orgId,
        approvalStatus: 'APPROVED'
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ ok: true, members })
  } catch (error) {
    console.error('Extension members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
