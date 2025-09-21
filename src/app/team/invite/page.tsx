import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import InviteTeamMemberForm from '@/components/team/invite-team-member-form'
import type { Session } from 'next-auth'

export default async function InviteTeamMember() {
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

  // Only allow OWNER and ADMIN to invite team members
  if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
    redirect('/team')
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Invite Team Member</h1>
            <p className="text-gray-600 mt-1">
              Add a new team member to your organization
            </p>
          </div>

          <InviteTeamMemberForm currentUser={session.user} />
        </div>
      </div>
    </DashboardLayout>
  )
}