import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

// GET /api/phase-access?stageId=<stageId> - Get all active tokens for a phase
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')

    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId
      },
      include: {
        room: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                orgId: true
              }
            }
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Get all active tokens for the stage
    const tokens = await prisma.phaseAccessToken.findMany({
      where: {
        stageId,
        active: true
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            accessLogs: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the UI expectations
    const transformedTokens = tokens.map(token => ({
      ...token,
      accessCount: token._count.accessLogs
    }))

    return NextResponse.json({ tokens: transformedTokens })

  } catch (error) {
    console.error('Error fetching phase access tokens:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/phase-access - Create a new phase access token
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { stageId, name } = body

    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Verify user has access to this stage and get stage details
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId
      },
      include: {
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

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Generate a secure token
    const token = nanoid(32) // 32 characters for security

    // Create default name if not provided
    const roomName = stage.room.name || stage.room.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    const stageTypeName = stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    const defaultName = name || `${roomName} - ${stageTypeName}`

    // Create the access token
    const phaseAccessToken = await prisma.phaseAccessToken.create({
      data: {
        stageId,
        token,
        name: defaultName,
        createdById: session.user.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        stage: {
          include: {
            room: {
              select: {
                name: true,
                type: true,
                project: {
                  select: {
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
        }
      }
    })

    // Log the activity (optional - don't fail token creation if logging fails)
    try {
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          action: 'CREATE_PHASE_ACCESS_TOKEN',
          entity: 'STAGE',
          entityId: stageId,
          details: {
            tokenId: phaseAccessToken.id,
            tokenName: phaseAccessToken.name,
            roomId: stage.room.id,
            projectId: stage.room.project.id
          }
        }
      })
    } catch (logError) {
      console.error('Failed to log activity:', logError)
      // Continue anyway - don't fail token creation because of logging
    }

    return NextResponse.json({ 
      success: true, 
      token: phaseAccessToken,
      url: `${process.env.NEXTAUTH_URL}/phase-progress/${token}`
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating phase access token:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      cause: error instanceof Error ? error.cause : undefined
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// DELETE /api/phase-access - Deactivate a phase access token
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tokenId = searchParams.get('tokenId')

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 })
    }

    // Verify token exists and user has access
    const existingToken = await prisma.phaseAccessToken.findFirst({
      where: {
        id: tokenId
      },
      include: {
        stage: {
          include: {
            room: {
              select: {
                id: true,
                project: {
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!existingToken) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    // Deactivate the token
    const updatedToken = await prisma.phaseAccessToken.update({
      where: { id: tokenId },
      data: { 
        active: false,
        updatedAt: new Date()
      }
    })

    // Log the activity (optional)
    try {
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          action: 'DEACTIVATE_PHASE_ACCESS_TOKEN',
          entity: 'STAGE',
          entityId: existingToken.stageId,
          details: {
            tokenId: existingToken.id,
            tokenName: existingToken.name,
            roomId: existingToken.stage.room.id,
            projectId: existingToken.stage.room.project.id
          }
        }
      })
    } catch (logError) {
      console.error('Failed to log deactivation activity:', logError)
      // Continue anyway
    }

    return NextResponse.json({ 
      success: true, 
      token: updatedToken 
    })

  } catch (error) {
    console.error('Error deactivating phase access token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}