import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'

// GET /api/messaging/conversations - Get all conversations for the current user
// Returns: General chat, assigned phase chats, and messages where user was mentioned
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const orgId = session.user.orgId

    // Get team members for the sidebar
    const teamMembers = await prisma.user.findMany({
      where: {
        orgId: orgId,
        id: { not: userId }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true
      },
      orderBy: { name: 'asc' }
    })

    // Get unread message counts per team member
    // Count messages sent by each team member in phases where current user is assigned or was mentioned
    const messageCounts = await Promise.all(
      teamMembers.map(async (member) => {
        try {
          // Messages from this team member in phases assigned to current user (handle legacy null chatType)
          const assignedPhaseMessages = await prisma.chatMessage.count({
            where: {
              authorId: member.id,
              isDeleted: false,
              stageId: { not: null },
              stage: {
                assignedTo: userId
              }
            }
          })

          // Messages from this team member that mention current user
          const mentionMessages = await prisma.chatMessage.count({
            where: {
              authorId: member.id,
              isDeleted: false,
              mentions: {
                some: {
                  mentionedId: userId
                }
              }
            }
          })

          // General chat messages from this member
          const generalMessages = await prisma.chatMessage.count({
            where: {
              authorId: member.id,
              isDeleted: false,
              chatType: 'GENERAL',
              orgId: orgId
            }
          })

          return {
            ...member,
            messageCount: assignedPhaseMessages + mentionMessages + generalMessages
          }
        } catch (error) {
          console.error(`Error fetching message count for member ${member.id}:`, error)
          // Return member with 0 count on error to avoid breaking the entire list
          return {
            ...member,
            messageCount: 0
          }
        }
      })
    )

    // Get phases assigned to current user with message counts
    const assignedPhases = await prisma.stage.findMany({
      where: {
        assignedTo: userId,
        room: {
          project: {
            orgId: orgId,
            status: { not: 'CANCELLED' }
          }
        }
      },
      include: {
        room: {
          include: {
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            chatMessages: {
              where: {
                isDeleted: false
              }
            }
          }
        }
      },
      orderBy: [
        { room: { project: { name: 'asc' } } },
        { room: { name: 'asc' } }
      ]
    })

    // Get general chat message count
    const generalChatCount = await prisma.chatMessage.count({
      where: {
        chatType: 'GENERAL',
        orgId: orgId,
        isDeleted: false
      }
    })

    // Get suppliers with messages
    const suppliersWithMessages = await prisma.supplierMessage.groupBy({
      by: ['supplierId'],
      where: {
        orgId: orgId,
        isDeleted: false
      },
      _count: true
    })

    // Get supplier details for those with messages
    const supplierIds = suppliersWithMessages.map(s => s.supplierId)
    const suppliers = supplierIds.length > 0
      ? await prisma.supplier.findMany({
          where: {
            id: { in: supplierIds },
            orgId: orgId
          },
          select: {
            id: true,
            name: true,
            email: true,
            logo: true,
            category: true
          }
        })
      : []

    // Get unread counts per supplier (inbound messages not yet read)
    const unreadCounts = supplierIds.length > 0
      ? await prisma.supplierMessage.groupBy({
          by: ['supplierId'],
          where: {
            orgId: orgId,
            isDeleted: false,
            direction: 'INBOUND',
            readAt: null
          },
          _count: true
        })
      : []

    // Map suppliers with their message counts
    const suppliersData = suppliers.map(supplier => {
      const messageData = suppliersWithMessages.find(s => s.supplierId === supplier.id)
      const unreadData = unreadCounts.find(u => u.supplierId === supplier.id)
      return {
        ...supplier,
        messageCount: messageData?._count || 0,
        unreadCount: unreadData?._count || 0
      }
    }).sort((a, b) => b.unreadCount - a.unreadCount || b.messageCount - a.messageCount)

    // Group phases by project
    const projectPhases = assignedPhases.reduce((acc, phase) => {
      const projectId = phase.room.project.id
      if (!acc[projectId]) {
        acc[projectId] = {
          id: projectId,
          name: phase.room.project.name,
          phases: []
        }
      }
      acc[projectId].phases.push({
        id: phase.id,
        type: phase.type,
        status: phase.status,
        roomId: phase.room?.id || '',
        roomName: phase.room?.name || phase.room?.type || 'Unknown Room',
        messageCount: phase._count.chatMessages
      })
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      success: true,
      teamMembers: messageCounts, // Show all team members
      projects: Object.values(projectPhases),
      generalChatCount,
      suppliers: suppliersData
    })

  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

