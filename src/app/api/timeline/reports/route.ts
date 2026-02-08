import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/timeline/reports
 * Get aggregated time reports
 * Query params:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * - userId: filter by specific user (optional, owner/admin only for others)
 * - projectId: filter by project (optional)
 * - groupBy: 'day' | 'week' | 'project' | 'user' (default: 'day')
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')
    const projectId = searchParams.get('projectId')
    const groupBy = searchParams.get('groupBy') || 'day'

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(session.user.role || '')

    // Build where clause
    const where: any = {
      status: 'STOPPED', // Only count completed entries
      startTime: {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z')
      }
    }

    // User filter
    if (userId) {
      // Non-admins can only see their own data
      if (!isOwnerOrAdmin && userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      where.userId = userId
    } else if (!isOwnerOrAdmin) {
      // Non-admins default to their own data
      where.userId = session.user.id
    } else {
      // Admins see all org users
      const orgUsers = await prisma.user.findMany({
        where: { orgId: session.user.orgId },
        select: { id: true }
      })
      where.userId = { in: orgUsers.map(u => u.id) }
    }

    if (projectId) {
      where.projectId = projectId
    }

    // Fetch all matching entries
    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } }
      },
      orderBy: { startTime: 'asc' }
    })

    // Calculate totals
    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
    const totalEntries = entries.length

    // Calculate billed/unbilled hours
    const billedMinutes = entries
      .filter(e => e.isBillable && e.billedStatus === 'BILLED')
      .reduce((sum, e) => sum + (e.duration || 0), 0)
    const unbilledMinutes = entries
      .filter(e => e.isBillable && e.billedStatus === 'UNBILLED')
      .reduce((sum, e) => sum + (e.duration || 0), 0)

    // Group data based on groupBy parameter
    let grouped: any = {}

    if (groupBy === 'day') {
      grouped = groupByDay(entries)
    } else if (groupBy === 'week') {
      grouped = groupByWeek(entries)
    } else if (groupBy === 'project') {
      grouped = groupByProject(entries)
    } else if (groupBy === 'user') {
      grouped = groupByUser(entries)
    }

    // Get summary by user
    const byUser = groupByUser(entries)

    // Get summary by project
    const byProject = groupByProject(entries)

    return NextResponse.json({
      summary: {
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        totalEntries,
        billedHours: Math.round((billedMinutes / 60) * 100) / 100,
        unbilledHours: Math.round((unbilledMinutes / 60) * 100) / 100,
        startDate,
        endDate
      },
      grouped,
      byUser: Object.values(byUser),
      byProject: Object.values(byProject),
      entries: entries.map(e => ({
        ...e,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString()
      }))
    })

  } catch (error) {
    console.error('Error generating time reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function groupByDay(entries: any[]) {
  const grouped: Record<string, { date: string; totalMinutes: number; entries: number }> = {}
  
  entries.forEach(entry => {
    const date = entry.startTime.toISOString().split('T')[0]
    if (!grouped[date]) {
      grouped[date] = { date, totalMinutes: 0, entries: 0 }
    }
    grouped[date].totalMinutes += entry.duration || 0
    grouped[date].entries += 1
  })

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
}

function groupByWeek(entries: any[]) {
  const grouped: Record<string, { weekStart: string; totalMinutes: number; entries: number }> = {}
  
  entries.forEach(entry => {
    const date = new Date(entry.startTime)
    const day = date.getDay()
    const diff = date.getDate() - day // Get Sunday
    const weekStart = new Date(date.setDate(diff)).toISOString().split('T')[0]
    
    if (!grouped[weekStart]) {
      grouped[weekStart] = { weekStart, totalMinutes: 0, entries: 0 }
    }
    grouped[weekStart].totalMinutes += entry.duration || 0
    grouped[weekStart].entries += 1
  })

  return Object.values(grouped).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function groupByProject(entries: any[]) {
  const grouped: Record<string, { 
    projectId: string | null
    projectName: string
    totalMinutes: number
    entries: number 
  }> = {}
  
  entries.forEach(entry => {
    const projectId = entry.projectId || 'no-project'
    const projectName = entry.project?.name || 'No Project'
    
    if (!grouped[projectId]) {
      grouped[projectId] = { 
        projectId: entry.projectId, 
        projectName, 
        totalMinutes: 0, 
        entries: 0 
      }
    }
    grouped[projectId].totalMinutes += entry.duration || 0
    grouped[projectId].entries += 1
  })

  return grouped
}

function groupByUser(entries: any[]) {
  const grouped: Record<string, { 
    userId: string
    userName: string
    userImage: string | null
    userRole: string
    totalMinutes: number
    entries: number 
  }> = {}
  
  entries.forEach(entry => {
    const userId = entry.userId
    
    if (!grouped[userId]) {
      grouped[userId] = { 
        userId,
        userName: entry.user?.name || 'Unknown',
        userImage: entry.user?.image || null,
        userRole: entry.user?.role || 'VIEWER',
        totalMinutes: 0, 
        entries: 0 
      }
    }
    grouped[userId].totalMinutes += entry.duration || 0
    grouped[userId].entries += 1
  })

  return grouped
}
