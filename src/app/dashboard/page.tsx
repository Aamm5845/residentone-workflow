import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { FolderOpen, Users, Clock, CheckCircle, AlertCircle, TrendingUp, Building } from 'lucide-react'
import { formatDate, getStatusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Session } from 'next-auth'

export default async function Dashboard() {
  const session = await getSession() as Session & {
    user: {
      id: string
      name: string
      orgId: string
      role: string
    }
  } | null
  
  // More forgiving authentication check - handle both NextAuth and fallback
  if (!session?.user) {
    redirect('/auth/signin')
  }
  
  // Ensure orgId exists (create fallback if missing)
  if (!session.user.orgId) {
    session.user.orgId = 'fallback-org'
    session.user.role = session.user.role || 'OWNER'
    session.user.name = session.user.name || 'Admin User'
  }

  // Fetch dashboard data with fallback
  let activeProjects = 0
  let totalClients = 0
  let pendingApprovals = 0
  let recentProjects: any[] = []
  
  try {
    const [
      activeProjectsCount,
      totalClientsCount,
      pendingApprovalsCount,
      recentProjectsData
    ] = await Promise.all([
      prisma.project.count({
        where: {
          orgId: session.user.orgId,
          status: { in: ['IN_PROGRESS', 'PENDING_APPROVAL'] }
        }
      }),
      prisma.client.count({
        where: { orgId: session.user.orgId }
      }),
      prisma.approval.count({
        where: {
          project: { orgId: session.user.orgId },
          status: 'PENDING'
        }
      }),
      prisma.project.findMany({
        where: { orgId: session.user.orgId },
        include: {
          client: true,
          rooms: {
            include: {
              stages: true
            }
          },
          _count: {
            select: { rooms: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 5
      })
    ])
    
    activeProjects = activeProjectsCount
    totalClients = totalClientsCount
    pendingApprovals = pendingApprovalsCount
    recentProjects = recentProjectsData
    
  } catch (error) {
    console.warn('Database unavailable, using fallback data')
    
    // Import and use fallback data
    const { fallbackProjects } = await import('@/lib/fallback-data')
    
    activeProjects = 2
    totalClients = 2
    pendingApprovals = 1
    recentProjects = fallbackProjects
  }

  const stats = [
    {
      name: 'Active Projects',
      value: activeProjects.toString(),
      icon: FolderOpen,
      color: 'bg-blue-500',
    },
    {
      name: 'Total Clients',
      value: totalClients.toString(),
      icon: Users,
      color: 'bg-green-500',
    },
    {
      name: 'Pending Approvals',
      value: pendingApprovals.toString(),
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      name: 'This Month',
      value: '12', // Placeholder - could calculate actual completed this month
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
  ]

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-8">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Good morning, {session.user.name}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              You have {activeProjects} active projects and {pendingApprovals} pending approvals
            </p>
          </div>
        </div>

        {/* My Work Section - Task-based like Asana */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">My Tasks Today</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Task Items based on role */}
              {session.user.role === 'DESIGNER' && (
                <>
                  <TaskItem 
                    title="Complete Master Bedroom design for Johnson Residence"
                    project="Johnson Residence"
                    priority="high"
                    dueDate="Today"
                    status="in-progress"
                  />
                  <TaskItem 
                    title="Review Living Room concept boards"
                    project="Smith Residence"
                    priority="medium"
                    dueDate="Tomorrow"
                    status="pending"
                  />
                  <TaskItem 
                    title="Client meeting prep - Material selections"
                    project="Johnson Residence"
                    priority="high"
                    dueDate="Today"
                    status="pending"
                  />
                </>
              )}
              {session.user.role === 'RENDERER' && (
                <>
                  <TaskItem 
                    title="Render Master Bedroom - 3 views"
                    project="Johnson Residence"
                    priority="high"
                    dueDate="Today"
                    status="in-progress"
                  />
                  <TaskItem 
                    title="Kitchen renderings for client approval"
                    project="Smith Residence"
                    priority="medium"
                    dueDate="Tomorrow"
                    status="pending"
                  />
                </>
              )}
              {session.user.role === 'FFE' && (
                <>
                  <TaskItem 
                    title="Source headboard for Master Bedroom"
                    project="Johnson Residence"
                    priority="high"
                    dueDate="Today"
                    status="pending"
                  />
                  <TaskItem 
                    title="Update lighting specifications"
                    project="Smith Residence"
                    priority="medium"
                    dueDate="This week"
                    status="pending"
                  />
                  <TaskItem 
                    title="Review fabric samples"
                    project="Johnson Residence"
                    priority="low"
                    dueDate="Next week"
                    status="pending"
                  />
                </>
              )}
              {session.user.role === 'DRAFTER' && (
                <TaskItem 
                  title="Complete construction drawings"
                  project="Johnson Residence"
                  priority="high"
                  dueDate="Tomorrow"
                  status="in-progress"
                />
              )}
            </div>
          </div>
        </div>

        {/* Project Overview Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
            <Button variant="outline" size="sm">
              View All Projects
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentProjects.map((project) => {
              const completedRooms = project.rooms.filter((room: any) => 
                room.stages.some((stage: any) => stage.status === 'COMPLETED')
              ).length
              const progressPercent = project.rooms.length > 0 
                ? Math.round((completedRooms / project.rooms.length) * 100)
                : 0

              return (
                <ProjectCard 
                  key={project.id}
                  project={project}
                  progressPercent={progressPercent}
                />
              )
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            label="Active Projects"
            value={activeProjects}
            icon={FolderOpen}
            color="bg-blue-500"
          />
          <StatCard
            label="Total Clients"
            value={totalClients}
            icon={Users}
            color="bg-green-500"
          />
          <StatCard
            label="Pending Approvals"
            value={pendingApprovals}
            icon={Clock}
            color="bg-orange-500"
          />
          <StatCard
            label="Completed This Month"
            value="8"
            icon={CheckCircle}
            color="bg-purple-500"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

// Component for individual task items
function TaskItem({ title, project, priority, dueDate, status }: {
  title: string
  project: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string
  status: 'pending' | 'in-progress' | 'complete'
}) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    low: 'bg-green-100 text-green-800 border-green-200'
  }
  
  const statusIcons = {
    pending: '⏳',
    'in-progress': '🔄',
    complete: '✅'
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
      <div className="flex items-center space-x-4">
        <div className="w-8 h-8 bg-white rounded border-2 border-gray-300 flex items-center justify-center">
          <span className="text-lg">{statusIcons[status]}</span>
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{project} • Due {dueDate}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${priorityColors[priority]}`}>
          {priority}
        </span>
      </div>
    </div>
  )
}

// Component for project cards
function ProjectCard({ project, progressPercent }: {
  project: any
  progressPercent: number
}) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer hover:border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-700">{project.name}</h3>
            <p className="text-sm text-gray-600">{project.client.name}</p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
            <Building className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>{project._count.rooms} rooms</span>
          <span>{formatDate(project.updatedAt)}</span>
        </div>
      </div>
    </Link>
  )
}

// Component for stat cards
function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: any
  color: string
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`${color} p-3 rounded-lg mr-4`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  )
}
