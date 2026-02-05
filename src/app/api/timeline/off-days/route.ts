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
 * Add an off day for a user. Admins/Owners can add for any user.
 *
 * Body:
 * - date: The date (YYYY-MM-DD)
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
    const { date, reason = 'VACATION', notes, userId } = body

    if (!date) {
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

    // Parse date and set to midnight UTC
    const offDate = new Date(date)
    offDate.setUTCHours(0, 0, 0, 0)

    // Check if off day already exists
    const existing = await prisma.userOffDay.findUnique({
      where: {
        userId_date: {
          userId: targetUserId,
          date: offDate
        }
      }
    })

    if (existing) {
      // Update existing
      const updated = await prisma.userOffDay.update({
        where: { id: existing.id },
        data: {
          reason: reason as any,
          notes
        },
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Off day updated',
        offDay: {
          id: updated.id,
          userId: updated.userId,
          userName: updated.user.name,
          date: updated.date.toISOString().split('T')[0],
          reason: updated.reason,
          notes: updated.notes
        }
      })
    }

    // Create new off day
    const offDay = await prisma.userOffDay.create({
      data: {
        userId: targetUserId,
        date: offDate,
        reason: reason as any,
        notes
      },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Off day added',
      offDay: {
        id: offDay.id,
        userId: offDay.userId,
        userName: offDay.user.name,
        date: offDay.date.toISOString().split('T')[0],
        reason: offDay.reason,
        notes: offDay.notes
      }
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
