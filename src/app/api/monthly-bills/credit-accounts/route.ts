import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get all credit-type accounts from Plaid (credit cards and lines of credit)
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    // Get all credit-type accounts
    const accounts = await prisma.bankAccount.findMany({
      where: {
        plaidItem: {
          orgId: session.user.orgId,
          status: 'ACTIVE',
        },
        isActive: true,
        type: 'credit', // Credit cards and lines of credit
      },
      include: {
        plaidItem: {
          select: {
            institutionName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Also get loan-type accounts (some LOCs might be here)
    const loanAccounts = await prisma.bankAccount.findMany({
      where: {
        plaidItem: {
          orgId: session.user.orgId,
          status: 'ACTIVE',
        },
        isActive: true,
        type: 'loan',
      },
      include: {
        plaidItem: {
          select: {
            institutionName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const allAccounts = [...accounts, ...loanAccounts]

    // Format response
    const creditAccounts = allAccounts.map((acc) => ({
      id: acc.id,
      accountId: acc.accountId,
      name: acc.name,
      officialName: acc.officialName,
      type: acc.type,
      subtype: acc.subtype, // 'credit card', 'line of credit', etc.
      mask: acc.mask,
      currentBalance: Number(acc.currentBalance || 0),
      institutionName: acc.plaidItem.institutionName,
      lastUpdated: acc.lastBalanceUpdate,
    }))

    // Separate by subtype
    const creditCards = creditAccounts.filter(a =>
      a.subtype?.toLowerCase().includes('credit') &&
      !a.subtype?.toLowerCase().includes('line')
    )

    const linesOfCredit = creditAccounts.filter(a =>
      a.subtype?.toLowerCase().includes('line') ||
      a.type === 'loan'
    )

    return NextResponse.json({
      creditCards,
      linesOfCredit,
      all: creditAccounts,
    })
  } catch (error: any) {
    console.error('Get credit accounts error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get credit accounts' },
      { status: 500 }
    )
  }
}
