import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { autoAssignAllUnassignedStages } from '@/lib/utils/auto-assignment'

export async function POST() {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER and ADMIN can trigger system-wide auto-assignment
    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners and admins can trigger auto-assignment.' 
      }, { status: 403 })
    }

    const result = await autoAssignAllUnassignedStages()
    
    return NextResponse.json({
      success: true,
      message: `Auto-assignment completed successfully`,
      assignedCount: result.assignedCount
    })

  } catch (error) {
    console.error('Error in manual auto-assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get count of unassigned stages
    const { prisma } = await import('@/lib/prisma')
    const unassignedCount = await prisma.stage.count({
      where: {
        assignedTo: null
      }
    })
    
    return NextResponse.json({
      unassignedCount,
      needsAssignment: unassignedCount > 0
    })

  } catch (error) {
    console.error('Error checking unassigned stages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
