import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

/**
 * GET /api/projects/[id]/phase-pricing
 * Get phase pricing for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as AuthSession | null
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id },
      select: { phasePricing: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({
      phasePricing: (project.phasePricing as Record<string, number>) || {},
    })
  } catch (error) {
    console.error('Error fetching phase pricing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]/phase-pricing
 * Set phase pricing for a project
 * Body: { phasePricing: { DESIGN_CONCEPT: 500, THREE_D: 1200, ... } }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as AuthSession | null
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { phasePricing } = await request.json()

    if (!phasePricing || typeof phasePricing !== 'object') {
      return NextResponse.json({ error: 'phasePricing object is required' }, { status: 400 })
    }

    await prisma.project.update({
      where: { id },
      data: { phasePricing },
    })

    return NextResponse.json({ success: true, phasePricing })
  } catch (error) {
    console.error('Error updating phase pricing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
