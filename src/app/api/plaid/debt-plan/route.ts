import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateDebtPayoffPlan } from '@/lib/openai-service'

// GET - Generate debt payoff plan based on credit card balances
export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const monthlyBudget = parseFloat(searchParams.get('budget') || '500')

    // Get all credit accounts with balances
    const accounts = await prisma.bankAccount.findMany({
      where: {
        plaidItem: {
          orgId: session.user.orgId,
        },
        type: 'credit',
      },
      select: {
        id: true,
        name: true,
        currentBalance: true,
        officialName: true,
      },
    })

    // Filter accounts with positive balances (debt)
    const debts = accounts
      .filter(a => a.currentBalance && Number(a.currentBalance) > 0)
      .map(a => ({
        name: a.officialName || a.name,
        balance: Number(a.currentBalance),
        interestRate: undefined, // Plaid doesn't provide APR
        minimumPayment: undefined,
      }))

    if (debts.length === 0) {
      return NextResponse.json({
        hasDebt: false,
        message: 'No credit card debt found. Great job!',
        plan: null,
      })
    }

    const plan = await generateDebtPayoffPlan(debts, monthlyBudget)

    return NextResponse.json({
      hasDebt: true,
      plan,
    })
  } catch (error: any) {
    console.error('Debt plan error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate debt plan' },
      { status: 500 }
    )
  }
}
