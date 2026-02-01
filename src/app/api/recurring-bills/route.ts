import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - List all recurring bills
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const bills = await prisma.recurringBill.findMany({
      where: {
        orgId: session.user.orgId,
        isActive: true,
      },
      orderBy: [
        { category: 'asc' },
        { dueDay: 'asc' },
      ],
    })

    // Calculate next due date for each bill
    const now = new Date()
    const currentDay = now.getDate()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const billsWithDates = bills.map((bill) => {
      let nextDueDate = new Date(currentYear, currentMonth, bill.dueDay)

      // If the due day has passed this month, move to next month
      if (bill.dueDay < currentDay) {
        nextDueDate = new Date(currentYear, currentMonth + 1, bill.dueDay)
      }

      // Handle months with fewer days
      if (nextDueDate.getDate() !== bill.dueDay) {
        nextDueDate = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0)
      }

      const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const isOverdue = daysUntilDue < 0

      return {
        ...bill,
        amount: Number(bill.amount),
        lastPaidAmount: bill.lastPaidAmount ? Number(bill.lastPaidAmount) : null,
        nextDueDate,
        daysUntilDue,
        isOverdue,
      }
    })

    // Group by category
    const byCategory: Record<string, typeof billsWithDates> = {}
    for (const bill of billsWithDates) {
      if (!byCategory[bill.category]) {
        byCategory[bill.category] = []
      }
      byCategory[bill.category].push(bill)
    }

    // Calculate totals
    const totalMonthly = billsWithDates.reduce((sum, bill) => {
      if (bill.frequency === 'MONTHLY') return sum + bill.amount
      if (bill.frequency === 'WEEKLY') return sum + bill.amount * 4
      if (bill.frequency === 'BIWEEKLY') return sum + bill.amount * 2
      if (bill.frequency === 'QUARTERLY') return sum + bill.amount / 3
      if (bill.frequency === 'YEARLY') return sum + bill.amount / 12
      return sum + bill.amount
    }, 0)

    return NextResponse.json({
      bills: billsWithDates,
      byCategory,
      summary: {
        totalBills: bills.length,
        totalMonthly,
        overdueCount: billsWithDates.filter((b) => b.isOverdue).length,
        dueSoonCount: billsWithDates.filter((b) => !b.isOverdue && b.daysUntilDue <= 7).length,
      },
    })
  } catch (error: any) {
    console.error('Recurring bills error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recurring bills' },
      { status: 500 }
    )
  }
}

// POST - Create a new recurring bill
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      amount,
      category,
      dueDay,
      frequency = 'MONTHLY',
      description,
      payeeName,
      accountNumber,
      paymentUrl,
      isAutoPay = false,
    } = body

    if (!name || !amount || !category || !dueDay) {
      return NextResponse.json(
        { error: 'Name, amount, category, and due day are required' },
        { status: 400 }
      )
    }

    const bill = await prisma.recurringBill.create({
      data: {
        orgId: session.user.orgId,
        name,
        amount,
        category,
        dueDay: Math.min(31, Math.max(1, parseInt(dueDay))),
        frequency,
        description,
        payeeName,
        accountNumber,
        paymentUrl,
        isAutoPay,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ bill })
  } catch (error: any) {
    console.error('Create recurring bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create recurring bill' },
      { status: 500 }
    )
  }
}
