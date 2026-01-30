import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Update account settings (e.g., mark as business)
export async function PATCH(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { accountId, isBusiness } = await request.json()

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    // Verify account belongs to user's org
    const account = await prisma.bankAccount.findFirst({
      where: {
        id: accountId,
        plaidItem: {
          orgId: session.user.orgId,
        },
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Update account
    const updated = await prisma.bankAccount.update({
      where: { id: accountId },
      data: { isBusiness: isBusiness ?? false },
    })

    return NextResponse.json({
      success: true,
      account: {
        id: updated.id,
        isBusiness: updated.isBusiness,
      },
    })
  } catch (error: any) {
    console.error('Account settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update account' },
      { status: 500 }
    )
  }
}
