import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPlaidClient } from '@/lib/plaid'
import { Products, CountryCode } from 'plaid'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OWNER only for connecting bank
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

    const client = getPlaidClient()

    const response = await client.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: 'StudioFlow',
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca],
      language: 'en',
    })

    return NextResponse.json({ linkToken: response.data.link_token })
  } catch (error) {
    console.error('Error creating Plaid link token:', error)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
