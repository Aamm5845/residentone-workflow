import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get stages with basic info for debugging
    const stages = await prisma.stage.findMany({
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        room: {
          select: {
            id: true,
            name: true,
            type: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true
          }
        },
        designSections: {
          select: {
            id: true,
            type: true,
            completed: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ],
      take: 50 // Limit for debugging
    })

    return NextResponse.json({
      success: true,
      count: stages.length,
      stages
    })
  } catch (error) {
    console.error('Error fetching stages:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}