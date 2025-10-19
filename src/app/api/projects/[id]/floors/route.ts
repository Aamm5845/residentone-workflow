import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'

// GET /api/projects/[id]/floors - Get all floors for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // Floor model doesn't exist in schema - return empty array
    // TODO: Add Floor model to Prisma schema if floor organization is needed
    
    return NextResponse.json([])
  } catch (error) {
    console.error('Error fetching floors:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/floors - Create a new floor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { name, order } = body

    // Floor model doesn't exist in schema - return not implemented error
    // TODO: Add Floor model to Prisma schema if floor organization is needed
    
    return NextResponse.json({ error: 'Floor functionality not implemented - Floor model missing from schema' }, { status: 501 })
  } catch (error) {
    console.error('Error creating floor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
