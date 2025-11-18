import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/activities
 * Fetch organization-wide activities with pagination and filtering
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
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '25')))
    
    // Parse filter parameters
    const types = searchParams.get('types')?.split(',').filter(Boolean) || []
    const users = searchParams.get('users')?.split(',').filter(Boolean) || []
    const entities = searchParams.get('entities')?.split(',').filter(Boolean) || []
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
    
    // Filter by users
    if (users.length > 0) {
      where.actorId = { in: users }
    }
    
    // Filter by entity types
    if (entities.length > 0) {
      where.entity = { in: entities }
    }
    
    // Filter by date range
    if (startDateStr || endDateStr) {
      where.createdAt = {}
      
      if (startDateStr) {
        const startDate = new Date(startDateStr)
        if (!isNaN(startDate.getTime())) {
          where.createdAt.gte = startDate
        }
      }
      
      if (endDateStr) {
        const endDate = new Date(endDateStr)
        if (!isNaN(endDate.getTime())) {
          where.createdAt.lte = endDate
        }
      }
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
      take: perPage + 1 // Fetch one extra to check for more
    })
    
    // Determine if there are more results
    const hasMore = activities.length > perPage
    const items = activities.slice(0, perPage)
    
    // Normalize activities
    const normalizedActivities = items.map(activity => {
      // Parse details - handle both string (legacy) and object (new)
      let details = activity.details
      
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details)
        } catch (e) {
          console.warn(`Failed to parse activity details for activity ${activity.id}:`, e)
          details = {}
        }
      }
      
      // Ensure details is an object
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
    
    // Return response
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
