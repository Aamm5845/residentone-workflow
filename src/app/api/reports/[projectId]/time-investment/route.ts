import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { projectId } = resolvedParams

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: {
          users: {
            some: { id: session.user.id }
          }
        }
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        status: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all time entries for this project
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        projectId: projectId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    })

    // Calculate project duration (from creation to now)
    const projectStartDate = project.createdAt
    const now = new Date()
    const durationDays = Math.floor((now.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
    const durationWeeks = Math.floor(durationDays / 7)
    const durationMonths = Math.floor(durationDays / 30)

    // Calculate total hours
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.duration, 0)
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100

    // Calculate billed/unbilled hours
    const billedMinutes = timeEntries
      .filter(e => e.isBillable && e.billedStatus === 'BILLED')
      .reduce((sum, e) => sum + (e.duration || 0), 0)
    const unbilledMinutes = timeEntries
      .filter(e => e.isBillable && e.billedStatus === 'UNBILLED')
      .reduce((sum, e) => sum + (e.duration || 0), 0)

    // Calculate hours by team member
    const hoursByMember: Record<string, {
      userId: string
      userName: string
      userEmail: string
      userImage: string | null
      userRole: string
      totalMinutes: number
      totalHours: number
      entryCount: number
      lastEntry: Date | null
      phases: Record<string, number>
    }> = {}

    timeEntries.forEach(entry => {
      if (!hoursByMember[entry.userId]) {
        hoursByMember[entry.userId] = {
          userId: entry.userId,
          userName: entry.user.name || 'Unknown',
          userEmail: entry.user.email,
          userImage: entry.user.image,
          userRole: entry.user.role,
          totalMinutes: 0,
          totalHours: 0,
          entryCount: 0,
          lastEntry: null,
          phases: {}
        }
      }
      
      hoursByMember[entry.userId].totalMinutes += entry.duration
      hoursByMember[entry.userId].totalHours = Math.round((hoursByMember[entry.userId].totalMinutes / 60) * 100) / 100
      hoursByMember[entry.userId].entryCount += 1
      
      if (!hoursByMember[entry.userId].lastEntry || entry.startTime > hoursByMember[entry.userId].lastEntry!) {
        hoursByMember[entry.userId].lastEntry = entry.startTime
      }

      // Track by phase if available
      if (entry.stageType) {
        if (!hoursByMember[entry.userId].phases[entry.stageType]) {
          hoursByMember[entry.userId].phases[entry.stageType] = 0
        }
        hoursByMember[entry.userId].phases[entry.stageType] += entry.duration
      }
    })

    // Calculate hours by week (last 12 weeks)
    const hoursByWeek: { week: string; hours: number; entries: number }[] = []
    const twelveWeeksAgo = new Date()
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)

    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(twelveWeeksAgo)
      weekStart.setDate(weekStart.getDate() + (i * 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekEntries = timeEntries.filter(entry => {
        const entryDate = new Date(entry.startTime)
        return entryDate >= weekStart && entryDate < weekEnd
      })

      const weekMinutes = weekEntries.reduce((sum, e) => sum + e.duration, 0)
      
      hoursByWeek.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours: Math.round((weekMinutes / 60) * 100) / 100,
        entries: weekEntries.length
      })
    }

    // Calculate hours by phase
    const hoursByPhase: Record<string, { minutes: number; hours: number; percentage: number }> = {}
    const phaseLabels: Record<string, string> = {
      DESIGN_CONCEPT: 'Design Concept',
      THREE_D: '3D Rendering',
      DRAWINGS: 'Drawings',
      FFE: 'FFE',
      OTHER: 'General'
    }

    timeEntries.forEach(entry => {
      const phase = entry.stageType || 'OTHER'
      if (!hoursByPhase[phase]) {
        hoursByPhase[phase] = { minutes: 0, hours: 0, percentage: 0 }
      }
      hoursByPhase[phase].minutes += entry.duration
    })

    // Calculate percentages
    Object.keys(hoursByPhase).forEach(phase => {
      hoursByPhase[phase].hours = Math.round((hoursByPhase[phase].minutes / 60) * 100) / 100
      hoursByPhase[phase].percentage = totalMinutes > 0 
        ? Math.round((hoursByPhase[phase].minutes / totalMinutes) * 100) 
        : 0
    })

    // Recent activity (last 10 entries)
    const recentActivity = timeEntries.slice(0, 10).map(entry => ({
      id: entry.id,
      date: entry.startTime,
      duration: entry.duration,
      hours: Math.round((entry.duration / 60) * 100) / 100,
      description: entry.description,
      stageType: entry.stageType,
      user: {
        id: entry.user.id,
        name: entry.user.name,
        image: entry.user.image
      }
    }))

    // Calculate average hours per week
    const activeWeeks = hoursByWeek.filter(w => w.hours > 0).length || 1
    const avgHoursPerWeek = Math.round((totalHours / activeWeeks) * 100) / 100

    // First and last time entry dates
    const firstEntryDate = timeEntries.length > 0 ? timeEntries[timeEntries.length - 1].startTime : null
    const lastEntryDate = timeEntries.length > 0 ? timeEntries[0].startTime : null

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        status: project.status
      },
      summary: {
        totalMinutes,
        totalHours,
        entryCount: timeEntries.length,
        avgHoursPerWeek,
        billing: {
          billedHours: Math.round((billedMinutes / 60) * 100) / 100,
          unbilledHours: Math.round((unbilledMinutes / 60) * 100) / 100,
        },
        projectDuration: {
          days: durationDays,
          weeks: durationWeeks,
          months: durationMonths,
          startDate: projectStartDate
        },
        tracking: {
          firstEntry: firstEntryDate,
          lastEntry: lastEntryDate,
          activeDays: new Set(timeEntries.map(e => e.startTime.toISOString().split('T')[0])).size
        }
      },
      byMember: Object.values(hoursByMember).sort((a, b) => b.totalMinutes - a.totalMinutes),
      byWeek: hoursByWeek,
      byPhase: Object.entries(hoursByPhase).map(([key, value]) => ({
        phase: key,
        label: phaseLabels[key] || key,
        ...value
      })).sort((a, b) => b.minutes - a.minutes),
      recentActivity
    })

  } catch (error) {
    console.error('Error fetching time investment data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch time investment data' },
      { status: 500 }
    )
  }
}

