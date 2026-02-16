import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/extension-auth'

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
