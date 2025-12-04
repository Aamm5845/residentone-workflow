import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { formatDate, formatRoomType } from '@/lib/utils'
import type { Session } from 'next-auth'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'

// Brand colors for phases
const PHASE_COLORS: Record<string, string> = {
  DESIGN_CONCEPT: '#a657f0',
  THREE_D: '#f6762e',
  CLIENT_APPROVAL: '#14b8a6',
  DRAWINGS: '#6366ea',
  FFE: '#e94d97',
}

const PHASE_LABELS: Record<string, string> = {
  DESIGN_CONCEPT: 'Design',
  THREE_D: '3D Rendering',
  CLIENT_APPROVAL: 'Approval',
  DRAWINGS: 'Drawings',
  FFE: 'FFE',
}

export default async function Rooms({ searchParams }: { searchParams: Promise<{ status?: string, search?: string }> }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const params = await searchParams
  const searchQuery = params.search

  // Fetch all rooms with active phases (not fully completed)
  let rooms: any[] = []
  
  try {
    rooms = await prisma.room.findMany({
      where: {
        // Must have at least one IN_PROGRESS or NEEDS_ATTENTION stage
        stages: {
          some: {
            status: { in: ['IN_PROGRESS', 'NEEDS_ATTENTION'] }
          }
        },
        // Exclude rooms where all stages are completed
        NOT: {
          stages: {
            every: {
              OR: [
                { status: 'COMPLETED' },
                { status: 'NOT_APPLICABLE' }
              ]
            }
          }
        }
      },
      include: {
        project: {
          include: {
            client: true
          }
        },
        stages: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
  } catch (error) {
    console.error('Error fetching rooms:', error)
    rooms = []
  }

  // Filter by search if provided
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    rooms = rooms.filter(room => 
      (room.name || '').toLowerCase().includes(query) ||
      formatRoomType(room.type).toLowerCase().includes(query) ||
      room.project.name.toLowerCase().includes(query) ||
      room.project.client.name.toLowerCase().includes(query)
    )
  }

  // Calculate stats for each room and group by project
  const roomsWithStats = rooms.map(room => {
    const completedStages = room.stages.filter((s: any) => s.status === 'COMPLETED')
    const applicableStages = room.stages.filter((s: any) => s.status !== 'NOT_APPLICABLE')
    const totalStages = applicableStages.length
    const progressPercent = totalStages > 0 ? Math.round((completedStages.length / totalStages) * 100) : 0
    
    // Get ALL active phases (not just the first one)
    const activeStages = room.stages.filter((s: any) => 
      s.status === 'IN_PROGRESS' || s.status === 'NEEDS_ATTENTION'
    )

    return {
      id: room.id,
      name: room.name || formatRoomType(room.type),
      type: formatRoomType(room.type),
      projectId: room.project.id,
      projectName: room.project.name,
      clientName: room.project.client.name,
      progressPercent,
      completedCount: completedStages.length,
      totalCount: totalStages,
      activePhases: activeStages.map((s: any) => ({
        type: s.type,
        label: PHASE_LABELS[s.type] || s.type,
        color: PHASE_COLORS[s.type] || '#6366ea'
      })),
      updatedAt: formatDate(room.updatedAt)
    }
  })

  // Group rooms by project
  const roomsByProject = roomsWithStats.reduce((acc: Record<string, { projectName: string; clientName: string; projectId: string; rooms: typeof roomsWithStats }>, room) => {
    if (!acc[room.projectId]) {
      acc[room.projectId] = {
        projectId: room.projectId,
        projectName: room.projectName,
        clientName: room.clientName,
        rooms: []
      }
    }
    acc[room.projectId].rooms.push(room)
    return acc
  }, {})

  return (
    <DashboardLayout session={session}>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Active Rooms</h1>
          <p className="text-sm text-gray-500 mt-1">{roomsWithStats.length} rooms in progress</p>
          <Link href="/dashboard" className="text-sm text-[#a657f0] hover:text-[#a657f0]/80 mt-2 inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            Back to Dashboard
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <form>
            <input
              type="text"
              name="search"
              placeholder="Search rooms, projects, or clients..."
              defaultValue={searchQuery || ''}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a657f0]/20 focus:border-[#a657f0]"
            />
          </form>
        </div>

        {/* Rooms List - Grouped by Project */}
        {Object.keys(roomsByProject).length > 0 ? (
          <div className="space-y-6">
            {Object.values(roomsByProject).map((group) => (
              <div key={group.projectId}>
                {/* Project Header */}
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-semibold text-gray-900">{group.projectName}</h2>
                  <span className="text-sm text-gray-500">• {group.clientName}</span>
                  <span className="text-xs text-gray-400 ml-auto">{group.rooms.length} rooms</span>
                </div>
                
                {/* Rooms */}
                <div className="space-y-2">
                  {group.rooms.map((room) => (
                    <Link 
                      key={room.id} 
                      href={`/projects/${room.projectId}/rooms/${room.id}`}
                      className="block"
                    >
                      <div className="bg-white rounded-lg border border-gray-200 p-3 hover:border-[#a657f0]/40 hover:shadow-sm transition-all group">
                        <div className="flex items-center gap-4">
                          {/* Room Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 group-hover:text-[#a657f0] transition-colors">
                                {room.name}
                              </span>
                              {room.activePhases.map((phase: any, idx: number) => (
                                <span 
                                  key={idx}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: phase.color }}
                                >
                                  {phase.label}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-medium text-gray-700">{room.progressPercent}%</span>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all"
                                style={{ 
                                  width: `${room.progressPercent}%`,
                                  backgroundColor: room.progressPercent === 100 ? '#14b8a6' : '#a657f0'
                                }}
                              />
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#a657f0] transition-colors" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No rooms found' : 'No active rooms'}
            </h3>
            <p className="text-gray-500 text-sm">
              {searchQuery 
                ? `No rooms match "${searchQuery}"`
                : 'All rooms are either completed or not started yet'}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
