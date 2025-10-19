import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Session } from 'next-auth'

// Validation schema for client updates
const updateClientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(200).optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
})

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

// Helper function to check if user can modify clients
function canModifyClient(session: AuthSession): boolean {
  return ['OWNER', 'ADMIN', 'DESIGNER'].includes(session.user.role)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await prisma.client.findFirst({
      where: { 
        id: params.id,
        orgId: session.user.orgId
      },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      console.error('❌ Unauthorized - no session or orgId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!canModifyClient(session)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners, admins, and designers can modify clients.' 
      }, { status: 403 })
    }

    // Validate request body
    
    const body = await request.json()
    
    const validatedData = updateClientSchema.parse(body)
    
    // Check if client exists and belongs to the org
    const existingClient = await prisma.client.findFirst({
      where: { 
        id: params.id,
        orgId: session.user.orgId
      }
    })

    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Check for email uniqueness within the organization if email is being updated
    if (validatedData.email && validatedData.email !== existingClient.email) {
      const emailExists = await prisma.client.findFirst({
        where: {
          email: validatedData.email,
          orgId: session.user.orgId,
          NOT: { id: params.id }
        }
      })

      if (emailExists) {
        return NextResponse.json({ 
          error: 'A client with this email already exists in your organization.' 
        }, { status: 400 })
      }
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    }
    
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name
    }
    if (validatedData.email !== undefined) {
      updateData.email = validatedData.email
    }
    if (validatedData.phone !== undefined) {
      updateData.phone = validatedData.phone
    }
    if (validatedData.company !== undefined) {
      updateData.company = validatedData.company
    }

    // Update client
    const updatedClient = await prisma.client.update({
      where: { id: params.id },
      data: updateData,
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json(updatedClient)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}