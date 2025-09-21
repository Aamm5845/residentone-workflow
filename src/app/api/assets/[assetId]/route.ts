import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import type { Session } from 'next-auth'

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
      }
    })

    if (!existingAsset) {
      return NextResponse.json({ error: 'Asset not found or unauthorized' }, { status: 404 })
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