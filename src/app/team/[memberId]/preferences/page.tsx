import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { NotificationPreferences } from '@/components/team/NotificationPreferences'
import { ProfileUpdateForm } from '@/components/team/ProfileUpdateForm'
import { ChangePasswordForm } from '@/components/team/ChangePasswordForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Session } from 'next-auth'

interface PageProps {
  params: Promise<{
    memberId: string
  }>
}

export default async function TeamMemberPreferences({ params }: PageProps) {
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
  
  try {
    member = await prisma.user.findUnique({
      where: {
        id: resolvedParams.memberId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        phoneNumber: true,
        smsNotificationsEnabled: true,
        emailNotificationsEnabled: true,
        orgId: true
      }
    })
  } catch (error) {
    console.error('[Team Preferences] Database error:', error)
    redirect('/team?error=member_load_failed')
  }

  if (!member || !member.orgId) {
    redirect('/team?error=member_not_found')
  }

  // Only allow the user themselves or admins/owners to view preferences
  const canEdit = session.user.id === member.id || ['OWNER', 'ADMIN'].includes(session.user.role)

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

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
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
                  Team Preferences
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm text-gray-600">{member.name || 'Team Member'}</span>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!canEdit && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              You don't have permission to edit these preferences. Only the user or administrators can modify these settings.
            </p>
          </div>
        )}

        {/* Preferences Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <ProfileUpdateForm
            userId={member.id}
            initialName={member.name}
            initialEmail={member.email}
            initialImage={member.image}
            canEdit={canEdit}
          />

          {/* Security Settings */}
          <ChangePasswordForm
            userId={member.id}
            canEdit={canEdit}
          />

          {/* Notification Preferences - Full Width */}
          <div className="lg:col-span-2">
            <NotificationPreferences
              userId={member.id}
              initialEmailEnabled={member.emailNotificationsEnabled ?? true}
              initialSmsEnabled={member.smsNotificationsEnabled}
              initialPhoneNumber={member.phoneNumber}
              canEdit={canEdit}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
