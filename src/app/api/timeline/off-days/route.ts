import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/timeline/off-days
 *
 * Get off days for a user. Admins/Owners can view any user's off days.
 *
 * Query params:
 * - userId: (optional) User ID to get off days for (admin only)
 * - startDate: (optional) Start of date range
 * - endDate: (optional) End of date range
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let targetUserId = searchParams.get('userId') || session.user.id
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Only admins/owners can view other users' off days
    if (targetUserId !== session.user.id) {
      const isAdmin = ['OWNER', 'ADMIN'].includes(session.user.role)
      if (!isAdmin) {
        targetUserId = session.user.id
      }
    }

    const whereClause: any = {
      userId: targetUserId
    }

    if (startDate || endDate) {
      whereClause.date = {}
      if (startDate) {
        whereClause.date.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.date.lte = new Date(endDate)
      }
    }

    const offDays = await prisma.userOffDay.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      offDays: offDays.map(od => ({
        id: od.id,
        userId: od.userId,
        userName: od.user.name,
        userEmail: od.user.email,
        date: od.date.toISOString().split('T')[0],
        reason: od.reason,
        notes: od.notes,
        createdAt: od.createdAt
      }))
    })
  } catch (error) {
    console.error('Error fetching off days:', error)
    return NextResponse.json(
      { error: 'Failed to fetch off days' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/timeline/off-days
 *
 * Add off day(s) for a user. Admins/Owners can add for any user.
 * Supports single date or date range (weekdays only).
 *
 * Body:
 * - date: Single date (YYYY-MM-DD) — legacy/backward-compatible
 * - fromDate: Range start (YYYY-MM-DD)
 * - toDate: Range end (YYYY-MM-DD)
 * - reason: VACATION | SICK | PERSONAL | HOLIDAY | OTHER
 * - notes: (optional) Additional notes
 * - userId: (optional) User ID to add off day for (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, fromDate, toDate, reason = 'VACATION', notes, userId } = body

    // Support both legacy single-date and new range format
    const rangeStart = fromDate || date
    const rangeEnd = toDate || date

    if (!rangeStart) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      )
    }

    // Determine target user
    let targetUserId = session.user.id
    if (userId && userId !== session.user.id) {
      const isAdmin = ['OWNER', 'ADMIN'].includes(session.user.role)
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only admins can add off days for other users' },
          { status: 403 }
        )
      }
      targetUserId = userId
    }

    // Validate reason
    const validReasons = ['VACATION', 'SICK', 'PERSONAL', 'HOLIDAY', 'OTHER']
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      )
    }

    // Build list of weekday dates in range
    const dates: Date[] = []
    const start = new Date(rangeStart + 'T00:00:00Z')
    const end = new Date((rangeEnd || rangeStart) + 'T00:00:00Z')

    if (end < start) {
      return NextResponse.json(
        { error: '"To" date cannot be before "From" date' },
        { status: 400 }
      )
    }

    // Safety: max 60 days range to prevent abuse
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 60) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 60 days' },
        { status: 400 }
      )
    }

    const cursor = new Date(start)
    while (cursor <= end) {
      const dow = cursor.getUTCDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dow !== 0 && dow !== 6) {
        dates.push(new Date(cursor))
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    if (dates.length === 0) {
      return NextResponse.json(
        { error: 'No weekdays in the selected range' },
        { status: 400 }
      )
    }

    // Upsert each date (create or update)
    let created = 0
    let updated = 0

    for (const offDate of dates) {
      const existing = await prisma.userOffDay.findUnique({
        where: {
          userId_date: {
            userId: targetUserId,
            date: offDate,
          },
        },
      })

      if (existing) {
        await prisma.userOffDay.update({
          where: { id: existing.id },
          data: { reason: reason as any, notes },
        })
        updated++
      } else {
        await prisma.userOffDay.create({
          data: {
            userId: targetUserId,
            date: offDate,
            reason: reason as any,
            notes,
          },
        })
        created++
      }
    }

    return NextResponse.json({
      success: true,
      message:
        dates.length === 1
          ? 'Off day added'
          : `${created} off day${created !== 1 ? 's' : ''} added${updated > 0 ? `, ${updated} updated` : ''}`,
      count: dates.length,
      created,
      updated,
    })
  } catch (error) {
    console.error('Error adding off day:', error)
    return NextResponse.json(
      { error: 'Failed to add off day' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/timeline/off-days
 *
 * Remove an off day. Admins/Owners can remove any user's off days.
 *
 * Query params:
 * - id: The off day ID to delete
 * OR
 * - date: The date to remove (YYYY-MM-DD)
 * - userId: (optional) User ID (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const date = searchParams.get('date')
    const userId = searchParams.get('userId')

    if (!id && !date) {
      return NextResponse.json(
        { error: 'Either id or date is required' },
        { status: 400 }
      )
    }

    const isAdmin = ['OWNER', 'ADMIN'].includes(session.user.role)

    if (id) {
      // Delete by ID
      const offDay = await prisma.userOffDay.findUnique({
        where: { id }
      })

      if (!offDay) {
        return NextResponse.json(
          { error: 'Off day not found' },
          { status: 404 }
        )
      }

      // Check permission
      if (offDay.userId !== session.user.id && !isAdmin) {
        return NextResponse.json(
          { error: 'Not authorized to delete this off day' },
          { status: 403 }
        )
      }

      await prisma.userOffDay.delete({ where: { id } })
    } else if (date) {
      // Delete by date
      const targetUserId = (userId && isAdmin) ? userId : session.user.id
      const offDate = new Date(date)
      offDate.setUTCHours(0, 0, 0, 0)

      await prisma.userOffDay.deleteMany({
        where: {
          userId: targetUserId,
          date: offDate
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Off day removed'
    })
  } catch (error) {
    console.error('Error removing off day:', error)
    return NextResponse.json(
      { error: 'Failed to remove off day' },
      { status: 500 }
    )
  }
}
