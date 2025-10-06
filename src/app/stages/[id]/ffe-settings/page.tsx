import { getSession } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getStageName } from '@/constants/workflow'
import FFESettingsPageClient from '@/components/stages/ffe-settings-page-client'
import type { Session } from 'next-auth'

export default async function FFESettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  const resolvedParams = await params
  
  if (!session?.user) {
    return redirect('/auth/signin')
  }

  // Fetch stage with room data
  let stage: any = null
  
  try {
    stage = await prisma.stage.findFirst({
      where: { 
        id: resolvedParams.id,
        type: 'FFE' // Only allow FFE settings for FFE stages
      },
      select: {
        id: true,
        type: true,
        status: true,
        room: {
          select: {
            id: true,
            type: true,
            name: true,
            status: true,
            project: {
              select: {
                id: true,
                name: true,
                orgId: true
              }
            }
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching stage data:', error)
    stage = null
  }

  if (!stage) {
    notFound()
  }

  // Check access - user must belong to same org
  if (stage.room.project.orgId !== session.user.orgId) {
    return redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/stages/${stage.id}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              FFE Settings - {stage.room.name || stage.room.type}
            </h1>
            <p className="text-gray-600">
              Manage furniture, fixtures, and equipment for this room
            </p>
          </div>
        </div>

        {/* Settings Content */}
        <FFESettingsPageClient 
          stageId={stage.id}
          roomId={stage.room.id}
          roomName={stage.room.name}
          roomType={stage.room.type}
          projectId={stage.room.project.id}
          projectName={stage.room.project.name}
          orgId={session.user.orgId}
        />
      </div>
    </DashboardLayout>
  )
}