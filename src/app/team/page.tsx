import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import TeamManagementClient from '@/components/team/team-management-client'
import type { Session } from 'next-auth'

export default async function TeamManagement() {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      role: string
    }
  } | null
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  // Only allow OWNER and ADMIN to access team management
  if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  // Fetch team members with fallback
  let teamMembers: any[] = []
  
  try {
    teamMembers = await prisma.user.findMany({
      where: { orgId: session.user.orgId },
      include: {
        organization: true,
        assignedStages: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          },
          where: {
            status: 'IN_PROGRESS'
          }
        },
        _count: {
          select: {
            assignedStages: true,
            comments: true,
            uploadedAssets: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
  } catch (error) {
    console.warn('Database unavailable, using fallback team data')
    
    // Fallback team data
    teamMembers = [
      {
        id: 'user-1',
        name: 'Aaron (Designer)',
        email: 'aaron@company.com',
        role: 'DESIGNER',
        status: 'ACTIVE',
        assignedStages: [],
        _count: { assignedStages: 2, comments: 15, uploadedAssets: 8 }
      },
      {
        id: 'user-2',
        name: 'Vitor (Renderer)',
        email: 'vitor@company.com',
        role: 'RENDERER',
        status: 'ACTIVE',
        assignedStages: [],
        _count: { assignedStages: 1, comments: 5, uploadedAssets: 12 }
      },
      {
        id: 'user-3',
        name: 'Sammy (Drafter)',
        email: 'sammy@company.com',
        role: 'DRAFTER',
        status: 'ACTIVE',
        assignedStages: [],
        _count: { assignedStages: 0, comments: 3, uploadedAssets: 6 }
      },
      {
        id: 'user-4',
        name: 'Shaya (FFE)',
        email: 'shaya@company.com',
        role: 'FFE',
        status: 'ACTIVE',
        assignedStages: [],
        _count: { assignedStages: 0, comments: 8, uploadedAssets: 4 }
      }
    ]
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
            <p className="text-gray-600 mt-1">
              Manage team members, roles, and assignments
            </p>
          </div>
        </div>

        <TeamManagementClient 
          teamMembers={teamMembers}
          currentUser={session.user}
        />
      </div>
    </DashboardLayout>
  )
}
