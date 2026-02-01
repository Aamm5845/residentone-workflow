import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - List all monthly bills
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'PERSONAL' or 'BUSINESS'

    const bills = await prisma.monthlyBill.findMany({
      where: {
        orgId: session.user.orgId,
        isActive: true,
        ...(type && { type: type as 'PERSONAL' | 'BUSINESS' }),
      },
      orderBy: [
        { type: 'asc' },
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    })

    // Calculate next due date for each bill
    const now = new Date()
    const currentDay = now.getDate()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const billsWithDates = bills.map((bill) => {
      let nextDueDate: Date | null = null
      let daysUntilDue: number | null = null
      let monthlyAmount = Number(bill.amount)

      // Calculate monthly equivalent for different frequencies
      if (bill.frequency === 'WEEKLY') {
        monthlyAmount = Number(bill.amount) * 4.33
      } else if (bill.frequency === 'BIWEEKLY') {
        monthlyAmount = Number(bill.amount) * 2.17
      } else if (bill.frequency === 'YEARLY') {
        monthlyAmount = Number(bill.amount) / 12
      } else if (bill.frequency === 'QUARTERLY') {
        monthlyAmount = Number(bill.amount) / 3
      }

      if (bill.dueDay && !bill.isVariable) {
        nextDueDate = new Date(currentYear, currentMonth, bill.dueDay)

        // Handle yearly bills
        if (bill.frequency === 'YEARLY' && bill.yearlyMonth) {
          nextDueDate = new Date(currentYear, bill.yearlyMonth - 1, bill.dueDay)
          if (nextDueDate < now) {
            nextDueDate = new Date(currentYear + 1, bill.yearlyMonth - 1, bill.dueDay)
          }
        } else if (bill.dueDay < currentDay) {
          // If the due day has passed this month, move to next occurrence
          if (bill.frequency === 'BIWEEKLY') {
            // For biweekly, add 14 days from today
            nextDueDate = new Date(now)
            nextDueDate.setDate(nextDueDate.getDate() + 14 - ((currentDay - bill.dueDay) % 14))
          } else {
            nextDueDate = new Date(currentYear, currentMonth + 1, bill.dueDay)
          }
        }

        // Handle months with fewer days
        if (nextDueDate.getDate() !== bill.dueDay) {
          nextDueDate = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0)
        }

        daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      }

      return {
        ...bill,
        amount: Number(bill.amount),
        monthlyAmount,
        averageAmount: bill.averageAmount ? Number(bill.averageAmount) : null,
        lastPaidAmount: bill.lastPaidAmount ? Number(bill.lastPaidAmount) : null,
        nextDueDate,
        daysUntilDue,
        isOverdue: daysUntilDue !== null && daysUntilDue < 0,
      }
    })

    // Group by type, then by category
    const personal = billsWithDates.filter((b) => b.type === 'PERSONAL')
    const business = billsWithDates.filter((b) => b.type === 'BUSINESS')

    // Calculate totals
    const calculateTotals = (bills: typeof billsWithDates) => {
      const recurring = bills.filter((b) => !b.isVariable)
      const variable = bills.filter((b) => b.isVariable)

      return {
        recurringTotal: recurring.reduce((sum, b) => sum + b.monthlyAmount, 0),
        variableTotal: variable.reduce((sum, b) => sum + (b.averageAmount || b.monthlyAmount), 0),
        total: bills.reduce((sum, b) => sum + (b.isVariable ? (b.averageAmount || b.monthlyAmount) : b.monthlyAmount), 0),
        count: bills.length,
      }
    }

    return NextResponse.json({
      bills: billsWithDates,
      personal: {
        bills: personal,
        ...calculateTotals(personal),
      },
      business: {
        bills: business,
        ...calculateTotals(business),
      },
      summary: {
        totalMonthly: calculateTotals(billsWithDates).total,
        personalTotal: calculateTotals(personal).total,
        businessTotal: calculateTotals(business).total,
        overdueCount: billsWithDates.filter((b) => b.isOverdue).length,
        dueSoonCount: billsWithDates.filter((b) => !b.isOverdue && b.daysUntilDue !== null && b.daysUntilDue <= 7).length,
      },
    })
  } catch (error: any) {
    console.error('Monthly bills error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch monthly bills' },
      { status: 500 }
    )
  }
}

// POST - Create a new monthly bill
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
      type = 'PERSONAL',
      category,
      subCategory,
      dueDay,
      frequency = 'MONTHLY',
      yearlyMonth,
      isVariable = false,
      averageAmount,
      description,
      payeeName,
      accountNumber,
      paymentUrl,
      isAutoPay = false,
      source = 'MANUAL',
      screenshotUrl,
    } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      )
    }

    if (!isVariable && !amount) {
      return NextResponse.json(
        { error: 'Amount is required for recurring bills' },
        { status: 400 }
      )
    }

    const bill = await prisma.monthlyBill.create({
      data: {
        orgId: session.user.orgId,
        name,
        amount: amount || 0,
        type,
        category,
        subCategory,
        dueDay: dueDay ? Math.min(31, Math.max(1, parseInt(dueDay))) : null,
        frequency,
        yearlyMonth: yearlyMonth ? Math.min(12, Math.max(1, parseInt(yearlyMonth))) : null,
        isVariable,
        averageAmount: averageAmount || null,
        description,
        payeeName,
        accountNumber,
        paymentUrl,
        isAutoPay,
        source,
        screenshotUrl,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ bill })
  } catch (error: any) {
    console.error('Create monthly bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create monthly bill' },
      { status: 500 }
    )
  }
}
