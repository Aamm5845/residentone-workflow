import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { createLinkToken } from '@/lib/plaid-service'

export async function POST() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER can access financial features
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { linkToken } = await createLinkToken(session.user.id, session.user.orgId)

    return NextResponse.json({ linkToken })
  } catch (error: any) {
    console.error('Create link token error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    )
  }
}
