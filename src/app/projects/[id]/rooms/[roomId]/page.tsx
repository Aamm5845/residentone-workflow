import React from 'react'
import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, Settings, Users, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatRoomType } from '@/lib/utils'
import RoomPhaseBoard from '@/components/rooms/room-phase-board'
import { ROOM_PHASES, type PhaseId } from '@/lib/constants/room-phases'

interface Props {
  params: { id: string; roomId: string }
}

export default async function RoomWorkspace({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id, roomId } = await params

  // Fetch project and room data
  let project: any = null
  let room: any = null
  let teamMembers: any[] = []
  
  try {
    const [projectData, teamData] = await Promise.all([
      prisma.project.findFirst({
        where: { 
          id: id
        },
        include: {
          client: true,
          rooms: {
            include: {
              stages: {
                include: {
                  assignedUser: true
                }
              },
              assets: true,
              ffeItems: true
            }
          }
        }
      }),
      prisma.user.findMany({
        where: {
          AND: [
            { name: { not: { startsWith: '[DELETED]' } } },
            { email: { not: { startsWith: 'deleted_' } } },
            { email: { in: ['aaron@meisnerinteriors.com', 'shaya@meisnerinteriors.com', 'sami@meisnerinteriors.com', 'euvi.3d@gmail.com'] } }
          ]
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          image: true,
          _count: {
            select: {
              assignedStages: true
            }
          }
        }
      })
    ])
    
    project = projectData
    room = projectData?.rooms.find((r: any) => r.id === roomId)
    teamMembers = teamData
    
  } catch (error) {
    console.error('Error fetching project data:', error)
    redirect(`/projects/${id}`)
  }

  if (!project || !room) {
    redirect(`/projects/${id}`)
  }

  // Transform legacy stages to new phase format
  const getPhaseData = () => {
    return ROOM_PHASES.map(phaseConfig => {
      // Map old stage types to new phase IDs
      const stageTypeMap: Record<string, string> = {
        'DESIGN_CONCEPT': 'DESIGN_CONCEPT',
        'THREE_D': 'RENDERING',
        'RENDERING': 'RENDERING',
        'CLIENT_APPROVAL': 'CLIENT_APPROVAL', 
        'DRAWINGS': 'DRAWINGS',
        'FFE': 'FFE'
      }
      
      const matchingStage = room.stages.find((stage: any) => 
        stageTypeMap[stage.type] === phaseConfig.id
      )
      
      return {
        id: phaseConfig.id,
        status: matchingStage?.status === 'COMPLETED' ? 'COMPLETE' as const :
                matchingStage?.status === 'IN_PROGRESS' ? 'IN_PROGRESS' as const :
                matchingStage?.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' as const :
                matchingStage?.status === 'NOT_STARTED' ? 'PENDING' as const :
                matchingStage?.status === 'PENDING' ? 'PENDING' as const :
                'PENDING' as const,
        assignedUser: matchingStage?.assignedUser || null,
        completedAt: matchingStage?.completedAt || null,
        startedAt: matchingStage?.startedAt || null,
        stageId: matchingStage?.id || null
      }
    })
  }

  const phases = getPhaseData()
  const applicablePhases = phases.filter(p => p.status !== 'NOT_APPLICABLE')
  const completedPhases = phases.filter(p => p.status === 'COMPLETE').length
  const roomProgress = applicablePhases.length > 0 ? Math.round((completedPhases / applicablePhases.length) * 100) : 0

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        {/* Modern Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/projects/${id}`}>
                  <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {room.name || formatRoomType(room.type)}
                  </h1>
                  <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                    <span>{project.name}</span>
                    <span>•</span>
                    <span>{project.client.name}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <BarChart3 className="w-4 h-4" />
                  <span className="font-medium">{roomProgress}% Complete</span>
                </div>
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Team
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
            
            {/* Clean Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${roomProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Phase Board */}
        <div className="px-6 py-8">
          <RoomPhaseBoard 
            phases={phases}
            teamMembers={teamMembers}
            roomId={roomId}
            projectId={id}
            currentUser={session.user}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

