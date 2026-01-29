import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { removeItem } from '@/lib/plaid-service'

export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER can access financial features
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { plaidItemId } = await request.json()

    if (!plaidItemId) {
      return NextResponse.json({ error: 'Plaid item ID is required' }, { status: 400 })
    }

    // Get the Plaid item
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        id: plaidItemId,
        orgId: session.user.orgId,
      },
    })

    if (!plaidItem) {
      return NextResponse.json({ error: 'Bank connection not found' }, { status: 404 })
    }

    // Remove from Plaid
    try {
      await removeItem(plaidItem.accessToken)
    } catch (error) {
      console.error('Plaid remove item error:', error)
      // Continue with local deletion even if Plaid fails
    }

    // Update status to disconnected (soft delete)
    await prisma.plaidItem.update({
      where: { id: plaidItemId },
      data: { status: 'DISCONNECTED' },
    })

    // Deactivate all associated bank accounts
    await prisma.bankAccount.updateMany({
      where: { plaidItemId },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Bank disconnected successfully',
    })
  } catch (error: any) {
    console.error('Disconnect bank error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect bank' },
      { status: 500 }
    )
  }
}
