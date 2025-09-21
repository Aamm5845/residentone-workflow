import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { Search, Filter, MoreVertical, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, getStatusColor, formatRoomType } from '@/lib/utils'
import Link from 'next/link'
import type { Session } from 'next-auth'

export default async function Rooms({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  // Handle filtering based on query parameters
  const statusFilter = searchParams.status

  // Build where clause based on filters
  const whereClause: any = {
    project: { orgId: session.user.orgId }
  }

  if (statusFilter === 'active') {
    whereClause.stages = {
      some: {
        status: { in: ['IN_PROGRESS', 'NEEDS_ATTENTION'] }
      }
    }
  }

  // Fetch rooms from database
  let rooms: any[] = []
  
  try {
    rooms = await prisma.room.findMany({
      where: whereClause,
      include: {
        project: {
          include: {
            client: true
          }
        },
        stages: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { 
            stages: true,
            assets: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
  } catch (error) {
    console.error('Error fetching rooms:', error)
    rooms = []
  }

  // Calculate room statistics
  const roomsWithStats = rooms.map(room => {
    const activeStages = room.stages.filter((stage: any) => 
      ['IN_PROGRESS', 'NEEDS_ATTENTION'].includes(stage.status)
    )
    const completedStages = room.stages.filter((stage: any) => stage.status === 'COMPLETED')
    const totalStages = room.stages.length
    const progressPercent = totalStages > 0 ? Math.round((completedStages.length / totalStages) * 100) : 0
    
    // Get current phase
    const currentStage = activeStages[0]
    const currentPhase = currentStage ? {
      name: currentStage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()),
      status: currentStage.status,
      dueDate: currentStage.dueDate
    } : null

    return {
      ...room,
      activeStages: activeStages.length,
      completedStages: completedStages.length,
      totalStages,
      progressPercent,
      currentPhase
    }
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'NEEDS_ATTENTION':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'NEEDS_ATTENTION':
        return 'bg-red-100 text-red-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {statusFilter === 'active' ? 'Active Rooms' : 'All Rooms'}
            </h1>
            <p className="text-gray-600 mt-1">
              {roomsWithStats.length} {statusFilter === 'active' ? 'active' : ''} rooms
            </p>
            {statusFilter && (
              <Link href="/dashboard" className="text-sm text-purple-600 hover:text-purple-800 mt-2 inline-block">
                ← Back to Dashboard
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Rooms List */}
        <div className="space-y-6">
          {roomsWithStats.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Room
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Project & Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Phase
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Active Stages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {roomsWithStats.map((room) => (
                      <tr key={room.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/projects/${room.project.id}/rooms/${room.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {room.name || formatRoomType(room.type)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatRoomType(room.type)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{room.project.name}</div>
                          <div className="text-sm text-gray-500">{room.project.client.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {room.currentPhase ? (
                            <div className="flex items-center">
                              {getStatusIcon(room.currentPhase.status)}
                              <div className="ml-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {room.currentPhase.name}
                                </div>
                                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(room.currentPhase.status)}`}>
                                  {room.currentPhase.status.replace('_', ' ')}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No active phase</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${room.progressPercent}%` }}
                              />
                            </div>
                            <span className="ml-2 text-sm font-medium text-gray-700">{room.progressPercent}%</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {room.completedStages}/{room.totalStages} stages
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{room.activeStages}</div>
                          <div className="text-sm text-gray-500">stages</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(room.updatedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
                <Users className="w-full h-full" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {statusFilter === 'active' ? 'No active rooms' : 'No rooms found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {statusFilter === 'active' 
                  ? 'All rooms are currently on hold or completed.'
                  : 'Start by creating a project with rooms.'}
              </p>
              <Button asChild>
                <Link href="/projects/new">
                  Create Project
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}