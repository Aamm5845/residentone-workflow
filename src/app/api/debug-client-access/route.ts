import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function GET(request: NextRequest) {
  try {
    console.log('=== DEBUG CLIENT ACCESS ===')
    
    // Check session
    const session = await getSession()
    console.log('Session:', session)
    
    if (!session?.user) {
      console.log('No session or user')
      return NextResponse.json({ error: 'No session', session }, { status: 401 })
    }
    
    // Get projects
    const projects = await prisma.project.findMany({
      take: 3,
      include: {
        client: true
      }
    })
    
    console.log('Found projects:', projects.map(p => ({ id: p.id, name: p.name, clientName: p.client?.name })))
    
    if (projects.length === 0) {
      return NextResponse.json({ 
        error: 'No projects found',
        session: session.user,
        projects: []
      })
    }
    
    // Try to create a test token for first project
    const testProject = projects[0]
    console.log('Using test project:', testProject.id, testProject.name)
    
    try {
      const token = nanoid(32)
      console.log('Generated token:', token)
      
      const clientAccessToken = await prisma.clientAccessToken.create({
        data: {
          projectId: testProject.id,
          token,
          name: `DEBUG - ${testProject.client?.name} - ${testProject.name}`,
          createdById: session.user.id
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
      
      console.log('Created token successfully:', clientAccessToken)
      
      return NextResponse.json({ 
        success: true,
        message: 'Debug test successful',
        session: session.user,
        projects: projects.map(p => ({ id: p.id, name: p.name, clientName: p.client?.name })),
        createdToken: {
          id: clientAccessToken.id,
          token: clientAccessToken.token,
          name: clientAccessToken.name,
          url: `${process.env.NEXTAUTH_URL}/client-progress/${token}`
        }
      })
      
    } catch (tokenError) {
      console.error('Token creation error:', tokenError)
      return NextResponse.json({ 
        error: 'Token creation failed',
        details: tokenError instanceof Error ? tokenError.message : String(tokenError),
        session: session.user,
        projects: projects.map(p => ({ id: p.id, name: p.name, clientName: p.client?.name }))
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}