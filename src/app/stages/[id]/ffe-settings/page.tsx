import { getSession } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export default async function FFESettingsPage({ params }: { params: Promise<{ id: string }> }) {
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
  if (stage.room.project.orgId !== userOrgId) {
    return redirect('/auth/signin')
  }

  // Redirect to the new dedicated FFE settings page
  redirect(`/ffe/${stage.room.id}/settings`)
}