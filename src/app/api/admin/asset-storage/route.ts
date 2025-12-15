import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: string
  }
}

// GET /api/admin/asset-storage?projectId=xxx or ?search=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // All authenticated team members can access this

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const search = searchParams.get('search')

    // If searching for projects
    if (search) {
      const projects = await prisma.project.findMany({
        where: {
          orgId: session.user.orgId,
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { client: { name: { contains: search, mode: 'insensitive' } } },
            { address: { contains: search, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          dropboxFolder: true,
          client: { select: { name: true } },
          _count: { select: { assets: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      })

      return NextResponse.json({ projects })
    }

    // If getting assets for a specific project
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          orgId: session.user.orgId
        },
        select: {
          id: true,
          name: true,
          dropboxFolder: true,
          client: { select: { name: true } }
        }
      })

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      // Get all assets for this project
      const assets = await prisma.asset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          title: true,
          filename: true,
          url: true,
          type: true,
          size: true,
          mimeType: true,
          metadata: true,
          createdAt: true,
          uploadedByUser: {
            select: { name: true }
          }
        }
      })

      // Analyze storage location for each asset
      const analyzedAssets = assets.map(asset => {
        let metadata: Record<string, unknown> = {}
        try {
          metadata = asset.metadata ? JSON.parse(asset.metadata as string) : {}
        } catch {
          // Ignore parse errors
        }

        const dropboxPath = (metadata?.dropboxPath as string) || 
          (asset.url?.startsWith('/') ? asset.url : null)
        const isBase64 = asset.url?.startsWith('data:')
        const isEmpty = !asset.url || asset.url === ''
        const isDropboxProtocol = asset.url?.startsWith('dropbox://')

        let storageType: 'dropbox' | 'database' | 'empty' | 'other' = 'other'
        let storagePath: string | null = null

        if (dropboxPath) {
          storageType = 'dropbox'
          storagePath = dropboxPath
        } else if (isDropboxProtocol) {
          storageType = 'dropbox'
          storagePath = asset.url?.replace('dropbox://', '') || null
        } else if (isBase64) {
          storageType = 'database'
          storagePath = 'Stored as base64 in database'
        } else if (isEmpty) {
          storageType = 'empty'
          storagePath = 'No file stored'
        }

        return {
          id: asset.id,
          title: asset.title || asset.filename || 'Unknown',
          filename: asset.filename,
          type: asset.type,
          size: asset.size,
          mimeType: asset.mimeType,
          storageType,
          storagePath,
          createdAt: asset.createdAt,
          uploadedBy: asset.uploadedByUser?.name || 'Unknown'
        }
      })

      // Calculate summary
      const summary = {
        total: analyzedAssets.length,
        dropbox: analyzedAssets.filter(a => a.storageType === 'dropbox').length,
        database: analyzedAssets.filter(a => a.storageType === 'database').length,
        empty: analyzedAssets.filter(a => a.storageType === 'empty').length,
        other: analyzedAssets.filter(a => a.storageType === 'other').length
      }

      return NextResponse.json({
        project: {
          ...project,
          hasDropbox: !!project.dropboxFolder
        },
        assets: analyzedAssets,
        summary
      })
    }

    return NextResponse.json({ error: 'Missing projectId or search parameter' }, { status: 400 })
  } catch (error) {
    console.error('[Asset Storage API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

