import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getBalances } from '@/lib/plaid-service'

// GET - List all connected bank accounts
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER can access financial features
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    // Get all Plaid items for this organization
    const plaidItems = await prisma.plaidItem.findMany({
      where: {
        orgId: session.user.orgId,
        status: 'ACTIVE',
      },
      include: {
        bankAccounts: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format response
    const connectedBanks = plaidItems.map((item) => ({
      id: item.id,
      institutionName: item.institutionName || 'Unknown Bank',
      institutionId: item.institutionId,
      status: item.status,
      lastSynced: item.lastSyncedAt,
      accounts: item.bankAccounts.map((acc) => ({
        id: acc.id,
        accountId: acc.accountId, // Plaid account ID for fetching transactions
        name: acc.name,
        officialName: acc.officialName,
        type: acc.type,
        subtype: acc.subtype,
        mask: acc.mask,
        currentBalance: acc.currentBalance,
        availableBalance: acc.availableBalance,
        currency: acc.isoCurrencyCode,
        lastUpdated: acc.lastBalanceUpdate,
      })),
    }))

    return NextResponse.json({ banks: connectedBanks })
  } catch (error: any) {
    console.error('Get accounts error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get accounts' },
      { status: 500 }
    )
  }
}

// POST - Refresh balances for all accounts
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

    // Get all active Plaid items
    const plaidItems = await prisma.plaidItem.findMany({
      where: {
        orgId: session.user.orgId,
        status: 'ACTIVE',
      },
    })

    let updatedCount = 0

    for (const item of plaidItems) {
      try {
        const { accounts } = await getBalances(item.accessToken)

        for (const account of accounts) {
          await prisma.bankAccount.updateMany({
            where: { accountId: account.account_id },
            data: {
              currentBalance: account.balances.current,
              availableBalance: account.balances.available,
              lastBalanceUpdate: new Date(),
            },
          })
          updatedCount++
        }

        // Update last synced time
        await prisma.plaidItem.update({
          where: { id: item.id },
          data: { lastSyncedAt: new Date() },
        })
      } catch (error) {
        console.error(`Failed to refresh balances for item ${item.id}:`, error)
        // Continue with other items
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} accounts`,
    })
  } catch (error: any) {
    console.error('Refresh balances error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to refresh balances' },
      { status: 500 }
    )
  }
}
