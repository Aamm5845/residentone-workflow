import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { Filter, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import type { Session } from 'next-auth'

export default async function Stages({ searchParams }: { searchParams: { status?: string } }) {
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
    room: {
      project: { orgId: session.user.orgId }
    }
  }

  if (statusFilter === 'active') {
    whereClause.status = 'IN_PROGRESS'
  }

  // Fetch stages from database
  let stages: any[] = []
  
  try {
    stages = await prisma.stage.findMany({
      where: whereClause,
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
      orderBy: { updatedAt: 'desc' }
    })
  } catch (error) {
    console.error('Error fetching stages:', error)
    stages = []
  }

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

  const formatStageType = (type: string) => {
    return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {statusFilter === 'active' ? 'Active Stages' : 'All Stages'}
            </h1>
            <p className="text-gray-600 mt-1">
              {stages.length} {statusFilter === 'active' ? 'active' : ''} stages
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

        {/* Stages List */}
        <div className="space-y-6">
          {stages.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Room & Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stages.map((stage) => (
                      <tr key={stage.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/stages/${stage.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIcon(stage.status)}
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {formatStageType(stage.type)}
                              </div>
                              <div className="text-sm text-gray-500">
                                Stage {stage.order || 1}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {stage.room.name || stage.room.type.replace('_', ' ')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {stage.room.project.name} • {stage.room.project.client.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(stage.status)}`}>
                            {stage.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stage.assignedUser ? (
                            <div className="flex items-center">
                              <Users className="w-4 h-4 text-gray-400 mr-2" />
                              {stage.assignedUser.name}
                            </div>
                          ) : (
                            <span className="text-gray-500">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stage.dueDate ? formatDate(stage.dueDate) : 'No due date'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(stage.updatedAt)}
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
                <Clock className="w-full h-full" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {statusFilter === 'active' ? 'No active stages' : 'No stages found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {statusFilter === 'active' 
                  ? 'All stages are completed or on hold.'
                  : 'Stages will appear here as projects are created.'}
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