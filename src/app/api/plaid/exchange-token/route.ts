import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { exchangePublicToken, getAccounts, getInstitution } from '@/lib/plaid-service'
import { prisma } from '@/lib/prisma'

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

    const { publicToken, institutionId } = await request.json()

    if (!publicToken) {
      return NextResponse.json({ error: 'Public token is required' }, { status: 400 })
    }

    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken)

    // Get institution details
    let institutionName = null
    if (institutionId) {
      const institution = await getInstitution(institutionId)
      institutionName = institution?.name
    }

    // Get accounts for this item
    const { accounts } = await getAccounts(accessToken)

    // Store the Plaid item in database
    const plaidItem = await prisma.plaidItem.create({
      data: {
        orgId: session.user.orgId,
        itemId,
        accessToken, // In production, encrypt this!
        institutionId,
        institutionName,
        status: 'ACTIVE',
        lastSyncedAt: new Date(),
      },
    })

    // Store the bank accounts
    const bankAccounts = await Promise.all(
      accounts.map(async (account) => {
        return prisma.bankAccount.create({
          data: {
            plaidItemId: plaidItem.id,
            accountId: account.account_id,
            name: account.name,
            officialName: account.official_name,
            type: account.type,
            subtype: account.subtype || null,
            mask: account.mask,
            currentBalance: account.balances.current,
            availableBalance: account.balances.available,
            isoCurrencyCode: account.balances.iso_currency_code || 'CAD',
            lastBalanceUpdate: new Date(),
          },
        })
      })
    )

    return NextResponse.json({
      success: true,
      plaidItem: {
        id: plaidItem.id,
        institutionName: plaidItem.institutionName,
      },
      accounts: bankAccounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        mask: acc.mask,
      })),
    })
  } catch (error: any) {
    console.error('Exchange token error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to connect bank account' },
      { status: 500 }
    )
  }
}
