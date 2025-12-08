import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { unlink } from 'fs/promises'
import type { Session } from 'next-auth'

// GET /api/assets/[assetId] - Get asset details including Dropbox path
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
      }
    } | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { assetId } = resolvedParams

    const asset = await prisma.asset.findFirst({
      where: { 
        id: assetId,
        orgId: session.user.orgId
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            dropboxFolder: true
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Return asset with diagnostic info about storage location
    return NextResponse.json({
      id: asset.id,
      title: asset.title,
      filename: asset.filename,
      provider: asset.provider,
      dropboxPath: asset.url,
      projectDropboxFolder: asset.project?.dropboxFolder,
      room: asset.room ? {
        name: asset.room.name,
        type: asset.room.type
      } : null,
      uploadedAt: asset.createdAt
    })
  } catch (error) {
    console.error('[Asset Get] Error:', error)
    return NextResponse.json({ error: 'Failed to retrieve asset' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        name: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the asset and verify ownership/access
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id: resolvedParams.assetId,
        orgId: session.user.orgId // Same organization
      },
      include: {
        renderingVersion: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!existingAsset) {
      return NextResponse.json({ error: 'Asset not found or unauthorized' }, { status: 404 })
    }

    // Delete from Dropbox if this is a rendering asset and project has dropboxFolder
    if (existingAsset.renderingVersion && existingAsset.renderingVersion.room.project.dropboxFolder) {
      try {
        // Use custom room name if provided, otherwise use room type (matching upload pattern)
        let roomName = existingAsset.renderingVersion.room.name && existingAsset.renderingVersion.room.name.trim()
        if (!roomName) {
          // Convert enum value to readable format: LIVING_ROOM -> Living Room
          roomName = existingAsset.renderingVersion.room.type
            .split('_')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
        }
        
        // Sanitize folder name (matching upload pattern exactly)
        const sanitizedRoomName = roomName
          .replace(/[<>:\"\/\\|?*]/g, ' ') // replace invalid chars with space (same as upload)
          .replace(/\s+/g, ' ')            // collapse multiple spaces
          .replace(/\.$/, '')              // remove trailing period
          .trim()
        
        const projectFolder = existingAsset.renderingVersion.room.project.dropboxFolder
        const version = existingAsset.renderingVersion.version
        
        // Construct the Dropbox file path (note: folder is "3- RENDERING" with space after dash)
        const dropboxFilePath = `${projectFolder}/3- RENDERING/${sanitizedRoomName}/${version}/${existingAsset.filename}`
        
        await dropboxService.deleteFile(dropboxFilePath)
        console.log(`✅ File deleted from Dropbox: ${dropboxFilePath}`)
      } catch (dropboxError) {
        console.error('❌ Failed to delete from Dropbox:', dropboxError)
        // Continue with database deletion even if Dropbox deletion fails
      }
    }
    
    // Also try to delete using the asset's stored URL path if it's a Dropbox asset
    if (existingAsset.provider === 'dropbox' && existingAsset.url && existingAsset.url.startsWith('/')) {
      try {
        await dropboxService.deleteFile(existingAsset.url)
        console.log(`✅ File deleted from Dropbox using stored URL: ${existingAsset.url}`)
      } catch (dropboxError) {
        console.error('⚠️ Failed to delete from Dropbox using stored URL:', dropboxError)
        // Continue with database deletion even if Dropbox deletion fails
      }
    }

    // Delete file from storage provider (files are stored in database as base64, so just delete local files if any)
    if (existingAsset.provider === 'local' && existingAsset.metadata) {
      try {
        const metadata = JSON.parse(existingAsset.metadata)
        if (metadata.localPath) {
          await unlink(metadata.localPath)
        }
      } catch (error) {
        console.error('Failed to delete local file:', error)
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete the asset from database
    await prisma.asset.delete({
      where: { id: resolvedParams.assetId }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting asset:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}