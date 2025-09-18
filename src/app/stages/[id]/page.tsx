import { getSession } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import DesignStage from '@/components/stages/design-stage'
import StageDetailClient from '@/components/stages/stage-detail-client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Session } from 'next-auth'

export default async function StageDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  const resolvedParams = await params
  
  if (!session?.user?.orgId) {
    return redirect('/auth/signin')
  }

  // Fetch stage with fallback
  let stage: any = null
  
  try {
    stage = await prisma.stage.findFirst({
      where: { 
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        assignedUser: {
          select: { name: true }
        },
        designSections: {
          include: {
            assets: true,
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            },
            stages: {
              include: {
                assignedUser: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            ffeItems: true
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

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/projects/${stage.room.project.id}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {stage.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Stage
            </h1>
            <p className="text-gray-600">
              {stage.room.name || stage.room.type.replace('_', ' ')} - {stage.room.project.name}
            </p>
          </div>
        </div>

        {/* Stage Content */}
        <StageDetailClient stage={stage} />
      </div>
    </DashboardLayout>
  )
}
