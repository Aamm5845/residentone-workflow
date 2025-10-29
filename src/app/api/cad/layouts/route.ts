import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Session } from 'next-auth'
import { enhancedCADConversionService } from '@/lib/cad-conversion-enhanced'
import { dropboxService } from '@/lib/dropbox-service-v2'
import { CadLayout, LayoutDiscoveryResult, LAYOUT_CACHE_EXPIRY_DAYS } from '@/types/cad-preferences'

// Validation schema
const getLayoutsSchema = z.object({
  dropboxPath: z.string().min(1, "Dropbox path is required")
})

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

/**
 * Discover layouts in a CAD file
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const dropboxPath = searchParams.get('dropboxPath')
    
    if (!dropboxPath) {
      return NextResponse.json({ error: 'dropboxPath query parameter is required' }, { status: 400 })
    }

    // Validate the user has access to files with this path
    // Check if there's at least one linked file with this path in their organization
    const hasAccess = await prisma.dropboxFileLink.findFirst({
      where: { 
        dropboxPath,
        section: {
          specBook: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      }
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this file' }, { status: 403 })
    }

    // Get file metadata from Dropbox to get the revision
    const fileMetadata = await dropboxService.getFileMetadata(dropboxPath)
    if (!fileMetadata) {
      return NextResponse.json({ error: 'File not found in Dropbox' }, { status: 404 })
    }

    const revision = fileMetadata.revision

    // Check cache first
    const cachedLayouts = await prisma.cadLayoutCache.findFirst({
      where: { 
        dropboxPath,
        dropboxRevision: revision,
        expiresAt: { gt: new Date() }
      }
    })

    if (cachedLayouts) {
      const layouts = (cachedLayouts.layouts as string[]).map(layoutName => ({
        name: layoutName,
        isModelSpace: layoutName.toLowerCase() === 'model',
        displayName: layoutName === 'Model' ? 'Model Space' : layoutName
      }))

      return NextResponse.json({
        success: true,
        layouts,
        cached: true
      } as LayoutDiscoveryResult)
    }

    // Attempt to discover layouts using the enhanced conversion service
    try {
      const discoveredLayouts = await enhancedCADConversionService.discoverLayouts(dropboxPath, revision)
      
      const layouts: CadLayout[] = discoveredLayouts.map(layoutName => ({
        name: layoutName,
        isModelSpace: layoutName.toLowerCase() === 'model',
        displayName: layoutName === 'Model' ? 'Model Space' : layoutName
      }))

      // Cache the results
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + LAYOUT_CACHE_EXPIRY_DAYS)

      await prisma.cadLayoutCache.upsert({
        where: { 
          dropboxPath_dropboxRevision: {
            dropboxPath,
            dropboxRevision: revision
          }
        },
        create: {
          dropboxPath,
          dropboxRevision: revision,
          layouts: discoveredLayouts,
          expiresAt
        },
        update: {
          layouts: discoveredLayouts,
          discoveredAt: new Date(),
          expiresAt
        }
      })

      return NextResponse.json({
        success: true,
        layouts,
        cached: false
      } as LayoutDiscoveryResult)

    } catch (discoveryError) {
      console.error('Layout discovery failed:', discoveryError)
      
      // Return fallback layouts with error information
      const fallbackLayouts: CadLayout[] = [
        { name: 'Model', isModelSpace: true, displayName: 'Model Space' },
        { name: 'Layout1', isModelSpace: false, displayName: 'Layout1' },
        { name: 'Layout2', isModelSpace: false, displayName: 'Layout2' }
      ]

      return NextResponse.json({
        success: false,
        layouts: fallbackLayouts,
        cached: false,
        error: 'Layout discovery failed, showing common layouts. You can still manually enter a layout name.'
      } as LayoutDiscoveryResult)
    }

  } catch (error) {
    console.error('Error discovering CAD layouts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Clear layout cache for a specific file (force refresh)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const dropboxPath = searchParams.get('dropboxPath')
    
    if (!dropboxPath) {
      return NextResponse.json({ error: 'dropboxPath query parameter is required' }, { status: 400 })
    }

    // Validate the user has access to this file
    const hasAccess = await prisma.dropboxFileLink.findFirst({
      where: { 
        dropboxPath,
        section: {
          specBook: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      }
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this file' }, { status: 403 })
    }

    // Delete cache entries for this file
    const deletedCount = await prisma.cadLayoutCache.deleteMany({
      where: { dropboxPath }
    })

    return NextResponse.json({ 
      success: true, 
      message: `Cleared ${deletedCount.count} cache entries for file` 
    })

  } catch (error) {
    console.error('Error clearing layout cache:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
