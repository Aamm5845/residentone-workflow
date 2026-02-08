import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPlaidClient } from '@/lib/plaid'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OWNER only
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, orgId: true },
    })

    if (user?.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can connect bank accounts' }, { status: 403 })
    }

    if (!user.orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const body = await request.json()
    const { publicToken, institutionId, institutionName } = body

    if (!publicToken) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 })
    }

    const client = getPlaidClient()

    // Exchange public token for access token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: publicToken,
    })

    const accessToken = exchangeResponse.data.access_token
    const itemId = exchangeResponse.data.item_id

    // Get accounts
    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    })

    const accounts = accountsResponse.data.accounts.map((a) => ({
      accountId: a.account_id,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
    }))

    // Store in database (upsert in case reconnecting same institution)
    const connection = await prisma.plaidConnection.upsert({
      where: {
        orgId_itemId: {
          orgId: user.orgId,
          itemId,
        },
      },
      create: {
        orgId: user.orgId,
        accessToken,
        itemId,
        institutionId: institutionId || null,
        institutionName: institutionName || null,
        accounts,
        connectedById: session.user.id,
      },
      update: {
        accessToken,
        accounts,
        institutionId: institutionId || undefined,
        institutionName: institutionName || undefined,
        status: 'ACTIVE',
      },
    })

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      institutionName: connection.institutionName,
      accounts,
    })
  } catch (error) {
    console.error('Error exchanging Plaid token:', error)
    return NextResponse.json({ error: 'Failed to connect bank account' }, { status: 500 })
  }
}
