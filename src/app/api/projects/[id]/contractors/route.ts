import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get all contractors linked to a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all contractors linked to this project
    const projectContractors = await prisma.projectContractor.findMany({
      where: {
        projectId,
        isActive: true
      },
      include: {
        contractor: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(projectContractors)

  } catch (error) {
    console.error('Error fetching project contractors:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Link a contractor to a project
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id
    const { contractorId, role } = await request.json()

    if (!contractorId) {
      return NextResponse.json(
        { error: 'Contractor ID is required' },
        { status: 400 }
      )
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify contractor exists and belongs to same org
    const contractor = await prisma.contractor.findFirst({
      where: {
        id: contractorId,
        orgId: session.user.orgId
      }
    })

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    // Check if already linked
    const existing = await prisma.projectContractor.findUnique({
      where: {
        projectId_contractorId: {
          projectId,
          contractorId
        }
      }
    })

    if (existing) {
      // If exists but inactive, reactivate it
      if (!existing.isActive) {
        const updated = await prisma.projectContractor.update({
          where: { id: existing.id },
          data: { isActive: true, role },
          include: {
            contractor: true
          }
        })
        return NextResponse.json(updated)
      }
      return NextResponse.json(
        { error: 'Contractor is already linked to this project' },
        { status: 400 }
      )
    }

    // Create new link
    const projectContractor = await prisma.projectContractor.create({
      data: {
        projectId,
        contractorId,
        role,
        isActive: true
      },
      include: {
        contractor: true
      }
    })

    return NextResponse.json(projectContractor, { status: 201 })

  } catch (error) {
    console.error('Error linking contractor to project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
