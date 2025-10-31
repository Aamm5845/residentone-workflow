import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import ProjectOrganizedTasks from '@/components/team/project-organized-tasks'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail, User as UserIcon, Settings } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Session } from 'next-auth'

interface PageProps {
  params: Promise<{
    memberId: string
  }>
}

export default async function TeamMemberTasks({ params }: PageProps) {
  const resolvedParams = await params
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      role: string
    }
  } | null
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  let member: any = null
  
  console.log('[Team Member Page] Loading member:', resolvedParams.memberId)
  
  try {
    // First, try to get basic user info
    member = await prisma.user.findUnique({
      where: {
        id: resolvedParams.memberId
      }
    })
    
    if (!member) {
      console.log('[Team Member Page] User not found with ID:', resolvedParams.memberId)
      redirect('/team?error=member_not_found')
    }
    
    console.log('[Team Member Page] Basic user loaded:', member.name, member.email)
    
    // Now load the full data
    member = await prisma.user.findUnique({
      where: {
        id: resolvedParams.memberId
      },
      include: {
        assignedStages: {
          where: {
            status: {
              in: ['NOT_STARTED', 'IN_PROGRESS', 'NEEDS_ATTENTION', 'ON_HOLD', 'PENDING_APPROVAL']
            }
          },
          include: {
            room: {
              include: {
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
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            assignedStages: true,
            comments: true,
            uploadedAssets: true
          }
        }
      }
    })
    
    console.log('[Team Member Page] Member loaded:', {
      id: member?.id,
      name: member?.name,
      email: member?.email,
      role: member?.role,
      hasPhone: !!member?.phoneNumber,
      phoneNumber: member?.phoneNumber,
      smsEnabled: member?.smsNotificationsEnabled,
      tasksCount: member?.assignedStages?.length || 0,
      _count: member?._count
    })
  } catch (error) {
    console.error('[Team Member Page] Database error:', error)
    console.error('[Team Member Page] Error type:', typeof error)
    console.error('[Team Member Page] Error constructor:', error?.constructor?.name)
    console.error('[Team Member Page] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      memberId: resolvedParams.memberId,
      stack: error instanceof Error ? error.stack : undefined,
      errorKeys: error ? Object.keys(error) : [],
      errorString: JSON.stringify(error, null, 2)
    })
    
    // Don't throw - redirect to team page with error
    console.error('[Team Member Page] Redirecting to team page due to error')
    redirect('/team?error=member_load_failed')
  }

  if (!member) {
    console.error('[Team Member Page] Member not found:', resolvedParams.memberId)
    redirect('/team?error=member_not_found')
  }
  
  // Check if user is active team member
  if (!member.orgId) {
    console.error('[Team Member Page] Member not in organization:', resolvedParams.memberId)
    redirect('/team?error=member_not_active')
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: 'bg-purple-100 text-purple-800',
      ADMIN: 'bg-blue-100 text-blue-800', 
      DESIGNER: 'bg-green-100 text-green-800',
      RENDERER: 'bg-orange-100 text-orange-800',
      DRAFTER: 'bg-indigo-100 text-indigo-800',
      FFE: 'bg-pink-100 text-pink-800',
      VIEWER: 'bg-gray-100 text-gray-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  const getTaskStats = () => {
    if (!member.assignedStages) return { total: 0, inProgress: 0, overdue: 0, completed: 0 }
    
    const total = member.assignedStages.length
    const inProgress = member.assignedStages.filter((s: any) => s.status === 'IN_PROGRESS').length
    const overdue = member.assignedStages.filter((s: any) => 
      s.dueDate && new Date(s.dueDate) < new Date()
    ).length
    
    return { total, inProgress, overdue }
  }

  const stats = getTaskStats()

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* Back Button */}
            <Button variant="outline" asChild>
              <Link href="/team">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Team
              </Link>
            </Button>

            {/* Member Info */}
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 h-16 w-16">
                {member.image ? (
                  <Image
                    src={member.image}
                    alt={member.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {member.name || 'Team Member'}
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{member.email}</span>
                  </div>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            <Button variant="outline" asChild>
              <Link href={`/team/${member.id}/preferences`}>
                <Settings className="w-4 h-4 mr-2" />
                Team Preferences
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-600">Active Tasks</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <div className="h-6 w-6 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">▶</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <div className="h-6 w-6 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">!</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
                <p className="text-sm text-gray-600">Overdue</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <UserIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{member._count?.comments || 0}</p>
                <p className="text-sm text-gray-600">Comments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Project-Organized Tasks */}
        <ProjectOrganizedTasks member={member} isExpanded={true} />

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Assigned Stages:</span>
                <span className="font-medium">{member._count?.assignedStages || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Comments Made:</span>
                <span className="font-medium">{member._count?.comments || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Files Uploaded:</span>
                <span className="font-medium">{member._count?.uploadedAssets || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href={`/team/${member.id}/preferences`}>
                  <Settings className="w-4 h-4 mr-2" />
                  Team Preferences
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Send Message
              </Button>
              {(session.user.role === 'OWNER' || session.user.role === 'ADMIN') && (
                <Button className="w-full justify-start" variant="outline">
                  <UserIcon className="w-4 h-4 mr-2" />
                  Manage Assignments
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}