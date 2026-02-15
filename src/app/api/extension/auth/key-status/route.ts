import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: Check if the current user has an active extension API key
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find active extension key for this user
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        createdById: user.id,
        name: { startsWith: 'Extension:' },
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      select: {
        token: true,
        createdAt: true,
      }
    })

    if (!token) {
      return NextResponse.json({ hasKey: false })
    }

    // Mask the key: show first 6 + •••••••• + last 4
    const key = token.token
    const masked = key.length > 10
      ? key.slice(0, 6) + '••••••••' + key.slice(-4)
      : '••••••••••••'

    return NextResponse.json({
      hasKey: true,
      maskedKey: masked,
      createdAt: token.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Key status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
