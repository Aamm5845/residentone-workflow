import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// DELETE - Unlink a contractor from a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; contractorId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, contractorId } = params

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

    // Find the project contractor link
    const projectContractor = await prisma.projectContractor.findUnique({
      where: {
        id: contractorId
      }
    })

    if (!projectContractor || projectContractor.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Contractor link not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.projectContractor.update({
      where: { id: contractorId },
      data: { isActive: false }
    })

    return NextResponse.json({ message: 'Contractor removed from project' })

  } catch (error) {
    console.error('Error unlinking contractor from project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
