import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Map category tab IDs to activity action prefixes
const CATEGORY_ACTION_PREFIXES: Record<string, string[]> = {
  projects: ['PROJECT_', 'ROOM_', 'STAGE_'],
  procurement: ['RFQ_', 'ORDER_', 'SUPPLIER_QUOTE_', 'CLIENT_INVOICE_', 'BUDGET_QUOTE_', 'DELIVERY_'],
  design: ['DESIGN_', 'RENDERING_', 'DRAWING_', 'FFE_', 'CLIENT_APPROVAL_', 'AARON_APPROVED', 'FLOORPLAN_'],
  team: ['USER_', 'TEAM_MEMBER_', 'CONTRACTOR_', 'CLIENT_ACCESS_'],
  billing: ['INVOICE_', 'PAYMENT_', 'PROPOSAL_'],
  files: ['FILE_', 'TRANSMITTAL_', 'ASSET_'],
}

/**
 * GET /api/activities
 * Fetch organization-wide activities with pagination, filtering, and date range
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')))

    // Parse filter parameters
    const types = searchParams.get('types')?.split(',').filter(Boolean) || []
    const users = searchParams.get('users')?.split(',').filter(Boolean) || []
    const entities = searchParams.get('entities')?.split(',').filter(Boolean) || []
    const category = searchParams.get('category') || null
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    // Build where clause
    const where: any = {
      orgId: session.user.orgId
    }

    // Filter by activity types
    if (types.length > 0) {
      where.action = { in: types }
    }

    // Filter by category (maps to action prefixes)
    if (category && CATEGORY_ACTION_PREFIXES[category]) {
      const prefixes = CATEGORY_ACTION_PREFIXES[category]
      // Use OR conditions for action prefix matching
      where.OR = prefixes.map(prefix => ({
        action: { startsWith: prefix }
      }))
    }

    // Filter by users
    if (users.length > 0) {
      where.actorId = { in: users }
    }

    // Filter by entity types
    if (entities.length > 0) {
      where.entity = { in: entities }
    }

    // Default date range: last 7 days if no dates specified
    const now = new Date()
    const defaultStart = new Date()
    defaultStart.setDate(defaultStart.getDate() - 7)

    where.createdAt = {}

    if (startDateStr) {
      const startDate = new Date(startDateStr)
      if (!isNaN(startDate.getTime())) {
        where.createdAt.gte = startDate
      }
    } else {
      where.createdAt.gte = defaultStart
    }

    if (endDateStr) {
      const endDate = new Date(endDateStr)
      if (!isNaN(endDate.getTime())) {
        // Set to end of day
        endDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = endDate
      }
    } else {
      where.createdAt.lte = now
    }

    // Calculate skip
    const skip = (page - 1) * perPage

    // Fetch one extra to determine if there are more results
    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        actor: {
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
        createdAt: 'desc'
      },
      skip,
      take: perPage + 1
    })

    // Determine if there are more results
    const hasMore = activities.length > perPage
    const items = activities.slice(0, perPage)

    // Normalize activities
    const normalizedActivities = items.map(activity => {
      let details = activity.details

      if (typeof details === 'string') {
        try {
          details = JSON.parse(details)
        } catch (e) {
          console.warn(`Failed to parse activity details for activity ${activity.id}:`, e)
          details = {}
        }
      }

      if (typeof details !== 'object' || details === null) {
        details = {}
      }

      return {
        id: activity.id,
        action: activity.action,
        entity: activity.entity,
        entityId: activity.entityId,
        details,
        createdAt: activity.createdAt.toISOString(),
        actor: activity.actor ? {
          id: activity.actor.id,
          name: activity.actor.name,
          email: activity.actor.email,
          image: activity.actor.image,
          role: activity.actor.role
        } : null
      }
    })

    return NextResponse.json({
      items: normalizedActivities,
      pagination: {
        page,
        perPage,
        hasMore,
        nextPage: hasMore ? page + 1 : null
      }
    })

  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
