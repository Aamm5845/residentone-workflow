import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'

export async function GET(request: NextRequest) {
  try {
    
    // Test 1: Check session
    
    const session = await getSession()

    if (!isValidAuthSession(session)) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        sessionData: session,
        step: 'session_validation'
      }, { status: 401 })
    }

    // Test 2: Simple database query
    
    const stageCount = await prisma.stage.count()
    
    // Test 3: Get first stage with minimal data
    
    const firstStage = await prisma.stage.findFirst({
      select: {
        id: true,
        type: true,
        status: true
      }
    })
    
    if (!firstStage) {
      return NextResponse.json({
        success: true,
        message: 'Database connection working, but no stages found',
        stageCount,
        step: 'no_stages'
      })
    }

    // Test 4: Try to get stage with room/project relations
    
    const stageWithRelations = await prisma.stage.findFirst({
      where: { id: firstStage.id },
      select: {
        id: true,
        type: true,
        status: true,
        room: {
          select: {
            id: true,
            name: true,
            type: true,
            project: {
              select: {
                id: true,
                name: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })
    
    // Test 5: Try to get design sections
    
    const designSections = await prisma.designSection.findMany({
      where: { stageId: firstStage.id },
      select: {
        id: true,
        type: true,
        completed: true,
        content: true
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'All tests passed',
      data: {
        session: {
          userId: session.user.id,
          userEmail: session.user.email,
          role: session.user.role,
          orgId: session.user.orgId
        },
        stageCount,
        testStage: stageWithRelations,
        designSections
      }
    })

  } catch (error) {
    console.error('❌ Debug test error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown'
    })
    
    return NextResponse.json({ 
      error: 'Debug test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}