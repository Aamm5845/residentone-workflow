import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET share settings for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id: projectId } = resolvedParams

    // Get user's orgId
    let orgId = session.user.orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    // Verify project belongs to user's org
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: orgId
      },
      select: {
        id: true,
        name: true,
        shareSettings: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse share settings from JSON field or return defaults
    const shareSettings = project.shareSettings as any || {
      isPublished: false,
      showSupplier: false,
      showBrand: true,
      showPricing: false,
      showDetails: true
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    
    return NextResponse.json({
      success: true,
      settings: {
        ...shareSettings,
        shareUrl: shareSettings.isPublished 
          ? `${baseUrl}/shared/specs/${projectId}`
          : null
      }
    })

  } catch (error) {
    console.error('Error fetching share settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch share settings' },
      { status: 500 }
    )
  }
}

// POST/update share settings for a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id: projectId } = resolvedParams
    const body = await request.json()

    // Get user's orgId
    let orgId = session.user.orgId
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      orgId = user.orgId
    }

    // Verify project belongs to user's org
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Prepare share settings
    const shareSettings = {
      isPublished: body.isPublished ?? false,
      showSupplier: body.showSupplier ?? false,
      showBrand: body.showBrand ?? true,
      showPricing: body.showPricing ?? false,
      showDetails: body.showDetails ?? true,
      updatedAt: new Date().toISOString()
    }

    // Update project with new share settings
    await prisma.project.update({
      where: { id: projectId },
      data: {
        shareSettings: shareSettings
      }
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    const shareUrl = shareSettings.isPublished 
      ? `${baseUrl}/shared/specs/${projectId}`
      : null

    return NextResponse.json({
      success: true,
      settings: shareSettings,
      shareUrl
    })

  } catch (error) {
    console.error('Error updating share settings:', error)
    return NextResponse.json(
      { error: 'Failed to update share settings' },
      { status: 500 }
    )
  }
}
