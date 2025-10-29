import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { Filter, AlertCircle, Clock, Calendar, Users, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import type { Session } from 'next-auth'

export default async function Tasks({ searchParams }: { searchParams: { status?: string, search?: string } }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      name: string
      role: string
    }
  } | null
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  // Handle filtering based on query parameters
  const statusFilter = searchParams.status
  const searchTerm = searchParams.search

  let userTasks: any[] = []
  
  try {
    if (statusFilter === 'overdue') {
      // Get user's overdue tasks (assigned to them)
      const overdueStages = await prisma.stage.findMany({
        where: {
          assignedTo: session.user.id,
          room: {
            project: { orgId: session.user.orgId }
          },
          status: { in: ['IN_PROGRESS', 'NEEDS_ATTENTION'] },
          dueDate: { lt: new Date() }
        },
        include: {
          room: {
            include: {
              project: {
                include: {
                  client: true
                }
              }
            }
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      })

      // Get overdue client approvals (sent more than 7 days ago)
      const overdueApprovals = await prisma.clientApprovalVersion.findMany({
        where: {
          stage: {
            room: {
              project: { orgId: session.user.orgId }
            }
          },
          status: 'SENT_TO_CLIENT',
          clientDecision: 'PENDING',
          sentToClientAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        },
        include: {
          stage: {
            include: {
              room: {
                include: {
                  project: {
                    include: {
                      client: true
                    }
                  }
                }
              }
            }
          },
          sentByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { sentToClientAt: 'asc' }
      })

      // Combine and transform the data
      const transformedStages = overdueStages.map(stage => ({
        id: stage.id,
        type: 'stage' as const,
        title: `${stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())} - ${stage.room.name || stage.room.type.replace('_', ' ')}`,
        projectName: stage.room.project.name,
        clientName: stage.room.project.client.name,
        dueDate: stage.dueDate,
        status: stage.status,
        assignedUser: stage.assignedUser,
        roomId: stage.room.id,
        projectId: stage.room.project.id,
        overdueBy: stage.dueDate ? Math.floor((new Date().getTime() - new Date(stage.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
        urgencyLevel: stage.status === 'NEEDS_ATTENTION' ? 'high' : 'medium'
      }))

      const transformedApprovals = overdueApprovals.map(approval => ({
        id: approval.id,
        type: 'approval' as const,
        title: `Client Approval - ${approval.stage.room.name || approval.stage.room.type.replace('_', ' ')}`,
        projectName: approval.stage.room.project.name,
        clientName: approval.stage.room.project.client.name,
        dueDate: approval.sentToClientAt,
        status: 'PENDING_CLIENT_RESPONSE',
        assignedUser: approval.sentByUser,
        roomId: approval.stage.room.id,
        projectId: approval.stage.room.project.id,
        stageId: approval.stage.id,
        overdueBy: approval.sentToClientAt ? Math.floor((new Date().getTime() - new Date(approval.sentToClientAt).getTime()) / (1000 * 60 * 60 * 24)) - 7 : null,
        urgencyLevel: approval.sentToClientAt && (new Date().getTime() - new Date(approval.sentToClientAt).getTime()) > (14 * 24 * 60 * 60 * 1000) ? 'high' : 'medium',
        version: approval.version
      }))

      // Combine and sort by overdue time (most overdue first), handling null values
      userTasks = [...transformedStages, ...transformedApprovals].sort((a, b) => {
        if (a.overdueBy === null && b.overdueBy === null) return 0
        if (a.overdueBy === null) return 1 // null values go to end
        if (b.overdueBy === null) return -1 // null values go to end
        return b.overdueBy - a.overdueBy
      })
    } else {
      // Get all user's assigned IN_PROGRESS tasks
      const userStages = await prisma.stage.findMany({
        where: {
          assignedTo: session.user.id,
          room: {
            project: { orgId: session.user.orgId }
          },
          status: 'IN_PROGRESS',
          ...(searchTerm && {
            OR: [
              { room: { name: { contains: searchTerm, mode: 'insensitive' } } },
              { room: { type: { contains: searchTerm, mode: 'insensitive' } } },
              { room: { project: { name: { contains: searchTerm, mode: 'insensitive' } } } },
              { room: { project: { client: { name: { contains: searchTerm, mode: 'insensitive' } } } } },
              { type: { contains: searchTerm, mode: 'insensitive' } }
            ]
          })
        },
        include: {
          room: {
            include: {
              project: {
                include: {
                  client: true
                }
              }
            }
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }]
      })

      // Transform user stages into task format
      userTasks = userStages.map(stage => ({
        id: stage.id,
        type: 'stage' as const,
        title: `${stage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())} - ${stage.room.name || stage.room.type.replace('_', ' ')}`,
        projectName: stage.room.project.name,
        clientName: stage.room.project.client.name,
        dueDate: stage.dueDate,
        status: stage.status,
        assignedUser: stage.assignedUser,
        roomId: stage.room.id,
        projectId: stage.room.project.id,
        overdueBy: stage.dueDate ? Math.floor((new Date().getTime() - new Date(stage.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
        urgencyLevel: stage.dueDate && stage.dueDate < new Date() ? 'high' : 'medium',
        stageType: stage.type
      }))
    }
  } catch (error) {
    console.error('Error fetching user tasks:', error)
    userTasks = []
  }

  const getUrgencyColor = (urgencyLevel: string) => {
    switch (urgencyLevel) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (type: string, status: string) => {
    if (type === 'approval') {
      return <Send className="w-5 h-5 text-orange-500" />
    }
    
    switch (status) {
      case 'NEEDS_ATTENTION':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-blue-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getOverdueText = (overdueBy: number | null, type: string) => {
    if (overdueBy === null) return 'No due date'
    if (overdueBy <= 0) return 'Due today'
    if (overdueBy === 1) return `${overdueBy} day ${type === 'approval' ? 'overdue' : 'overdue'}`
    return `${overdueBy} days ${type === 'approval' ? 'overdue' : 'overdue'}`
  }

  const getTaskHref = (task: any) => {
    if (task.type === 'stage') {
      return `/stages/${task.id}`
    } else {
      return `/stages/${task.stageId}`
    }
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {statusFilter === 'overdue' ? 'My Overdue Tasks' : 'My Tasks'}
            </h1>
            <p className="text-gray-600 mt-1">
              {userTasks.length} {statusFilter === 'overdue' ? 'overdue' : 'active'} tasks assigned to you
            </p>
            {statusFilter && (
              <Link href="/dashboard" className="text-sm text-purple-600 hover:text-purple-800 mt-2 inline-block">
                ← Back to Dashboard
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {/* Search Form */}
            <form method="GET" className="flex items-center space-x-2">
              {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
              <input
                type="text"
                name="search"
                placeholder="Search tasks..."
                defaultValue={searchTerm}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>
            <Link href={statusFilter === 'overdue' ? '/tasks' : '/tasks?status=overdue'}>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                {statusFilter === 'overdue' ? 'Show All' : 'Show Overdue'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        {statusFilter === 'overdue' && userTasks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-800">High Priority</p>
                  <p className="text-2xl font-bold text-red-900">
                    {userTasks.filter(task => task.urgencyLevel === 'high').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Medium Priority</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {userTasks.filter(task => task.urgencyLevel === 'medium').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Send className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Client Approvals</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {userTasks.filter(task => task.type === 'approval').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className="space-y-6">
          {userTasks.length > 0 ? (
            <div className="space-y-4">
              {userTasks.map((task) => (
                <Link key={`${task.type}-${task.id}`} href={getTaskHref(task)}>
                  <div className="bg-white rounded-lg shadow-sm border-l-4 border-l-red-500 p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(task.type, task.status)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {task.title}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                              <span>{task.projectName}</span>
                              <span>•</span>
                              <span>{task.clientName}</span>
                              {task.type === 'approval' && (
                                <>
                                  <span>•</span>
                                  <span>Version {task.version}</span>
                                </>
                              )}
                            </div>
                            
                            {/* Assigned User */}
                            {task.assignedUser && (
                              <div className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                                <Users className="w-4 h-4" />
                                <span>
                                  {task.type === 'approval' ? 'Sent by' : 'Assigned to'} {task.assignedUser.name}
                                </span>
                              </div>
                            )}
                            
                            {/* Due Date Info */}
                            {task.dueDate && (
                              <div className={`flex items-center space-x-2 text-sm px-3 py-2 rounded-lg ${
                                task.urgencyLevel === 'high' ? 'bg-red-50 border border-red-200' :
                                task.overdueBy !== null && task.overdueBy > 0 ? 'bg-red-50 border border-red-200' :
                                task.overdueBy === 0 ? 'bg-yellow-50 border border-yellow-200' :
                                'bg-gray-50 border border-gray-200'
                              }`}>
                                <Calendar className={`w-4 h-4 ${
                                  task.urgencyLevel === 'high' ? 'text-red-500' :
                                  task.overdueBy !== null && task.overdueBy > 0 ? 'text-red-500' :
                                  task.overdueBy === 0 ? 'text-yellow-500' :
                                  'text-gray-500'
                                }`} />
                                <span className={`font-medium ${
                                  task.urgencyLevel === 'high' ? 'text-red-700' :
                                  task.overdueBy !== null && task.overdueBy > 0 ? 'text-red-700' :
                                  task.overdueBy === 0 ? 'text-yellow-700' :
                                  'text-gray-700'
                                }`}>
                                  {task.type === 'approval' ? 'Sent' : 'Due'}: {formatDate(task.dueDate)}
                                  {task.overdueBy !== null && task.overdueBy > 0 && (
                                    <span className="ml-2 font-bold text-red-600">
                                      ({getOverdueText(task.overdueBy, task.type)})
                                    </span>
                                  )}
                                  {task.overdueBy === 0 && (
                                    <span className="ml-2 font-bold text-yellow-600">
                                      (Due Today!)
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(task.urgencyLevel)}`}>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {getOverdueText(task.overdueBy, task.type)}
                      </span>
                      
                      {/* Task Type Badge */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        task.type === 'approval' 
                          ? 'bg-blue-100 text-blue-800' 
                          : task.status === 'NEEDS_ATTENTION'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {task.type === 'approval' ? 'Client Approval' : task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
                {statusFilter === 'overdue' ? (
                  <AlertCircle className="w-full h-full" />
                ) : (
                  <Clock className="w-full h-full" />
                )}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {statusFilter === 'overdue' 
                  ? 'No overdue tasks! 🎉' 
                  : searchTerm 
                    ? `No tasks found for "${searchTerm}"` 
                    : 'No active tasks assigned to you'}
              </h3>
              <p className="text-gray-600 mb-6">
                {statusFilter === 'overdue' 
                  ? 'All your assigned tasks are on track!'
                  : searchTerm
                    ? 'Try adjusting your search terms or check the spelling.'
                    : 'You have no tasks currently in progress. Great job staying on top of your work!'}
              </p>
              <Button asChild>
                <Link href="/projects">
                  View Projects
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
