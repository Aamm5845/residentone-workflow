import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { 
  Package, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  Filter,
  Plus,
  Building,
  Users,
  Calendar,
  TrendingUp,
  ShoppingCart,
  Truck,
  DollarSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import type { Session } from 'next-auth'

export default async function FFEPage({ searchParams }: { searchParams: { status?: string, search?: string } }) {
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

  // Get FFE-related data
  let ffeStages: any[] = []
  let ffeTasks: any[] = []
  let ffeStats = {
    total: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    totalBudget: 0,
    itemsOrdered: 0
  }
  
  try {
    // Get all FFE stages for the organization
    const stages = await prisma.stage.findMany({
      where: {
        type: 'FFE',
        room: {
          project: { orgId: session.user.orgId }
        },
        status: { not: 'NOT_APPLICABLE' }
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
      orderBy: [
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ]
    })

    ffeStages = stages

    // Calculate stats
    ffeStats.total = stages.length
    ffeStats.inProgress = stages.filter(s => s.status === 'IN_PROGRESS').length
    ffeStats.completed = stages.filter(s => s.status === 'COMPLETED').length
    ffeStats.overdue = stages.filter(s => s.dueDate && s.dueDate < new Date() && s.status !== 'COMPLETED').length

    // Transform stages to tasks for easier display
    ffeTasks = stages.map(stage => ({
      id: stage.id,
      title: `FFE - ${stage.room.name || stage.room.type.replace('_', ' ')}`,
      projectName: stage.room.project.name,
      clientName: stage.room.project.client.name,
      roomType: stage.room.type,
      status: stage.status,
      dueDate: stage.dueDate,
      assignedUser: stage.assignedUser,
      roomId: stage.room.id,
      projectId: stage.room.project.id,
      overdueBy: stage.dueDate ? Math.floor((new Date().getTime() - new Date(stage.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
      urgencyLevel: stage.dueDate && stage.dueDate < new Date() && stage.status !== 'COMPLETED' ? 'high' : 'medium'
    }))

    // Filter based on search params
    if (searchParams.status) {
      if (searchParams.status === 'overdue') {
        ffeTasks = ffeTasks.filter(task => task.overdueBy !== null && task.overdueBy > 0 && task.status !== 'COMPLETED')
      } else {
        ffeTasks = ffeTasks.filter(task => task.status === searchParams.status.toUpperCase())
      }
    }

    if (searchParams.search) {
      const searchTerm = searchParams.search.toLowerCase()
      ffeTasks = ffeTasks.filter(task => 
        task.title.toLowerCase().includes(searchTerm) ||
        task.projectName.toLowerCase().includes(searchTerm) ||
        task.clientName.toLowerCase().includes(searchTerm)
      )
    }

  } catch (error) {
    console.error('Error fetching FFE data:', error)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'NEEDS_ATTENTION':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'NEEDS_ATTENTION':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Package className="w-5 h-5 text-gray-400" />
    }
  }

  const getRoomIcon = (roomType: string) => {
    // You can expand this with more room-specific icons
    return <Building className="w-4 h-4" />
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Package className="w-7 h-7 text-emerald-600 mr-3" />
              FFE Sourcing Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Furniture, Fixtures & Equipment management for all active projects
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Search Form */}
            <form method="GET" className="flex items-center space-x-2">
              {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="search"
                  placeholder="Search projects, rooms..."
                  defaultValue={searchParams.search}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-64"
                />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>
            
            <Link href={searchParams.status === 'overdue' ? '/ffe' : '/ffe?status=overdue'}>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                {searchParams.status === 'overdue' ? 'Show All' : 'Show Overdue'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total FFE Tasks</p>
                  <p className="text-3xl font-bold text-gray-900">{ffeStats.total}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <Package className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-3xl font-bold text-blue-600">{ffeStats.inProgress}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{ffeStats.completed}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-3xl font-bold text-red-600">{ffeStats.overdue}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FFE Tasks List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {searchParams.status === 'overdue' ? 'Overdue FFE Tasks' : 'Active FFE Tasks'}
            </h2>
            <p className="text-sm text-gray-500">{ffeTasks.length} tasks</p>
          </div>

          {ffeTasks.length > 0 ? (
            <div className="space-y-4">
              {ffeTasks.map((task) => (
                <Link key={task.id} href={`/stages/${task.id}`}>
                  <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-emerald-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          {/* Status Icon */}
                          <div className="flex-shrink-0 mt-1">
                            {getStatusIcon(task.status)}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                  {task.title}
                                </h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                  <div className="flex items-center space-x-1">
                                    <Building className="w-4 h-4" />
                                    <span>{task.projectName}</span>
                                  </div>
                                  <span>•</span>
                                  <div className="flex items-center space-x-1">
                                    <Users className="w-4 h-4" />
                                    <span>{task.clientName}</span>
                                  </div>
                                  <span>•</span>
                                  <div className="flex items-center space-x-1">
                                    {getRoomIcon(task.roomType)}
                                    <span>{task.roomType.replace('_', ' ')}</span>
                                  </div>
                                </div>
                                
                                {/* Assigned User */}
                                {task.assignedUser && (
                                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                                    <Users className="w-4 h-4" />
                                    <span>Assigned to {task.assignedUser.name}</span>
                                  </div>
                                )}
                                
                                {/* Due Date Info */}
                                {task.dueDate && (
                                  <div className={`flex items-center space-x-2 text-sm px-3 py-2 rounded-lg ${
                                    task.overdueBy !== null && task.overdueBy > 0 ? 'bg-red-50 border border-red-200' :
                                    task.overdueBy === 0 ? 'bg-yellow-50 border border-yellow-200' :
                                    'bg-gray-50 border border-gray-200'
                                  }`}>
                                    <Calendar className={`w-4 h-4 ${
                                      task.overdueBy !== null && task.overdueBy > 0 ? 'text-red-500' :
                                      task.overdueBy === 0 ? 'text-yellow-500' :
                                      'text-gray-500'
                                    }`} />
                                    <span className={`font-medium ${
                                      task.overdueBy !== null && task.overdueBy > 0 ? 'text-red-700' :
                                      task.overdueBy === 0 ? 'text-yellow-700' :
                                      'text-gray-700'
                                    }`}>
                                      Due: {formatDate(task.dueDate)}
                                      {task.overdueBy !== null && task.overdueBy > 0 && (
                                        <span className="ml-2 font-bold text-red-600">
                                          ({task.overdueBy} day{task.overdueBy > 1 ? 's' : ''} overdue)
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
                          <Badge className={getStatusColor(task.status)}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                          
                          {task.overdueBy !== null && task.overdueBy > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            /* Empty State */
            <Card>
              <CardContent className="p-12 text-center">
                <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
                  <Package className="w-full h-full" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchParams.status === 'overdue' 
                    ? 'No overdue FFE tasks! 🎉' 
                    : searchParams.search 
                      ? `No FFE tasks found for "${searchParams.search}"` 
                      : 'No FFE tasks assigned'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchParams.status === 'overdue' 
                    ? 'All your FFE tasks are on track!'
                    : searchParams.search
                      ? 'Try adjusting your search terms.'
                      : 'FFE tasks will appear here as projects progress to the FFE stage.'}
                </p>
                <Button asChild>
                  <Link href="/projects">
                    View Projects
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}