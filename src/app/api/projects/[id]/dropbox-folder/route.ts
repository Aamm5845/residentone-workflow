import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { dropboxService } from '@/lib/dropbox-service'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { projectName } = await request.json()

    if (!projectName) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create Dropbox folder structure
    try {
      console.log('📁 Creating Dropbox folder structure for project:', projectName)
      const folderPath = await dropboxService.createProjectFolderStructure(projectName)
      console.log('✅ Dropbox folder created:', folderPath)
      
      return NextResponse.json({
        success: true,
        folderPath
      }, { status: 200 })
    } catch (error) {
      console.error('❌ Failed to create Dropbox folder structure:', error)
      return NextResponse.json({
        error: 'Failed to create Dropbox folder structure',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in dropbox-folder route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
