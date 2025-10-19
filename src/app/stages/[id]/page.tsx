import { getSession } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import DesignStage from '@/components/stages/design-stage'
import StageDetailClient from '@/components/stages/stage-detail-client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getStageName } from '@/constants/workflow'
import type { Session } from 'next-auth'

export default async function StageDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
      email?: string
    }
  } | null
  const resolvedParams = await params
  
  if (!session?.user) {
    
    return redirect('/auth/signin')
  }

  // Get orgId from user record if not in session (Vercel fix)
  let userOrgId = session.user.orgId
  if (!userOrgId && session.user.email) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      userOrgId = user?.orgId
      
    } catch (error) {
      console.error('Error fetching user orgId:', error)
    }
  }
  
  if (!userOrgId) {
    
    return redirect('/auth/signin')
  }

  // Fetch stage with fallback
  let stage: any = null
  
  try {
    stage = await prisma.stage.findFirst({
      where: { 
        id: resolvedParams.id
      },
      select: {
        id: true,
        type: true,
        status: true,
        assignedTo: true,
        dueDate: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedUser: {
          select: { 
            id: true,
            name: true 
          }
        },
        designSections: {
          select: {
            id: true,
            type: true,
            content: true,
            completed: true,
            createdAt: true,
            updatedAt: true,
            // Only count assets instead of fetching full data
            _count: {
              select: {
                assets: true
              }
            },
            comments: {
              select: {
                id: true,
                content: true,
                createdAt: true,
                author: {
                  select: { 
                    id: true,
                    name: true 
                  }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
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
                orgId: true,
                client: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            },
            stages: {
              select: {
                id: true,
                type: true,
                status: true,
                assignedTo: true,
                dueDate: true,
                assignedUser: {
                  select: { 
                    id: true,
                    name: true 
                  }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            // Only count FFE items instead of fetching full data
            _count: {
              select: {
                ffeItems: true
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
  if (stage.room.project.orgId !== userOrgId) {
    
    return redirect('/auth/signin')
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
              {getStageName(stage.type)} Phase
            </h1>
            <p className="text-gray-600">
              {stage.room.name || stage.room.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • {stage.room.project.name} • {stage.room.project.client.name}
            </p>
          </div>
        </div>

        {/* Stage Content */}
        <StageDetailClient stage={stage} />
      </div>
    </DashboardLayout>
  )
}
